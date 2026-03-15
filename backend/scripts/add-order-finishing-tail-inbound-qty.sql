-- 为 order_finishing 表增加「尾部入库数」列（方案 A：支持部分出货、部分入库）
-- 若使用 TypeORM synchronize: true 可自动建列，无需执行本脚本。仅执行一次。

USE erp;

ALTER TABLE order_finishing
  ADD COLUMN tail_inbound_qty INT NOT NULL DEFAULT 0 COMMENT '尾部入库数（可多次累加）' AFTER tail_shipped_qty;
