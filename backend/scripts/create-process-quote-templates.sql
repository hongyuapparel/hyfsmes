-- 服装类型报价模板表：如 T恤、连衣裙，用于订单成本页一键导入工序列表
-- 执行前请备份数据库。若表已存在可跳过。

USE erp;

CREATE TABLE IF NOT EXISTS process_quote_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(64) NOT NULL COMMENT '模板名称，如 T恤、连衣裙',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  KEY idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工序报价模板（服装类型）';

CREATE TABLE IF NOT EXISTS process_quote_template_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL COMMENT '模板 ID',
  process_id INT NOT NULL COMMENT '生产工序 ID',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '项内排序',
  KEY idx_template_id (template_id),
  KEY idx_process_id (process_id),
  CONSTRAINT fk_pqt_item_template FOREIGN KEY (template_id) REFERENCES process_quote_templates (id) ON DELETE CASCADE,
  CONSTRAINT fk_pqt_item_process FOREIGN KEY (process_id) REFERENCES production_processes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='报价模板工序项';
