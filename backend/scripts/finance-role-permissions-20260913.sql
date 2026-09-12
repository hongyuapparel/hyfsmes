-- 按需启用：仅授予 code=finance 的专职财务角色；不改变只读或其他角色。
-- 先部署后端，使权限种子创建下列权限。执行后核对结果应为 9 行。
SELECT id, code, name FROM roles WHERE code = 'finance';
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code = 'finance' AND p.code IN (
  'finance_income_create', 'finance_income_edit', 'finance_income_delete',
  'finance_expense_create', 'finance_expense_edit', 'finance_expense_delete',
  'finance_accounts_manage', 'finance_transfer_create', 'finance_transfer_void'
) AND NOT EXISTS (
  SELECT 1 FROM role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);
SELECT r.code role_code, p.code permission_code FROM roles r
JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id
WHERE r.code = 'finance' AND p.code LIKE 'finance_%' ORDER BY p.code;
