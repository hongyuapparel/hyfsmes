const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const OLD_ASSET_BASE_URL = 'http://47.112.218.75';
const SAMPLE_DIR = path.resolve(__dirname, '..', '..', 'docs', 'migration-samples', 'AL50');
const LOCAL_UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads', 'migration-old');

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

function readTsvLines(filename) {
  return fs
    .readFileSync(path.join(SAMPLE_DIR, filename), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ''))
    .filter(Boolean);
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
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function toAbsoluteImageUrl(value) {
  const text = toNullableString(value);
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith('/')) return `${OLD_ASSET_BASE_URL}${text}`;
  return `${OLD_ASSET_BASE_URL}/${text}`;
}

function resolveImportImageUrl(value) {
  const text = toNullableString(value);
  if (!text) return '';

  const filename = path.basename(text);
  if (!filename) return '';

  const localMirrorPath = path.join(LOCAL_UPLOADS_DIR, filename);
  if (fs.existsSync(localMirrorPath)) {
    return `/api/uploads/migration-old/${filename}`;
  }

  return '';
}

function parseOrderRow(line) {
  const cols = line.split('\t');
  return {
    orderId: Number(cols[0]),
    orderNo: cols[1] ?? '',
    skuId: Number(cols[2]),
    skuNo: cols[3] ?? '',
    designNo: cols[4] ?? '',
    customerId: toNumber(cols[5]),
    customerName: cols[6] ?? '',
    orderTypeText: cols[7] ?? '',
    orderNum: toNumber(cols[8]) ?? 0,
    orderPrice: toNumber(cols[9]) ?? 0,
    factoryPrice: toNumber(cols[10]) ?? 0,
    processStr: toNullableString(cols[11]),
    skuImage: cols[12] ?? '',
    orderUserId: toNumber(cols[13]),
    orderUserName: toNullableString(cols[14]),
    checkUserId: toNumber(cols[15]),
    checkUserName: toNullableString(cols[16]),
    createTime: toNullableString(cols[17]),
    orderTime: toNullableString(cols[18]),
    ourDeliveryDate: toNullableString(cols[19]),
    expectDeliveryDate: toNullableString(cols[20]),
    orderDeliveryDate: toNullableString(cols[21]),
    shipmentTime: toNullableString(cols[22]),
    orderStatus: toNullableString(cols[23]),
  };
}

function parseSkuRow(line) {
  const cols = line.split('\t');
  return {
    skuId: Number(cols[0]),
    skuNo: cols[1] ?? '',
    designNo: cols[2] ?? '',
    skuImage: cols[3] ?? '',
    customerId: toNumber(cols[4]),
    customerName: cols[5] ?? '',
    salesmanUserId: toNumber(cols[6]),
    skuPrice: toNumber(cols[7]),
    productionPrice: toNumber(cols[8]),
    createTime: toNullableString(cols[9]),
  };
}

function parseWorkProcessRows(lines) {
  return lines.map((line) => {
    const cols = line.split('\t');
    return {
      skuId: Number(cols[0]),
      productionClass: toNumber(cols[1]) ?? 0,
      groupId: toNumber(cols[2]) ?? 0,
      processesId: toNumber(cols[3]) ?? 0,
      processName: cols[4] ?? '',
      workPrice: toNumber(cols[5]) ?? 0,
      sort: toNumber(cols[6]) ?? 0,
    };
  });
}

function parseSkuProcessRows(lines) {
  return lines.map((line) => {
    const cols = line.split('\t');
    return {
      processId: toNumber(cols[0]),
      skuId: toNumber(cols[1]),
      skuNo: cols[2] ?? '',
      processName: cols[3] ?? '',
      materialsId: toNumber(cols[4]),
      processClass: cols[5] ?? '',
      materialsName: toNullableString(cols[6]),
      contactAddress: toNullableString(cols[7]),
      contactPhone: toNullableString(cols[8]),
      processUnit: toNullableString(cols[9]),
      supplierName: toNullableString(cols[10]),
      unitPrice: toNumber(cols[11]) ?? 0,
      processPrice: toNumber(cols[12]) ?? 0,
      unitConsumption: toNumber(cols[13]) ?? 0,
      optUserId: toNumber(cols[14]),
      optUserName: toNullableString(cols[15]),
      optTime: toNullableString(cols[16]),
      processRemark: toNullableString(cols[17]),
      supplierId: toNumber(cols[18]),
    };
  });
}

