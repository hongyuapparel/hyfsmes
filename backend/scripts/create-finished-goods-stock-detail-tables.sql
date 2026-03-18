-- 成品库存详情相关表：颜色图片 + 调整记录
-- 执行前请备份数据库。若表已存在可跳过。

USE erp;

CREATE TABLE IF NOT EXISTS finished_goods_stock_color_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  finished_stock_id INT NOT NULL COMMENT '成品库存 ID',
  color_name VARCHAR(64) DEFAULT '' COMMENT '颜色',
  image_url VARCHAR(512) DEFAULT '' COMMENT '图片 URL',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY idx_fgsci_stock (finished_stock_id),
  KEY idx_fgsci_color (color_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成品库存颜色图片';

CREATE TABLE IF NOT EXISTS finished_goods_stock_adjust_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  finished_stock_id INT NOT NULL COMMENT '成品库存 ID',
  operator_username VARCHAR(128) DEFAULT '' COMMENT '操作人',
  `before` JSON NULL COMMENT '变更前（JSON）',
  `after` JSON NULL COMMENT '变更后（JSON）',
  remark VARCHAR(500) DEFAULT '' COMMENT '备注',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_fgsal_stock (finished_stock_id),
  KEY idx_fgsal_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成品库存资料调整记录';

