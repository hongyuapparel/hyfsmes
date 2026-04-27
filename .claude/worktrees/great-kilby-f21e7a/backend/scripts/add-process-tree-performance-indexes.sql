-- 工序树性能索引（仅创建缺失索引，重复执行安全）
-- 执行方式（示例）：mysql -uroot -p < backend/scripts/add-process-tree-performance-indexes.sql

SET @db := DATABASE();

-- production_processes: 按 department + job_type 查询工序，并按 sort_order + id 排序
SET @idx_pp := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = @db
    AND table_name = 'production_processes'
    AND index_name = 'idx_pp_dept_job_sort_id'
);
SET @sql_pp := IF(
  @idx_pp = 0,
  'CREATE INDEX idx_pp_dept_job_sort_id ON production_processes (department, job_type, sort_order, id)',
  'SELECT "idx_pp_dept_job_sort_id exists"'
);
PREPARE stmt_pp FROM @sql_pp;
EXECUTE stmt_pp;
DEALLOCATE PREPARE stmt_pp;

-- system_options: 按 option_type + parent_id 拉树节点，并按 sort_order + id 排序
SET @idx_so := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = @db
    AND table_name = 'system_options'
    AND index_name = 'idx_so_type_parent_sort_id'
);
SET @sql_so := IF(
  @idx_so = 0,
  'CREATE INDEX idx_so_type_parent_sort_id ON system_options (option_type, parent_id, sort_order, id)',
  'SELECT "idx_so_type_parent_sort_id exists"'
);
PREPARE stmt_so FROM @sql_so;
EXECUTE stmt_so;
DEALLOCATE PREPARE stmt_so;
