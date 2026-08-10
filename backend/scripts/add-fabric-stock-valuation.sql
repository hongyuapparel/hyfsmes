-- 面料库存实际成本与出库成本快照。
-- 历史记录保持 NULL（未计价/历史未记录），禁止按当前库存或同名采购数据反推。

ALTER TABLE fabric_stock
  ADD COLUMN unit_price DECIMAL(14,4) NULL COMMENT '实际入库成本单价；NULL表示未计价' AFTER quantity;

ALTER TABLE fabric_outbound
  ADD COLUMN name_snapshot VARCHAR(128) NULL AFTER fabric_stock_id,
  ADD COLUMN customer_name_snapshot VARCHAR(255) NULL AFTER name_snapshot,
  ADD COLUMN unit_snapshot VARCHAR(32) NULL AFTER customer_name_snapshot,
  ADD COLUMN inventory_type_id INT NULL AFTER unit_snapshot,
  ADD COLUMN inventory_type_label VARCHAR(255) NULL AFTER inventory_type_id,
  ADD COLUMN unit_price DECIMAL(14,4) NULL COMMENT '出库时成本单价' AFTER quantity,
  ADD COLUMN amount DECIMAL(16,2) NULL COMMENT '出库时成本金额' AFTER unit_price;
