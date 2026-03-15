-- 收入流水表：按部门、银行账号手动录入
CREATE TABLE IF NOT EXISTS finance_income_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  occur_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  department_id INT NULL,
  bank_account_id INT NULL,
  remark VARCHAR(500) DEFAULT '',
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 支出流水表：可关联订单/供应商或仅填明细
CREATE TABLE IF NOT EXISTS finance_expense_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  occur_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_type_id INT NULL,
  department_id INT NULL,
  order_id INT NULL,
  supplier_id INT NULL,
  detail VARCHAR(500) DEFAULT '',
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 支出类型、银行账号使用 system_options 表，option_type 分别为 expense_types、bank_accounts
-- 可在「系统设置 - 财务设置」中维护，或执行下方示例数据（按需修改后执行）

/*
INSERT INTO system_options (option_type, value, sort_order, parent_id) VALUES
('expense_types', '采购', 0, NULL),
('expense_types', '外发加工', 1, NULL),
('expense_types', '人工', 2, NULL),
('expense_types', '运费', 3, NULL),
('expense_types', '办公', 4, NULL),
('expense_types', '其他', 5, NULL);

INSERT INTO system_options (option_type, value, sort_order, parent_id) VALUES
('bank_accounts', '公司主账户', 0, NULL),
('bank_accounts', '一般户', 1, NULL);
*/
