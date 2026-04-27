-- 用户多角色：新增 user_roles 关联表
-- 执行前请先备份数据库

CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `role_id` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_role` (`user_id`, `role_id`),
  KEY `idx_user_roles_user_id` (`user_id`),
  KEY `idx_user_roles_role_id` (`role_id`),
  CONSTRAINT `fk_user_roles_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_user_roles_role_id` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 将 users.role_id 回填到 user_roles，保证存量账号默认拥有原主角色
INSERT INTO `user_roles` (`user_id`, `role_id`)
SELECT u.`id`, u.`role_id`
FROM `users` u
LEFT JOIN `user_roles` ur
  ON ur.`user_id` = u.`id` AND ur.`role_id` = u.`role_id`
WHERE u.`role_id` IS NOT NULL
  AND ur.`id` IS NULL;
