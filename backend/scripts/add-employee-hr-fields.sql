ALTER TABLE `employees`
  ADD COLUMN `gender` VARCHAR(16) NOT NULL DEFAULT 'unknown' AFTER `name`,
  ADD COLUMN `education` VARCHAR(64) NOT NULL DEFAULT '' AFTER `contact_phone`,
  ADD COLUMN `dormitory` VARCHAR(128) NOT NULL DEFAULT '' AFTER `education`,
  ADD COLUMN `id_card_no` VARCHAR(64) NOT NULL DEFAULT '' AFTER `dormitory`,
  ADD COLUMN `native_place` VARCHAR(128) NOT NULL DEFAULT '' AFTER `id_card_no`,
  ADD COLUMN `home_address` VARCHAR(255) NOT NULL DEFAULT '' AFTER `native_place`,
  ADD COLUMN `emergency_contact` VARCHAR(64) NOT NULL DEFAULT '' AFTER `home_address`,
  ADD COLUMN `emergency_phone` VARCHAR(64) NOT NULL DEFAULT '' AFTER `emergency_contact`,
  ADD COLUMN `leave_date` DATE NULL AFTER `emergency_phone`,
  ADD COLUMN `leave_reason` VARCHAR(255) NOT NULL DEFAULT '' AFTER `leave_date`,
  ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0 AFTER `remark`;

UPDATE `employees`
SET `sort_order` = `id`
WHERE `sort_order` = 0;

