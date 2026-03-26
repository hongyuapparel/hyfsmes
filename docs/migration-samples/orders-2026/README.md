# 2026 订单迁移（旧系统 -> 新系统）

## 目标

- 仅迁移 `2026` 年新建订单。
- 状态按旧系统状态直接匹配到新系统状态字段（优先 code，其次 label）。
- 映射规则：
  - 制单顶部 SKU/图片 -> 新系统订单编辑 `A区`（`skuCode` + `imageUrl`）
  - 制单尺寸表 -> `D区尺寸信息`（`sizeInfoMetaHeaders` + `sizeInfoRows`）
  - 制单中的印/绣花要求 -> `E区工艺项目`（`processItems`）
  - 其他制单信息 -> `F区生产要求`（`productionRequirement`）
  - 制单附件图片 -> 仅同步到 `H区图片附件`（`attachments`），不再写入 `G区` / `F区`

---

## 一、旧系统导出（在旧库执行）

在旧系统 Linux shell（不是 `mysql>` 提示符）执行：

```bash
mkdir -p /tmp/migration_orders_2026

mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  o.order_id,
  o.order_no,
  o.sku_no,
  o.sku_image,
  o.customer_id,
  o.customer_name,
  o.order_num,
  o.factory_price,
  o.sell_price,
  o.process_str,
  o.order_status,
  IFNULL(os.status_name, '') AS old_status_name,
  o.order_user_name,
  o.check_user_name,
  IFNULL(u.display_name, u.user_name) AS track_user_name,
  DATE_FORMAT(o.create_time, '%Y-%m-%d %H:%i:%s') AS create_time,
  DATE_FORMAT(o.order_time, '%Y-%m-%d %H:%i:%s') AS order_time,
  DATE_FORMAT(o.order_delivery_date, '%Y-%m-%d') AS order_delivery_date,
  DATE_FORMAT(o.our_delivery_date, '%Y-%m-%d') AS our_delivery_date,
  DATE_FORMAT(o.expect_delivery_date, '%Y-%m-%d') AS expect_delivery_date,
  DATE_FORMAT(o.shipment_time, '%Y-%m-%d %H:%i:%s') AS shipment_time,
  o.before_require,
  o.cutting_require,
  o.sewing_require,
  o.tail_require,
  o.order_remark,
  o.process_desc,
  o.order_code,
  o.sku_color_code,
  o.sku_size_code,
  o.course_con_imgs,
  o.order_type,
  o.is_sample
FROM erp_order o
LEFT JOIN erp_order_status os ON os.status_id = o.order_status
LEFT JOIN erp_user u ON u.user_id = o.track_user_id
WHERE o.create_time >= '2026-01-01 00:00:00'
  AND o.create_time < '2027-01-01 00:00:00'
ORDER BY o.order_id ASC;
" > /tmp/migration_orders_2026/01_orders_2026.tsv
```

把导出的 `01_orders_2026.tsv` 放到：

- `docs/migration-samples/orders-2026/01_orders_2026.tsv`

为补齐 B/D/E 区，请继续导出以下补充文件（同目录）：

