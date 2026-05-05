#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * 一次性脚本：修正历史成品库存的 color_size_snapshot
 * ============================================================
 *
 * 背景：
 *   旧版 buildOrderColorSizeSnapshot 在「待仓处理 → 成品库存」反推尺码时
 *   按订单计划比例分配，导致与实际生产/入库尺码不符（订单 XXL 计划 25 件
 *   实际入库 55 件 → 旧反推为 27 件，缺 28 件）。
 *
 * 本脚本：
 *   遍历所有 finished_goods_stock 记录，按以下优先级重新计算并写入正确的
 *   color_size_snapshot：
 *     1) order_finishing.tail_inbound_qty_row（尾部实际入库尺码，单色订单）
 *     2) order_cutting.actual_cut_rows（裁床实际尺码）
 *     3) order_ext.color_size_rows（订单计划，原行为）
 *   随后扣减已发生的出库（finished_goods_outbound.size_breakdown）得到当前
 *   应有的剩余尺码分布。
 *
 * 安全保护：
 *   - 默认 DRY-RUN：仅打印将会修改的记录，不写库
 *   - 加 --apply 才真正写入；写入用单事务，可整体回滚
 *   - 自动备份原 color_size_snapshot 到 finished_goods_stock_snapshot_backup_<timestamp> 表
 *   - 校验：corrected sum 必须等于 stock.quantity，否则跳过该行（不写错误数据）
 *
 * 使用方法（在 backend 目录执行，依赖与 backend 共用）：
 *   预览：           node scripts/fix-finished-stock-snapshots.js
 *   仅看某条记录：    node scripts/fix-finished-stock-snapshots.js --id=123
 *   实际写入：        node scripts/fix-finished-stock-snapshots.js --apply
 *
 * 环境变量（与 backend/.env 一致）：
 *   MYSQL_HOST / MYSQL_PORT / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE
 */

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

/* ------------------------------ 工具函数 ------------------------------ */

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  });
}

function parseArgs() {
  const args = { dryRun: true, idFilter: null };
  process.argv.slice(2).forEach((arg) => {
    if (arg === '--apply') args.dryRun = false;
    else if (arg.startsWith('--id=')) args.idFilter = Number(arg.slice(5));
  });
  return args;
}

