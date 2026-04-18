-- 将「无产品分组」的产品归入系统选项 product_groups 下的根节点「未分组」
-- 目的：分组侧边栏计数与列表总数一致（原 NULL 行不会进入按 product_group_id 的统计）
-- 执行前请备份数据库；可重复执行（幂等：仅更新仍为 NULL 的行，且「未分组」仅插入一次）
--
-- 请按需替换库名或去掉下一行 USE：
-- USE your_database_name;

-- 1) 确保存在根级「未分组」（parent_id IS NULL）
INSERT INTO system_options (option_type, value, sort_order, parent_id)
SELECT 'product_groups', '未分组', 9999, NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1
  FROM system_options
  WHERE option_type = 'product_groups'
    AND parent_id IS NULL
    AND `value` = '未分组'
);

-- 2) 将所有 product_group_id 为 NULL 的产品指向该节点
SET @ungrouped_id := (
  SELECT id
  FROM system_options
  WHERE option_type = 'product_groups'
    AND parent_id IS NULL
    AND `value` = '未分组'
  ORDER BY id ASC
  LIMIT 1
);

UPDATE products
SET product_group_id = @ungrouped_id
WHERE product_group_id IS NULL
  AND @ungrouped_id IS NOT NULL;
