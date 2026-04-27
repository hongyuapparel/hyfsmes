const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const OLD_ASSET_BASE_URL = process.env.OLD_ASSET_BASE_URL || 'http://47.112.218.75';
const LOCAL_UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads', 'migration-old');

function loadEnv(envPath) {
  const env = {};
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!/^[A-Z0-9_]+=/.test(line)) continue;
    const idx = line.indexOf('=');
    env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
}

function parseArgs(argv) {
  const args = { sampleDir: '', dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (token === '--sample-dir') {
      args.sampleDir = argv[i + 1] || '';
      i += 1;
    }
  }
  return args;
}

function readTsvLines(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ''))
    .filter(Boolean);
}

function toNullableString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text || text.toUpperCase() === 'NULL') return null;
  return text;
}

function toNumber(value) {
  const text = toNullableString(value);
  if (text == null) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value) {
  const text = toNullableString(value);
  if (!text) return null;
  const d = new Date(text.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function toAbsoluteImageUrl(value) {
  const text = toNullableString(value);
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith('/')) return `${OLD_ASSET_BASE_URL}${text}`;
  return `${OLD_ASSET_BASE_URL}/${text}`;
}

function resolveImportImageUrl(value) {
  const text = toNullableString(value);
  if (!text) return '';
  const filename = path.basename(text);
  if (!filename) return '';
  const localMirrorPath = path.join(LOCAL_UPLOADS_DIR, filename);
  if (fs.existsSync(localMirrorPath)) {
    return `/api/uploads/migration-old/${filename}`;
  }
  return toAbsoluteImageUrl(text);
}

function parseOrderRow(line) {
  const cols = line.split('\t');
  return {
    oldOrderId: toNumber(cols[0]),
    orderNo: toNullableString(cols[1]) || '',
    skuNo: toNullableString(cols[2]) || '',
    skuImage: toNullableString(cols[3]) || '',
    customerId: toNumber(cols[4]),
    customerName: toNullableString(cols[5]) || '',
    quantity: toNumber(cols[6]) || 0,
    exFactoryPrice: toNumber(cols[7]) || 0,
    salePrice: toNumber(cols[8]) || 0,
    processStr: toNullableString(cols[9]) || '',
    oldStatusCode: toNullableString(cols[10]) || '',
    oldStatusName: toNullableString(cols[11]) || '',
    orderUserName: toNullableString(cols[12]) || '',
    checkUserName: toNullableString(cols[13]) || '',
    trackUserName: toNullableString(cols[14]) || '',
    createTime: parseDate(cols[15]),
    orderTime: parseDate(cols[16]),
    orderDeliveryDate: parseDate(cols[17]),
    ourDeliveryDate: parseDate(cols[18]),
    expectDeliveryDate: parseDate(cols[19]),
    shipmentTime: parseDate(cols[20]),
    beforeRequire: toNullableString(cols[21]) || '',
    cuttingRequire: toNullableString(cols[22]) || '',
    sewingRequire: toNullableString(cols[23]) || '',
    tailRequire: toNullableString(cols[24]) || '',
    orderRemark: toNullableString(cols[25]) || '',
    processDescHtml: toNullableString(cols[26]) || '',
    orderCodeJson: toNullableString(cols[27]) || '',
    skuColorCode: toNullableString(cols[28]) || '',
    skuSizeCode: toNullableString(cols[29]) || '',
    courseConImgsHtml: toNullableString(cols[30]) || '',
    oldOrderType: toNullableString(cols[31]) || '',
    isSample: toNumber(cols[32]),
  };
}

function parseOrderSkuSizeRow(line) {
  const cols = line.split('\t');
  return {
    orderId: toNumber(cols[0]),
    orderNo: toNullableString(cols[1]) || '',
    isTitle: toNumber(cols[2]) || 0,
    sort: toNumber(cols[3]) || 0,
    cells: cols.slice(4, 16).map((x) => toNullableString(x) || ''),
  };
}

function parseOrderSizeRow(line) {
  const cols = line.split('\t');
  return {
    orderId: toNumber(cols[0]),
    orderNo: toNullableString(cols[1]) || '',
    isTitle: toNumber(cols[2]) || 0,
    sort: toNumber(cols[3]) || 0,
    cells: cols.slice(4, 19).map((x) => toNullableString(x) || ''),
  };
}

function parseOrderSkuRequireRow(line) {
  const cols = line.split('\t');
  return {
    orderId: toNumber(cols[0]),
    orderNo: toNullableString(cols[1]) || '',
    produceCategory: toNumber(cols[2]) || 0,
    isTitle: toNumber(cols[3]) || 0,
    requireName: toNullableString(cols[4]) || '',
    requireDesc: toNullableString(cols[5]) || '',
    sort: toNumber(cols[6]) || 0,
  };
}

function parseSkuSizeRow(line) {
  const cols = line.split('\t');
  return {
    skuNo: toNullableString(cols[0]) || '',
    isTitle: toNumber(cols[1]) || 0,
    sort: toNumber(cols[2]) || 0,
    cells: cols.slice(3).map((x) => toNullableString(x) || ''),
  };
}

function parseOrderMaterialsRow(line) {
  const cols = line.split('\t');
  return {
    orderId: toNumber(cols[0]),
    orderNo: toNullableString(cols[1]) || '',
    skuNo: toNullableString(cols[2]) || '',
    supplierName: toNullableString(cols[3]) || '',
    materialCategory: toNullableString(cols[4]) || '',
    materialName: toNullableString(cols[5]) || '',
    materialColor: toNullableString(cols[6]) || '',
    usagePerPiece: toNumber(cols[7]),
    lossText: toNullableString(cols[8]) || '',
    orderNum: toNumber(cols[9]),
    plannedUsage: toNumber(cols[10]),
    remark: toNullableString(cols[11]) || '',
  };
}

function parseSkuBasicRow(line) {
  const cols = line.split('\t');
  return {
    skuNo: toNullableString(cols[0]) || '',
    processStr: toNullableString(cols[1]) || '',
    beforeRequire: toNullableString(cols[2]) || '',
    cuttingRequire: toNullableString(cols[3]) || '',
    sewingRequire: toNullableString(cols[4]) || '',
    tailRequire: toNullableString(cols[5]) || '',
    primaryCloth: toNullableString(cols[6]) || '',
    secondaryCloth: toNullableString(cols[7]) || '',
    secondaryClothA: toNullableString(cols[8]) || '',
    secondaryClothB: toNullableString(cols[9]) || '',
    cutParts: toNullableString(cols[10]) || '',
    weavingType: toNullableString(cols[11]) || '',
    skuColorCode: toNullableString(cols[12]) || '',
    skuSizeCode: toNullableString(cols[13]) || '',
  };
}

// produce_category: 1=裁床, 2=车缝, 3=尾部
function parseRequireRow(line) {
  const cols = line.split('\t');
  return {
    orderId: toNumber(cols[0]),
    orderNo: toNullableString(cols[1]) || '',
    produceCategory: toNumber(cols[2]) || 0,
    isTitle: toNumber(cols[3]) || 0,
    requireName: toNullableString(cols[4]) || '',
    requireDesc: toNullableString(cols[5]) || '',
    sort: toNumber(cols[6]) || 0,
  };
}

function parseSkuRequireRow(line) {
  const cols = line.split('\t');
  return {
    skuNo: toNullableString(cols[0]) || '',
    produceCategory: toNumber(cols[1]) || 0,
    isTitle: toNumber(cols[2]) || 0,
    requireName: toNullableString(cols[3]) || '',
    requireDesc: toNullableString(cols[4]) || '',
    sort: toNumber(cols[5]) || 0,
  };
}

const CATEGORY_LABELS = { 1: '裁剪要求', 2: '车间要求', 3: '尾部要求' };

function composeRequirementText(requireRows) {
  if (!requireRows || !requireRows.length) return '';
  const data = requireRows
    .filter((r) => Number(r.isTitle) !== 1)
    .sort((a, b) => (a.produceCategory || 0) - (b.produceCategory || 0) || (a.sort || 0) - (b.sort || 0));
  if (!data.length) return '';
  const byCat = new Map();
  for (const r of data) {
    const cat = r.produceCategory || 0;
    if (!byCat.has(cat)) byCat.set(cat, []);
    const name = String(r.requireName || '').trim();
    const desc = String(r.requireDesc || '').trim();
    if (name || desc) byCat.get(cat).push(name && desc ? `${name}：${desc}` : (name || desc));
  }
  const sections = [];
  const catOrder = [1, 2, 3, 0];
  for (const cat of catOrder) {
    const items = byCat.get(cat);
    if (!items || !items.length) continue;
    const label = CATEGORY_LABELS[cat] || `其他要求(${cat})`;
    sections.push(`【${label}】\n${items.join('\n')}`);
  }
  return sections.join('\n\n').trim();
}

function decodeHtml(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function stripHtml(text) {
  return decodeHtml(String(text || ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

function extractTableRows(html) {
  const rows = [];
  const trMatches = String(html || '').match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trMatches) {
    const cells = [];
    const cellReg = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
    let m;
    while ((m = cellReg.exec(tr)) !== null) {
      const cellText = decodeHtml(m[2])
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\r/g, '')
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
        .join(' ');
      cells.push(cellText);
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function isSizeHeaderCell(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return /^(\d{1,2}|[XSML]{1,3}|[0-9]{1,2}XL|XXL|XXXL)$/i.test(t) || /^(6|8|10|12|14|16|18|20)$/.test(t);
}

function parseMixedNumber(text) {
  const t = String(text || '').trim();
  if (!t) return 0;
  const pure = t.replace(/,/g, '');
  if (/^-?\d+(\.\d+)?$/.test(pure)) return Number(pure);
  const mixed = pure.match(/^(-?\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const a = Number(mixed[1]);
    const b = Number(mixed[2]);
    const c = Number(mixed[3]);
    if (Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && c !== 0) return a + b / c;
  }
  const frac = pure.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const b = Number(frac[1]);
    const c = Number(frac[2]);
    if (Number.isFinite(b) && Number.isFinite(c) && c !== 0) return b / c;
  }
  return 0;
}

function extractSizeInfoFromProcessDesc(html) {
  const rows = extractTableRows(html);
  if (!rows.length) {
    return {
      sizeInfoMetaHeaders: [],
      colorSizeHeaders: [],
      sizeInfoRows: [],
    };
  }

  let headerIndex = -1;
  let firstSizeCol = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const col = row.findIndex((cell) => isSizeHeaderCell(cell));
    if (col > 0 && row.some((c) => c.includes('部位'))) {
      headerIndex = i;
      firstSizeCol = col;
      break;
    }
  }
  if (headerIndex < 0 || firstSizeCol < 0) {
    return {
      sizeInfoMetaHeaders: [],
      colorSizeHeaders: [],
      sizeInfoRows: [],
    };
  }

  const headerRow = rows[headerIndex];
  const sizeInfoMetaHeaders = headerRow.slice(0, firstSizeCol).map((x) => x || '');
  const colorSizeHeaders = headerRow.slice(firstSizeCol).map((x) => x || '').filter(Boolean);

  const sizeInfoRows = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row.length) continue;
    const first = String(row[0] || '').trim();
    if (!first) continue;
    if (/^[一二三四五六七八九十]+、/.test(first) || /要求/.test(first)) break;

    const metaValues = sizeInfoMetaHeaders.map((_, idx) => String(row[idx] || '').trim());
    const sizeValues = colorSizeHeaders.map((_, idx) => {
      const raw = row[firstSizeCol + idx] || '';
      return parseMixedNumber(raw);
    });
    if (metaValues.some(Boolean) || sizeValues.some((n) => n > 0)) {
      sizeInfoRows.push({ metaValues, sizeValues });
    }
  }

  return {
    sizeInfoMetaHeaders,
    colorSizeHeaders,
    sizeInfoRows,
  };
}

function extractPrintEmbroideryRequirement(html) {
  const lines = stripHtml(html);
  if (!lines.length) return '';
  const start = lines.findIndex((x) => /印.*绣.*要求|印绣花要求|印\/绣花要求|印花要求|绣花要求/.test(x));
  if (start < 0) return '';
  const picked = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const text = lines[i];
    if (!text) continue;
    if (/^[一二三四五六七八九十]+、/.test(text)) break;
    if (/车间要求|尾部要求|裁前要求|裁床要求/.test(text)) break;
    picked.push(text);
  }
  return picked.join('\n').trim();
}

function parseColorSizeRowsFromOrderCode(orderCodeJson) {
  const text = String(orderCodeJson || '').trim();
  if (!text) return { headers: [], rows: [] };

  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { headers: [], rows: [] };
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { headers: [], rows: [] };
  }

  const headers = [];
  const rowsByColor = new Map();
  const keyList = Object.keys(obj);
  for (const key of keyList) {
    const raw = String(key || '').trim();
    if (!raw) continue;
    const idx = raw.lastIndexOf('-');
    if (idx <= 0 || idx >= raw.length - 1) continue;
    const color = raw.slice(0, idx).trim();
    const size = raw.slice(idx + 1).trim();
    if (!color || !size) continue;
    if (!headers.includes(size)) headers.push(size);
    const quantity = Number(obj[key]) || 0;
    const row = rowsByColor.get(color) || { colorName: color, map: new Map(), remark: '' };
    row.map.set(size, quantity);
    rowsByColor.set(color, row);
  }

  const rows = Array.from(rowsByColor.values()).map((x) => ({
    colorName: x.colorName,
    quantities: headers.map((h) => Number(x.map.get(h)) || 0),
    remark: x.remark || '',
  }));

  return { headers, rows };
}

function parseColorSizeRowsFromSkuSizeTable(rows) {
  if (!rows || !rows.length) return { headers: [], rows: [] };
  const ordered = [...rows].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const title = ordered.find((x) => Number(x.isTitle) === 1);
  const dataRows = ordered.filter((x) => Number(x.isTitle) !== 1);
  if (!title || !dataRows.length) return { headers: [], rows: [] };

  const headers = title.cells
    .slice(2)
    .map((x) => String(x || '').trim())
    .filter((x) => x && !/合计/.test(x));
  if (!headers.length) return { headers: [], rows: [] };

  const resultRows = dataRows
    .map((r) => {
      const color = String(r.cells[0] || '').trim();
      if (!color) return null;
      const quantities = headers.map((_, idx) => Number(r.cells[2 + idx]) || 0);
      return { colorName: color, quantities, remark: '' };
    })
    .filter(Boolean);
  return { headers, rows: resultRows };
}

function parseColorSizeRowsFromProcessDesc(html) {
  const rows = extractTableRows(html);
  if (!rows.length) return { headers: [], rows: [] };

  let headerIndex = -1;
  let firstSizeCol = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const hasColorTitle = row.some((c) => String(c || '').includes('颜色/尺寸'));
    const col = row.findIndex((cell) => isSizeHeaderCell(cell));
    if (hasColorTitle && col > 0) {
      headerIndex = i;
      firstSizeCol = col;
      break;
    }
  }
  if (headerIndex < 0 || firstSizeCol < 0) return { headers: [], rows: [] };

  const headerRow = rows[headerIndex];
  const headers = headerRow
    .slice(firstSizeCol)
    .map((x) => String(x || '').trim())
    .filter((x) => x && !/合计/.test(x));
  if (!headers.length) return { headers: [], rows: [] };

  const colorRows = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row.length) continue;
    const first = String(row[0] || '').trim();
    if (!first) continue;
    if (/下单总计|部位|英文字段|量法/.test(first)) break;
    if (/^[一二三四五六七八九十]+、/.test(first)) break;

    const quantities = headers.map((_, idx) => parseMixedNumber(row[firstSizeCol + idx] || '0'));
    if (!quantities.some((n) => n > 0)) continue;
    colorRows.push({ colorName: first, quantities, remark: '' });
  }
  return { headers, rows: colorRows };
}

