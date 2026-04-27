const mysql = require('mysql2/promise');

function parseJsonSafe(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  }
  return null;
}

function matchConditions(conditions, order) {
  if (!conditions || typeof conditions !== 'object') return { ok: true, score: 0 };
  let score = 0;
  if (Array.isArray(conditions.orderTypeIds) && conditions.orderTypeIds.length > 0) {
    if (order.orderTypeId == null || !conditions.orderTypeIds.includes(order.orderTypeId)) return { ok: false, score: 0 };
    score += 1;
  }
  if (Array.isArray(conditions.collaborationTypeIds) && conditions.collaborationTypeIds.length > 0) {
    if (order.collaborationTypeId == null || !conditions.collaborationTypeIds.includes(order.collaborationTypeId)) return { ok: false, score: 0 };
    score += 1;
  }
  if (conditions.hasProcessItem !== undefined) {
    const has = !!(order.processItem && String(order.processItem).trim());
    if (has !== conditions.hasProcessItem) return { ok: false, score: 0 };
    score += 1;
  }
  return { ok: true, score };
}

function pickRule(rules, order) {
  const candidates = [];
  for (const r of rules) {
    if (String(r.fromStatus || '') !== String(order.status || '')) continue;
    const m = matchConditions(r.conditionsJson, order);
    if (!m.ok) continue;
    candidates.push({ r, score: m.score });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aHasChain = a.r.chainId != null ? 1 : 0;
    const bHasChain = b.r.chainId != null ? 1 : 0;
    if (bHasChain !== aHasChain) return bHasChain - aHasChain;
    return Number(b.r.id) - Number(a.r.id);
  });
  return candidates[0].r;
}

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'qiyafang1993',
    database: 'erp',
  });

  const [ruleRows] = await conn.query(
    "SELECT id, chain_id AS chainId, from_status AS fromStatus, to_status AS toStatus, conditions_json AS conditionsJson FROM order_status_transitions WHERE trigger_code='craft_completed' AND enabled=1",
  );
  const rules = (ruleRows || []).map((r) => ({
    ...r,
    conditionsJson: parseJsonSafe(r.conditionsJson),
  }));
  if (!rules.length) {
    console.log('未找到 craft_completed 启用规则，退出。');
    await conn.end();
    return;
  }

  const [rows] = await conn.query(
    "SELECT o.id,o.order_no AS orderNo,o.status,o.order_type_id AS orderTypeId,o.collaboration_type_id AS collaborationTypeId,o.process_item AS processItem,c.completed_at AS completedAt FROM orders o INNER JOIN order_craft c ON c.order_id=o.id WHERE c.status='completed'",
  );

  let updated = 0;
  for (const row of rows || []) {
    const rule = pickRule(rules, row);
    if (!rule) continue;
    if (String(rule.toStatus || '') === String(row.status || '')) continue;
    await conn.query('UPDATE orders SET status=?, status_time=? WHERE id=?', [
      rule.toStatus,
      row.completedAt || new Date(),
      row.id,
    ]);
    updated += 1;
    console.log(`已回填: order=${row.orderNo} from=${row.status} to=${rule.toStatus} ruleId=${rule.id}`);
  }

  console.log(`回填完成，共更新 ${updated} 条。`);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

