-- 发布配套：修正已关联客户档案的历史订单名称副本，供生产等直接读取订单的页面使用。
-- 先核对下面的明细，再执行事务；不按旧名称猜配，不改状态、单据快照或订单更新时间。
SELECT o.id, o.order_no, o.customer_id, o.customer_name AS old_name, c.company_name AS current_name
FROM orders o JOIN customers c ON c.id = o.customer_id
WHERE BINARY o.customer_name <> BINARY c.company_name;

START TRANSACTION;
UPDATE orders o JOIN customers c ON c.id = o.customer_id
SET o.customer_name = c.company_name, o.updated_at = o.updated_at
WHERE BINARY o.customer_name <> BINARY c.company_name;
SELECT COUNT(*) AS remaining_mismatches
FROM orders o JOIN customers c ON c.id = o.customer_id
WHERE BINARY o.customer_name <> BINARY c.company_name;
COMMIT;

-- 未关联或档案已不存在的记录仅供人工核对，本次不自动绑定。
SELECT o.id, o.order_no, o.customer_id, o.customer_name
FROM orders o LEFT JOIN customers c ON c.id = o.customer_id
WHERE c.id IS NULL AND o.customer_name <> '';
