-- 库存类型改为只存 ID（inventory_type_id 关联 system_options.id，option_type = 'inventory_types'）
-- 执行前请备份。成品库存表仅新增列，无旧字符串列，无需数据迁移。

ALTER TABLE finished_goods_stock
  ADD COLUMN inventory_type_id INT NULL COMMENT '库存类型ID(system_options.id, option_type=inventory_types)' AFTER warehouse_id;
