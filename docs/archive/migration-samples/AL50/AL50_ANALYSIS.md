# AL50 Analysis

## Sample Identity

- old DB: `hyfsmes`
- order_id: `19182`
- order_no: `AL50`
- sku_id: `10640`
- sku_no: `AL50`

## Exported Files

- `01_order.tsv`
- `02_sku.tsv`
- `03_sku_work_processes.tsv`
- `04_sku_process.tsv`
- `05_sku_cost_detail.tsv`
- `06_work_process_dict.tsv`

## File Status

- `01_order.tsv`: 1 row
- `02_sku.tsv`: 1 row
- `03_sku_work_processes.tsv`: 19 rows
- `04_sku_process.tsv`: 1 row
- `05_sku_cost_detail.tsv`: 2415 rows
- `06_work_process_dict.tsv`: 0 rows

## Direct Findings

### Order

Main values visible from `01_order.tsv`:

- `order_id = 19182`
- `order_no = AL50`
- `sku_id = 10640`
- `sku_no = AL50`
- `customer_id = 2129`
- `customer_name = Alex- Turki alharbi`
- `order_num = 1`
- `order_price = 35.35`
- `factory_price = 0.00`
- `image = /Public/images/2025-05-08/681c9e5cecb81.png`
- `create_time = 2025-05-12 14:15:02`
- `our_delivery_date = 2025-05-27`
- `order_status = 100`

### SKU

Main values visible from `02_sku.tsv`:

- `sku_id = 10640`
- `sku_no = AL50`
- `design_no = AL50`
- `customer_id = 2129`
- `customer_name = Alex- Turki alharbi`
- `salesman_user_id = 1124`
- `sku_price = 83.37`
- `production_price = 20.16`
- `create_time = 2025-04-02 13:06:29`

### Production Rows

`03_sku_work_processes.tsv` contains 19 rows.

Important characteristics:

- all `production_class = 0`
- all `processes_id = 0`
- usable fields are mainly:
  - `processes_name`
  - `work_price`
  - `sort`
  - `group_id`

This means AL50 cannot currently rely on old process dictionary ID matching.
For AL50 first-pass migration, production rows should be imported by process name and price.

### Process Item Rows

`04_sku_process.tsv` contains 1 row:

- `process_name = 绣花`
- `process_class = 成衣`
- `supplier_name = 冠鑫绣花厂`
- `unit_price = 5.00`
- `process_price = 5.00`
- `unit_consumption = 1.00`
- `process_remark = 裁片绣花`

### Material Rows

`05_sku_cost_detail.tsv` contains 2415 rows, but this is not one BOM.

Observed pattern:

- all rows belong to `order_id = 10640`
- there are `105` distinct `category_id`
- each `category_id` contains exactly `23` rows
- each `category_id` contains `23` distinct titles

Conclusion:

- the old table is storing many historical BOM versions for the same SKU
- AL50 first-pass import should not use all 2415 rows

## Current Best Rule For AL50

Use the newest BOM version:

- latest `category_id = 22398`
- latest version row count: `23`

This is the best current candidate to map into new-system `snapshot.materialRows`.

## Migration Recommendation For AL50

### Products

Use:

- `sku_no` -> `sku_code`
- `design_no` -> `product_name`
- `sku_image` -> `image_url`
- `customer_id` optional
- `customer_name` keep for display/reference
- `create_time` -> `created_at`

### Orders

Use:

- `order_no` -> `order_no`
- `sku_no` -> `sku_code`
- `customer_name` -> `customer_name`
- `order_num` -> `quantity`
- `order_price` -> `sale_price`
- `factory_price` -> `ex_factory_price`
- `sku_image` -> `image_url`
- `create_time` -> `created_at`
- `our_delivery_date` -> delivery-related field

### Snapshot Material Rows

Use only rows where:

- `category_id = 22398`

Map:

- `title` -> `materialName`
- `material_meter` -> quantity/supporting quantity field
- `unit_price` -> `unitPrice`
- `simple_account` -> usage-per-piece candidate
- `supplier_loss` -> loss percent

### Snapshot Process Item Rows

Use the one row from `04_sku_process.tsv`

Map:

- `process_name` -> `processName`
- `supplier_name` -> `supplierName`
- `unit_price` -> `unitPrice`
- `unit_consumption` -> `quantity`
- `process_price` -> amount
- `process_remark` -> `remark`

### Snapshot Production Rows

Use all 19 rows from `03_sku_work_processes.tsv`

Map:

- `processes_name` -> process name
- `work_price` -> unit price
- `sort` -> sort
- `group_id` -> helper classification

## Open Risk

AL50 proves the export path works, but it also proves the old material table is versioned history.
Before doing larger migration batches, BOM version selection rules must be defined clearly.

## Why Old UI Shows More Than Current Import

The current AL50 exported sample is incomplete relative to the old UI.

Confirmed by comparison:

- old UI cost page shows current visible material rows and total `50.63`
- current exported `05_sku_cost_detail_latest_22398.tsv` gives 23 rows and does not match that page total
- old UI size / process sheet shows rows like `裤脚开口 / 半腰围 / 臀围 / 裤长`
- none of those keywords appear in the current exported AL50 TSV sample set

Conclusion:

- the current import gap is not only a new-system mapping problem
- the current old-system export is missing at least one additional source table or rendered content source

### Image gap

- old UI can display AL50 image because the old system still has access to the old image file
- current new-system local test cannot display it because we only imported the path, not the actual image file
- path-only import is insufficient for image migration

## Local Reimport Result

AL50 has been reimported into the local new-system test DB with a second-pass script update.

Current local target result:

- product image switched from old relative path to absolute old-system URL
- order status switched from `draft` to `completed`
- order type mapped from old `样板` to new `样品`
- `order_ext` is now filled so edit/detail pages can show:
  - B color-size section
  - C materials
  - E process items
  - F production requirement
- `order_cost_snapshots` remains populated for cost page display

Known temporary compromise for AL50:

- exact old color/size detail was not present in the exported sample files
- current B area therefore uses one placeholder row:
  - color: `未区分`
  - size header: `均码`
  - quantity: `1`
