-- 装箱单三表（packing_lists / packing_list_boxes / packing_list_items），后端启动时也会自动建（main.ts ensurePackingListTables）
CREATE TABLE IF NOT EXISTS packing_lists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL DEFAULT '',
  customer_id INT NULL,
  customer_name VARCHAR(255) NOT NULL DEFAULT '',
  service_manager VARCHAR(128) NOT NULL DEFAULT '',
  po_no VARCHAR(255) NOT NULL DEFAULT '',
  pack_date DATE NULL,
  remark VARCHAR(1000) NOT NULL DEFAULT '',
  show_company TINYINT NOT NULL DEFAULT 1,
  size_headers JSON NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  shipped_at DATETIME NULL,
  operator_username VARCHAR(255) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_packing_lists_status (status),
  KEY idx_packing_lists_customer_name (customer_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS packing_list_boxes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packing_list_id INT NOT NULL,
  box_seq INT NOT NULL,
  weight_kg DECIMAL(10,2) NULL,
  carton_size VARCHAR(64) NOT NULL DEFAULT '',
  remark VARCHAR(255) NOT NULL DEFAULT '',
  KEY idx_plb_list (packing_list_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS packing_list_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packing_list_id INT NOT NULL,
  box_id INT NOT NULL,
  style_no VARCHAR(128) NOT NULL DEFAULT '',
  style_name VARCHAR(255) NOT NULL DEFAULT '',
  color_name VARCHAR(128) NOT NULL DEFAULT '',
  image_url VARCHAR(512) NOT NULL DEFAULT '',
  size_quantities JSON NULL,
  total_qty INT NOT NULL DEFAULT 0,
  source_type VARCHAR(16) NOT NULL DEFAULT 'manual',
  source_id INT NULL,
  KEY idx_pli_list (packing_list_id),
  KEY idx_pli_box (box_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