/** 与后端 normalizeSizeHeader 等价：去空白、转大写、Unicode 规范化 */
function normalizeSizeHeader(s) {
  return String(s ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

function safeInt(v) { return Math.max(0, Math.trunc(Number(v) || 0)); }

function parseJSON(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * 按权重分配总量到各位置，与后端 allocateByWeight 等价。
 * 用最大余数法保证 sum(allocated) == total。
 */
function allocateByWeight(weights, total) {
  const safeTotal = safeInt(total);
  if (!weights.length) return [];
  const sumWeight = weights.reduce((s, w) => s + Math.max(0, Number(w) || 0), 0);
  if (safeTotal <= 0) return weights.map(() => 0);
  if (sumWeight <= 0) {
    const arr = weights.map(() => 0);
    arr[0] = safeTotal;
    return arr;
  }
  const exact = weights.map((w) => (Math.max(0, Number(w) || 0) * safeTotal) / sumWeight);
  const base = exact.map((v) => Math.floor(v));
  let remain = safeTotal - base.reduce((s, n) => s + n, 0);
  const order = exact
    .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  let i = 0;
  while (remain > 0 && order.length > 0) {
    base[order[i % order.length].idx] += 1;
    remain -= 1;
    i += 1;
  }
  return base;
}

/** 把 source 的 (color, size) 矩阵按 target headers 缩放为目标总数 */
function scaleColorSizeRowsToQuantity(headers, rows, targetQty) {
  if (!headers.length || !rows.length) return [];
  const safeTarget = safeInt(targetQty);
  const weights = [];
  rows.forEach((row) => {
    for (let i = 0; i < headers.length; i += 1) {
      weights.push(Math.max(0, Number(row.quantities?.[i]) || 0));
    }
  });
  const weightSum = weights.reduce((s, n) => s + n, 0);
  if (weightSum <= 0) {
    return rows.map((row) => ({
      colorName: String(row.colorName ?? '').trim(),
      quantities: Array(headers.length).fill(0),
    }));
  }
  const allocated = weightSum === safeTarget ? [...weights] : allocateByWeight(weights, safeTarget);
  let cursor = 0;
  return rows.map((row) => {
    const quantities = [];
    for (let i = 0; i < headers.length; i += 1) {
      quantities.push(allocated[cursor] ?? 0);
      cursor += 1;
    }
    return { colorName: String(row.colorName ?? '').trim(), quantities };
  });
}

/** 把出库 sizeBreakdown 累加到 (color, size) 减量映射 */
function accumulateOutbound(headers, breakdown, decMap) {
  const headerMap = new Map(headers.map((h, i) => [normalizeSizeHeader(h), i]));
  const ob = parseJSON(breakdown);
  if (!ob || !Array.isArray(ob.headers) || !Array.isArray(ob.rows)) return;
  const obHeaderToTarget = ob.headers.map((h) => headerMap.get(normalizeSizeHeader(h)));
  for (const row of ob.rows) {
    if (!row || typeof row !== 'object') continue;
    const colorName = String(row.colorName ?? '').trim();
    const values = Array.isArray(row.quantities)
      ? row.quantities
      : Array.isArray(row.values) ? row.values : [];
    const arr = decMap.get(colorName) || Array(headers.length).fill(0);
    for (let i = 0; i < values.length; i += 1) {
      const targetIdx = obHeaderToTarget[i];
      if (targetIdx == null) continue;
      arr[targetIdx] += safeInt(values[i]);
    }
    decMap.set(colorName, arr);
  }
}

/* ------------------------------ 主流程 ------------------------------ */

async function main() {
  loadEnv();
  const args = parseArgs();

  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'erp',
    multipleStatements: false,
  });

  const mode = args.dryRun ? 'DRY-RUN（预览模式，不写库）' : 'APPLY（实际写入）';
  console.log(`\n=== finished_goods_stock.color_size_snapshot 修复脚本 ===`);
  console.log(`模式: ${mode}`);
  if (args.idFilter) console.log(`仅检查 stock.id = ${args.idFilter}`);
  console.log('');

  /** 备份表（仅 apply 模式下创建） */
  let backupTable = null;
  if (!args.dryRun) {
    const ts = new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15);
    backupTable = `finished_goods_stock_snapshot_backup_${ts}`;
    await conn.query(`CREATE TABLE \`${backupTable}\` (
      id INT PRIMARY KEY,
      order_id INT NULL,
      sku_code VARCHAR(64) NULL,
      quantity INT NULL,
      old_snapshot JSON NULL,
      backed_up_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log(`已创建备份表: ${backupTable}\n`);
  }

  /** 1. 读所有 finished_goods_stock（带 order_id 才能反推） */
  const stockSql = args.idFilter
    ? `SELECT id, order_id, sku_code, quantity, color_size_snapshot FROM finished_goods_stock WHERE id = ${Number(args.idFilter)}`
    : `SELECT id, order_id, sku_code, quantity, color_size_snapshot FROM finished_goods_stock WHERE order_id IS NOT NULL ORDER BY id`;
  const [stocks] = await conn.query(stockSql);

  let scanned = 0, ok = 0, skipped = 0, fixed = 0;
  const skipReasons = {};
  const fixedSamples = [];

  await conn.beginTransaction();
  try {
    for (const stock of stocks) {
      scanned += 1;
      const result = await processStock(conn, stock);
      if (result.status === 'ok-already-correct') ok += 1;
      else if (result.status === 'fixed') {
        fixed += 1;
        if (fixedSamples.length < 5) fixedSamples.push(result);
        if (!args.dryRun) {
          // 备份 + 写入
          await conn.query(
            `INSERT INTO \`${backupTable}\` (id, order_id, sku_code, quantity, old_snapshot) VALUES (?, ?, ?, ?, ?)`,
            [stock.id, stock.order_id, stock.sku_code, stock.quantity, stock.color_size_snapshot ?? null],
          );
          await conn.query(
            `UPDATE finished_goods_stock SET color_size_snapshot = ? WHERE id = ?`,
            [JSON.stringify(result.correctedSnapshot), stock.id],
          );
        }
      } else {
        skipped += 1;
        skipReasons[result.reason] = (skipReasons[result.reason] || 0) + 1;
      }
    }
    if (!args.dryRun) await conn.commit();
    else await conn.rollback();
  } catch (err) {
    await conn.rollback();
    console.error('\n[ERROR] 事务失败，已回滚:', err);
    throw err;
  }

  /* 报告 */
  console.log(`\n=== 扫描报告 ===`);
  console.log(`总扫描: ${scanned}`);
  console.log(`已正确: ${ok}`);
  console.log(`需修复: ${fixed}`);
  console.log(`已跳过: ${skipped}`);
  if (Object.keys(skipReasons).length) {
    console.log(`\n跳过原因分布:`);
    Object.entries(skipReasons).forEach(([k, v]) => console.log(`  - ${k}: ${v}`));
  }
  if (fixedSamples.length) {
    console.log(`\n修复示例（前 ${fixedSamples.length} 条）:`);
    fixedSamples.forEach((s) => {
      console.log(`  stock#${s.id} order=${s.orderId} sku=${s.skuCode} qty=${s.quantity} src=${s.source}`);
      console.log(`    旧: ${JSON.stringify(s.oldSnapshotShort)}`);
      console.log(`    新: ${JSON.stringify(s.newSnapshotShort)}`);
    });
  }
  if (args.dryRun) {
    console.log(`\n这是 DRY-RUN 预览，未写入。`);
    console.log(`确认无误后加 --apply 真正写入：node scripts/fix-finished-stock-snapshots.js --apply`);
  } else {
    console.log(`\n已写入 ${fixed} 条记录。`);
    console.log(`备份表: ${backupTable}（如需回滚，可从该表恢复 color_size_snapshot）`);
  }

  await conn.end();
}

