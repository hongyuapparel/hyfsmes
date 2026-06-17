-- 成品库存「按颜色重分配」上线前安全备份（在 RDS / 数据库工具里整段粘贴执行）
-- 作用：把 finished_goods_stock / 颜色图片 / 调整日志 的当前全量快照各存一份带时间戳的备份表。
-- 验证若出问题，可用文末的 RESTORE 语句还原。执行一次即可（重复执行会因表已存在而报错，属正常）。

CREATE TABLE finished_goods_stock_bak_20260617 AS SELECT * FROM finished_goods_stock;
CREATE TABLE finished_goods_stock_color_images_bak_20260617 AS SELECT * FROM finished_goods_stock_color_images;
CREATE TABLE finished_goods_stock_adjust_logs_bak_20260617 AS SELECT * FROM finished_goods_stock_adjust_logs;

-- 备份行数核对（三张表的备份应与原表一致）
SELECT
  (SELECT COUNT(*) FROM finished_goods_stock)                         AS stock_now,
  (SELECT COUNT(*) FROM finished_goods_stock_bak_20260617)            AS stock_bak,
  (SELECT COUNT(*) FROM finished_goods_stock_color_images)            AS img_now,
  (SELECT COUNT(*) FROM finished_goods_stock_color_images_bak_20260617) AS img_bak,
  (SELECT COUNT(*) FROM finished_goods_stock_adjust_logs)             AS log_now,
  (SELECT COUNT(*) FROM finished_goods_stock_adjust_logs_bak_20260617) AS log_bak;

-- ===== 如需还原（谨慎！会用备份覆盖现有数据），再整段执行下面这段 =====
-- SET FOREIGN_KEY_CHECKS = 0;
-- TRUNCATE finished_goods_stock;
-- INSERT INTO finished_goods_stock SELECT * FROM finished_goods_stock_bak_20260617;
-- TRUNCATE finished_goods_stock_color_images;
-- INSERT INTO finished_goods_stock_color_images SELECT * FROM finished_goods_stock_color_images_bak_20260617;
-- TRUNCATE finished_goods_stock_adjust_logs;
-- INSERT INTO finished_goods_stock_adjust_logs SELECT * FROM finished_goods_stock_adjust_logs_bak_20260617;
-- SET FOREIGN_KEY_CHECKS = 1;
