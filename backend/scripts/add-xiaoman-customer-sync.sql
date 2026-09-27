-- 上线前在 ERP 数据库执行一次。仅新增关联字段和搜索快照，不覆盖任何客户资料。
ALTER TABLE customers
  ADD COLUMN xiaoman_company_id VARCHAR(32) NULL,
  ADD UNIQUE KEY uq_customers_xiaoman_company (xiaoman_company_id);

CREATE TABLE IF NOT EXISTS xiaoman_sync_state (
  id INT NOT NULL PRIMARY KEY,
  snapshot JSON NULL,
  last_success_at DATETIME NULL,
  last_attempt_at DATETIME NULL,
  last_error TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 运行后核对：成功时间、错误信息及索引数量；不输出客户联系方式。
SELECT last_success_at, last_attempt_at, last_error, JSON_LENGTH(snapshot) AS indexed_customers
FROM xiaoman_sync_state WHERE id = 1;
