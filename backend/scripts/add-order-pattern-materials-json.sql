-- 为纸样管理增加“物料/裁片清单”字段（json）与备注字段
-- 用于在「纸样管理」中查看/编辑，默认可从订单物料同步
-- 执行前请确认当前数据库已存在表 order_pattern

ALTER TABLE `order_pattern`
  ADD COLUMN `materials_json` JSON NULL COMMENT '纸样物料/裁片清单（可从订单物料同步）'
  AFTER `sample_image_url`,
  ADD COLUMN `materials_remark` VARCHAR(500) NULL COMMENT '纸样物料备注'
  AFTER `materials_json`;

