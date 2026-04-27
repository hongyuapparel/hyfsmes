# Production Processes Migration

This folder is for the first migration phase: old process library -> new `production_processes`.

## Old source table

- `hyfsmes.erp_work_processes`

## Export target file

Put the old export here with this exact filename:

- `erp_work_processes.tsv`

## Recommended old-system export command

Run on the old server shell, not inside `mysql>`:

```bash
mysql -uroot -p -D hyfsmes -N -B -e "SELECT processes_id,processes_name,unit_price,processes_sort,work_name,work_class,group_name FROM erp_work_processes ORDER BY work_class,group_name,processes_sort,processes_id" > /tmp/erp_work_processes.tsv
```

Then download:

- `/tmp/erp_work_processes.tsv`

and place it in:

- `docs/migration-samples/production-processes/erp_work_processes.tsv`

## Import command

After the file is in place, run locally:

```bash
node backend/scripts/import-old-production-processes.js
```

## Current first-pass mapping rule

- `work_class` -> `department`
- `group_name` -> `job_type`
- fallback: if `group_name` is empty, use `work_name`
- `processes_name` -> `name`
- `unit_price` -> `unit_price`
- `processes_sort` -> `sort_order`

## Notes

- This phase intentionally ignores SKU, order, cost, image, and size-sheet problems.
- Goal: make the new system process library complete and verifiable first.
