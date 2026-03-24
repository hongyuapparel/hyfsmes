ALTER TABLE `suppliers`
  ADD COLUMN IF NOT EXISTS `business_scope_ids` JSON NULL COMMENT 'multi business scope ids' AFTER `business_scope_id`,
  ADD COLUMN IF NOT EXISTS `last_active_at` DATETIME NULL COMMENT 'last active time' AFTER `business_scope_ids`;
