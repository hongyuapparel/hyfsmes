/* 
  成品库存：详情读取混乱 + 冗余数据清理（Dry-Run 报告）
  - 仅查询/统计，不做任何删除或更新
  - 执行前请确认当前连接数据库为目标环境（建议先在测试库执行）
*/

/* =========================
   0) 基础健康检查
   ========================= */

-- 0.1 库存主表总量 & 异常行
SELECT 
  COUNT(*) AS stock_rows,
  SUM(CASE WHEN sku_code IS NULL OR TRIM(sku_code) = '' THEN 1 ELSE 0 END) AS bad_sku_rows,
  SUM(CASE WHEN quantity IS NULL OR quantity < 0 THEN 1 ELSE 0 END) AS bad_quantity_rows
FROM finished_goods_stock;

-- 0.2 颜色图片表总量
SELECT COUNT(*) AS color_image_rows FROM finished_goods_stock_color_images;

-- 0.3 调整日志表总量
SELECT COUNT(*) AS adjust_log_rows FROM finished_goods_stock_adjust_logs;


/* =========================
   1) 同一 SKU 存在多个不同主图的记录
   说明：当前系统历史上可能把“库存行 image_url”当作主图来源，导致同 SKU 不一致。
   目标：主图应统一来自 products.image_url（单一数据源）。
   ========================= */

-- 1.1 同 SKU 在 finished_goods_stock 内出现多个不同 image_url（非空）
SELECT
  s.sku_code,
  COUNT(*) AS stock_rows,
  COUNT(DISTINCT NULLIF(TRIM(s.image_url), '')) AS distinct_stock_image_urls
FROM finished_goods_stock s
GROUP BY s.sku_code
HAVING COUNT(DISTINCT NULLIF(TRIM(s.image_url), '')) > 1
ORDER BY distinct_stock_image_urls DESC, stock_rows DESC;

-- 1.2 同 SKU：库存行 image_url（非空）与 products.image_url 不一致
SELECT
  s.sku_code,
  TRIM(p.image_url) AS product_image_url,
  COUNT(*) AS mismatch_rows,
  COUNT(DISTINCT NULLIF(TRIM(s.image_url), '')) AS distinct_stock_image_urls
FROM finished_goods_stock s
LEFT JOIN products p ON p.sku_code = s.sku_code
WHERE NULLIF(TRIM(s.image_url), '') IS NOT NULL
  AND NULLIF(TRIM(p.image_url), '') IS NOT NULL
  AND TRIM(s.image_url) <> TRIM(p.image_url)
GROUP BY s.sku_code, TRIM(p.image_url)
ORDER BY mismatch_rows DESC;

-- 1.3 成品库存存在但 products 主数据缺失（主图无法统一）
SELECT
  s.sku_code,
  COUNT(*) AS stock_rows
FROM finished_goods_stock s
LEFT JOIN products p ON p.sku_code = s.sku_code
WHERE p.id IS NULL
  AND NULLIF(TRIM(s.sku_code), '') IS NOT NULL
GROUP BY s.sku_code
ORDER BY stock_rows DESC;


/* =========================
   2) 没有关联主记录的孤儿明细
   ========================= */

-- 2.1 孤儿颜色图片：color_images.finished_stock_id 找不到 finished_goods_stock.id
SELECT
  ci.id,
  ci.finished_stock_id,
  ci.color_name,
  ci.image_url,
  ci.created_at,
  ci.updated_at
FROM finished_goods_stock_color_images ci
LEFT JOIN finished_goods_stock s ON s.id = ci.finished_stock_id
WHERE s.id IS NULL
ORDER BY ci.id DESC;

-- 2.2 孤儿调整日志：adjust_logs.finished_stock_id 找不到 finished_goods_stock.id
SELECT
  l.id,
  l.finished_stock_id,
  l.operator_username,
  l.remark,
  l.created_at
FROM finished_goods_stock_adjust_logs l
LEFT JOIN finished_goods_stock s ON s.id = l.finished_stock_id
WHERE s.id IS NULL
ORDER BY l.id DESC;


