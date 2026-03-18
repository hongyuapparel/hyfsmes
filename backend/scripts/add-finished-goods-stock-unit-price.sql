-- 成品库存：新增出厂价字段（unit_price）
-- 解决列表查询报错：Unknown column 's.unit_price'
-- 执行前请备份数据库。

USE erp;

ALTER TABLE finished_goods_stock
  ADD COLUMN unit_price DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT '出厂价（元）' AFTER quantity;

