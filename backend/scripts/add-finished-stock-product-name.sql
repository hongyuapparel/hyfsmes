-- 成品库存选填品名及出库快照。请先备份，在目标数据库执行，再发布新版后端。
-- 可重复执行；不修改任何历史名称、数量或金额，不依赖产品档案。
SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE()
    AND table_name = 'finished_goods_stock' AND column_name = 'product_name'),
  'SELECT 1',
  'ALTER TABLE finished_goods_stock ADD COLUMN product_name VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''库存品名'' AFTER sku_code'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE()
    AND table_name = 'finished_goods_outbound' AND column_name = 'product_name'),
  'SELECT 1',
  'ALTER TABLE finished_goods_outbound ADD COLUMN product_name VARCHAR(255) NOT NULL DEFAULT '''' COMMENT ''出库时品名快照'' AFTER sku_code'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
