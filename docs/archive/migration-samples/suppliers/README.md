# 供应商迁移导出说明（旧系统 -> 新系统）

## 一、导出目标

只导出以下 6 个字段（其余字段不迁移）：

1. 供应商名称
2. 业务范围
3. 联系人
4. 联系电话
5. 工厂地址
6. 结款时间

导出文件统一使用：`TSV`（与订单迁移一致）。

---

## 二、旧系统 Linux shell 导出步骤

> 注意：在 Linux shell 执行，不在 `mysql>` 提示符内执行。

### 1）创建导出目录

```bash
mkdir -p /tmp/migration_suppliers
```

### 2）导出数据体（无表头）

```bash
mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  TRIM(IFNULL(s.supplier_name, '')) AS supplier_name,
  TRIM(IFNULL(s.supplier_scope, '')) AS supplier_scope,
  TRIM(IFNULL(s.contact_person, '')) AS contact_person,
  TRIM(IFNULL(s.contact_info, '')) AS contact_info,
  TRIM(IFNULL(s.factory_address, '')) AS factory_address,
  TRIM(IFNULL(s.settlement_time, '')) AS settlement_time
FROM erp_sys_supplier s
WHERE TRIM(IFNULL(s.supplier_name, '')) <> ''
ORDER BY s.supplier_id ASC;
" > /tmp/migration_suppliers/01_suppliers_body.tsv
```

### 3）补充表头，生成最终文件

```bash
{
  printf "供应商名称\t业务范围\t联系人\t联系电话\t工厂地址\t结款时间\n"
  cat /tmp/migration_suppliers/01_suppliers_body.tsv
} > /tmp/migration_suppliers/01_suppliers.tsv
```

### 4）导出自检（必须执行）

```bash
wc -l /tmp/migration_suppliers/01_suppliers.tsv
sed -n '1,5p' /tmp/migration_suppliers/01_suppliers.tsv
sed -n '$p' /tmp/migration_suppliers/01_suppliers.tsv
```

---

## 三、文件放置到本地项目

将文件复制到：

- `docs/migration-samples/suppliers/01_suppliers.tsv`

---

## 四、本地导入命令（backend）

```bash
# 预览（不写库）
node scripts/import-legacy-suppliers.js --file="../docs/migration-samples/suppliers/01_suppliers.tsv" --dry-run

# 正式导入
node scripts/import-legacy-suppliers.js --file="../docs/migration-samples/suppliers/01_suppliers.tsv"
```

---

## 五、当前导入规则（与你确认一致）

- 旧系统「供应商名称」-> 新系统「供应商名称」
- 供应商类型统一默认「面料供应商」
- 业务范围按值映射；新系统没有的业务范围会自动补建到「面料供应商」下
- 联系人、联系电话、工厂地址、结款时间按同名导入
- 其他字段不导入

---

## 六、加工厂列表导入供应商（本次需求）

### 字段映射（严格按本次约定）

- 旧系统「加工厂名称」-> 新系统 `suppliers.name`
- 旧系统「加工厂级别」-> 新系统 `business_scope_id` / `business_scope_ids`
- 旧系统「备注」-> 新系统 `remark`
- 供应商类型统一默认「加工供应商」
- 其他字段不导入

### 1）旧系统导出（Linux shell）

```bash
mkdir -p /tmp/migration_suppliers

mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  TRIM(IFNULL(f.factory_name, '')) AS factory_name,
  TRIM(IFNULL(f.grade_name, '')) AS grade_name,
  TRIM(IFNULL(f.remark, '')) AS remark
FROM erp_factory f
WHERE TRIM(IFNULL(f.factory_name, '')) <> ''
ORDER BY f.factory_id ASC;
" > /tmp/migration_suppliers/02_factories_to_suppliers_body.tsv

{
  printf "加工厂名称\t加工厂级别\t备注\n"
  cat /tmp/migration_suppliers/02_factories_to_suppliers_body.tsv
} > /tmp/migration_suppliers/02_factories_to_suppliers.tsv

wc -l /tmp/migration_suppliers/02_factories_to_suppliers.tsv
sed -n '1,5p' /tmp/migration_suppliers/02_factories_to_suppliers.tsv
sed -n '$p' /tmp/migration_suppliers/02_factories_to_suppliers.tsv
```

### 2）放到本地项目

- `docs/migration-samples/suppliers/02_factories_to_suppliers.tsv`

### 3）本地导入命令（backend）

```bash
# 预览（不写库）
node scripts/import-legacy-factories-to-suppliers.js --file="../docs/migration-samples/suppliers/02_factories_to_suppliers.tsv" --dry-run

# 正式导入
node scripts/import-legacy-factories-to-suppliers.js --file="../docs/migration-samples/suppliers/02_factories_to_suppliers.tsv"
```

---

## 七、同步“加工厂级别”的说明值到业务范围显示（可选）

当你希望业务范围不只显示字母（A/B/C...），而是显示“字母+说明/比例”时，执行本节。

### 1）旧系统导出级别映射（Linux shell）

```bash
mkdir -p /tmp/migration_suppliers

mysql -uroot -p -D hyfsmes -N -B -e "
SELECT
  TRIM(IFNULL(g.grade_name, '')) AS grade_name,
  TRIM(IFNULL(g.grade_desc, '')) AS grade_desc,
  TRIM(IFNULL(g.ctm_proportion, '')) AS ctm_proportion,
  TRIM(IFNULL(g.fob_proportion, '')) AS fob_proportion
FROM erp_supplier_grade g
WHERE TRIM(IFNULL(g.grade_name, '')) <> ''
ORDER BY g.sort ASC, g.grade_id ASC;
" > /tmp/migration_suppliers/03_factory-grade-mapping_body.tsv

{
  printf "加工厂级别\t级别说明\tCTM比例\tFOB比例\n"
  cat /tmp/migration_suppliers/03_factory-grade-mapping_body.tsv
} > /tmp/migration_suppliers/03_factory-grade-mapping.tsv

wc -l /tmp/migration_suppliers/03_factory-grade-mapping.tsv
sed -n '1,5p' /tmp/migration_suppliers/03_factory-grade-mapping.tsv
sed -n '$p' /tmp/migration_suppliers/03_factory-grade-mapping.tsv
```

### 2）放到本地项目

- `docs/migration-samples/suppliers/03_factory-grade-mapping.tsv`

### 3）执行同步（backend）

```bash
# 预览（不写库）
node scripts/sync-processing-scope-labels.js --file="../docs/migration-samples/suppliers/03_factory-grade-mapping.tsv" --dry-run

# 正式同步
node scripts/sync-processing-scope-labels.js --file="../docs/migration-samples/suppliers/03_factory-grade-mapping.tsv"
```
