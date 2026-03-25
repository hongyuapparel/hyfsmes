# Database Migration Context

## Purpose

This file records the long-term context for the current old-system to new-system data migration work.
Use it as the source of truth in future sessions before continuing migration analysis, export work, or import scripting.

## Databases

- Old database: `hyfsmes`
- Old system access mode used in this migration:
  - BaoTa terminal
  - MySQL interactive prompt `mysql>`
- New system:
  - Current project workspace: `e:\1.Cursor-Project\6. hyfsmes`
  - New system codebase contains backend + frontend for the target ERP

## Migration Goal

This is not a full historical ERP rebuild.
The current migration focus is to move the minimum high-value business data needed by the new system:

- products / SKU basics
- orders
- process pricing
- material cost snapshots
- production process snapshots

Lower-priority or deferred items:

- strict customer master matching
- old user/login/account history
- old approval flow history
- old schedule/progress JSON history

## New System Tables Already Identified

Core target tables already confirmed from local schema and sample data:

- `products`
- `orders`
- `order_cost_snapshots`
- `production_processes`
- `process_quote_templates`
- `process_quote_template_items`
- `system_options`
- `order_ext`

Important option types already seen in the new system:

- `process_job_types`
- `order_types`
- `collaboration`
- `applicable_people`
- `material_types`
- `product_groups`

## Old System Tables Already Confirmed

Main old tables currently used for migration analysis:

- `erp_sku`
- `erp_order`
- `erp_work_processes`
- `erp_sku_work_processes`
- `erp_sku_process`
- `erp_sku_cost_detail`

## Confirmed Mapping Direction

### 1. Old process dictionary -> new process library

- Old: `erp_work_processes`
- New: `production_processes`

Suggested mapping:

- `work_class` -> `department`
- `group_name` or `work_name` -> `job_type`
- `processes_name` -> `name`
- `unit_price` -> `unit_price`
- `processes_sort` -> `sort_order`

### 2. Old SKU -> new products

- Old: `erp_sku`
- New: `products`

Suggested mapping:

- `sku_no` -> `sku_code`
- `design_no` -> `product_name`
- `sku_image` -> `image_url`
- `customer_id` -> `customer_id` if available, otherwise empty
- `salesman_user_id` -> temporary text mapping or leave empty in first pass
- `create_time` -> `created_at`

Notes:

- `customer_name` is useful display data but customer foreign key is not a strict blocker
- `sku_price` and `production_price` are no longer the main pricing center in the new system

### 3. Old order -> new orders

- Old: `erp_order`
- New: `orders`

Suggested mapping:

- `order_no` -> `order_no`
- `sku_no` -> `sku_code`
- `customer_id` -> `customer_id` if matchable, otherwise empty
- `customer_name` -> `customer_name`
- `order_num` -> `quantity`
- `order_price` -> `sale_price`
- `factory_price` -> `ex_factory_price`
- `order_type` -> `order_type_id` after option mapping
- `process_str` -> `process_item`
- `sku_image` -> `image_url`
- `order_user_name` or `check_user_name` -> `salesperson` / `merchandiser` by import rule
- `create_time` -> `created_at`

Delivery/date notes:

- `erp_order` does not have `delivery_time`
- Prefer one of these for delivery-related import:
  - `order_delivery_date`
  - `our_delivery_date`
  - `expect_delivery_date`
  - `shipment_time`

### 4. Old material/process/work costs -> new order snapshots

- New target: `order_cost_snapshots.snapshot`

#### Material rows

- Old source: `erp_sku_cost_detail`
- New target: `snapshot.materialRows`

Suggested mapping:

- `title` -> `materialName`
- `unit_price` -> `unitPrice`
- `simple_account` / `simple_use` -> usage-related fields
- `material_meter` -> quantity/supporting field
- `supplier_loss` -> loss percent after cleaning

Known data quality issues:

- mixed formats like `USD17`, `11/码`, `%8%`, `0..55`
- cannot import raw without cleaning

#### Process item rows

- Old source: `erp_sku_process`
- New target: `snapshot.processItemRows`

Suggested mapping:

- `process_name` -> `processName`
- `supplier_name` -> `supplierName`
- `process_remark` -> `remark`
- `process_price` -> amount
- `unit_price` -> `unitPrice`
- `unit_consumption` -> `quantity`

#### Production rows

