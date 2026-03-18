-- 若 finished_goods_outbound 表已存在但缺少 部门/仓库/库存类型 列，执行本脚本
-- 执行前请备份数据库。若某列已存在会报错，可注释掉对应行后重试。

USE erp;

ALTER TABLE finished_goods_outbound
  ADD COLUMN department VARCHAR(128) DEFAULT '' COMMENT '部门（出库时从库存冗余）' AFTER quantity;
ALTER TABLE finished_goods_outbound
  ADD COLUMN warehouse_id INT NULL COMMENT '仓库 ID' AFTER department;
ALTER TABLE finished_goods_outbound
  ADD COLUMN inventory_type_id INT NULL COMMENT '库存类型 ID' AFTER warehouse_id;
