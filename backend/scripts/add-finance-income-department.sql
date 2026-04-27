ALTER TABLE finance_income_records
  ADD COLUMN department_id INT NULL COMMENT '部门 ID（system_options.id, org_departments）' AFTER fund_account_id;