function parseSizeInfoFromOrderSizeTable(rows, preferredSizeHeaders) {
  if (!rows || !rows.length) return { sizeInfoMetaHeaders: [], sizeInfoRows: [] };
  const ordered = [...rows].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  const title = ordered.find((x) => Number(x.isTitle) === 1);
  const dataRows = ordered.filter((x) => Number(x.isTitle) !== 1);
  const defaultMetaHeaders = ['部位', '英文部位', '盘法', '娃样尺寸', '样衣尺寸', '公差'];
  const normalizedPreferred = Array.isArray(preferredSizeHeaders)
    ? preferredSizeHeaders.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  if (!dataRows.length) return { sizeInfoMetaHeaders: [], sizeInfoRows: [] };

  if (title) {
    const metaHeaderCells = title.cells.slice(0, 6).map((x) => String(x || '').trim());
    const rawSizeHeaderCells = title.cells.slice(6).map((x) => String(x || '').trim());
    const activeSizeCount = rawSizeHeaderCells.filter(Boolean).length;
    const sizeHeaderCells = activeSizeCount
      ? rawSizeHeaderCells.slice(0, activeSizeCount)
      : normalizedPreferred;
    const sizeInfoMetaHeaders = metaHeaderCells.map((x, idx) => x || defaultMetaHeaders[idx] || `字段${idx + 1}`);
    const sizeInfoRows = dataRows
      .map((r) => {
        const metaValues = r.cells.slice(0, 6).map((x) => String(x || '').trim());
        const sizeValues = sizeHeaderCells.map((_, idx) => parseMixedNumber(r.cells[6 + idx] || '0'));
        if (!metaValues.some(Boolean) && !sizeValues.some((n) => n > 0)) return null;
        return { metaValues, sizeValues };
      })
      .filter(Boolean);
    return { sizeInfoMetaHeaders, sizeInfoRows };
  }

  // 旧表大量行没有标题（is_title=0），按固定列结构推断：
  // site_1..site_5 为元信息列，site_6.. 为尺码列。
  const rawRows = dataRows.map((r) => ({
    metaValues: r.cells.slice(0, 6).map((x) => String(x || '').trim()),
    rawSizes: r.cells.slice(6).map((x) => String(x || '').trim()),
  }));
  const maxSizeCols = rawRows.reduce((m, r) => Math.max(m, r.rawSizes.length), 0);
  const activeSizeIdx = [];
  for (let i = 0; i < maxSizeCols; i += 1) {
    const used = rawRows.some((r) => {
      const t = String(r.rawSizes[i] || '').trim();
      if (!t) return false;
      if (t === '0') return false;
      return true;
    });
    if (used) activeSizeIdx.push(i);
  }
  const finalIdx = activeSizeIdx.length
    ? activeSizeIdx
    : [...Array(Math.min(normalizedPreferred.length || 0, maxSizeCols)).keys()];
  if (!finalIdx.length) return { sizeInfoMetaHeaders: [], sizeInfoRows: [] };

  const sizeHeaderCells = finalIdx.map((idx, pos) => normalizedPreferred[pos] || `尺码${pos + 1}`);
  const sizeInfoRows = rawRows
    .map((r) => {
      const sizeValues = finalIdx.map((idx) => parseMixedNumber(r.rawSizes[idx] || '0'));
      if (!r.metaValues.some(Boolean) && !sizeValues.some((n) => n > 0)) return null;
      return { metaValues: r.metaValues, sizeValues };
    })
    .filter(Boolean);

  return {
    sizeInfoMetaHeaders: defaultMetaHeaders,
    sizeInfoRows,
    inferredSizeHeaders: sizeHeaderCells,
  };
}

