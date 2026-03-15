-- 产品分组改为只存 system_options.id（改名历史同步）
-- 执行前请备份。系统未上线、无数据时可直接执行。

USE erp;

-- 删除旧字符串列 product_group，新增整型列 product_group_id（若已无 product_group 列，只执行 ADD 两行即可）
ALTER TABLE products   DROP COLUMN product_group;
ALTER TABLE products   ADD COLUMN product_group_id INT NULL COMMENT 'system_options.id, option_type=product_groups';

ALTER TABLE customers  DROP COLUMN product_group;
ALTER TABLE customers  ADD COLUMN product_group_id INT NULL COMMENT 'system_options.id, option_type=product_groups';
