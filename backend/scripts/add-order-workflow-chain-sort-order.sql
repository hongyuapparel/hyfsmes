-- 为流程链路增加排序字段（数字越小越靠前）
-- 说明：项目默认未开启 migrations，且生产环境可能关闭 synchronize

ALTER TABLE order_workflow_chains
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER enabled;

-- 初始化：按 id 倒序（原列表默认顺序）生成 sort_order
SET @rownum := 0;
UPDATE order_workflow_chains
SET sort_order = (@rownum := @rownum + 1)
ORDER BY id DESC;

