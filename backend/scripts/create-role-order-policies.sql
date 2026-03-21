CREATE TABLE IF NOT EXISTS `role_order_policies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `role_id` int NOT NULL,
  `action` varchar(16) NOT NULL,
  `status_code` varchar(64) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_role_action_status` (`role_id`, `action`, `status_code`),
  KEY `idx_role_order_policies_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

