-- 订单列表性能索引
-- 作用：
-- 1. 提升状态 Tab 切换（WHERE status = ? ORDER BY id DESC LIMIT ...）
-- 2. 提升完成时间 / 下单时间 / 客户交期范围过滤
-- 3. 提升订单类型、合作方式、业务员、跟单员等精确筛选
--
-- 执行方式（示例）：
-- mysql -uroot -p < backend/scripts/add-orders-list-performance-indexes.sql

SET @db_name = DATABASE();

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = @db_name AND table_name = 'orders' AND index_name = 'idx_orders_status_id'
  ),
  'SELECT ''idx_orders_status_id exists''',
  'ALTER TABLE orders ADD INDEX idx_orders_status_id (status, id)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = @db_name AND table_name = 'orders' AND index_name = 'idx_orders_completed_time'
  ),
  'SELECT ''idx_orders_completed_time exists''',
  'ALTER TABLE orders ADD INDEX idx_orders_completed_time (status, status_time)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = @db_name AND table_name = 'orders' AND index_name = 'idx_orders_order_date'
  ),
  'SELECT ''idx_orders_order_date exists''',
  'ALTER TABLE orders ADD INDEX idx_orders_order_date (order_date)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = @db_name AND table_name = 'orders' AND index_name = 'idx_orders_customer_due_date'
  ),
  'SELECT ''idx_orders_customer_due_date exists''',
  'ALTER TABLE orders ADD INDEX idx_orders_customer_due_date (customer_due_date)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = @db_name AND table_name = 'orders' AND index_name = 'idx_orders_order_type_id'
  ),
  'SELECT ''idx_orders_order_type_id exists''',
  'ALTER TABLE orders ADD INDEX idx_orders_order_type_id (order_type_id)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = @db_name AND table_name = 'orders' AND index_name = 'idx_orders_collaboration_type_id'
  ),
  'SELECT ''idx_orders_collaboration_type_id exists''',
  'ALTER TABLE orders ADD INDEX idx_orders_collaboration_type_id (collaboration_type_id)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = @db_name AND table_name = 'orders' AND index_name = 'idx_orders_salesperson'
  ),
  'SELECT ''idx_orders_salesperson exists''',
  'ALTER TABLE orders ADD INDEX idx_orders_salesperson (salesperson)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = @db_name AND table_name = 'orders' AND index_name = 'idx_orders_merchandiser'
  ),
  'SELECT ''idx_orders_merchandiser exists''',
  'ALTER TABLE orders ADD INDEX idx_orders_merchandiser (merchandiser)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
