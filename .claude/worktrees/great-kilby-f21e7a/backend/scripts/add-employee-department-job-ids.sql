ALTER TABLE `employees`
  ADD COLUMN `department_id` INT NULL AFTER `job_title`,
  ADD COLUMN `job_title_id` INT NULL AFTER `department_id`;

-- 可选：根据现有 department / job_title 文本，手动或后续脚本填充对应的 ID。
-- 例如：
-- UPDATE employees e
-- JOIN system_options d
--   ON d.option_type = 'org_departments' AND d.value = e.department
-- SET e.department_id = d.id
-- WHERE e.department IS NOT NULL AND e.department <> '';

-- UPDATE employees e
-- JOIN system_options j
--   ON j.option_type = 'org_jobs' AND j.value = e.job_title
-- SET e.job_title_id = j.id
-- WHERE e.job_title IS NOT NULL AND e.job_title <> '';

