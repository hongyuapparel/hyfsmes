-- 裁床管理：增加裁剪部门/裁剪人字段（用于区分本厂/外发裁床）
-- 执行前请确认当前数据库已存在表 order_cutting

ALTER TABLE `order_cutting`
  ADD COLUMN `cutting_department` VARCHAR(128) NULL COMMENT '裁剪部门/加工厂：本厂或外发加工厂名称'
  AFTER `actual_cut_rows`,
  ADD COLUMN `cutter_name` VARCHAR(64) NULL COMMENT '裁剪人（仅本厂裁床）'
  AFTER `cutting_department`;

