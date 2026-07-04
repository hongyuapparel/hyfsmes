/*
  清理复制订单误继承的采购/领料完成字段

  适用问题：
  - 订单从已采购/已领料的旧订单复制为新草稿后，旧物料行里的 purchaseStatus/pickStatus
    与完成时间被带到新订单。
  - 新订单审单进入采购后，采购页把这些旧颜色/旧物料误判为已完成。

  安全判定：
  - 只处理有 copy_to_draft 日志的复制订单；
  - 只处理已经进入过 pending_purchase 的订单；
  - 只处理“物料完成时间 < 本订单到采购时间”的物料行；
  - 跳过到采购后已经人工采购登记或已经进入下游生产登记的订单。

  使用方式：
  1) 先执行“1) 预览候选数据”，确认 order_no / material_index / old_*_completed_at 确实是异常旧时间；
  2) 再执行“2) 执行清理”；
  3) 最后执行“3) 清理后复查”。
*/

/* =========================
   1) 预览候选数据
   ========================= */

DROP TEMPORARY TABLE IF EXISTS tmp_copied_order_material_cleanup_candidates;

CREATE TEMPORARY TABLE tmp_copied_order_material_cleanup_candidates AS
SELECT *
FROM (
  SELECT
    o.id AS order_id,
    o.order_no,
    o.sku_code,
    o.status AS order_status,
    o.status_time,
    lp.pending_purchase_at,
    jt.ord - 1 AS material_index,
    JSON_UNQUOTE(JSON_EXTRACT(jt.item, '$.materialName')) AS material_name,
    JSON_UNQUOTE(JSON_EXTRACT(jt.item, '$.color')) AS material_color,
    LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jt.item, '$.purchaseStatus')), 'pending')) AS purchase_status,
    STR_TO_DATE(
      REPLACE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jt.item, '$.purchaseCompletedAt')), 19), 'T', ' '),
      '%Y-%m-%d %H:%i:%s'
    ) AS purchase_completed_at,
    LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jt.item, '$.pickStatus')), 'pending')) AS pick_status,
    STR_TO_DATE(
      REPLACE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jt.item, '$.pickCompletedAt')), 19), 'T', ' '),
      '%Y-%m-%d %H:%i:%s'
    ) AS pick_completed_at
  FROM orders o
  JOIN (
    SELECT DISTINCT order_id
    FROM order_operation_logs
    WHERE action = 'copy_to_draft'
  ) copied ON copied.order_id = o.id
  JOIN order_ext e ON e.order_id = o.id
  JOIN (
    SELECT
      h.order_id,
      MAX(h.entered_at) AS pending_purchase_at
    FROM order_status_history h
    JOIN order_statuses s ON s.id = h.status_id
    WHERE s.code = 'pending_purchase'
    GROUP BY h.order_id
  ) lp ON lp.order_id = o.id
  JOIN JSON_TABLE(
    COALESCE(e.materials, JSON_ARRAY()),
    '$[*]' COLUMNS (
      ord FOR ORDINALITY,
      item JSON PATH '$'
    )
  ) jt
  WHERE o.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM order_operation_logs l
      WHERE l.order_id = o.id
        AND l.created_at >= lp.pending_purchase_at
        AND l.action = 'production_purchase_register'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM order_operation_logs l
      WHERE l.order_id = o.id
        AND l.created_at >= lp.pending_purchase_at
        AND l.action IN (
          'production_process_complete',
          'production_cutting_register',
          'production_cutting_edit',
          'production_sewing_register',
          'production_finishing_inbound'
        )
    )
) x
WHERE (
    x.purchase_status = 'completed'
    AND x.purchase_completed_at IS NOT NULL
    AND x.purchase_completed_at < x.pending_purchase_at
  )
  OR (
    x.pick_status = 'completed'
    AND x.pick_completed_at IS NOT NULL
    AND x.pick_completed_at < x.pending_purchase_at
  );

-- 1.1 候选订单汇总
SELECT
  order_id,
  order_no,
  sku_code,
  order_status,
  status_time,
  pending_purchase_at,
  COUNT(*) AS inherited_material_rows,
  MIN(COALESCE(purchase_completed_at, pick_completed_at)) AS earliest_old_completed_at,
  MAX(COALESCE(purchase_completed_at, pick_completed_at)) AS latest_old_completed_at
FROM tmp_copied_order_material_cleanup_candidates
GROUP BY order_id, order_no, sku_code, order_status, status_time, pending_purchase_at
ORDER BY pending_purchase_at DESC, order_id DESC;

-- 1.2 候选物料明细
SELECT
  order_id,
  order_no,
  sku_code,
  material_index,
  material_name,
  material_color,
  pending_purchase_at,
  purchase_status,
  purchase_completed_at,
  pick_status,
  pick_completed_at
FROM tmp_copied_order_material_cleanup_candidates
ORDER BY pending_purchase_at DESC, order_id DESC, material_index;

/* =========================
   2) 执行清理
   ========================= */

