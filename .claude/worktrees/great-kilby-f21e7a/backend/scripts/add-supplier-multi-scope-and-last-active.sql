SET @db_name = DATABASE();

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db_name
        AND TABLE_NAME = 'suppliers'
        AND COLUMN_NAME = 'business_scope_ids'
    ),
    'SELECT ''business_scope_ids already exists''',
    'ALTER TABLE `suppliers` ADD COLUMN `business_scope_ids` TEXT NULL COMMENT ''multi business scope ids'' AFTER `business_scope_id`'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db_name
        AND TABLE_NAME = 'suppliers'
        AND COLUMN_NAME = 'last_active_at'
    ),
    'SELECT ''last_active_at already exists''',
    'ALTER TABLE `suppliers` ADD COLUMN `last_active_at` DATETIME NULL COMMENT ''last active time'' AFTER `business_scope_ids`'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
