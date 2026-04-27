-- 为 order_finishing 表增加「备注」列（登记包装完成时的备注）
-- 若使用 TypeORM synchronize: true 可自动建列。仅执行一次。

USE erp;

ALTER TABLE order_finishing
  ADD COLUMN remark VARCHAR(500) NULL COMMENT '登记包装完成时的备注' AFTER defect_quantity;
