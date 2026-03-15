-- 为“流程链路”增加独立表与步骤归属字段
-- 执行前请备份数据库。

USE erp;

CREATE TABLE IF NOT EXISTS order_workflow_chains (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL COMMENT '链路名称（用于后台配置展示）',
  conditions_json JSON NULL COMMENT '整条链路共用条件，如 {orderType:\"sample\",productForm:\"finished\"}',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用链路',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单流程链路（配置）';

-- 在规则表中增加链路归属与步骤顺序（允许为空，兼容历史“单条规则”）
ALTER TABLE order_status_transitions
  ADD COLUMN chain_id INT NULL COMMENT '所属链路ID(order_workflow_chains.id)' AFTER id,
  ADD COLUMN step_order INT NULL COMMENT '链路内步骤顺序，从1开始' AFTER chain_id;

CREATE INDEX idx_chain_step ON order_status_transitions(chain_id, step_order);

