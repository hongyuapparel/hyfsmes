-- 面料库存：新增库存类型 ID（system_options.id, option_type = 'inventory_types'）
-- 执行前请备份。仅新增列，无数据迁移。
ALTER TABLE fabric_stock
  ADD COLUMN inventory_type_id INT NULL COMMENT '库存类型ID(system_options.id, option_type=inventory_types)' AFTER warehouse_id;