function parseProcessItemsFromSkuRequire(rows) {
  if (!rows || !rows.length) return [];
  const ordered = [...rows].sort((a, b) => (a.sort || 0) - (b.sort || 0));
  return ordered
    .filter((r) => Number(r.isTitle) !== 1)
    .map((r) => ({
      processName: r.requireName || '',
      supplierName: '',
      part: '',
      remark: r.requireDesc || '',
    }))
    .filter((x) => x.processName || x.remark);
}

function extractImageUrlsFromHtml(html) {
  const out = [];
  const reg = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = reg.exec(String(html || ''))) !== null) {
    const src = String(m[1] || '').trim();
    if (!src) continue;
    out.push(src);
  }
  return out;
}

function extractImagePathsFromText(text) {
  const input = String(text || '');
  const chunks = input
    .replace(/[\r\n]+/g, ',')
    .split(/[,，\s]+/)
    .map((x) => String(x || '').trim().replace(/^['"]|['"]$/g, '').replace(/[);.]+$/g, ''))
    .filter(Boolean);
  const out = [];
  for (const token of chunks) {
    if (/^https?:\/\//i.test(token)) {
      out.push(token);
      continue;
    }
    if (/^\/Public\/images\//i.test(token)) {
      out.push(token);
      continue;
    }
    if (/^Public\/images\//i.test(token)) {
      out.push(`/${token}`);
    }
  }
  return out;
}

function parsePercent(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const m = t.match(/(-?\d+(?:\.\d+)?)\s*%/);
  if (m) return Number(m[1]);
  const n = Number(t.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseMaterialsFromProcessDesc(html, materialTypeIdByValue, orderQty) {
  const rows = extractTableRows(html);
  if (!rows.length) return [];
  let headerIndex = -1;
  let nameCol = -1;
  let typeCol = -1;
  let colorCol = -1;
  let usageCol = -1;
  let lossCol = -1;
  let planCol = -1;
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i].map((x) => String(x || '').trim());
    const nIdx = row.findIndex((c) => c.includes('物料名称'));
    const tIdx = row.findIndex((c) => c.includes('物料类型'));
    if (nIdx >= 0 && tIdx >= 0) {
      headerIndex = i;
      nameCol = nIdx;
      typeCol = tIdx;
      colorCol = row.findIndex((c) => c.includes('物料颜色') || c === '颜色');
      usageCol = row.findIndex((c) => c.includes('单件用量') || c.includes('单耗'));
      lossCol = row.findIndex((c) => c.includes('损耗'));
      planCol = row.findIndex((c) => c.includes('计划用量') || c.includes('应采购'));
      break;
    }
  }
  if (headerIndex < 0) return [];
  const out = [];
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i].map((x) => String(x || '').trim());
    if (!row.length) continue;
    const first = String(row[nameCol] || '').trim();
    if (!first || first === '0') continue;
    if (/^部位$|^一、|^二、|^三、|^四、|^五、/.test(first)) break;
    const materialType = String(row[typeCol] || '').trim();
    const usagePerPiece = parseMixedNumber(usageCol >= 0 ? row[usageCol] : '');
    const lossPercent = parsePercent(lossCol >= 0 ? row[lossCol] : '');
    const orderPieces = Number(orderQty) || 0;
    const planFromText = parseMixedNumber(planCol >= 0 ? row[planCol] : '');
    const computedPlan =
      usagePerPiece > 0 && orderPieces > 0
        ? Number((usagePerPiece * orderPieces * (1 + (Number(lossPercent || 0) / 100))).toFixed(4))
        : 0;
    const purchaseQuantity = planFromText > 0 ? planFromText : computedPlan;
    out.push({
      materialTypeId: materialTypeIdByValue.get(materialType) ?? null,
      supplierName: '',
      materialName: first,
      color: colorCol >= 0 ? String(row[colorCol] || '').trim() : '',
      usagePerPiece: usagePerPiece > 0 ? usagePerPiece : null,
      lossPercent: lossPercent != null ? lossPercent : null,
      orderPieces: orderPieces > 0 ? orderPieces : null,
      purchaseQuantity: purchaseQuantity > 0 ? purchaseQuantity : null,
      cuttingQuantity: null,
      remark: '',
    });
  }
  return out.filter((x) => x.materialName || x.materialTypeId != null);
}

function parseRequirementSectionsFromProcessDesc(html) {
  const lines = stripHtml(html);
  if (!lines.length) return '';
  const start = lines.findIndex((x) => /^[一二三四五六七八九十]+[、.．]/.test(x));
  if (start < 0) return '';
  const picked = [];
  for (let i = start; i < lines.length; i += 1) {
    const line = String(lines[i] || '').trim();
    if (!line) continue;
    picked.push(line);
  }
  return picked.join('\n').trim();
}

function buildMaterialsFromSkuBasic(skuBasic, materialTypeIdByValue, colorRows, orderQty) {
  if (!skuBasic) return [];
  const firstColor = Array.isArray(colorRows) && colorRows.length
    ? String(colorRows[0]?.colorName || '').trim()
    : '';
  const resolveColor = () => {
    if (firstColor) return firstColor;
    const raw = String(skuBasic.skuColorCode || '').trim();
    if (!raw) return '';
    return raw.split(/[、,，]/)[0].trim();
  };
  const color = resolveColor();
  const orderPieces = Number(orderQty) || null;
  const rows = [];
  const pushMaterial = (name, typeValue) => {
    const n = String(name || '').trim();
    if (!n) return;
    rows.push({
      materialTypeId: materialTypeIdByValue.get(typeValue) ?? null,
      supplierName: '',
      materialName: n,
      color,
      usagePerPiece: null,
      lossPercent: null,
      orderPieces,
      purchaseQuantity: null,
      cuttingQuantity: null,
      remark: '来自SKU基础信息',
    });
  };
  pushMaterial(skuBasic.primaryCloth, '主面料');
  pushMaterial(skuBasic.secondaryCloth, '面料');
  pushMaterial(skuBasic.secondaryClothA, '里布');
  pushMaterial(skuBasic.secondaryClothB, '衬布');
  pushMaterial(skuBasic.cutParts, '辅料');
  return rows;
}

function composeProductionRequirement(row) {
  const lines = [];
  if (row.processStr) lines.push(`工艺项目：${row.processStr}`);
  if (row.beforeRequire) lines.push(`裁前要求：${row.beforeRequire}`);
  if (row.cuttingRequire) lines.push(`裁床要求：${row.cuttingRequire}`);
  if (row.sewingRequire) lines.push(`车间要求：${row.sewingRequire}`);
  if (row.tailRequire) lines.push(`尾部要求：${row.tailRequire}`);
  if (row.orderRemark) lines.push(`订单备注：${row.orderRemark}`);
  if (row.skuColorCode) lines.push(`SKU颜色：${row.skuColorCode}`);
  if (row.skuSizeCode) lines.push(`SKU尺码：${row.skuSizeCode}`);

  const sectionText = parseRequirementSectionsFromProcessDesc(row.processDescHtml);
  if (sectionText) {
    lines.push(`制单表分段内容：\n${sectionText}`);
  } else {
    const plain = stripHtml(row.processDescHtml);
    if (plain.length) lines.push(`制单表内容：\n${plain.join('\n')}`);
  }
  return lines.join('\n\n').trim();
}

function composeSkuBasicRequirement(skuBasic) {
  if (!skuBasic) return '';
  const lines = [];
  if (skuBasic.processStr) lines.push(`工艺组成：${skuBasic.processStr}`);
  const materialLines = [];
  if (skuBasic.primaryCloth) materialLines.push(`主面料：${skuBasic.primaryCloth}`);
  if (skuBasic.secondaryCloth) materialLines.push(`配布：${skuBasic.secondaryCloth}`);
  if (skuBasic.secondaryClothA) materialLines.push(`配布A：${skuBasic.secondaryClothA}`);
  if (skuBasic.secondaryClothB) materialLines.push(`配布B：${skuBasic.secondaryClothB}`);
  if (materialLines.length) lines.push(`面料信息：${materialLines.join('；')}`);
  if (skuBasic.cutParts) lines.push(`辅料名称：${skuBasic.cutParts}`);
  if (skuBasic.weavingType) lines.push(`织法：${skuBasic.weavingType}`);
  if (skuBasic.beforeRequire) lines.push(`裁前要求：${skuBasic.beforeRequire}`);
  if (skuBasic.cuttingRequire) lines.push(`裁床要求：${skuBasic.cuttingRequire}`);
  if (skuBasic.sewingRequire) lines.push(`车间要求：${skuBasic.sewingRequire}`);
  if (skuBasic.tailRequire) lines.push(`尾部要求：${skuBasic.tailRequire}`);
  return lines.join('\n').trim();
}

function calcColorSizeTotal(rows) {
  if (!Array.isArray(rows) || !rows.length) return 0;
  let total = 0;
  for (const row of rows) {
    const quantities = Array.isArray(row?.quantities) ? row.quantities : [];
    for (const n of quantities) total += Number(n) || 0;
  }
  return total;
}

function buildSizeInfoFallbackFromColorSize(headers, rows) {
  const cleanHeaders = Array.isArray(headers) ? headers.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (!cleanHeaders.length) return { sizeInfoMetaHeaders: [], sizeInfoRows: [] };
  const totals = cleanHeaders.map((_, idx) =>
    (Array.isArray(rows) ? rows : []).reduce((sum, r) => sum + (Number(r?.quantities?.[idx]) || 0), 0),
  );
  if (!totals.some((n) => n > 0)) return { sizeInfoMetaHeaders: [], sizeInfoRows: [] };
  return {
    sizeInfoMetaHeaders: ['项目'],
    sizeInfoRows: [{ metaValues: ['下单数量'], sizeValues: totals }],
  };
}

function resolveOrderTypeId(row, orderTypeIdByValue) {
  const orderNo = String(row.orderNo || '').trim();
  const oldOrderType = String(row.oldOrderType || '').trim();
  const isSample = Number(row.isSample || 0);
  const directCandidates = [oldOrderType, row.skuSizeCode, row.skuColorCode].map((x) =>
    String(x || '').trim(),
  );
  for (const text of directCandidates) {
    if (text && orderTypeIdByValue.has(text)) return orderTypeIdByValue.get(text);
  }
  if (/产前/.test(orderNo) && orderTypeIdByValue.has('产前版')) return orderTypeIdByValue.get('产前版');
  if (/(头版|头样)/.test(orderNo) && orderTypeIdByValue.has('头版')) return orderTypeIdByValue.get('头版');
  if (/(改版|修改)/.test(orderNo) && orderTypeIdByValue.has('修改版')) return orderTypeIdByValue.get('修改版');
  if (/拍照/.test(orderNo) && orderTypeIdByValue.has('拍照板')) return orderTypeIdByValue.get('拍照板');
  if (/销售/.test(orderNo) && orderTypeIdByValue.has('销售版')) return orderTypeIdByValue.get('销售版');
  if (isSample === 1 && orderTypeIdByValue.has('样品')) return orderTypeIdByValue.get('样品');
  if (orderTypeIdByValue.has('大货')) return orderTypeIdByValue.get('大货');
  return null;
}

function resolveStatusCode(row, statusCodeSet, codeByLabel) {
  const rawCode = String(row.oldStatusCode || '').trim();
  const rawName = String(row.oldStatusName || '').trim();

  if (rawName && codeByLabel.has(rawName)) return codeByLabel.get(rawName);
  if (rawName && statusCodeSet.has(rawName)) return rawName;
  // 仅当旧值本身看起来就是“新系统状态码”时才直接复用，避免把 0/1/100 这类旧数字状态写入新系统。
  if (rawCode && /^[a-z_]+$/i.test(rawCode) && statusCodeSet.has(rawCode)) return rawCode;

  if (rawName.includes('完成')) return statusCodeSet.has('completed') ? 'completed' : 'draft';
  if (rawName.includes('审')) return statusCodeSet.has('pending_review') ? 'pending_review' : 'draft';
  if (rawName.includes('纸样')) return statusCodeSet.has('pending_pattern') ? 'pending_pattern' : 'draft';
  if (rawName.includes('采购')) return statusCodeSet.has('pending_purchase') ? 'pending_purchase' : 'draft';
  if (rawName.includes('裁')) return statusCodeSet.has('pending_cutting') ? 'pending_cutting' : 'draft';
  if (rawName.includes('缝')) return statusCodeSet.has('pending_sewing') ? 'pending_sewing' : 'draft';
  if (rawName.includes('尾')) return statusCodeSet.has('pending_finishing') ? 'pending_finishing' : 'draft';

  if (rawCode === '100') return statusCodeSet.has('completed') ? 'completed' : 'draft';
  if (rawCode === '0') return 'draft';
  if (rawCode === '1') return statusCodeSet.has('pending_review') ? 'pending_review' : 'draft';

  return 'draft';
}

async function main() {
  const args = parseArgs(process.argv);
  const backendDir = path.resolve(__dirname, '..');
  const env = loadEnv(path.join(backendDir, '.env'));

  const sampleDir = args.sampleDir
    ? path.resolve(backendDir, args.sampleDir)
    : path.resolve(backendDir, '..', 'docs', 'migration-samples', 'orders-2026');
  const ordersFile = path.join(sampleDir, '01_orders_2026.tsv');
  const orderSkuSizeFile = path.join(sampleDir, '02_order_sku_size_2026.tsv');
  const orderSizeFile = path.join(sampleDir, '03_order_size_2026.tsv');
  const orderSkuRequireFile = path.join(sampleDir, '04_order_sku_require_2026.tsv');
  const skuSizeFile = path.join(sampleDir, '05_sku_size_2026.tsv');
  const orderMaterialsFile = path.join(sampleDir, '06_order_materials_2026.tsv');
  const skuBasicFile = path.join(sampleDir, '07_sku_basic_2026.tsv');
  const orderRequireFile = path.join(sampleDir, '10_order_require_2026.tsv');
  const skuRequireFile = path.join(sampleDir, '11_sku_require_2026.tsv');
  if (!fs.existsSync(ordersFile)) {
    throw new Error(`缺少文件: ${ordersFile}`);
  }

  const allRows = readTsvLines(ordersFile).map(parseOrderRow);
  const skuSizeRows = fs.existsSync(orderSkuSizeFile)
    ? readTsvLines(orderSkuSizeFile).map(parseOrderSkuSizeRow)
    : [];
  const orderSizeRows = fs.existsSync(orderSizeFile)
    ? readTsvLines(orderSizeFile).map(parseOrderSizeRow)
    : [];
  const skuRequireRows = fs.existsSync(orderSkuRequireFile)
    ? readTsvLines(orderSkuRequireFile).map(parseOrderSkuRequireRow)
    : [];
  const skuSizeRowsForFallback = fs.existsSync(skuSizeFile)
    ? readTsvLines(skuSizeFile).map(parseSkuSizeRow)
    : [];
  const orderMaterialsRows = fs.existsSync(orderMaterialsFile)
    ? readTsvLines(orderMaterialsFile).map(parseOrderMaterialsRow)
    : [];
  const skuBasicRows = fs.existsSync(skuBasicFile)
    ? readTsvLines(skuBasicFile).map(parseSkuBasicRow)
    : [];

  const skuSizeByOrderNo = new Map();
  const skuSizeByOrderId = new Map();
  for (const row of skuSizeRows) {
    const key = String(row.orderNo || '').trim();
    if (!key) continue;
    if (!skuSizeByOrderNo.has(key)) skuSizeByOrderNo.set(key, []);
    skuSizeByOrderNo.get(key).push(row);
    const idKey = Number(row.orderId) || 0;
    if (idKey > 0) {
      if (!skuSizeByOrderId.has(idKey)) skuSizeByOrderId.set(idKey, []);
      skuSizeByOrderId.get(idKey).push(row);
    }
  }
  const orderSizeByOrderNo = new Map();
  const orderSizeByOrderId = new Map();
  for (const row of orderSizeRows) {
    const key = String(row.orderNo || '').trim();
    if (!key) continue;
    if (!orderSizeByOrderNo.has(key)) orderSizeByOrderNo.set(key, []);
    orderSizeByOrderNo.get(key).push(row);
    const idKey = Number(row.orderId) || 0;
    if (idKey > 0) {
      if (!orderSizeByOrderId.has(idKey)) orderSizeByOrderId.set(idKey, []);
      orderSizeByOrderId.get(idKey).push(row);
    }
  }
  const skuRequireByOrderNo = new Map();
  const skuRequireByOrderId = new Map();
  for (const row of skuRequireRows) {
    const key = String(row.orderNo || '').trim();
    if (!key) continue;
    if (!skuRequireByOrderNo.has(key)) skuRequireByOrderNo.set(key, []);
    skuRequireByOrderNo.get(key).push(row);
    const idKey = Number(row.orderId) || 0;
    if (idKey > 0) {
      if (!skuRequireByOrderId.has(idKey)) skuRequireByOrderId.set(idKey, []);
      skuRequireByOrderId.get(idKey).push(row);
    }
  }
  const skuSizeBySkuNo = new Map();
  for (const row of skuSizeRowsForFallback) {
    const key = String(row.skuNo || '').trim();
    if (!key) continue;
    if (!skuSizeBySkuNo.has(key)) skuSizeBySkuNo.set(key, []);
    skuSizeBySkuNo.get(key).push(row);
  }
  const materialsByOrderNo = new Map();
  const materialsByOrderId = new Map();
  for (const row of orderMaterialsRows) {
    const keyNo = String(row.orderNo || '').trim();
    if (keyNo) {
      if (!materialsByOrderNo.has(keyNo)) materialsByOrderNo.set(keyNo, []);
      materialsByOrderNo.get(keyNo).push(row);
    }
    const keyId = Number(row.orderId) || 0;
    if (keyId > 0) {
      if (!materialsByOrderId.has(keyId)) materialsByOrderId.set(keyId, []);
      materialsByOrderId.get(keyId).push(row);
    }
  }
  const skuBasicBySkuNo = new Map();
  for (const row of skuBasicRows) {
    const key = String(row.skuNo || '').trim();
    if (!key) continue;
    skuBasicBySkuNo.set(key, row);
  }

  // 08 订单级生产要求（erp_order_require）
  const orderRequireRawRows = fs.existsSync(orderRequireFile)
    ? readTsvLines(orderRequireFile).map(parseRequireRow)
    : [];
  const orderRequireByOrderNo = new Map();
  const orderRequireByOrderId = new Map();
  for (const r of orderRequireRawRows) {
    const keyNo = String(r.orderNo || '').trim();
    if (keyNo) {
      if (!orderRequireByOrderNo.has(keyNo)) orderRequireByOrderNo.set(keyNo, []);
      orderRequireByOrderNo.get(keyNo).push(r);
    }
    const keyId = Number(r.orderId) || 0;
    if (keyId > 0) {
      if (!orderRequireByOrderId.has(keyId)) orderRequireByOrderId.set(keyId, []);
      orderRequireByOrderId.get(keyId).push(r);
    }
  }

  // 09 SKU级生产要求（erp_sku_require）
  const skuRequireRawRows = fs.existsSync(skuRequireFile)
    ? readTsvLines(skuRequireFile).map(parseSkuRequireRow)
    : [];
  const skuRequireBySkuNo = new Map();
  for (const r of skuRequireRawRows) {
    const key = String(r.skuNo || '').trim();
    if (!key) continue;
    if (!skuRequireBySkuNo.has(key)) skuRequireBySkuNo.set(key, []);
    skuRequireBySkuNo.get(key).push(r);
  }

  const rows2026 = allRows.filter((r) => {
    if (!r.orderNo || !r.skuNo) return false;
    const d = r.createTime || r.orderTime;
    return d && d.getFullYear() === 2026;
  });

  const conn = await mysql.createConnection({
    host: env.MYSQL_HOST || 'localhost',
    port: parseInt(env.MYSQL_PORT || '3306', 10),
    user: env.MYSQL_USER || 'root',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'erp',
    charset: 'utf8mb4',
  });

  try {
    const [statusRows] = await conn.query('SELECT code, label FROM order_statuses');
    const statusCodeSet = new Set((statusRows || []).map((x) => String(x.code || '').trim()).filter(Boolean));
    const codeByLabel = new Map((statusRows || []).map((x) => [String(x.label || '').trim(), String(x.code || '').trim()]));
    const [optionRows] = await conn.query("SELECT id, option_type, value FROM system_options WHERE option_type IN ('order_types','collaboration')");
    const orderTypeIdByValue = new Map(
      (optionRows || [])
        .filter((x) => String(x.option_type || '') === 'order_types')
        .map((x) => [String(x.value || '').trim(), Number(x.id) || 0])
        .filter((x) => x[0] && x[1] > 0),
    );
    const [materialTypeRows] = await conn.query("SELECT id, value FROM system_options WHERE option_type = 'material_types'");
    const materialTypeIdByValue = new Map(
      (materialTypeRows || [])
        .map((x) => [String(x.value || '').trim(), Number(x.id) || 0])
        .filter((x) => x[0] && x[1] > 0),
    );

    const prepared = rows2026.map((row) => {
      const imageUrl = resolveImportImageUrl(row.skuImage);
      const sizeInfo = extractSizeInfoFromProcessDesc(row.processDescHtml);
      const colorSize = parseColorSizeRowsFromOrderCode(row.orderCodeJson);
      const skuSizeRowsRaw =
        skuSizeByOrderNo.get(row.orderNo) ||
        skuSizeByOrderId.get(Number(row.oldOrderId) || 0) ||
        [];
      const colorSizeFromTable = parseColorSizeRowsFromSkuSizeTable(
        skuSizeRowsRaw,
      );
      const orderSizeRowsRaw =
        orderSizeByOrderNo.get(row.orderNo) ||
        orderSizeByOrderId.get(Number(row.oldOrderId) || 0) ||
        [];
      const colorSizeFromDesc = parseColorSizeRowsFromProcessDesc(row.processDescHtml);
      const sizeInfoFromTable = parseSizeInfoFromOrderSizeTable(
        orderSizeRowsRaw,
        colorSizeFromTable.headers.length
          ? colorSizeFromTable.headers
          : (colorSize.headers.length ? colorSize.headers : colorSizeFromDesc.headers),
      );
      const sizeInfoFromSkuTable = parseSizeInfoFromOrderSizeTable(
        skuSizeBySkuNo.get(row.skuNo) || [],
        colorSizeFromTable.headers.length
          ? colorSizeFromTable.headers
          : (colorSize.headers.length ? colorSize.headers : colorSizeFromDesc.headers),
      );
      const printEmbroidery = extractPrintEmbroideryRequirement(row.processDescHtml);
      const processItemsFromText = printEmbroidery
        ? [{ processName: '印/绣花要求', supplierName: '', part: '', remark: printEmbroidery }]
        : [];
      const processItemsFromTable = parseProcessItemsFromSkuRequire(
        skuRequireByOrderNo.get(row.orderNo) ||
        skuRequireByOrderId.get(Number(row.oldOrderId) || 0) ||
        [],
      );
      const processItems = processItemsFromTable.length ? processItemsFromTable : processItemsFromText;
      const materialsRaw =
        materialsByOrderNo.get(row.orderNo) ||
        materialsByOrderId.get(Number(row.oldOrderId) || 0) ||
        [];
      const materialsFromFile = materialsRaw
        .map((m) => {
          const usagePerPiece = Number(m.usagePerPiece || 0);
          const orderPieces = Number(m.orderNum || row.quantity || 0);
          const lossPercent = parsePercent(m.lossText);
          const planFromFile = Number(m.plannedUsage || 0);
          const computedPlan =
            usagePerPiece > 0 && orderPieces > 0
              ? Number((usagePerPiece * orderPieces * (1 + (Number(lossPercent || 0) / 100))).toFixed(4))
              : 0;
          return {
            materialTypeId: materialTypeIdByValue.get(String(m.materialCategory || '').trim()) ?? null,
            supplierName: String(m.supplierName || '').trim(),
            materialName: String(m.materialName || '').trim(),
            color: String(m.materialColor || '').trim(),
            usagePerPiece: usagePerPiece > 0 ? usagePerPiece : null,
            lossPercent: lossPercent != null ? lossPercent : null,
            orderPieces: orderPieces > 0 ? orderPieces : null,
            purchaseQuantity: (planFromFile > 0 ? planFromFile : computedPlan) || null,
            cuttingQuantity: null,
            remark: String(m.remark || '').trim(),
          };
        })
        .filter((x) => x.materialName || x.materialTypeId != null);
      const materialsFromDesc = parseMaterialsFromProcessDesc(
        row.processDescHtml,
        materialTypeIdByValue,
        Number(row.quantity) || 0,
      );
      const skuBasic = skuBasicBySkuNo.get(row.skuNo) || null;
      const materialsFromSkuBasic = buildMaterialsFromSkuBasic(
        skuBasic,
        materialTypeIdByValue,
        colorSizeFromTable.rows.length ? colorSizeFromTable.rows : colorSize.rows,
        Number(row.quantity) || 0,
      );
      const materials = materialsFromFile.length
        ? materialsFromFile
        : (materialsFromDesc.length ? materialsFromDesc : materialsFromSkuBasic);

      const attachmentPaths = [
        ...extractImageUrlsFromHtml(row.courseConImgsHtml),
        ...extractImagePathsFromText(row.courseConImgsHtml),
      ];
      const attachmentUrls = Array.from(
        new Set(attachmentPaths.map((x) => resolveImportImageUrl(x)).filter(Boolean)),
      );
      const packagingHeaders = [];
      const packagingCells = [];

      const mergedRow = {
        ...row,
        processStr: row.processStr || skuBasic?.processStr || '',
        beforeRequire: row.beforeRequire || skuBasic?.beforeRequire || '',
        cuttingRequire: row.cuttingRequire || skuBasic?.cuttingRequire || '',
        sewingRequire: row.sewingRequire || skuBasic?.sewingRequire || '',
        tailRequire: row.tailRequire || skuBasic?.tailRequire || '',
      };
      const productionRequirementBase = composeProductionRequirement(mergedRow);
      const productionRequirementFallback = composeSkuBasicRequirement(skuBasic);

      // 从 erp_order_require 表获取详细的按条生产要求
      const orderRequireItems =
        orderRequireByOrderNo.get(row.orderNo) ||
        orderRequireByOrderId.get(Number(row.oldOrderId) || 0) ||
        [];
      const orderRequireText = composeRequirementText(orderRequireItems);

      // 从 erp_sku_require 表获取 SKU 级生产要求（作为最终 fallback）
      const skuRequireItems = skuRequireBySkuNo.get(row.skuNo) || [];
      const skuRequireText = composeRequirementText(skuRequireItems);

      // 优先级：订单级 require 表 > process_desc 解析 > SKU级 require 表 > sku_basic fallback
      const detailedRequireText = orderRequireText || skuRequireText || '';
      const parts = [productionRequirementBase, detailedRequireText, productionRequirementFallback].filter(Boolean);
      const productionRequirement = parts.join('\n\n');
      const status = resolveStatusCode(row, statusCodeSet, codeByLabel);
      const orderTypeId = resolveOrderTypeId(row, orderTypeIdByValue);
      const statusTime =
        row.shipmentTime ||
        row.orderDeliveryDate ||
        row.ourDeliveryDate ||
        row.expectDeliveryDate ||
        row.orderTime ||
        row.createTime ||
        null;
      const colorSizeHeaders = colorSizeFromTable.headers.length
        ? colorSizeFromTable.headers
        : (colorSize.headers.length
            ? colorSize.headers
            : (colorSizeFromDesc.headers.length ? colorSizeFromDesc.headers : sizeInfo.colorSizeHeaders));
      const finalColorSizeHeaders =
        sizeInfoFromTable.inferredSizeHeaders && sizeInfoFromTable.inferredSizeHeaders.length
          ? sizeInfoFromTable.inferredSizeHeaders
          : colorSizeHeaders;
      const colorSizeRows = colorSizeFromTable.rows.length
        ? colorSizeFromTable.rows
        : (colorSize.rows.length ? colorSize.rows : colorSizeFromDesc.rows);
      const sizeInfoFallback = buildSizeInfoFallbackFromColorSize(finalColorSizeHeaders, colorSizeRows);
      const sizeInfoMetaHeaders = sizeInfoFromTable.sizeInfoMetaHeaders.length
        ? sizeInfoFromTable.sizeInfoMetaHeaders
        : (sizeInfoFromSkuTable.sizeInfoMetaHeaders.length
            ? sizeInfoFromSkuTable.sizeInfoMetaHeaders
            : (sizeInfo.sizeInfoMetaHeaders.length ? sizeInfo.sizeInfoMetaHeaders : sizeInfoFallback.sizeInfoMetaHeaders));
      const sizeInfoRows = sizeInfoFromTable.sizeInfoRows.length
        ? sizeInfoFromTable.sizeInfoRows
        : (sizeInfoFromSkuTable.sizeInfoRows.length
            ? sizeInfoFromSkuTable.sizeInfoRows
            : (sizeInfo.sizeInfoRows.length ? sizeInfo.sizeInfoRows : sizeInfoFallback.sizeInfoRows));
      const oldQuantity = Number(row.quantity) || 0;
      const bTotal = calcColorSizeTotal(colorSizeRows);
      const quantity = Math.max(oldQuantity, Math.round(bTotal));

      return {
        row,
        imageUrl,
        status,
        orderTypeId,
        quantity,
        statusTime,
        orderDate: row.orderTime || row.createTime || null,
        customerDueDate: row.orderDeliveryDate || row.ourDeliveryDate || row.expectDeliveryDate || null,
        salesperson: row.checkUserName || row.orderUserName || '',
        merchandiser: row.trackUserName || row.orderUserName || '',
        processItem: row.processStr || (processItems.length ? '印/绣花要求' : ''),
        sizeInfoMetaHeaders,
        colorSizeHeaders,
        colorSizeRows,
        sizeInfoRows,
        processItems,
        materials,
        productionRequirement,
        packagingHeaders,
        packagingCells,
        attachments: attachmentUrls,
      };
    });

    if (args.dryRun) {
      console.log(
        JSON.stringify(
          {
            ok: true,
            dryRun: true,
            sampleDir,
            sourceRows: allRows.length,
            rows2026: rows2026.length,
            preview: prepared.slice(0, 10).map((x) => ({
              orderNo: x.row.orderNo,
              skuNo: x.row.skuNo,
              status: x.status,
              imageUrl: x.imageUrl,
              hasSizeInfo: x.sizeInfoRows.length > 0,
              hasColorSizeRows: x.colorSizeRows.length > 0,
              hasMaterials: x.materials.length > 0,
              hasPrintEmbroidery: x.processItems.length > 0,
              hasPackagingImages: x.packagingCells.length > 0,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    await conn.beginTransaction();
    let upsertedOrders = 0;
    let upsertedExt = 0;

    for (const item of prepared) {
      const x = item.row;
      await conn.execute(
        `
        INSERT INTO orders
          (
            order_no, sku_code, customer_id, customer_name, salesperson, merchandiser, quantity,
            ex_factory_price, sale_price, collaboration_type_id, order_type_id, process_item,
            status, status_time, order_date, customer_due_date, factory_name, image_url, created_at, updated_at
          )
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, '', ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          sku_code = VALUES(sku_code),
          customer_id = VALUES(customer_id),
          customer_name = VALUES(customer_name),
          salesperson = VALUES(salesperson),
          merchandiser = VALUES(merchandiser),
          quantity = VALUES(quantity),
          ex_factory_price = VALUES(ex_factory_price),
          sale_price = VALUES(sale_price),
          collaboration_type_id = VALUES(collaboration_type_id),
          order_type_id = VALUES(order_type_id),
          process_item = VALUES(process_item),
          status = VALUES(status),
          status_time = VALUES(status_time),
          order_date = VALUES(order_date),
          customer_due_date = VALUES(customer_due_date),
          image_url = VALUES(image_url),
          updated_at = NOW()
        `,
        [
          x.orderNo,
          x.skuNo,
          x.customerId,
          x.customerName,
          item.salesperson,
          item.merchandiser,
          item.quantity,
          x.exFactoryPrice || 0,
          x.salePrice || 0,
          item.orderTypeId,
          item.processItem,
          item.status,
          item.statusTime,
          item.orderDate,
          item.customerDueDate,
          item.imageUrl,
          x.createTime || new Date(),
        ],
      );
      upsertedOrders += 1;

      const [orderRows] = await conn.execute('SELECT id FROM orders WHERE order_no = ? LIMIT 1', [x.orderNo]);
      const orderId = orderRows[0]?.id;
      if (!orderId) continue;

      await conn.execute(
        `
        INSERT INTO order_ext
          (
            order_id, materials, color_size_headers, color_size_rows, size_info_meta_headers,
            size_info_rows, process_items, production_requirement, packaging_headers, packaging_cells,
            packaging_method, attachments
          )
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          materials = VALUES(materials),
          color_size_headers = VALUES(color_size_headers),
          color_size_rows = VALUES(color_size_rows),
          size_info_meta_headers = VALUES(size_info_meta_headers),
          size_info_rows = VALUES(size_info_rows),
          process_items = VALUES(process_items),
          production_requirement = VALUES(production_requirement),
          packaging_headers = VALUES(packaging_headers),
          packaging_cells = VALUES(packaging_cells),
          packaging_method = VALUES(packaging_method),
          attachments = VALUES(attachments)
        `,
        [
          orderId,
          JSON.stringify(item.materials),
          JSON.stringify(item.colorSizeHeaders),
          JSON.stringify(item.colorSizeRows),
          JSON.stringify(item.sizeInfoMetaHeaders),
          JSON.stringify(item.sizeInfoRows),
          JSON.stringify(item.processItems),
          item.productionRequirement,
          JSON.stringify(item.packagingHeaders),
          JSON.stringify(item.packagingCells),
          '',
          JSON.stringify(item.attachments),
        ],
      );
      upsertedExt += 1;
    }

    await conn.commit();
    console.log(
      JSON.stringify(
        {
          ok: true,
          sampleDir,
          sourceRows: allRows.length,
          rows2026: rows2026.length,
          upsertedOrders,
          upsertedOrderExt: upsertedExt,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
