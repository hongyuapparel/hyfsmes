CREATE TABLE IF NOT EXISTS work_report_plans (
 owner_id INT NOT NULL PRIMARY KEY,
 version INT NOT NULL DEFAULT 0,
 tasks JSON NOT NULL,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS work_report_snapshots (
 owner_id INT NOT NULL,
 report_date DATE NOT NULL,
 tasks JSON NOT NULL,
 PRIMARY KEY(owner_id, report_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO permissions(code,name,type,route_path) VALUES
('menu_work_reports','工作报告','menu','/work-reports'),
('work_reports_all','工作报告-查看全员','action','/work-reports')
ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code='menu_work_reports'
WHERE r.code IN ('admin','merchandiser','purchase','pattern','cutting','sewing','finishing','inventory')
AND NOT EXISTS(SELECT 1 FROM role_permissions rp WHERE rp.role_id=r.id AND rp.permission_id=p.id);
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN permissions p ON p.code='work_reports_all'
WHERE r.code='admin' AND NOT EXISTS(SELECT 1 FROM role_permissions rp WHERE rp.role_id=r.id AND rp.permission_id=p.id);