- Old source: `erp_sku_work_processes`
- New target: `snapshot.productionRows`

Suggested mapping:

- `processes_id` -> new `production_processes.id` after matching
- `processes_name` -> fallback matching key
- `work_price` -> `unitPrice`
- `production_class` -> department inference
- `group_id` -> helper for job type inference
- `sort` -> sort/order

Department inference already observed:

- `production_class = 1` -> 裁床
- `production_class = 2` -> 车缝
- `production_class = 3` -> 尾部

## Business Clarifications Already Confirmed

- Customer records are not a hard migration dependency.
- `customer_name` can be preserved even if `customer_id` is not matched.
- Detailed process pricing is important and should be imported.
- The new system pricing center is mainly around order cost snapshots instead of only SKU base price.

## Current Test Sample Status

### First 20 earliest orders

The first batch chosen by earliest `order_id` was not ideal:

- orders existed
- SKU existed
- work/process data existed
- `erp_sku_cost_detail` returned empty for that batch

Conclusion:

- those orders are not good for full snapshot verification

### Current complete sample

Current sample order selected because it has material/process/work data:

- `order_id = 19182`
- `sku_id = 10640`
- `order_no = AL50`
- `sku_no = AL50`

Observed counts:

- material rows from `erp_sku_cost_detail`: `2415`
- process rows from `erp_sku_process`: `1`
- work process rows from `erp_sku_work_processes`: `19`

Important warning:

- `2415` material rows is abnormally large for a single SKU/order snapshot
- likely historical accumulation, repeated revisions, or non-snapshot storage
- `erp_sku_cost_detail` must not be imported blindly as-is

## AL50 Additional Clarifications Confirmed On 2026-03-25

- The old-system AL50 SKU page clearly shows:
  - a reachable SKU image inside the old system UI
  - a current cost page with visible material rows and total `50.63`
  - a size / process sheet with measurement rows and production notes
- The current exported AL50 sample files do **not** contain that full information.

What is confirmed missing from the current sample export:

- no size-sheet rows such as `裤脚开口 / 半腰围 / 臀围 / 裤长`
- no current production-note text such as old sewing / packaging / evaluation content
- no trustworthy current material list matching the old cost page total

This means:

- old UI visibility does **not** automatically mean our chosen export tables already include those fields
- the current AL50 migration sample is only a partial sample, not the full old-page source

### Image conclusion

- old DB currently gives us only the image path, for example:
  - `/Public/images/2025-05-08/681c9e5cecb81.png`
- the new local system cannot display that path unless the actual image file is migrated into new-system uploads or the old host remains reachable
- importing only the path is not enough

### Current local AL50 import policy

To avoid showing wrong data in the new system, AL50 local test import now uses the safer rule:

- image URL: empty unless a local mirrored image file exists under new uploads
- `order_ext.materials`: empty
- `order_ext.color_size_rows`: empty
- `order_ext.size_info_rows`: empty
- `order_ext.production_requirement`: empty
- `order_ext.attachments`: empty
- `order_cost_snapshots.snapshot.materialRows`: empty

Still kept for AL50 local verification:

- order basic info
- mapped completed status
- mapped order type
- one process item row
- nineteen production process rows

## Export Work Status

Dedicated server export folder prepared:

- `/tmp/migration_20260325_al50`

Current issue:

- user previously attempted export, but the expected file did not appear in the dedicated folder
- likely causes still to verify:
  - export SQL was not actually the final `INTO OUTFILE` statement
  - MySQL session changed and temporary table was lost
  - file path / permissions / secure-file-priv issue
  - query execution did not complete successfully

Resolved findings:

- `SELECT ... INTO OUTFILE` cannot be used on this server
- MySQL error confirmed:
  - `ERROR 1290 (HY000): The MySQL server is running with the --secure-file-priv option so it cannot execute this statement`
- working export method:
  - run from Linux shell instead of `mysql>`
  - use `mysql -uroot -p -D hyfsmes -N -B -e "SQL" > /tmp/.../*.tsv`

## Production Process Library Status

First independent migration phase completed on 2026-03-25:

- old source file:
  - `docs/migration-samples/production-processes/erp_work_processes.tsv`
- local import script:
  - `backend/scripts/import-old-production-processes.js`

Local import result:

