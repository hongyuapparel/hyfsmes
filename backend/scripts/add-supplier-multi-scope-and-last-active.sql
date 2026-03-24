ALTER TABLE `suppliers`
  ADD COLUMN IF NOT EXISTS `business_scope_ids` JSON NULL COMMENT '业务范围ID列表（多选）' AFTER `business_scope_id`,
  ADD COLUMN IF NOT EXISTS `last_active_at` DATETIME NULL COMMENT '最近活跃时间' AFTER `business_scope_ids`;
