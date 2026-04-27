-- 尾部登记包装完成：按尺码持久化入库数、次品数（与 tail_received_qty_row 结构一致：最后一列为合计）
-- 执行前请确认当前数据库已存在表 order_finishing

ALTER TABLE `order_finishing`
  ADD COLUMN `tail_inbound_qty_row` JSON NULL COMMENT '尾部入库数按尺码明细（与 B 区尺码列一致，最后一项为合计）'
  AFTER `tail_inbound_qty`;

ALTER TABLE `order_finishing`
  ADD COLUMN `defect_quantity_row` JSON NULL COMMENT '次品数按尺码明细（与 B 区尺码列一致，最后一项为合计）'
  AFTER `defect_quantity`;
