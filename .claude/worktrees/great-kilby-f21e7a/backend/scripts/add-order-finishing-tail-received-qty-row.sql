-- 为尾部收货数增加“按尺码明细”字段（json），用于在「尾部管理-登记包装完成」弹窗展示细数
-- 执行前请确认当前数据库已存在表 order_finishing

ALTER TABLE `order_finishing`
  ADD COLUMN `tail_received_qty_row` JSON NULL COMMENT '尾部收货数按尺码明细（与 B 区尺码列一致，最后一项为合计）'
  AFTER `tail_received_qty`;

