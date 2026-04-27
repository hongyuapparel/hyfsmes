-- 删除已改为“只存 ID”模式后遗留的字符串列，保持库表干净。
-- 若某条报错 1091 (Can't DROP ... check that column/key exists)，表示该列已不存在，可忽略。

-- 供应商：只保留 supplier_type_id / business_scope_id
ALTER TABLE suppliers DROP COLUMN type;
ALTER TABLE suppliers DROP COLUMN business_scope;

-- 产品：只保留 product_group_id
ALTER TABLE products DROP COLUMN product_group;

-- 客户：只保留 product_group_id（若已删过会报 1091，可忽略）
ALTER TABLE customers DROP COLUMN product_group;

-- 仓库入库 / 成品库存的 warehouse 已改为 warehouse_id，若已删过会报 1091，可忽略
ALTER TABLE warehouse_inbound DROP COLUMN warehouse;
ALTER TABLE finished_goods_stock DROP COLUMN warehouse;
-- 成品库存的库存类型已改为 inventory_type_id，若已删过会报 1091，可忽略
ALTER TABLE finished_goods_stock DROP COLUMN inventory_type;
