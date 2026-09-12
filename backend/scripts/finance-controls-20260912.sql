-- 在目标库执行一次；先备份。历史流水不推定业务性质，也不自动填入期初余额。
ALTER TABLE finance_income_records
 ADD COLUMN cash_kind varchar(20) NOT NULL DEFAULT 'unclassified',
 ADD COLUMN bank_reference varchar(100) NOT NULL DEFAULT '',
 ADD COLUMN version int NOT NULL DEFAULT 1,
 ADD COLUMN deleted_at datetime NULL;
ALTER TABLE finance_expense_records
 ADD COLUMN cash_kind varchar(20) NOT NULL DEFAULT 'unclassified',
 ADD COLUMN bank_reference varchar(100) NOT NULL DEFAULT '',
 ADD COLUMN version int NOT NULL DEFAULT 1,
 ADD COLUMN deleted_at datetime NULL;
ALTER TABLE finance_fund_accounts
 ADD COLUMN opening_date date NULL,
 ADD COLUMN opening_balance decimal(12,2) NULL,
 ADD COLUMN reconciled_through date NULL,
 ADD COLUMN reconciled_balance decimal(12,2) NULL;
CREATE TABLE finance_transfers (
 id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
 occur_date date NOT NULL,
 from_account_id int NOT NULL,
 to_account_id int NOT NULL,
 amount decimal(12,2) NOT NULL,
 bank_reference varchar(100) NOT NULL DEFAULT '',
 remark varchar(500) NOT NULL DEFAULT '',
 deleted_at datetime NULL,
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_transfer_from (from_account_id, occur_date),
 INDEX idx_transfer_to (to_account_id, occur_date)
);
CREATE TABLE finance_audit_logs (
 id int NOT NULL AUTO_INCREMENT PRIMARY KEY,
 record_kind varchar(20) NOT NULL,
 record_id int NOT NULL,
 action varchar(30) NOT NULL,
 actor_id int NOT NULL,
 actor_name varchar(128) NOT NULL,
 reason varchar(500) NOT NULL DEFAULT '',
 before_data json NULL,
 after_data json NULL,
 created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_finance_audit_record (record_kind, record_id, id)
);
