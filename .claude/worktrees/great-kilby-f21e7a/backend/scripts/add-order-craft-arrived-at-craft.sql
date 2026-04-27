-- 为工艺管理增加“到工艺时间”字段（datetime）
-- 用于在工艺完成后仍能展示“到工艺时间”
-- 执行前请确认当前数据库已存在表 order_craft

ALTER TABLE `order_craft`
  ADD COLUMN `arrived_at_craft` DATETIME NULL COMMENT '到工艺时间（进入待工艺 pending_craft 的时间）'
  AFTER `status`;

