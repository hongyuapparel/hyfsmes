-- 成品出库记录表：库存点击出库时写入，用于按日期追溯
-- 执行前请备份数据库。若表已存在可跳过。

USE erp;

CREATE TABLE IF NOT EXISTS finished_goods_outbound (
  id INT AUTO_INCREMENT PRIMARY KEY,
  finished_stock_id INT NOT NULL COMMENT '成品库存 ID',
  order_id INT NULL COMMENT '订单 ID（可选）',
  order_no VARCHAR(32) DEFAULT '' COMMENT '订单号（冗余）',
  sku_code VARCHAR(64) DEFAULT '' COMMENT 'SKU',
  image_url VARCHAR(512) DEFAULT '' COMMENT '出库图片快照（优先库存图）',
  customer_name VARCHAR(255) DEFAULT '' COMMENT '客户名称（冗余）',
  quantity INT NOT NULL DEFAULT 0 COMMENT '出库数量',
  department VARCHAR(128) DEFAULT '' COMMENT '部门（出库时从库存冗余）',
  warehouse_id INT NULL COMMENT '仓库 ID（出库时从库存冗余）',
  inventory_type_id INT NULL COMMENT '库存类型 ID（出库时从库存冗余）',
  pickup_user_id INT NULL COMMENT '领走人用户ID（业务员）',
  pickup_user_name VARCHAR(128) DEFAULT '' COMMENT '领走人姓名（冗余）',
  size_breakdown JSON NULL COMMENT '颜色尺码明细快照',
  operator_username VARCHAR(128) DEFAULT '' COMMENT '操作人',
  remark VARCHAR(500) DEFAULT '' COMMENT '备注',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '出库时间',
  KEY idx_outbound_stock (finished_stock_id),
  KEY idx_outbound_order (order_id),
  KEY idx_outbound_order_no (order_no),
  KEY idx_outbound_sku (sku_code),
  KEY idx_outbound_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成品出库记录表';
