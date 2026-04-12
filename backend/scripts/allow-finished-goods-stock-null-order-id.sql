-- 成品库存：订单号选填，无订单入库时 order_id 必须为 NULL（与实体 FinishedGoodsStock.orderId 一致）
-- 若列已是 NULL，本语句仅刷新列定义，可安全重复执行。
-- 执行前请备份数据库。

ALTER TABLE finished_goods_stock
  MODIFY COLUMN order_id INT NULL COMMENT '订单 ID，可选（无订单号直接入库时为 NULL）';
