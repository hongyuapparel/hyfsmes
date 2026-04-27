-- Read-only checks for production records that were written as completed while
-- the main order status did not move forward. Run on the production database.

SELECT
  'pattern_completed_but_order_pending_pattern' AS issue,
  o.id AS order_id,
  o.order_no,
  o.sku_code,
  o.status AS order_status,
  p.status AS module_status,
  p.completed_at AS module_completed_at,
  o.status_time
FROM orders o
JOIN order_pattern p ON p.order_id = o.id
WHERE o.status = 'pending_pattern'
  AND p.status = 'completed'

UNION ALL

SELECT
  'cutting_completed_but_order_pending_cutting' AS issue,
  o.id AS order_id,
  o.order_no,
  o.sku_code,
  o.status AS order_status,
  c.status AS module_status,
  c.completed_at AS module_completed_at,
  o.status_time
FROM orders o
JOIN order_cutting c ON c.order_id = o.id
WHERE o.status = 'pending_cutting'
  AND c.status = 'completed'

UNION ALL

SELECT
  'sewing_completed_but_order_pending_sewing' AS issue,
  o.id AS order_id,
  o.order_no,
  o.sku_code,
  o.status AS order_status,
  s.status AS module_status,
  s.completed_at AS module_completed_at,
  o.status_time
FROM orders o
JOIN order_sewing s ON s.order_id = o.id
WHERE o.status = 'pending_sewing'
  AND s.status = 'completed'

UNION ALL

SELECT
  'finishing_inbound_but_order_pending_finishing' AS issue,
  o.id AS order_id,
  o.order_no,
  o.sku_code,
  o.status AS order_status,
  f.status AS module_status,
  f.completed_at AS module_completed_at,
  o.status_time
FROM orders o
JOIN order_finishing f ON f.order_id = o.id
WHERE o.status = 'pending_finishing'
  AND f.status = 'inbound'

ORDER BY module_completed_at DESC, order_id DESC;

-- Purchase/picking rows are stored in order_ext.materials JSON. This query
-- finds orders whose material rows are all completed while the order is still
-- stuck at pending_purchase.
SELECT
  o.id AS order_id,
  o.order_no,
  o.sku_code,
  o.status AS order_status,
  material_stats.material_count,
  material_stats.completed_count,
  material_stats.last_completed_at,
  o.status_time
FROM orders o
JOIN (
  SELECT
    ext.order_id,
    COUNT(*) AS material_count,
    SUM(
      CASE
        WHEN COALESCE(m.purchase_status, 'pending') = 'completed'
          OR COALESCE(m.pick_status, 'pending') = 'completed'
        THEN 1
        ELSE 0
      END
    ) AS completed_count,
    MAX(
      GREATEST(
        COALESCE(m.purchase_completed_at, '1000-01-01 00:00:00'),
        COALESCE(m.pick_completed_at, '1000-01-01 00:00:00')
      )
    ) AS last_completed_at
  FROM order_ext ext
  JOIN JSON_TABLE(
    COALESCE(ext.materials, JSON_ARRAY()),
    '$[*]' COLUMNS (
      purchase_status VARCHAR(32) PATH '$.purchaseStatus' NULL ON EMPTY,
      pick_status VARCHAR(32) PATH '$.pickStatus' NULL ON EMPTY,
      purchase_completed_at VARCHAR(32) PATH '$.purchaseCompletedAt' NULL ON EMPTY,
      pick_completed_at VARCHAR(32) PATH '$.pickCompletedAt' NULL ON EMPTY
    )
  ) AS m
  GROUP BY ext.order_id
) AS material_stats ON material_stats.order_id = o.id
WHERE o.status = 'pending_purchase'
  AND material_stats.material_count > 0
  AND material_stats.completed_count = material_stats.material_count
ORDER BY material_stats.last_completed_at DESC, o.id DESC;

-- These were hidden by the old sewing list after the order moved past
-- pending_finishing. They are visible after the code fix in this changeset.
SELECT
  o.id AS order_id,
  o.order_no,
  o.sku_code,
  o.status AS order_status,
  s.status AS sewing_status,
  s.completed_at AS sewing_completed_at,
  o.status_time
FROM orders o
JOIN order_sewing s ON s.order_id = o.id
WHERE s.status = 'completed'
  AND o.status NOT IN ('pending_sewing', 'pending_finishing')
ORDER BY s.completed_at DESC, o.id DESC;