- source rows: `7811`
- deduped rows: `7755`
- inserted: `7755`
- current local `production_processes` total: `7757`

Current department distribution after first-pass import:

- `车缝`: `7672`
- `尾部`: `84`
- `裁床`: `1`

Important note:

- process library import is now technically working
- department / job-type classification is still first-pass heuristic and may need refinement after UI review

## AL50 Sample Files Imported Into Workspace

Local sample folder:

- `docs/migration-samples/AL50`

Imported files:

- `01_order.tsv`
- `02_sku.tsv`
- `03_sku_work_processes.tsv`
- `04_sku_process.tsv`
- `05_sku_cost_detail.tsv`
- `06_work_process_dict.tsv`

Current status:

- files `01` to `05` contain data
- file `06` is empty

Reason `06` is empty:

- in `03_sku_work_processes.tsv`, all rows have:
  - `production_class = 0`
  - `processes_id = 0`
- therefore old sample cannot join to `erp_work_processes` by `processes_id`
- for this sample, production rows should be carried forward by process name and price first

## AL50 Local Import Status

AL50 has already been imported into the local new-system test database and then upgraded to a second-pass "UI-visible" import.

Current local DB state:

- `products.sku_code = AL50`
- `orders.order_no = AL50`
- `orders.status = completed`
- `orders.order_type_id = 6` (`样品`)
- `products.image_url` and `orders.image_url` now use an absolute old-system URL:
  - `http://47.112.218.75/Public/images/2025-05-08/681c9e5cecb81.png`
- `order_ext` is now populated for AL50:
  - `materials = 23`
  - `color_size_rows = 1`
  - `process_items = 1`
  - `production_requirement` filled
- `order_cost_snapshots.snapshot` is populated:
  - `materialRows = 23`
  - `processItemRows = 1`
  - `productionRows = 19`

Important limitation:

- the current AL50 export files do not contain exact old color-size distribution JSON or rich old remark fields
- therefore AL50 B/F areas are currently "best-effort migration":
  - B area uses a placeholder row: `未区分 / 均码 / 1`
  - F area contains preserved old migration notes and source references
- if exact old size/color/remark restoration is required, the old-system export must be expanded to include:
  - `order_code`
  - `sku_code`
  - `order_remark`
  - `before_require`
  - `cutting_require`
  - `sewing_require`
  - `tail_require`
  - `process_desc`

## AL50 Material Detail Pattern

`05_sku_cost_detail.tsv` analysis:

- total rows: `2415`
- all rows use `order_id = 10640`
- unique `category_id` count: `105`
- each `category_id` contains exactly `23` rows
- each `category_id` also contains `23` distinct titles

Conclusion:

- `erp_sku_cost_detail` is storing historical BOM versions for this SKU
- it is not a single one-time order snapshot
- current best first-pass rule for AL50:
  - use the latest `category_id` as the current candidate BOM snapshot

Current latest observed category for AL50:

- `latest_category_id = 22398`

Rows in latest category:

- `23`

## Next Recommended Export Verification

Before exporting all six files, verify one file end-to-end:

1. Re-enter old database:
   - `use hyfsmes;`
2. Recreate the needed temporary selection table if the session changed
3. Run one `SELECT ... INTO OUTFILE '/tmp/migration_20260325_al50/01_order.csv' ...`
4. Confirm:
   - MySQL reports success
   - the file appears in `/tmp/migration_20260325_al50`
   - opening it shows the expected AL50 row

## Suggested Export File Names

If export is successful, keep fixed names:

- `01_order.csv`
- `02_sku.csv`
- `03_sku_work_processes.csv`
- `04_sku_process.csv`
- `05_sku_cost_detail.csv`
- `06_work_process_dict.csv`

## First-Pass Import Sequence

Recommended import order:

1. `production_processes`
2. `products`
3. `orders`
4. `order_cost_snapshots`

## First-Pass Skip List

Do not migrate these in the first pass:

- old schedule/progress JSON
- old approval/history metadata
- user/login history
- strict customer master reconciliation
- miscellaneous workflow counters and message fields

## Notes For Future Sessions

When continuing this migration, always re-check:

- old DB name: `hyfsmes`
- whether the current MySQL session is still the same one
- whether `tmp_mig_order_ids` still exists
- whether export path is dedicated and empty before writing files
- whether `erp_sku_cost_detail` needs de-duplication/version filtering before import
