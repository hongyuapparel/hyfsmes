-- 订单时效配置表 + 订单状态流转历史表
-- 用于「订单设置 - 订单时效配置」与「财务管理 - 订单流转时效报表」
-- 执行前请备份数据库。若表已存在可跳过或先 DROP 再执行。

USE erp;

-- 1) 订单状态时效配置表：每个状态可配置合理停留时长（小时），超期用于绩效统计
CREATE TABLE IF NOT EXISTS order_status_sla (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_status_id INT NOT NULL COMMENT '订单状态 ID（order_statuses.id）',
  limit_hours DECIMAL(10,2) NOT NULL COMMENT '该状态合理停留时长（小时），超过即超期',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用该条配置',
  CONSTRAINT fk_order_status_sla_status FOREIGN KEY (order_status_id) REFERENCES order_statuses(id) ON DELETE CASCADE,
  KEY idx_order_status_sla_status (order_status_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单状态时效配置表';

-- 2) 订单状态进入记录表：每次状态变更写入一条，用于计算停留时长与超期
CREATE TABLE IF NOT EXISTS order_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL COMMENT '订单 ID',
  status_id INT NOT NULL COMMENT '进入的状态 ID（order_statuses.id）',
  entered_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '进入该状态的时间',
  CONSTRAINT fk_order_status_history_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_status_history_status FOREIGN KEY (status_id) REFERENCES order_statuses(id) ON DELETE CASCADE,
  KEY idx_order_status_history_order (order_id),
  KEY idx_order_status_history_entered (entered_at),
  KEY idx_order_status_history_status (status_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单状态进入记录表';