/* =========================
   3) 已废弃功能遗留但当前页面不该再用的数据（仅做盘点）
   说明：成品库存“子行详情”若严格以 row_id 为准，不应再从 order_ext 拼接颜色尺码。
   这里统计：存在成品库存的订单中，order_ext 的颜色尺码字段覆盖情况。
   ========================= */

-- 3.1 统计：成品库存关联订单中，order_ext 是否存在颜色尺码字段
SELECT
  COUNT(DISTINCT s.order_id) AS stock_order_count,
  COUNT(DISTINCT CASE WHEN oe.id IS NOT NULL THEN s.order_id END) AS order_ext_exists_count,
  COUNT(DISTINCT CASE WHEN oe.id IS NOT NULL AND oe.color_size_headers IS NOT NULL THEN s.order_id END) AS ext_has_headers_count,
  COUNT(DISTINCT CASE WHEN oe.id IS NOT NULL AND oe.color_size_rows IS NOT NULL THEN s.order_id END) AS ext_has_rows_count
FROM finished_goods_stock s
LEFT JOIN order_ext oe ON oe.order_id = s.order_id
WHERE s.order_id IS NOT NULL;

-- 3.2 统计：成品库存行自身是否已有 color_size_snapshot（作为“子行独立尺码明细”数据源）
SELECT
  COUNT(*) AS stock_rows,
  SUM(CASE WHEN s.color_size_snapshot IS NOT NULL THEN 1 ELSE 0 END) AS rows_with_snapshot,
  SUM(CASE WHEN s.color_size_snapshot IS NULL THEN 1 ELSE 0 END) AS rows_without_snapshot
FROM finished_goods_stock s;


/* =========================
   4) 明显重复的测试数据或历史垃圾数据（仅启发式统计）
   说明：用“入库合并键”（sku_code + order_id + warehouse_id + inventory_type_id + department）找重复行。
   ========================= */

-- 4.1 以合并键聚合，找出同键多行（可能是历史重复或合并策略变更导致）
SELECT
  s.sku_code,
  COALESCE(s.order_id, 0) AS order_id,
  COALESCE(s.warehouse_id, 0) AS warehouse_id,
  COALESCE(s.inventory_type_id, 0) AS inventory_type_id,
  TRIM(COALESCE(s.department, '')) AS department,
  COUNT(*) AS row_count,
  SUM(COALESCE(s.quantity, 0)) AS quantity_sum,
  MIN(s.created_at) AS min_created_at,
  MAX(s.created_at) AS max_created_at
FROM finished_goods_stock s
GROUP BY
  s.sku_code,
  COALESCE(s.order_id, 0),
  COALESCE(s.warehouse_id, 0),
  COALESCE(s.inventory_type_id, 0),
  TRIM(COALESCE(s.department, ''))
HAVING COUNT(*) > 1
ORDER BY row_count DESC, quantity_sum DESC;

-- 4.2 SKU 为空/部门为空等“明显测试/异常”行（仅供人工复核）
SELECT
  s.id,
  s.sku_code,
  s.order_id,
  s.customer_name,
  s.department,
  s.warehouse_id,
  s.inventory_type_id,
  s.quantity,
  s.created_at
FROM finished_goods_stock s
WHERE (s.sku_code IS NULL OR TRIM(s.sku_code) = '')
   OR (s.department IS NULL OR TRIM(s.department) = '')
   OR (s.quantity IS NULL OR s.quantity <= 0)
ORDER BY s.id DESC
LIMIT 200;


/* =========================
   5) 日志保留建议盘点（默认保留，不做删除）
   ========================= */

-- 5.1 每条库存的调整日志数量分布（前 50）
SELECT
  l.finished_stock_id,
  COUNT(*) AS log_count,
  MIN(l.created_at) AS first_log_at,
  MAX(l.created_at) AS last_log_at
FROM finished_goods_stock_adjust_logs l
GROUP BY l.finished_stock_id
ORDER BY log_count DESC
LIMIT 50;