```bash
# 02 B区颜色尺码数量（待审单常见来源）
mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  s.order_id,
  o.order_no,
  s.is_title,
  s.sort,
  IFNULL(s.site_1, ''), IFNULL(s.site_2, ''), IFNULL(s.site_3, ''), IFNULL(s.site_4, ''),
  IFNULL(s.site_5, ''), IFNULL(s.site_6, ''), IFNULL(s.site_7, ''), IFNULL(s.site_8, ''),
  IFNULL(s.site_9, ''), IFNULL(s.site_10, ''), IFNULL(s.site_11, ''), IFNULL(s.site_12, '')
FROM erp_order_sku_size s
JOIN erp_order o ON o.order_id = s.order_id
WHERE o.create_time >= '2026-01-01 00:00:00'
  AND o.create_time < '2027-01-01 00:00:00'
ORDER BY s.order_id ASC, s.sort ASC, s.size_id ASC;
" > /tmp/migration_orders_2026/02_order_sku_size_2026.tsv

# 03 D区尺寸信息
mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  s.order_id,
  o.order_no,
  s.is_title,
  s.sort,
  IFNULL(s.site_1, ''), IFNULL(s.site_1_1, ''), IFNULL(s.site_2, ''), IFNULL(s.site_3, ''),
  IFNULL(s.site_4, ''), IFNULL(s.site_5, ''), IFNULL(s.site_6, ''), IFNULL(s.site_7, ''),
  IFNULL(s.site_8, ''), IFNULL(s.site_9, ''), IFNULL(s.site_10, ''), IFNULL(s.site_11, ''),
  IFNULL(s.site_12, ''), IFNULL(s.site_13, ''), IFNULL(s.site_14, ''), IFNULL(s.site_15, '')
FROM erp_order_size s
JOIN erp_order o ON o.order_id = s.order_id
WHERE o.create_time >= '2026-01-01 00:00:00'
  AND o.create_time < '2027-01-01 00:00:00'
ORDER BY s.order_id ASC, s.sort ASC, s.size_id ASC;
" > /tmp/migration_orders_2026/03_order_size_2026.tsv

# 04 E区工艺项目（印/绣花要求等）
mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  r.order_id,
  o.order_no,
  r.produce_category,
  r.is_title,
  IFNULL(r.require_name, ''),
  IFNULL(r.require_desc, ''),
  IFNULL(r.require_id, 0) AS sort_id
FROM erp_order_sku_require r
JOIN erp_order o ON o.order_id = r.order_id
WHERE o.create_time >= '2026-01-01 00:00:00'
  AND o.create_time < '2027-01-01 00:00:00'
ORDER BY r.order_id ASC, r.require_id ASC;
" > /tmp/migration_orders_2026/04_order_sku_require_2026.tsv

# 05 D区兜底：SKU尺寸库（当订单尺寸表无数据时用）
mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  k.sku_no,
  s.is_title,
  s.sort,
  IFNULL(s.site_1, ''), IFNULL(s.site_1_1, ''), IFNULL(s.site_2, ''), IFNULL(s.site_3, ''),
  IFNULL(s.site_4, ''), IFNULL(s.site_5, ''), IFNULL(s.site_6, ''), IFNULL(s.site_7, ''),
  IFNULL(s.site_8, ''), IFNULL(s.site_9, ''), IFNULL(s.site_10, ''), IFNULL(s.site_11, ''), IFNULL(s.site_12, '')
FROM erp_sku_size s
JOIN erp_sku k ON k.sku_id = s.sku_id
WHERE k.sku_no IN (
  SELECT DISTINCT o.sku_no
  FROM erp_order o
  WHERE o.create_time >= '2026-01-01 00:00:00'
    AND o.create_time < '2027-01-01 00:00:00'
)
ORDER BY k.sku_no ASC, s.sort ASC, s.size_id ASC;
" > /tmp/migration_orders_2026/05_sku_size_2026.tsv

# 06 C区物料信息：订单物料明细（优先）
mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  m.order_id,
  m.order_no,
  m.sku_no,
  IFNULL(m.supplier_name, ''),
  IFNULL(m.materials_category, ''),
  IFNULL(m.materials_name, ''),
  IFNULL(m.materials_color, ''),
  IFNULL(m.materials_single, 0),
  IFNULL(m.materials_loss, ''),
  IFNULL(m.order_num, 0),
  IFNULL(m.materials_single, 0) * IFNULL(m.order_num, 0) AS planned_usage,
  IFNULL(m.remark, '')
FROM erp_order_materials m
JOIN erp_order o ON o.order_id = m.order_id
WHERE o.create_time >= '2026-01-01 00:00:00'
  AND o.create_time < '2027-01-01 00:00:00'
ORDER BY m.order_id ASC, m.order_materials_id ASC;
" > /tmp/migration_orders_2026/06_order_materials_2026.tsv

# 07 C/F区兜底：SKU基础信息（当06缺失或为空时用）
mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  s.sku_no,
  IFNULL(s.process_str, ''),
  IFNULL(s.before_require, ''),
  IFNULL(s.cutting_require, ''),
  IFNULL(s.sewing_require, ''),
  IFNULL(s.tail_require, ''),
  IFNULL(s.primary_cloth, ''),
  IFNULL(s.secondary_cloth, ''),
  IFNULL(s.secondary_cloth_A, ''),
  IFNULL(s.secondary_cloth_B, ''),
  IFNULL(s.cut_parts, ''),
  IFNULL(s.weaving_type, ''),
  IFNULL(s.sku_color_code, ''),
  IFNULL(s.sku_size_code, '')
FROM erp_sku s
WHERE s.sku_no IN (
  SELECT DISTINCT o.sku_no
  FROM erp_order o
  WHERE o.create_time >= '2026-01-01 00:00:00'
    AND o.create_time < '2027-01-01 00:00:00'
)
ORDER BY s.sku_no ASC;
" > /tmp/migration_orders_2026/07_sku_basic_2026.tsv
```

