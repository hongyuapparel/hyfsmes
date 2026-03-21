-- 待入库：新增来源类型字段（normal=正常入库，defect=次品入库）
-- 执行前请备份数据库。

USE erp;

ALTER TABLE inbound_pending
  ADD COLUMN source_type VARCHAR(32) NOT NULL DEFAULT 'normal' COMMENT '来源类型：normal|defect' AFTER quantity;

