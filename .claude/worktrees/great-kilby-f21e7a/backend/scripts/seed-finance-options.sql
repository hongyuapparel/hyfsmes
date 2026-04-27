-- 初始化财务下拉选项：支出类型、银行账号（仅当该类型尚无任何选项时插入，可重复执行）

INSERT INTO system_options (option_type, value, sort_order, parent_id)
SELECT 'expense_types', '采购', 0, NULL FROM DUAL
WHERE (SELECT COUNT(*) FROM system_options WHERE option_type = 'expense_types') = 0
UNION ALL
SELECT 'expense_types', '外发加工', 1, NULL FROM DUAL
WHERE (SELECT COUNT(*) FROM system_options WHERE option_type = 'expense_types') = 0
UNION ALL
SELECT 'expense_types', '人工', 2, NULL FROM DUAL
WHERE (SELECT COUNT(*) FROM system_options WHERE option_type = 'expense_types') = 0
UNION ALL
SELECT 'expense_types', '运费', 3, NULL FROM DUAL
WHERE (SELECT COUNT(*) FROM system_options WHERE option_type = 'expense_types') = 0
UNION ALL
SELECT 'expense_types', '办公', 4, NULL FROM DUAL
WHERE (SELECT COUNT(*) FROM system_options WHERE option_type = 'expense_types') = 0
UNION ALL
SELECT 'expense_types', '其他', 5, NULL FROM DUAL
WHERE (SELECT COUNT(*) FROM system_options WHERE option_type = 'expense_types') = 0;

INSERT INTO system_options (option_type, value, sort_order, parent_id)
SELECT 'bank_accounts', '公司主账户', 0, NULL FROM DUAL
WHERE (SELECT COUNT(*) FROM system_options WHERE option_type = 'bank_accounts') = 0
UNION ALL
SELECT 'bank_accounts', '一般户', 1, NULL FROM DUAL
WHERE (SELECT COUNT(*) FROM system_options WHERE option_type = 'bank_accounts') = 0;
