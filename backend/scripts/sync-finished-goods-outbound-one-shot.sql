-- 成品出库表一键同步脚本（可重复执行）
-- 用途：一次性创建/补齐 finished_goods_outbound 所需字段，避免逐行手动执行
-- 执行前请备份数据库。

USE erp;

-- 1) 先保证表存在（最小结构）
CREATE TABLE IF NOT EXISTS finished_goods_outbound (
  id INT AUTO_INCREMENT PRIMARY KEY,
  finished_stock_id INT NOT NULL COMMENT '成品库存 ID',
  order_id INT NULL COMMENT '订单 ID（可选）',
  order_no VARCHAR(32) DEFAULT '' COMMENT '订单号（冗余）',
  sku_code VARCHAR(64) DEFAULT '' COMMENT 'SKU',
  image_url VARCHAR(512) DEFAULT '' COMMENT '出库图片快照（优先库存图）',
  customer_name VARCHAR(255) DEFAULT '' COMMENT '客户名称（冗余）',
  quantity INT NOT NULL DEFAULT 0 COMMENT '出库数量',
  operator_username VARCHAR(128) DEFAULT '' COMMENT '操作人',
  remark VARCHAR(500) DEFAULT '' COMMENT '备注',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '出库时间',
  KEY idx_outbound_stock (finished_stock_id),
  KEY idx_outbound_order (order_id),
  KEY idx_outbound_order_no (order_no),
  KEY idx_outbound_sku (sku_code),
  KEY idx_outbound_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成品出库记录表';

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_sync_finished_goods_outbound $$
CREATE PROCEDURE sp_sync_finished_goods_outbound()
BEGIN
  -- department
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'finished_goods_outbound'
      AND COLUMN_NAME = 'department'
  ) THEN
    ALTER TABLE finished_goods_outbound
      ADD COLUMN department VARCHAR(128) DEFAULT '' COMMENT '部门（出库时从库存冗余）' AFTER quantity;
  END IF;

  -- warehouse_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'finished_goods_outbound'
      AND COLUMN_NAME = 'warehouse_id'
  ) THEN
    ALTER TABLE finished_goods_outbound
      ADD COLUMN warehouse_id INT NULL COMMENT '仓库 ID（出库时从库存冗余）' AFTER department;
  END IF;

  -- inventory_type_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'finished_goods_outbound'
      AND COLUMN_NAME = 'inventory_type_id'
  ) THEN
    ALTER TABLE finished_goods_outbound
      ADD COLUMN inventory_type_id INT NULL COMMENT '库存类型 ID（出库时从库存冗余）' AFTER warehouse_id;
  END IF;

  -- pickup_user_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'finished_goods_outbound'
      AND COLUMN_NAME = 'pickup_user_id'
  ) THEN
    ALTER TABLE finished_goods_outbound
      ADD COLUMN pickup_user_id INT NULL COMMENT '领取人 users.id（业务员约束在业务层）' AFTER inventory_type_id;
  END IF;

  -- pickup_user_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'finished_goods_outbound'
      AND COLUMN_NAME = 'pickup_user_name'
  ) THEN
    ALTER TABLE finished_goods_outbound
      ADD COLUMN pickup_user_name VARCHAR(128) DEFAULT '' COMMENT '领取人姓名快照（冗余展示）' AFTER pickup_user_id;
  END IF;

  -- size_breakdown
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'finished_goods_outbound'
      AND COLUMN_NAME = 'size_breakdown'
  ) THEN
    ALTER TABLE finished_goods_outbound
      ADD COLUMN size_breakdown JSON NULL COMMENT '颜色尺码明细快照' AFTER pickup_user_name;
  END IF;

  -- image_url
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'finished_goods_outbound'
      AND COLUMN_NAME = 'image_url'
  ) THEN
    ALTER TABLE finished_goods_outbound
      ADD COLUMN image_url VARCHAR(512) DEFAULT '' COMMENT '出库图片快照（优先库存图）' AFTER sku_code;
  END IF;
END $$

CALL sp_sync_finished_goods_outbound() $$
DROP PROCEDURE IF EXISTS sp_sync_finished_goods_outbound $$

DELIMITER ;

