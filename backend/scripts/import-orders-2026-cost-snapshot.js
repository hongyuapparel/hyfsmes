const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnv(envPath) {
  const env = {};
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!/^[A-Z0-9_]+=/.test(line)) continue;
    const idx = line.indexOf('=');
    env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
}

function parseArgs(argv) {
  const args = { sampleDir: '', dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--sample-dir') {
      args.sampleDir = argv[i + 1] || '';
      i += 1;
    }
  }
  return args;
}

function toNullableString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text.toUpperCase() === 'NULL') return null;
  return text;
}

function toNumber(value) {
  const text = toNullableString(value);
  if (text == null) return null;
  const normalized = text.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parsePercent(value) {
  const text = toNullableString(value);
  if (!text) return null;
  const m = text.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeProcessNameForMatch(value) {
  return normalizeText(value)
    // 兼容旧系统末尾标记：如 "（新"、"（改"、"(新)"、"(改)"
    .replace(/[（(]\s*(新|改)\s*[）)]?$/g, '')
    // 兼容工序步骤计数：如 "*1"、"*2"
    .replace(/\*\d+/g, '')
    // 去除符号，保留中英文与数字
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function appendIndex(map, key, value) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function pickStable(list) {
  if (!Array.isArray(list) || !list.length) return null;
  return list
    .slice()
    .sort((a, b) => (Number(a?.id) || 0) - (Number(b?.id) || 0))[0];
}

function normalizeProfitMargin(v) {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0) return 0.1;
  if (Math.abs(n - 0.15) < 1e-9) return 0.1;
  return n;
}

function calcExFactoryPrice(snapshot) {
  const materialRows = Array.isArray(snapshot?.materialRows) ? snapshot.materialRows : [];
  const processItemRows = Array.isArray(snapshot?.processItemRows) ? snapshot.processItemRows : [];
  const productionRows = Array.isArray(snapshot?.productionRows) ? snapshot.productionRows : [];

  const materialTotal = materialRows.reduce((sum, row) => {
    const usage = Number(row?.usagePerPiece) || 0;
    const lossPercent = Number(row?.lossPercent) || 0;
    const price = Number(row?.unitPrice) || 0;
    return sum + usage * (1 + lossPercent / 100) * price;
  }, 0);

  const processItemTotal = processItemRows.reduce((sum, row) => {
    const qty = Number(row?.quantity) || 0;
    const price = Number(row?.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const productionTotal = productionRows.reduce((sum, row) => sum + (Number(row?.unitPrice) || 0), 0);
  const totalCost = materialTotal + processItemTotal + productionTotal;
  const margin = Number(snapshot?.profitMargin) || 0;
  const exFactory = margin >= 1 ? totalCost : totalCost / (1 - margin);
  return Number.isFinite(exFactory) ? Number(exFactory.toFixed(2)) : 0;
}

function readTsvLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ''))
    .filter(Boolean);
}

function groupBySku(rows) {
  const bySku = new Map();
  for (const row of rows) {
    const key = String(row.skuNo || '').trim();
    if (!key) continue;
    if (!bySku.has(key)) bySku.set(key, []);
    bySku.get(key).push(row);
  }
  return bySku;
}

function resolveMaterialTypeId(raw, materialTypeIdByValue) {
  const text = String(raw || '').trim();
  if (!text) return null;
  if (materialTypeIdByValue.has(text)) return materialTypeIdByValue.get(text);
  for (const [name, id] of materialTypeIdByValue.entries()) {
    if (text.includes(name) || name.includes(text)) return id;
  }
  return null;
}

function inferDepartment(productionClass) {
  const n = Number(productionClass) || 0;
  if (n === 1) return '裁床';
  if (n === 2) return '车缝';
  if (n === 3) return '尾部';
  return '车缝';
}

async function main() {
  const args = parseArgs(process.argv);
  const backendDir = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(backendDir, '.env'));

  const sampleDir = args.sampleDir
    ? path.resolve(backendDir, args.sampleDir)
    : path.resolve(backendDir, '..', 'docs', 'migration-samples', 'orders-2026');
  const ordersFile = path.join(sampleDir, '01_orders_2026.tsv');
  const skuMaterialsFile = path.join(sampleDir, '08_sku_materials_2026.tsv');
  const skuProcessFile = path.join(sampleDir, '09_sku_process_2026.tsv');
  const skuWorkProcessesFile = path.join(sampleDir, '10_sku_work_processes_2026.tsv');
  const requiredFiles = [ordersFile, skuMaterialsFile, skuProcessFile, skuWorkProcessesFile];
  for (const filePath of requiredFiles) {
    if (!fs.existsSync(filePath)) throw new Error(`缺少文件: ${filePath}`);
  }

  const orderRows = readTsvLines(ordersFile).map((line) => line.split('\t')).map((cols) => ({
    orderNo: toNullableString(cols[1]) || '',
    skuNo: toNullableString(cols[2]) || '',
  }));
  const sourceOrderByNo = new Map(
    orderRows
      .filter((x) => x.orderNo && x.skuNo)
      .map((x) => [x.orderNo, x]),
  );
  const orderNos = Array.from(sourceOrderByNo.keys());
  if (!orderNos.length) throw new Error('01_orders_2026.tsv 未解析到有效订单号');

  // 所有 TSV 文件均由 mysql -N -B 导出（无表头），直接按位置解析
  const parseTsvRows = (filePath, parseRow) => {
    const lines = readTsvLines(filePath);
    if (!lines.length) return [];
    return lines.map((line) => parseRow(line.split('\t'))).filter(Boolean);
  };

  // 08: sku_id(0) sku_no(1) materials_category(2) supplier_name(3) materials_name(4)
  //     materials_color(5) materials_cm(6) materials_single(7) materials_loss(8)
  //     full_price(9) unit_price(10) use_part(11)
  const skuMaterialRows = parseTsvRows(skuMaterialsFile, (cols) => {
    const skuNo = toNullableString(cols[1]);
    const materialName = toNullableString(cols[4]);
    if (!skuNo || !materialName) return null;
    return {
      skuNo,
      materialTypeText: toNullableString(cols[2]) || '',
      supplierName: toNullableString(cols[3]) || '',
      materialName,
      color: toNullableString(cols[5]) || '',
      fabricWidth: toNullableString(cols[6]) || '',
      usagePerPiece: toNumber(cols[7]),
      lossPercent: parsePercent(cols[8]),
      fullPrice: toNumber(cols[9]),
      unitPrice: toNumber(cols[10]),
      usePart: toNullableString(cols[11]) || '',
    };
  });

  // 09: sku_id(0) sku_no(1) process_name(2) supplier_name(3) materials_name(4)
  //     process_remark(5) unit_price(6) unit_consumption(7) process_class(8)
  const skuProcessRows = parseTsvRows(skuProcessFile, (cols) => {
    const skuNo = toNullableString(cols[1]);
    const processName = toNullableString(cols[2]);
    if (!skuNo || !processName) return null;
    return {
      skuNo,
      processName,
      supplierName: toNullableString(cols[3]) || '',
      part: toNullableString(cols[4]) || '',
      remark: toNullableString(cols[5]) || '',
      processClass: toNullableString(cols[8]) || '',
      unitPrice: toNumber(cols[6]) || 0,
      quantity: toNumber(cols[7]) || 1,
    };
  });

  // 10: sku_id(0) sku_no(1) processes_name(2) production_class(3) group_id(4)
  //     work_price(5) sort(6)
  const skuWorkProcessRows = parseTsvRows(skuWorkProcessesFile, (cols) => {
    const skuNo = toNullableString(cols[1]);
    const processName = toNullableString(cols[2]);
    if (!skuNo || !processName) return null;
    return {
      skuNo,
      processName,
      productionClass: toNumber(cols[3]) || 0,
      groupId: toNumber(cols[4]) || 0,
      unitPrice: toNumber(cols[5]) || 0,
    };
  });

  const materialsBySku = groupBySku(skuMaterialRows);
  const processBySku = groupBySku(skuProcessRows);
  const workProcessBySku = groupBySku(skuWorkProcessRows);

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306', 10),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'erp',
    charset: 'utf8mb4',
  });

  try {
    const [materialTypeRows] = await conn.query("SELECT id, value FROM system_options WHERE option_type = 'material_types'");
    const materialTypeIdByValue = new Map(
      (materialTypeRows || [])
        .map((x) => [String(x.value || '').trim(), Number(x.id) || 0])
        .filter((x) => x[0] && x[1] > 0),
    );
    const [productionProcessRows] = await conn.query(
      'SELECT id, name, department, job_type, unit_price FROM production_processes',
    );
    const productionProcessByNameDept = new Map();
    const productionProcessByName = new Map();
    const productionProcessByCanonicalDept = new Map();
    const productionProcessByCanonical = new Map();
    for (const pp of productionProcessRows || []) {
      const nameKey = normalizeText(pp.name);
      const canonicalKey = normalizeProcessNameForMatch(pp.name);
      const deptKey = normalizeText(pp.department || '');
      if (!nameKey) continue;
      appendIndex(productionProcessByName, nameKey, pp);
      appendIndex(productionProcessByNameDept, `${nameKey}|${deptKey}`, pp);
      if (canonicalKey) {
        appendIndex(productionProcessByCanonical, canonicalKey, pp);
        appendIndex(productionProcessByCanonicalDept, `${canonicalKey}|${deptKey}`, pp);
      }
    }

    const placeholders = orderNos.map(() => '?').join(',');
    const [targetOrders] = await conn.query(
      `SELECT id, order_no, sku_code, quantity FROM orders WHERE order_no IN (${placeholders})`,
      orderNos,
    );
    const targetList = (targetOrders || []).map((x) => ({
      id: Number(x.id),
      orderNo: String(x.order_no || '').trim(),
      skuCode: String(x.sku_code || '').trim(),
      quantity: Number(x.quantity) || 0,
    }));
    const targetIds = targetList.map((x) => x.id);
    const existingSnapshotByOrderId = new Map();
    if (targetIds.length) {
      const idPlaceholders = targetIds.map(() => '?').join(',');
      const [existingRows] = await conn.query(
        `SELECT order_id, snapshot FROM order_cost_snapshots WHERE order_id IN (${idPlaceholders})`,
        targetIds,
      );
      for (const row of existingRows || []) {
        existingSnapshotByOrderId.set(Number(row.order_id), row.snapshot);
      }
    }

    const prepared = targetList.map((order) => {
      const source = sourceOrderByNo.get(order.orderNo);
      const skuNo = source?.skuNo || order.skuCode;
      const orderPieces = order.quantity > 0 ? order.quantity : null;

      const materialRows = (materialsBySku.get(skuNo) || []).map((m) => {
        const usagePerPiece = Number(m.usagePerPiece || 0) || null;
        const lossPercent = m.lossPercent != null ? Number(m.lossPercent) : null;
        const lossRate = (Number(lossPercent || 0) || 0) / 100;
        const computedPurchase =
          usagePerPiece != null && orderPieces != null
            ? Number((usagePerPiece * orderPieces * (1 + lossRate)).toFixed(4))
            : null;
        const unitPrice = Number(m.fullPrice || 0) > 0 ? Number(m.fullPrice) : Number(m.unitPrice || 0);
        return {
          materialTypeId: resolveMaterialTypeId(m.materialTypeText, materialTypeIdByValue),
          supplierName: m.supplierName || '',
          materialName: m.materialName || '',
          color: m.color || '',
          fabricWidth: m.fabricWidth || '',
          usagePerPiece,
          lossPercent,
          orderPieces,
          purchaseQuantity: computedPurchase,
          cuttingQuantity: null,
          remark: m.usePart || '',
          unitPrice: Number.isFinite(unitPrice) ? unitPrice : 0,
        };
      });

      const processItemRows = (processBySku.get(skuNo) || []).map((p) => {
        const processClass = String(p.processClass || '').trim();
        const remarkText = String(p.remark || '').trim();
        return {
          processName: p.processName || '',
          supplierName: p.supplierName || '',
          part: p.part || '',
          remark: processClass ? (remarkText ? `${remarkText}（${processClass}）` : `（${processClass}）`) : remarkText,
          unitPrice: Number(p.unitPrice) || 0,
          quantity: Number(p.quantity) > 0 ? Number(p.quantity) : 1,
        };
      });

      const productionRows = (workProcessBySku.get(skuNo) || []).map((w) => {
        const nameKey = normalizeText(w.processName || '');
        const canonicalKey = normalizeProcessNameForMatch(w.processName || '');
        const pClass = Number(w.productionClass) || 0;
        const anyMatch = pickStable(productionProcessByName.get(nameKey));
        const anyCanonicalMatch = pickStable(productionProcessByCanonical.get(canonicalKey));

        let department, matched;
        if (pClass > 0) {
          department = inferDepartment(pClass);
          matched =
            pickStable(productionProcessByNameDept.get(`${nameKey}|${normalizeText(department)}`))
            || pickStable(productionProcessByCanonicalDept.get(`${canonicalKey}|${normalizeText(department)}`))
            || null;
        } else {
          if (anyMatch) {
            department = anyMatch.department || '车缝';
            matched = anyMatch;
          } else if (anyCanonicalMatch) {
            department = anyCanonicalMatch.department || '车缝';
            matched = anyCanonicalMatch;
          } else {
            department = '车缝';
            matched = null;
          }
        }

        return {
          processId: matched?.id ?? null,
          department,
          jobType: matched?.job_type || '',
          processName: w.processName || matched?.name || '',
          unitPrice: Number(w.unitPrice) || 0,
          remark: '',
        };
      });

      const existingRaw = existingSnapshotByOrderId.get(order.id);
      const existing =
        existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw)
          ? existingRaw
          : null;
      const snapshot = {
        materialRows,
        processItemRows,
        productionRows,
        profitMargin: normalizeProfitMargin(existing?.profitMargin),
      };
      return {
        orderId: order.id,
        orderNo: order.orderNo,
        skuNo,
        snapshot,
        exFactoryPrice: calcExFactoryPrice(snapshot),
      };
    });

    if (args.dryRun) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            dryRun: true,
            sampleDir,
            sourceOrderNos: orderNos.length,
            targetOrdersMatched: prepared.length,
            skuMaterialsRows: skuMaterialRows.length,
            skuProcessRows: skuProcessRows.length,
            skuWorkProcessRows: skuWorkProcessRows.length,
            preview: prepared.slice(0, 20).map((x) => ({
              orderNo: x.orderNo,
              skuNo: x.skuNo,
              materialRows: x.snapshot.materialRows.length,
              processItemRows: x.snapshot.processItemRows.length,
              productionRows: x.snapshot.productionRows.length,
              exFactoryPrice: x.exFactoryPrice,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    await conn.beginTransaction();
    let upserted = 0;
    for (const item of prepared) {
      await conn.execute(
        `
        INSERT INTO order_cost_snapshots (order_id, snapshot, updated_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          snapshot = VALUES(snapshot),
          updated_at = NOW()
        `,
        [item.orderId, JSON.stringify(item.snapshot)],
      );
      await conn.execute(
        `
        UPDATE orders
        SET ex_factory_price = ?, updated_at = NOW()
        WHERE id = ?
        `,
        [item.exFactoryPrice, item.orderId],
      );
      upserted += 1;
    }
    await conn.commit();
    console.log(
      JSON.stringify(
        {
          ok: true,
          sampleDir,
          sourceOrderNos: orderNos.length,
          targetOrdersMatched: prepared.length,
          upsertedSnapshots: upserted,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