### 10 订单级生产要求（erp_order_require -> F区详细要求）

```bash
mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  r.order_id,
  IFNULL(o.order_no, ''),
  r.produce_category,
  r.is_title,
  IFNULL(r.require_name, ''),
  IFNULL(r.require_desc, ''),
  r.require_id
FROM erp_order_require r
LEFT JOIN erp_order o ON o.order_id = r.order_id
WHERE o.create_time >= '2026-01-01 00:00:00'
  AND o.create_time < '2027-01-01 00:00:00'
ORDER BY r.order_id ASC, r.produce_category ASC, r.require_id ASC;
" > /tmp/migration_orders_2026/10_order_require_2026.tsv
```

### 11 SKU级生产要求（erp_sku_require -> F区SKU级详细要求兜底）

```bash
mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  s.sku_no,
  r.produce_category,
  r.is_title,
  IFNULL(r.require_name, ''),
  IFNULL(r.require_desc, ''),
  r.require_id
FROM erp_sku_require r
INNER JOIN erp_sku s ON s.sku_id = r.sku_id
WHERE s.sku_no IN (
  SELECT DISTINCT o.sku_no
  FROM erp_order o
  WHERE o.create_time >= '2026-01-01 00:00:00'
    AND o.create_time < '2027-01-01 00:00:00'
)
ORDER BY s.sku_no ASC, r.produce_category ASC, r.require_id ASC;
" > /tmp/migration_orders_2026/11_sku_require_2026.tsv
```

把这些补充文件放到：

- `docs/migration-samples/orders-2026/02_order_sku_size_2026.tsv`
- `docs/migration-samples/orders-2026/03_order_size_2026.tsv`
- `docs/migration-samples/orders-2026/04_order_sku_require_2026.tsv`
- `docs/migration-samples/orders-2026/05_sku_size_2026.tsv`（可选但强烈建议）
- `docs/migration-samples/orders-2026/06_order_materials_2026.tsv`（C区优先来源）
- `docs/migration-samples/orders-2026/07_sku_basic_2026.tsv`（C/F区兜底来源）
- `docs/migration-samples/orders-2026/10_order_require_2026.tsv`（F区订单级详细要求）
- `docs/migration-samples/orders-2026/11_sku_require_2026.tsv`（F区SKU级详细要求兜底）

---

## 四、导出 2026 订单成本（SKU 成本 -> 新系统订单成本页）

目标：只迁移 **2026 年新建订单** 的成本信息到新系统 `订单成本` 页面三个板块：

- 物料信息 -> `物料成本`（`snapshot.materialRows`）
- 二次工艺 -> `工艺项目成本`（`snapshot.processItemRows`）
- 生产工序 -> `生产工序成本`（`snapshot.productionRows`）

注意：

- 成本快照存放在新系统表 `order_cost_snapshots.snapshot`，导入脚本只写这张表，不改订单主表与 `order_ext`。
- 供应商 / 物料类型 / 工序等配置项遵守“只存 ID”规则：物料类型写 `materialTypeId`，工序写 `processId`（若能匹配到新系统 `production_processes`）。

### 4.1 旧系统导出（在旧库执行）

在旧系统 Linux shell 执行（同 `/tmp/migration_orders_2026` 目录）：

