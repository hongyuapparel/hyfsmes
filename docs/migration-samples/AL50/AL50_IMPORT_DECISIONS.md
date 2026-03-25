# AL50 Import Decisions

## What AL50 Can Already Drive

The AL50 sample is now sufficient to define a first-pass import path for the new system.

It can support these three target objects:

1. one `products` row
2. one `orders` row
3. one `order_cost_snapshots` row

## Product Row Decision

Use AL50 as one product in the new system.

Main target fields:

- `sku_code = AL50`
- `product_name = AL50`
- `image_url = /Public/images/2025-05-08/681c9e5cecb81.png`
- `customer_id = 2129` if the new system can accept it, otherwise keep empty
- `created_at = 2025-04-02 13:06:29`

Deferred fields:

- salesperson name lookup
- customer strict foreign key reconciliation

## Order Row Decision

Use AL50 as one order in the new system.

Main target fields:

- `order_no = AL50`
- `sku_code = AL50`
- `customer_name = Alex- Turki alharbi`
- `quantity = 1`
- `sale_price = 35.35`
- `ex_factory_price = 0`
- `image_url = /Public/images/2025-05-08/681c9e5cecb81.png`
- `created_at = 2025-05-12 14:15:02`
- `order_time = 2025-05-12 14:15:02`
- delivery candidate = `2025-05-27`

Still unresolved before real import:

- new-system `order_type_id` mapping
- whether old `customer_id = 2129` should be preserved or cleared
- whether order should set salesperson / merchandiser to empty or mapped text

## Snapshot Decision

Use AL50 to build one snapshot for the order after the order row exists.

### Material rows

Do not use all 2415 old material rows.

Use only:

- latest `category_id = 22398`
- row count = `23`

### Process item rows

Use the single old process row:

- `processName = 绣花`
- `supplierName = 冠鑫绣花厂`
- `unitPrice = 5.00`
- `quantity = 1.00`
- `amount = 5.00`
- `remark = 裁片绣花`

### Production rows

Use all 19 old production rows from `03_sku_work_processes.tsv`.

Important limitation:

- `processes_id = 0`
- `production_class = 0`
- no reliable old dictionary ID mapping for this sample

So AL50 production rows must be imported with:

- process name
- unit price
- sort order

and later matched to the new process library by name or by a manual mapping table.

## Immediate Next Step

The next practical step is not exporting more AL50 data.

The next practical step is:

1. treat AL50 as the reference sample
2. define one first-pass import template for:
   - product
   - order
   - snapshot
3. then export 2 to 3 more representative old samples and verify whether:
   - BOM version pattern is stable
   - process item structure is stable
   - production row naming is stable

## Recommendation

After AL50, the best next sample types are:

- one normal large production order
- one order with more than one process item row
- one order whose `erp_sku_work_processes` can actually join to `erp_work_processes`
