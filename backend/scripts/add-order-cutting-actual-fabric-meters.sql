-- 裁床管理：增加实际用布总米数字段（用于对比纸样单件用量）
-- 执行前请确认当前数据库已存在表 order_cutting

ALTER TABLE `order_cutting`
  ADD COLUMN `actual_fabric_meters` DECIMAL(12,3) NULL COMMENT '实际用布总米数（m，仅本厂裁床）'
  AFTER `actual_cut_rows`;

