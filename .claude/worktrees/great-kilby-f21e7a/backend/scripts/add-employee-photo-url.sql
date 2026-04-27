ALTER TABLE `employees`
  ADD COLUMN `photo_url` VARCHAR(500) NOT NULL DEFAULT '' AFTER `remark`;