/**
 * 处理单条 stock：
 *   - 取 source 尺码（tail / cutting / plan，按优先级）
 *   - 减出库
 *   - 校验合计 = stock.quantity
 *   - 与现有 snapshot 比对，决定是否需要修复
 */
async function processStock(conn, stock) {
  // 读 order_ext（headers + plan）
  const [extRows] = await conn.query(
    `SELECT color_size_headers, color_size_rows FROM order_ext WHERE order_id = ? LIMIT 1`,
    [stock.order_id],
  );
  const ext = extRows[0];
  const planHeadersRaw = parseJSON(ext?.color_size_headers) || [];
  const headers = planHeadersRaw.map(normalizeSizeHeader).filter((h) => h);
  if (!headers.length) return { status: 'skipped', reason: 'order_ext 缺 headers' };
  const planRows = parseJSON(ext?.color_size_rows) || [];

  // 读 order_finishing.tail_inbound_qty_row
  const [finRows] = await conn.query(
    `SELECT tail_inbound_qty_row FROM order_finishing WHERE order_id = ? LIMIT 1`,
    [stock.order_id],
  );
  const tailRowRaw = finRows[0]?.tail_inbound_qty_row;
  const tailRow = parseJSON(tailRowRaw);
  let tailSizes = null;
  if (Array.isArray(tailRow)) {
    if (tailRow.length === headers.length + 1) tailSizes = tailRow.slice(0, headers.length).map(safeInt);
    else if (tailRow.length === headers.length) tailSizes = tailRow.map(safeInt);
    if (tailSizes && !tailSizes.some((v) => v > 0)) tailSizes = null;
  }

  // 读 order_cutting.actual_cut_rows
  const [cutRows] = await conn.query(
    `SELECT actual_cut_rows FROM order_cutting WHERE order_id = ? LIMIT 1`,
    [stock.order_id],
  );
  const cuttingRows = parseJSON(cutRows[0]?.actual_cut_rows) || [];
  const hasCuttingQty = cuttingRows.some((r) =>
    Array.isArray(r?.quantities) && r.quantities.some((q) => safeInt(q) > 0),
  );

  // 现有 snapshot
  const currentSnapshot = parseJSON(stock.color_size_snapshot);
  const currentTotal = currentSnapshot?.rows?.reduce(
    (s, r) => s + (Array.isArray(r?.quantities) ? r.quantities.reduce((ss, q) => ss + safeInt(q), 0) : 0),
    0,
  ) ?? 0;

  // 选取数据源生成 inbound（按 stock.quantity + 出库总和 还原 inbound 总数）
  const [outboundRows] = await conn.query(
    `SELECT size_breakdown, quantity FROM finished_goods_outbound WHERE finished_stock_id = ?`,
    [stock.id],
  );
  const outboundTotal = outboundRows.reduce((s, r) => s + safeInt(r.quantity), 0);
  const inboundTotal = safeInt(stock.quantity) + outboundTotal;
  if (inboundTotal <= 0) return { status: 'skipped', reason: 'inbound total = 0' };

  // 选 source 生成 inbound 阶段的 (color, size) 分布
  let sourceRows = null, source = '';
  if (planRows.length === 1 && tailSizes) {
    const colorName = String(planRows[0]?.colorName ?? '').trim();
    sourceRows = scaleColorSizeRowsToQuantity(headers, [{ colorName, quantities: tailSizes }], inboundTotal);
    source = 'tail_inbound_qty_row';
  } else if (hasCuttingQty) {
    sourceRows = scaleColorSizeRowsToQuantity(
      headers,
      cuttingRows.map((row) => ({
        colorName: row?.colorName,
        quantities: Array.isArray(row?.quantities) ? row.quantities : [],
      })),
      inboundTotal,
    );
    source = 'order_cutting';
  } else if (planRows.length) {
    sourceRows = scaleColorSizeRowsToQuantity(
      headers,
      planRows.map((row) => ({
        colorName: row?.colorName,
        quantities: Array.isArray(row?.quantities) ? row.quantities : [],
      })),
      inboundTotal,
    );
    source = 'order_ext (订单计划，与旧逻辑一致，跳过)';
    // plan 反推与旧逻辑一致，无修复价值
    return { status: 'skipped', reason: '无更高优先级数据源（仅 order_ext，与旧逻辑同源）' };
  } else {
    return { status: 'skipped', reason: 'no source data' };
  }

  // 减出库（按颜色+尺码）
  const decMap = new Map();
  for (const ob of outboundRows) {
    accumulateOutbound(headers, ob.size_breakdown, decMap);
  }

  // 应用减量
  const correctedRows = sourceRows.map((row) => {
    const dec = decMap.get(row.colorName) || Array(headers.length).fill(0);
    return {
      colorName: row.colorName,
      quantities: row.quantities.map((q, i) => Math.max(0, safeInt(q) - safeInt(dec[i]))),
    };
  });

  // 校验合计
  const correctedTotal = correctedRows.reduce(
    (s, r) => s + r.quantities.reduce((ss, q) => ss + q, 0),
    0,
  );
  if (correctedTotal !== safeInt(stock.quantity)) {
    return {
      status: 'skipped',
      reason: `合计校验失败（corrected=${correctedTotal} ≠ stock.quantity=${stock.quantity}），可能出库未按尺码或数据缺失`,
    };
  }

  const correctedSnapshot = {
    headers,
    rows: correctedRows.filter((r) => r.quantities.some((q) => q > 0)),
  };

  // 与现有 snapshot 比对：完全一致则无需修
  const sameSnapshot = JSON.stringify(currentSnapshot?.rows ?? null) === JSON.stringify(correctedSnapshot.rows);
  const sameHeaders = JSON.stringify(currentSnapshot?.headers ?? null) === JSON.stringify(correctedSnapshot.headers);
  if (sameSnapshot && sameHeaders && currentTotal === safeInt(stock.quantity)) {
    return { status: 'ok-already-correct' };
  }

  return {
    status: 'fixed',
    id: stock.id,
    orderId: stock.order_id,
    skuCode: stock.sku_code,
    quantity: stock.quantity,
    source,
    correctedSnapshot,
    oldSnapshotShort: currentSnapshot
      ? { headers: currentSnapshot.headers, rows: currentSnapshot.rows?.slice(0, 3) }
      : null,
    newSnapshotShort: { headers: correctedSnapshot.headers, rows: correctedSnapshot.rows.slice(0, 3) },
  };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
