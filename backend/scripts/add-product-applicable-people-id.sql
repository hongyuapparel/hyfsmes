-- 给 products 表新增「适用人群」字段（存 system_options.id，option_type='applicable_people'）
-- 执行前请确认数据库名称与权限

ALTER TABLE `products`
  ADD COLUMN `applicable_people_id` INT NULL AFTER `product_group_id`;

