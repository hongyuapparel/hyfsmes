-- =====================================================
-- 财务模块 v2 迁移脚本
-- 1. 删除旧的空表（刚建，无历史数据）
-- 2. 新建资金账户、收入类型、支出类型配置表
-- 3. 用全新结构重建收入/支出流水表
-- 4. 写入默认类型数据
-- =====================================================

DROP TABLE IF EXISTS finance_income_records;
DROP TABLE IF EXISTS finance_expense_records;

-- 资金账户配置表
CREATE TABLE IF NOT EXISTS finance_fund_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '账户名称',
  account_type ENUM('public','private','wechat','alipay','other') NOT NULL DEFAULT 'public' COMMENT '账户类型：公账/私账/微信/支付宝/其他',
  owner VARCHAR(100) DEFAULT '' COMMENT '归属人',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 收入类型配置表
CREATE TABLE IF NOT EXISTS finance_income_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '类型名称',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 支出类型配置表
CREATE TABLE IF NOT EXISTS finance_expense_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '类型名称',
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 收入流水表（新结构）
CREATE TABLE IF NOT EXISTS finance_income_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  occur_date DATE NOT NULL COMMENT '收款日期',
  amount DECIMAL(12,2) NOT NULL COMMENT '收入金额',
  income_type_id INT NULL COMMENT '收入类型 ID',
  fund_account_id INT NULL COMMENT '收款账户 ID',
  source_name VARCHAR(200) DEFAULT '' COMMENT '来源方/客户名称',
  order_no VARCHAR(100) DEFAULT '' COMMENT '关联订单号（文本，兼容系统外订单）',
  operator VARCHAR(100) DEFAULT '' COMMENT '经办人',
  remark VARCHAR(500) DEFAULT '' COMMENT '备注',
  attachments JSON NULL COMMENT '附件图片 URL 数组',
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 支出流水表（新结构）
CREATE TABLE IF NOT EXISTS finance_expense_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  occur_date DATE NOT NULL COMMENT '支出日期',
  amount DECIMAL(12,2) NOT NULL COMMENT '支出金额',
  expense_type_id INT NULL COMMENT '支出类型 ID',
  fund_account_id INT NULL COMMENT '支出账户 ID',
  object_type VARCHAR(20) DEFAULT '' COMMENT '对象类型：supplier/employee/platform/customer/other',
  payee_name VARCHAR(200) DEFAULT '' COMMENT '收款方名称',
  order_no VARCHAR(100) DEFAULT '' COMMENT '关联订单号（文本，兼容系统外订单）',
  department_id INT NULL COMMENT '部门 ID（system_options.id, org_departments）',
  operator VARCHAR(100) DEFAULT '' COMMENT '经办人',
  remark VARCHAR(500) DEFAULT '' COMMENT '备注',
  attachments JSON NULL COMMENT '附件图片 URL 数组',
  created_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 默认收入类型
INSERT IGNORE INTO finance_income_types (name, is_enabled, sort_order) VALUES
('平台提款', 1, 0),
('客户货款', 1, 1),
('客户补款', 1, 2),
('样品费收入', 1, 3),
('运费补收', 1, 4),
('退款回款', 1, 5),
('其他收入', 1, 6);

-- 默认支出类型
INSERT IGNORE INTO finance_expense_types (name, is_enabled, sort_order) VALUES
('供应商货款', 1, 0),
('外采付款', 1, 1),
('面辅料采购', 1, 2),
('加工费', 1, 3),
('运费', 1, 4),
('样品费', 1, 5),
('工资', 1, 6),
('提成', 1, 7),
('推广费', 1, 8),
('办公费', 1, 9),
('房租水电', 1, 10),
('退款', 1, 11),
('税费', 1, 12),
('其他支出', 1, 13);
