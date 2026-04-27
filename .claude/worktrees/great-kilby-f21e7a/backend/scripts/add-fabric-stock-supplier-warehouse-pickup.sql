-- 面料库存：供应商、仓库（存 system_options.id）、存放地址；面料出库：领取人（users.id）
ALTER TABLE fabric_stock
  ADD COLUMN supplier_id INT NULL COMMENT 'suppliers.id' AFTER customer_name,
  ADD COLUMN warehouse_id INT NULL COMMENT 'system_options.id warehouses' AFTER supplier_id,
  ADD COLUMN storage_location VARCHAR(255) NOT NULL DEFAULT '' COMMENT '存放地址' AFTER warehouse_id;

ALTER TABLE fabric_outbound
  ADD COLUMN pickup_user_id INT NULL COMMENT 'users.id' AFTER remark;
