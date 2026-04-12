-- 成品库存：手动录入的颜色尺码明细（JSON），无订单或优先于订单 order_ext 展示
-- 执行前请备份数据库。

ALTER TABLE finished_goods_stock
  ADD COLUMN color_size_snapshot JSON NULL COMMENT '手动颜色尺码明细 {headers, rows}' AFTER image_url;
