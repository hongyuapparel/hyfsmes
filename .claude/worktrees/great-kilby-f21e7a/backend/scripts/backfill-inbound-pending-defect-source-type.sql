-- 历史待入库数据回填：将“次品数量”对应行标记为 defect
-- 说明：
-- 1) 仅回填 source_type 仍为 normal 的历史数据
-- 2) 匹配规则：pending 行数量 = 尾部记录 defect_quantity（且 defect_quantity > 0）
-- 3) 执行前请备份数据库

USE erp;

UPDATE inbound_pending p
INNER JOIN order_finishing f ON f.order_id = p.order_id
SET p.source_type = 'defect'
WHERE p.status = 'pending'
  AND (p.source_type IS NULL OR p.source_type = '' OR p.source_type = 'normal')
  AND f.defect_quantity > 0
  AND p.quantity = f.defect_quantity;

