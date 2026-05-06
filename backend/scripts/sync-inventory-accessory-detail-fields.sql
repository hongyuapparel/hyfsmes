-- Rerunnable schema sync for inventory_accessory detail fields.
-- Run before deploying code that reads/writes warehouse_id, location, and image_urls.

USE erp;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_sync_inventory_accessory_detail_fields $$
CREATE PROCEDURE sp_sync_inventory_accessory_detail_fields()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'inventory_accessory'
      AND COLUMN_NAME = 'warehouse_id'
  ) THEN
    ALTER TABLE inventory_accessory
      ADD COLUMN warehouse_id INT NULL COMMENT 'system_options.id warehouses' AFTER unit;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'inventory_accessory'
      AND COLUMN_NAME = 'location'
  ) THEN
    ALTER TABLE inventory_accessory
      ADD COLUMN location VARCHAR(255) NOT NULL DEFAULT '' COMMENT 'storage location' AFTER warehouse_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'inventory_accessory'
      AND COLUMN_NAME = 'image_urls'
  ) THEN
    ALTER TABLE inventory_accessory
      ADD COLUMN image_urls JSON NULL COMMENT 'image url list' AFTER image_url;
  END IF;
END $$

CALL sp_sync_inventory_accessory_detail_fields() $$
DROP PROCEDURE IF EXISTS sp_sync_inventory_accessory_detail_fields $$

DELIMITER ;