function parseMaterialRows(lines) {
  return lines.map((line) => {
    const cols = line.split('\t');
    return {
      detailId: toNumber(cols[0]),
      orderId: toNumber(cols[1]),
      categoryId: toNumber(cols[2]),
      title: toNullableString(cols[3]) ?? '',
      unitPrice: toNumber(cols[6]) ?? 0,
    };
  });
}

function mapOldStatusToNewStatus(oldStatus) {
  const normalized = String(oldStatus ?? '').trim();
  if (normalized === '100') return 'completed';
  if (normalized === '0') return 'draft';
  return 'draft';
}

function inferDepartment(productionClass) {
  if (productionClass === 1) return '裁床';
  if (productionClass === 3) return '尾部';
  return '车缝';
}

async function main() {
  const backendDir = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(backendDir, '.env'));

  const orderRow = parseOrderRow(readTsvLines('01_order.tsv')[0]);
  const skuRow = parseSkuRow(readTsvLines('02_sku.tsv')[0]);
  const workProcessRows = parseWorkProcessRows(readTsvLines('03_sku_work_processes.tsv'));
  const skuProcessRows = parseSkuProcessRows(readTsvLines('04_sku_process.tsv'));
  const latestMaterialRows = parseMaterialRows(readTsvLines('05_sku_cost_detail_latest_22398.tsv'));
  const latestCategoryId = latestMaterialRows[0]?.categoryId ?? null;

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306', 10),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'erp',
    charset: 'utf8mb4',
  });

  try {
    await conn.beginTransaction();

    const [optionRows] = await conn.query(
      "SELECT id, option_type, value FROM system_options WHERE option_type = 'order_types'",
    );

    const orderTypeByValue = new Map();
    for (const row of optionRows) {
      if (row.option_type === 'order_types') orderTypeByValue.set(row.value, row.id);
    }

    const oldImageUrl = toAbsoluteImageUrl(orderRow.skuImage || skuRow.skuImage);
    const importImageUrl = resolveImportImageUrl(orderRow.skuImage || skuRow.skuImage);
    const resolvedOrderTypeId =
      orderTypeByValue.get(orderRow.orderTypeText) ??
      (orderRow.orderTypeText === '样板' ? orderTypeByValue.get('样品') ?? null : null);

    const resolvedStatus = mapOldStatusToNewStatus(orderRow.orderStatus);
    const resolvedStatusTime =
      orderRow.shipmentTime ||
      orderRow.orderDeliveryDate ||
      orderRow.ourDeliveryDate ||
      orderRow.expectDeliveryDate ||
      orderRow.orderTime ||
      orderRow.createTime ||
      null;

    const processItemsForExt = skuProcessRows.map((row) => {
      const detailBits = [];
      if (row.processClass) detailBits.push(`类别:${row.processClass}`);
      if (row.processUnit) detailBits.push(`单位:${row.processUnit}`);
      if (row.unitPrice != null) detailBits.push(`单价:${row.unitPrice}`);
      if (row.processPrice != null) detailBits.push(`金额:${row.processPrice}`);
      if (row.processRemark) detailBits.push(row.processRemark);
      return {
        processName: row.processName || '',
        supplierName: row.supplierName || '',
        part: row.materialsName || row.processClass || '',
        remark: detailBits.join('；'),
      };
    });

    const processItemSummary = orderRow.processStr
      ? orderRow.processStr
      : Array.from(new Set(skuProcessRows.map((row) => row.processName).filter(Boolean))).join(' / ');

    const snapshot = {
      materialRows: [],
      processItemRows: skuProcessRows.map((row) => ({
        processName: row.processName || '',
        supplierName: row.supplierName || '',
        part: row.materialsName || row.processClass || '',
        remark: row.processRemark || '',
        unitPrice: Number(row.unitPrice) || 0,
        quantity: orderRow.orderNum,
      })),
      productionRows: workProcessRows.map((row) => ({
        processId: null,
        department: inferDepartment(row.productionClass),
        jobType: row.groupId ? `旧分组${row.groupId}` : '',
        processName: row.processName || '',
        remark: row.sort ? `旧排序=${row.sort}` : '',
        unitPrice: Number(row.workPrice) || 0,
      })),
      profitMargin: 0.1,
      sourceMeta: {
        oldDb: 'hyfsmes',
        oldOrderId: orderRow.orderId,
        oldSkuId: orderRow.skuId,
        oldImageUrl,
        latestMaterialCategoryId: latestCategoryId,
        note: 'AL50 current sample lacks trusted order-level materials, size sheet, and production requirement source exports.',
      },
    };

    await conn.execute(
      `
      INSERT INTO products
        (product_name, sku_code, image_url, product_group_id, applicable_people_id, customer_id, salesperson, created_at, updated_at)
      VALUES
        (?, ?, ?, NULL, NULL, NULL, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        product_name = VALUES(product_name),
        image_url = VALUES(image_url),
        salesperson = VALUES(salesperson),
        updated_at = NOW()
      `,
      [
        skuRow.designNo || skuRow.skuNo || orderRow.designNo || orderRow.skuNo,
        skuRow.skuNo || orderRow.skuNo,
        importImageUrl,
        '',
        skuRow.createTime || orderRow.createTime || new Date(),
      ],
    );

    await conn.execute(
      `
      INSERT INTO orders
        (
          order_no, sku_code, customer_id, customer_name, salesperson, merchandiser,
          quantity, ex_factory_price, sale_price, collaboration_type_id, order_type_id,
          process_item, status, status_time, order_date, customer_due_date, factory_name,
          image_url, created_at, updated_at
        )
      VALUES
        (?, ?, NULL, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        sku_code = VALUES(sku_code),
        customer_name = VALUES(customer_name),
        salesperson = VALUES(salesperson),
        merchandiser = VALUES(merchandiser),
        quantity = VALUES(quantity),
        ex_factory_price = VALUES(ex_factory_price),
        sale_price = VALUES(sale_price),
        order_type_id = VALUES(order_type_id),
        process_item = VALUES(process_item),
        status = VALUES(status),
        status_time = VALUES(status_time),
        order_date = VALUES(order_date),
        customer_due_date = VALUES(customer_due_date),
        image_url = VALUES(image_url),
        updated_at = NOW()
      `,
      [
        orderRow.orderNo,
        orderRow.skuNo,
        orderRow.customerName || '',
        orderRow.checkUserName || '',
        orderRow.orderUserName || '',
        orderRow.orderNum || 0,
        orderRow.factoryPrice || 0,
        orderRow.orderPrice || 0,
        resolvedOrderTypeId,
        processItemSummary || '',
        resolvedStatus,
        resolvedStatusTime,
        orderRow.orderTime || orderRow.createTime || null,
        orderRow.ourDeliveryDate || orderRow.expectDeliveryDate || orderRow.orderDeliveryDate || null,
        '',
        importImageUrl,
        orderRow.createTime || new Date(),
      ],
    );

    const [orderRows] = await conn.execute('SELECT id FROM orders WHERE order_no = ? LIMIT 1', [orderRow.orderNo]);
    const orderId = orderRows[0]?.id;
    if (!orderId) throw new Error('Failed to resolve AL50 order id');

    await conn.execute(
      `
      INSERT INTO order_ext
        (
          order_id, materials, color_size_headers, color_size_rows, size_info_meta_headers,
          size_info_rows, process_items, production_requirement, packaging_headers,
          packaging_cells, packaging_method, attachments
        )
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        materials = VALUES(materials),
        color_size_headers = VALUES(color_size_headers),
        color_size_rows = VALUES(color_size_rows),
        size_info_meta_headers = VALUES(size_info_meta_headers),
        size_info_rows = VALUES(size_info_rows),
        process_items = VALUES(process_items),
        production_requirement = VALUES(production_requirement),
        packaging_headers = VALUES(packaging_headers),
        packaging_cells = VALUES(packaging_cells),
        packaging_method = VALUES(packaging_method),
        attachments = VALUES(attachments)
      `,
      [
        orderId,
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify([]),
        JSON.stringify(processItemsForExt),
        '',
        JSON.stringify([]),
        JSON.stringify([]),
        '',
        JSON.stringify([]),
      ],
    );

    await conn.execute(
      `
      INSERT INTO order_cost_snapshots (order_id, snapshot, updated_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        snapshot = VALUES(snapshot),
        updated_at = NOW()
      `,
      [orderId, JSON.stringify(snapshot)],
    );

    await conn.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          orderId,
          orderNo: orderRow.orderNo,
          status: resolvedStatus,
          orderTypeId: resolvedOrderTypeId,
          imageUrl: importImageUrl,
          oldImageUrl,
          materials: 0,
          processItems: processItemsForExt.length,
          productionRows: snapshot.productionRows.length,
          latestMaterialCategoryId: latestCategoryId,
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
