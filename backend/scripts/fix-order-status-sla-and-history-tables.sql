-- 修复 order_status_sla / order_status_history 表结构（补全缺失的 id 等列）
-- 若之前建表时漏掉 id 会导致 Unknown column 'OrderStatusSla.id' in 'field list'
-- 执行前请确认这两张表内无需要保留的数据；若有请先备份。

USE erp;

-- 先删从表（有外键引用 order_status_sla 的可先不建，本脚本只涉及这两张表）
DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_status_sla;

-- 1) 订单状态时效配置表（必须含 id 主键）
CREATE TABLE order_status_sla (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_status_id INT NOT NULL COMMENT '订单状态 ID（order_statuses.id）',
  limit_hours DECIMAL(10,2) NOT NULL COMMENT '该状态合理停留时长（小时），超过即超期',
  enabled TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用该条配置',
  CONSTRAINT fk_order_status_sla_status FOREIGN KEY (order_status_id) REFERENCES order_statuses(id) ON DELETE CASCADE,
  KEY idx_order_status_sla_status (order_status_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单状态时效配置表';

-- 2) 订单状态进入记录表
CREATE TABLE order_status_history (
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