```bash
# 08 SKU 物料（用作成本页“物料成本”的结构来源）
mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  m.sku_id,
  m.sku_no,
  IFNULL(m.materials_category, '') AS materials_category,
  IFNULL(m.supplier_name, '') AS supplier_name,
  IFNULL(m.materials_name, '') AS materials_name,
  IFNULL(m.materials_color, '') AS materials_color,
  IFNULL(m.materials_cm, '') AS materials_cm,
  IFNULL(m.materials_single, '') AS materials_single,
  IFNULL(m.materials_loss, '') AS materials_loss,
  IFNULL(m.full_price, 0) AS full_price,
  IFNULL(m.unit_price, 0) AS unit_price,
  IFNULL(m.use_part, '') AS use_part
FROM erp_sku_materials m
WHERE m.sku_no IN (
  SELECT DISTINCT o.sku_no
  FROM erp_order o
  WHERE o.create_time >= '2026-01-01 00:00:00'
    AND o.create_time < '2027-01-01 00:00:00'
)
ORDER BY m.sku_no ASC, m.materials_id ASC;
" > /tmp/migration_orders_2026/08_sku_materials_2026.tsv

# 09 SKU 二次工艺（用作成本页“工艺项目成本”）
mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  p.sku_id,
  p.sku_no,
  IFNULL(p.process_name, '') AS process_name,
  IFNULL(p.supplier_name, '') AS supplier_name,
  IFNULL(p.materials_name, '') AS materials_name,
  IFNULL(p.process_remark, '') AS process_remark,
  IFNULL(p.unit_price, 0) AS unit_price,
  IFNULL(p.unit_consumption, 0) AS unit_consumption,
  IFNULL(p.process_class, '') AS process_class
FROM erp_sku_process p
WHERE p.sku_no IN (
  SELECT DISTINCT o.sku_no
  FROM erp_order o
  WHERE o.create_time >= '2026-01-01 00:00:00'
    AND o.create_time < '2027-01-01 00:00:00'
)
ORDER BY p.sku_no ASC, p.process_id ASC;
" > /tmp/migration_orders_2026/09_sku_process_2026.tsv

# 10 SKU 生产工序（用作成本页“生产工序成本”）
mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  w.sku_id,
  s.sku_no,
  IFNULL(w.processes_name, '') AS processes_name,
  IFNULL(w.production_class, 0) AS production_class,
  IFNULL(w.group_id, 0) AS group_id,
  IFNULL(w.work_price, 0) AS work_price,
  IFNULL(w.sort, 0) AS sort
FROM erp_sku_work_processes w
JOIN erp_sku s ON s.sku_id = w.sku_id
WHERE s.sku_no IN (
  SELECT DISTINCT o.sku_no
  FROM erp_order o
  WHERE o.create_time >= '2026-01-01 00:00:00'
    AND o.create_time < '2027-01-01 00:00:00'
)
  AND IFNULL(w.is_delete, 0) = 0
ORDER BY s.sku_no ASC, w.production_class ASC, w.group_id ASC, w.sort ASC, w.sku_processes_id ASC;
" > /tmp/migration_orders_2026/10_sku_work_processes_2026.tsv
```

把导出的文件放到：

- `docs/migration-samples/orders-2026/08_sku_materials_2026.tsv`
- `docs/migration-samples/orders-2026/09_sku_process_2026.tsv`
- `docs/migration-samples/orders-2026/10_sku_work_processes_2026.tsv`

### 4.2 新系统导入（只写订单成本快照）

在项目 `backend` 目录执行：

```bash
# 先预览，不写库
node scripts/import-orders-2026-cost-snapshot.js --dry-run

# 正式导入（仅 upsert order_cost_snapshots）
node scripts/import-orders-2026-cost-snapshot.js
```

如果文件不在默认目录，可指定：

```bash
node scripts/import-orders-2026-cost-snapshot.js --sample-dir "../docs/migration-samples/orders-2026"
```

---

## 二、本地导入（新系统项目）

在项目 `backend` 目录执行：

```bash
# 先预览，不写库
node scripts/import-orders-2026.js --dry-run

# 正式导入
node scripts/import-orders-2026.js
```

如果你的文件不在默认目录，可指定：

```bash
node scripts/import-orders-2026.js --sample-dir "../docs/migration-samples/orders-2026"
```

---

## 三、导入结果检查建议

1. 订单列表确认有 2026 年数据；
2. 打开订单编辑：
   - `A区` 有 SKU 与图片；
   - `B区` 有颜色/尺码数量（依赖 `02_order_sku_size_2026.tsv`）；
   - `C区` 有物料信息（优先 `06_order_materials_2026.tsv`，其次制单表物料行，再次 `07_sku_basic_2026.tsv`）；
   - `D区` 有尺寸信息行（依赖 `03_order_size_2026.tsv`）；
   - `E区` 有印/绣花要求（依赖 `04_order_sku_require_2026.tsv`）；
   - `F区` 有详细生产要求（优先 `10_order_require_2026.tsv`，其次 `11_sku_require_2026.tsv`，再补充 process_desc 解析及 SKU 基础要求）；
   - `G区` 不导入制单附件图片；
   - `H区` 有制单附件图片（来自 `course_con_imgs`）。
