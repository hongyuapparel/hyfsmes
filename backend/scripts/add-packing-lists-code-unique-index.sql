-- 装箱单单号 code 唯一索引（手动补救/参考用）
-- 作用：给 packing_lists.code 加唯一约束，作为并发/异常下重复单号的最终防线
--（服务端已改为按当天最大序号+1 生成并在冲突时重试，本索引保证即使竞态也不会落库两条同号）。
--
-- 注意：正常**不用手动跑**。后端启动时 ensurePackingListTables 会自动幂等加这个唯一索引，
--   所以部署装箱单后端后（表已建好）会自动加上。本脚本仅作手动补救或离线参考。
--   且必须在 packing_lists 表已存在后执行；表不存在会报 “Table doesn't exist”。
--
-- 执行前：先确认当前没有重复 code（下面第 1 段会列出，正常应为空）。
--   若有重复，需先人工处理（改其中一条的 code）再执行加索引，否则 ALTER 会失败。
--
-- 执行方式（示例）：
--   mysql -uxxx -p 库名 < backend/scripts/add-packing-lists-code-unique-index.sql

-- 1) 列出重复 code（正常为空集）
SELECT code, COUNT(*) AS cnt
FROM packing_lists
GROUP BY code
HAVING COUNT(*) > 1;

-- 2) 幂等添加唯一索引（已存在则跳过）
SET @db_name = DATABASE();
SET @sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.statistics
    WHERE table_schema = @db_name AND table_name = 'packing_lists' AND index_name = 'uniq_packing_lists_code'
  ),
  'SELECT ''uniq_packing_lists_code exists''',
  'ALTER TABLE packing_lists ADD UNIQUE INDEX uniq_packing_lists_code (code)'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
