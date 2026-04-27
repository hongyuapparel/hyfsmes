-- 辅料出库记录表：订单提交时自动扣减辅料、日常领用/调整等
-- 执行前请备份数据库。若表已存在可跳过。

USE erp;

CREATE TABLE IF NOT EXISTS inventory_accessory_outbound (
  id INT AUTO_INCREMENT PRIMARY KEY,
  accessory_id INT NOT NULL COMMENT '辅料库存 ID',
  order_id INT NULL COMMENT '关联订单 ID（自动出库时填写）',
  order_no VARCHAR(32) NOT NULL DEFAULT '' COMMENT '关联订单号',
  outbound_type VARCHAR(32) NOT NULL DEFAULT 'manual' COMMENT 'order_auto | manual',
  quantity INT NOT NULL DEFAULT 0 COMMENT '出库数量',
  before_quantity INT NOT NULL DEFAULT 0 COMMENT '出库前库存',
  after_quantity INT NOT NULL DEFAULT 0 COMMENT '出库后库存',
  operator_username VARCHAR(128) NOT NULL DEFAULT '' COMMENT '操作人',
  remark VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '创建时间',
  KEY idx_accessory_id (accessory_id),
  KEY idx_order_id (order_id),
  KEY idx_order_no (order_no),
  KEY idx_outbound_type (outbound_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='辅料出库记录表';
