-- 裁床登记 v2：裁剪单价/总成本、物料用量明细 JSON
-- 执行前请备份。缺列时可重复执行（需手动判断或配合迁移工具）。

ALTER TABLE `order_cutting`
  ADD COLUMN `cutting_unit_price` DECIMAL(14, 4) NULL COMMENT '裁剪单价（元/件）' AFTER `cutting_cost`,
  ADD COLUMN `cutting_total_cost` DECIMAL(14, 2) NULL COMMENT '裁剪总成本（元）' AFTER `cutting_unit_price`,
  ADD COLUMN `material_usage` JSON NULL COMMENT '物料用量明细（裁床登记）' AFTER `cutting_total_cost`;
