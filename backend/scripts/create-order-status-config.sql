-- 订单状态与流转规则配置表
-- 执行前请备份数据库。系统未上线、无历史数据时可直接执行。

USE erp;

-- 1) 订单状态定义表：用于配置有哪些状态、显示名称与顺序
CREATE TABLE IF NOT EXISTS order_statuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE COMMENT '状态编码，如 draft / pending_review',
  label VARCHAR(64) NOT NULL COMMENT '状态中文名称，如 草稿 / 待审单',
  sort_order INT NOT NULL DEFAULT 0 COMMENT '用于前端排序的序号，越小越靠前',
  group_key VARCHAR(64) NULL COMMENT '可选：前端分组/展示分组标记，如 before_production / in_production / completed',
  is_final TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否为终态（如：订单完成）',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用该状态'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单状态定义表';

-- 2) 订单状态流转规则表：配置从某状态在何种触发下流转到哪一状态
CREATE TABLE IF NOT EXISTS order_status_transitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_status VARCHAR(64) NOT NULL COMMENT '当前状态编码',
  to_status VARCHAR(64) NOT NULL COMMENT '目标状态编码',
  trigger_type VARCHAR(32) NOT NULL COMMENT '触发类型：button / auto_event 等',
  trigger_code VARCHAR(64) NOT NULL COMMENT '触发编码，如 review_approve / purchase_all_completed',
  conditions_json JSON NULL COMMENT '条件 JSON，如订单类型/合作方式/是否样板等',
  next_department VARCHAR(64) NULL COMMENT '流转后归属部门标记，如 purchase / pattern / cutting',
  allow_roles VARCHAR(255) NULL COMMENT '允许触发该流转的角色编码列表，逗号分隔',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用该条规则',
  KEY idx_from_trigger (from_status, trigger_code),
  KEY idx_to_status (to_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单状态流转规则表';

