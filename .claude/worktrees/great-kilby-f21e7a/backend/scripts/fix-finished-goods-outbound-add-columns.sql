-- 若 finished_goods_outbound 表已存在但缺少字段，执行本脚本
-- 执行前请备份数据库。若某列已存在会报错，可注释掉对应行后重试。

USE erp;

ALTER TABLE finished_goods_outbound
  ADD COLUMN department VARCHAR(128) DEFAULT '' COMMENT '部门（出库时从库存冗余）' AFTER quantity;
ALTER TABLE finished_goods_outbound
  ADD COLUMN warehouse_id INT NULL COMMENT '仓库 ID' AFTER department;
ALTER TABLE finished_goods_outbound
  ADD COLUMN inventory_type_id INT NULL COMMENT '库存类型 ID' AFTER warehouse_id;
ALTER TABLE finished_goods_outbound
  ADD COLUMN pickup_user_id INT NULL COMMENT '领取人 users.id（业务员约束在业务层）' AFTER inventory_type_id;
ALTER TABLE finished_goods_outbound
  ADD COLUMN pickup_user_name VARCHAR(128) DEFAULT '' COMMENT '领取人姓名快照（冗余展示）' AFTER pickup_user_id;
ALTER TABLE finished_goods_outbound
  ADD COLUMN size_breakdown JSON NULL COMMENT '颜色尺码明细快照' AFTER pickup_user_name;
ALTER TABLE finished_goods_outbound
  ADD COLUMN image_url VARCHAR(512) DEFAULT '' COMMENT '出库图片快照（优先库存图）' AFTER sku_code;
