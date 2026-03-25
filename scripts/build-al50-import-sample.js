const fs = require('fs');
const path = require('path');

const sampleDir = path.resolve(__dirname, '..', 'docs', 'migration-samples', 'AL50');

function readTsv(fileName, headers) {
  const filePath = path.join(sampleDir, fileName);
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
  if (!raw) return [];

  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const values = line.split('\t');
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? '';
      });
      return row;
    });
}

function nullify(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toUpperCase() === 'NULL') return null;
  return trimmed;
}

function toNumber(value) {
  const normalized = nullify(value);
  if (normalized == null) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPercent(value) {
  const normalized = nullify(value);
  if (normalized == null) return null;
  const parsed = Number(normalized.replace('%', ''));
  return Number.isFinite(parsed) ? parsed / 100 : null;
}

const orderHeaders = [
  'order_id',
  'order_no',
  'sku_id',
  'sku_no',
  'design_no',
  'customer_id',
  'customer_name',
  'order_type',
  'order_num',
  'order_price',
  'factory_price',
  'process_str',
  'sku_image',
  'order_user_id',
  'order_user_name',
  'check_user_id',
  'check_user_name',
  'create_time',
  'order_time',
  'our_delivery_date',
  'expect_delivery_date',
  'order_delivery_date',
  'shipment_time',
  'order_status',
];

const skuHeaders = [
  'sku_id',
  'sku_no',
  'design_no',
  'sku_image',
  'customer_id',
  'customer_name',
  'salesman_user_id',
  'sku_price',
  'production_price',
  'create_time',
];

const productionHeaders = [
  'sku_id',
  'production_class',
  'group_id',
  'processes_id',
  'processes_name',
  'work_price',
  'sort',
];

const processItemHeaders = [
  'process_id',
  'sku_id',
  'sku_no',
  'process_name',
  'materials_id',
  'process_class',
  'materials_name',
  'contact_address',
  'contact_phone',
  'process_unit',
  'supplier_name',
  'unit_price',
  'process_price',
  'unit_consumption',
  'opt_user_id',
  'opt_user_name',
  'opt_time',
  'process_remark',
  'supplier_id',
];

const materialHeaders = [
  'detail_id',
  'order_id',
  'category_id',
  'title',
  'material_meter',
  'price',
  'unit_price',
  'simple_account',
  'simple_use',
  'supplier_loss',
  'supplier_profit',
];

const [order] = readTsv('01_order.tsv', orderHeaders);
const [sku] = readTsv('02_sku.tsv', skuHeaders);
const productionRowsRaw = readTsv('03_sku_work_processes.tsv', productionHeaders);
const processItemRowsRaw = readTsv('04_sku_process.tsv', processItemHeaders);
const materialRowsRaw = readTsv('05_sku_cost_detail.tsv', materialHeaders);

const latestCategoryId = materialRowsRaw
  .map((row) => toNumber(row.category_id))
  .filter((value) => value != null)
  .reduce((max, value) => (value > max ? value : max), 0);

const latestMaterialRows = materialRowsRaw.filter(
  (row) => toNumber(row.category_id) === latestCategoryId,
);

const product = {
  source: {
    oldDb: 'hyfsmes',
    oldSkuId: toNumber(sku.sku_id),
  },
  target: {
    sku_code: nullify(sku.sku_no),
    product_name: nullify(sku.design_no) || nullify(sku.sku_no),
    image_url: nullify(sku.sku_image),
    customer_id: toNumber(sku.customer_id),
    customer_name_note: nullify(sku.customer_name),
    salesperson_source_id: toNumber(sku.salesman_user_id),
    created_at: nullify(sku.create_time),
  },
};

const mappedOrder = {
  source: {
    oldDb: 'hyfsmes',
    oldOrderId: toNumber(order.order_id),
  },
  target: {
    order_no: nullify(order.order_no),
    sku_code: nullify(order.sku_no),
    customer_id: toNumber(order.customer_id),
    customer_name: nullify(order.customer_name),
    quantity: toNumber(order.order_num),
    sale_price: toNumber(order.order_price),
    ex_factory_price: toNumber(order.factory_price) ?? 0,
    process_item: nullify(order.process_str),
    image_url: nullify(order.sku_image),
    created_at: nullify(order.create_time),
    order_time: nullify(order.order_time),
    delivery_date_candidate:
      nullify(order.order_delivery_date) ||
      nullify(order.our_delivery_date) ||
      nullify(order.expect_delivery_date) ||
      nullify(order.shipment_time),
    order_type_source_text: nullify(order.order_type),
    order_status_source: nullify(order.order_status),
    salesperson_source_name: nullify(order.order_user_name),
    merchandiser_source_name: nullify(order.check_user_name),
  },
};

const snapshot = {
  sourceMeta: {
    sku_id: toNumber(sku.sku_id),
    latest_material_category_id: latestCategoryId,
    latest_material_row_count: latestMaterialRows.length,
    process_item_row_count: processItemRowsRaw.length,
    production_row_count: productionRowsRaw.length,
    notes: [
      'erp_sku_cost_detail contains historical BOM versions.',
      'For AL50 first pass, only the latest category_id is used.',
      'erp_sku_work_processes rows have processes_id=0 and production_class=0, so name-based mapping is required.',
      '06_work_process_dict.tsv is empty for this sample.',
    ],
  },
  materialRows: latestMaterialRows.map((row) => ({
    sourceDetailId: toNumber(row.detail_id),
    sourceCategoryId: toNumber(row.category_id),
    materialName: nullify(row.title),
    materialMeter: toNumber(row.material_meter),
    unitPrice: toNumber(row.unit_price),
    usagePerPiece: toNumber(row.simple_account),
    simpleUse: toNumber(row.simple_use),
    lossPercent: toPercent(row.supplier_loss),
    raw: {
      price: nullify(row.price),
      supplier_profit: nullify(row.supplier_profit),
    },
  })),
  processItemRows: processItemRowsRaw.map((row) => ({
    sourceProcessId: toNumber(row.process_id),
    processName: nullify(row.process_name),
    supplierName: nullify(row.supplier_name),
    unitPrice: toNumber(row.unit_price),
    quantity: toNumber(row.unit_consumption),
    amount: toNumber(row.process_price),
    unit: nullify(row.process_unit),
    processClass: nullify(row.process_class),
    remark: nullify(row.process_remark),
  })),
  productionRows: productionRowsRaw.map((row) => ({
    sourceGroupId: toNumber(row.group_id),
    sourceProcessesId: toNumber(row.processes_id),
    processName: nullify(row.processes_name),
    unitPrice: toNumber(row.work_price),
    sort: toNumber(row.sort),
    unresolvedDepartmentSource: toNumber(row.production_class),
    mappingStatus: 'needs_name_based_mapping',
  })),
};

const output = {
  sampleKey: 'AL50',
  generatedAt: new Date().toISOString(),
  product,
  order: mappedOrder,
  order_cost_snapshot: snapshot,
};

const outputPath = path.join(sampleDir, 'AL50_TARGET_IMPORT_SAMPLE.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

console.log(`Generated ${outputPath}`);
