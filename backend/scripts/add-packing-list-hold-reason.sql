-- 装箱单滞留待发：仅补内部原因字段，不修改任何历史状态、数量或库存。
-- 在 ERP 数据库中执行，可重复执行。后端启动检查也会按相同规则补列。
SET @packing_hold_ddl = IF(
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'packing_lists' AND column_name = 'hold_reason') = 0,
  'ALTER TABLE packing_lists ADD COLUMN hold_reason VARCHAR(500) NOT NULL DEFAULT '''' AFTER status',
  'SELECT ''hold_reason already exists'' AS result'
);
PREPARE packing_hold_stmt FROM @packing_hold_ddl;
EXECUTE packing_hold_stmt;
DEALLOCATE PREPARE packing_hold_stmt;
SHOW COLUMNS FROM packing_lists LIKE 'hold_reason';