-- 2.1 对候选物料行移除旧采购/领料操作字段；保留物料来源、供应商、名称、颜色、用量、参考图等业务字段。
WITH RECURSIVE
candidate_rows AS (
  SELECT
    d.order_id,
    d.material_index,
    ROW_NUMBER() OVER (PARTITION BY d.order_id ORDER BY d.material_index) AS rn
  FROM (
    SELECT DISTINCT order_id, material_index
    FROM tmp_copied_order_material_cleanup_candidates
  ) d
),
clean_steps AS (
  SELECT
    e.order_id,
    0 AS rn,
    e.materials
  FROM order_ext e
  JOIN (SELECT DISTINCT order_id FROM candidate_rows) c ON c.order_id = e.order_id

  UNION ALL

  SELECT
    cs.order_id,
    cr.rn,
    JSON_REMOVE(
      cs.materials,
      CONCAT('$[', cr.material_index, '].purchaseStatus'),
      CONCAT('$[', cr.material_index, '].actualPurchaseQuantity'),
      CONCAT('$[', cr.material_index, '].purchaseAmount'),
      CONCAT('$[', cr.material_index, '].purchaseCompletedAt'),
      CONCAT('$[', cr.material_index, '].purchaseUnitPrice'),
      CONCAT('$[', cr.material_index, '].purchaseOtherCost'),
      CONCAT('$[', cr.material_index, '].purchaseRemark'),
      CONCAT('$[', cr.material_index, '].purchaseImageUrl'),
      CONCAT('$[', cr.material_index, '].pickStatus'),
      CONCAT('$[', cr.material_index, '].pickCompletedAt'),
      CONCAT('$[', cr.material_index, '].pickRemark'),
      CONCAT('$[', cr.material_index, '].pickLogs')
    ) AS materials
  FROM clean_steps cs
  JOIN candidate_rows cr ON cr.order_id = cs.order_id AND cr.rn = cs.rn + 1
),
final_materials AS (
  SELECT
    cs.order_id,
    cs.materials
  FROM clean_steps cs
  JOIN (
    SELECT order_id, MAX(rn) AS max_rn
    FROM candidate_rows
    GROUP BY order_id
  ) last_step ON last_step.order_id = cs.order_id AND last_step.max_rn = cs.rn
)
UPDATE order_ext e
JOIN final_materials f ON f.order_id = e.order_id
SET e.materials = f.materials;

-- 2.2 若订单已经被旧完成字段自动推过采购，但没有真实下游登记，则回退当前状态到待采购。
DROP TEMPORARY TABLE IF EXISTS tmp_copied_order_status_reset_candidates;

CREATE TEMPORARY TABLE tmp_copied_order_status_reset_candidates AS
SELECT DISTINCT
  c.order_id,
  c.order_no,
  c.order_status,
  c.status_time,
  c.pending_purchase_at
FROM tmp_copied_order_material_cleanup_candidates c
WHERE c.order_status IN (
  'pending_pattern',
  'pending_cutting',
  'pending_craft',
  'pending_sewing',
  'pending_finishing'
);

UPDATE orders o
JOIN tmp_copied_order_status_reset_candidates c ON c.order_id = o.id
SET
  o.status = 'pending_purchase',
  o.status_time = c.pending_purchase_at
WHERE o.status = c.order_status;

-- 2.3 记录一次数据清理日志，便于以后追溯。
INSERT INTO order_operation_logs (
  order_id,
  order_no,
  operator_username,
  action,
  detail,
  created_at
)
SELECT
  c.order_id,
  c.order_no,
  '系统修复',
  'data_cleanup',
  CONCAT(
    '清理复制订单误继承的采购/领料完成字段；候选物料行数：',
    COUNT(*),
    '；到采购时间：',
    DATE_FORMAT(MAX(c.pending_purchase_at), '%Y-%m-%d %H:%i:%s')
  ),
  NOW()
FROM tmp_copied_order_material_cleanup_candidates c
GROUP BY c.order_id, c.order_no;

/* =========================
   3) 清理后复查
   ========================= */

-- 3.1 应返回 0 行：仍存在“完成时间早于到采购时间”的复制订单物料
SELECT *
FROM (
  SELECT
    o.id AS order_id,
    o.order_no,
    o.sku_code,
    o.status AS order_status,
    lp.pending_purchase_at,
    jt.ord - 1 AS material_index,
    JSON_UNQUOTE(JSON_EXTRACT(jt.item, '$.materialName')) AS material_name,
    JSON_UNQUOTE(JSON_EXTRACT(jt.item, '$.color')) AS material_color,
    LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jt.item, '$.purchaseStatus')), 'pending')) AS purchase_status,
    STR_TO_DATE(
      REPLACE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jt.item, '$.purchaseCompletedAt')), 19), 'T', ' '),
      '%Y-%m-%d %H:%i:%s'
    ) AS purchase_completed_at,
    LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(jt.item, '$.pickStatus')), 'pending')) AS pick_status,
    STR_TO_DATE(
      REPLACE(LEFT(JSON_UNQUOTE(JSON_EXTRACT(jt.item, '$.pickCompletedAt')), 19), 'T', ' '),
      '%Y-%m-%d %H:%i:%s'
    ) AS pick_completed_at
  FROM (
    SELECT DISTINCT order_id, pending_purchase_at
    FROM tmp_copied_order_material_cleanup_candidates
  ) lp
  JOIN orders o ON o.id = lp.order_id
  JOIN order_ext e ON e.order_id = o.id
  JOIN JSON_TABLE(
    COALESCE(e.materials, JSON_ARRAY()),
    '$[*]' COLUMNS (
      ord FOR ORDINALITY,
      item JSON PATH '$'
    )
  ) jt
) remaining
WHERE (
    remaining.purchase_status = 'completed'
    AND remaining.purchase_completed_at IS NOT NULL
    AND remaining.purchase_completed_at < remaining.pending_purchase_at
  )
  OR (
    remaining.pick_status = 'completed'
    AND remaining.pick_completed_at IS NOT NULL
    AND remaining.pick_completed_at < remaining.pending_purchase_at
  )
ORDER BY pending_purchase_at DESC, order_id DESC, material_index;

-- 3.2 复查这些订单当前状态
SELECT
  o.id AS order_id,
  o.order_no,
  o.sku_code,
  o.status,
  o.status_time
FROM orders o
JOIN (
  SELECT DISTINCT order_id
  FROM tmp_copied_order_material_cleanup_candidates
) c ON c.order_id = o.id
ORDER BY o.id DESC;
