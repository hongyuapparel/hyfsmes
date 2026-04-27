<template>
  <el-drawer
    :model-value="modelValue"
    title="库存详情"
    :size="`${drawerWidth}px`"
    destroy-on-close
    :with-header="true"
    class="finished-detail-drawer"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="detail-drawer-resizer" title="拖拽调整宽度" @mousedown="startResize" />
    <div v-loading="loading" class="detail-wrap">
      <div v-if="data" class="detail-sections">
        <div class="detail-top-row">
          <div class="detail-section">
            <div class="detail-section-head">
              <div class="detail-section-title">基础信息与产品图</div>
              <div class="detail-head-actions">
                <el-button
                  v-if="!metaEditing"
                  size="small"
                  text
                  type="primary"
                  class="detail-head-btn"
                  @click="toggleEditMode"
                >
                  <el-icon><Edit /></el-icon>
                  <span>编辑</span>
                </el-button>
                <template v-else>
                  <el-button
                    size="small"
                    type="success"
                    class="detail-head-btn"
                    :loading="saving"
                    @click="saveMeta"
                  >
                    保存
                  </el-button>
                  <el-button size="small" class="detail-head-btn" @click="toggleEditMode">
                    取消
                  </el-button>
                </template>
              </div>
            </div>
            <div class="detail-basic-main">
              <div class="detail-basic-grid">
                <div class="detail-basic-label">入库时间</div>
                <div class="detail-basic-value">{{ formatDateTime(data.stock.createdAt) }}</div>
                <div class="detail-basic-label">订单号</div>
                <div class="detail-basic-value">{{ data.orderNo || '-' }}</div>

                <div class="detail-basic-label">SKU</div>
                <div class="detail-basic-value">{{ data.stock.skuCode }}</div>
                <div class="detail-basic-label">客户</div>
                <div class="detail-basic-value">{{ data.stock.customerName || '-' }}</div>

                <div class="detail-basic-label">库存类型</div>
                <div class="detail-basic-value">
                  <el-select
                    v-if="metaEditing"
                    v-model="editForm.inventoryTypeId"
                    filterable
                    clearable
                    size="small"
                  >
                    <el-option
                      v-for="opt in inventoryTypeOptions"
                      :key="opt.id"
                      :label="opt.label"
                      :value="opt.id"
                    />
                  </el-select>
                  <span v-else>{{ findInventoryTypeLabel(data.stock.inventoryTypeId) || '-' }}</span>
                </div>

                <div class="detail-basic-label">仓库</div>
                <div class="detail-basic-value">
                  <el-select
                    v-if="metaEditing"
                    v-model="editForm.warehouseId"
                    filterable
                    clearable
                    size="small"
                  >
                    <el-option
                      v-for="opt in warehouseOptions"
                      :key="opt.id"
                      :label="opt.label"
                      :value="opt.id"
                    />
                  </el-select>
                  <span v-else>{{ findWarehouseLabel(data.stock.warehouseId) || '-' }}</span>
                </div>

                <div class="detail-basic-label">部门</div>
                <div class="detail-basic-value">
                  <el-select
                    v-if="metaEditing"
                    v-model="editForm.department"
                    filterable
                    clearable
                    size="small"
                  >
                    <el-option
                      v-for="opt in departmentOptions"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                  <span v-else>{{ data.stock.department || '-' }}</span>
                </div>

                <div class="detail-basic-label">存放地址</div>
                <div class="detail-basic-value">
                  <el-input v-if="metaEditing" v-model="editForm.location" clearable size="small" />
                  <span v-else>{{ data.stock.location || '-' }}</span>
                </div>

                <div class="detail-basic-label">备注</div>
                <div class="detail-basic-value detail-basic-value-span-3">
                  <el-input
                    v-if="metaEditing"
                    v-model="editForm.remark"
                    clearable
                    size="small"
                    placeholder="选填"
                  />
                  <span v-else>{{ editForm.remark || '-' }}</span>
                </div>
              </div>
              <div class="detail-product-image-panel">
                <div class="detail-image-label">产品图（可更换）</div>
                <ImageUploadArea v-if="metaEditing" v-model="editForm.imageUrl" compact />
                <AppImageThumb
                  v-else-if="displayProductImage"
                  :raw-url="displayProductImage"
                  :width="160"
                  :height="120"
                />
                <div v-else class="detail-image-empty">-</div>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">颜色图片与码数明细</div>
          <div
            v-if="displaySizeHeaders.length && displayColorSizeRows.length"
            class="detail-color-size-table-wrap"
          >
            <el-table
              :data="displayColorSizeRows"
              border
              size="small"
              class="detail-color-size-table"
              show-summary
              :summary-method="getColorSizeSummary"
            >
              <el-table-column label="颜色" width="88" align="center" header-align="center">
                <template #default="{ row }">{{ row.colorName || '-' }}</template>
              </el-table-column>
              <el-table-column label="颜色图片" width="122" align="center" header-align="center">
                <template #default="{ row }">
                  <ImageUploadArea
                    v-if="metaEditing"
                    class="detail-color-image-editor"
                    compact
                    :model-value="colorImageMap[row.colorName] || ''"
                    @update:model-value="(url) => saveColorImage(row.colorName, url)"
                  />
                  <AppImageThumb
                    v-else-if="colorImageMap[row.colorName]"
                    :raw-url="colorImageMap[row.colorName]"
                    variant="table"
                  />
                  <span v-else class="text-placeholder">-</span>
                </template>
              </el-table-column>
              <el-table-column
                v-for="(size, sizeIdx) in displaySizeHeaders"
                :key="`size-${sizeIdx}`"
                :label="size"
                min-width="64"
                align="center"
                header-align="center"
              >
                <template #default="{ row }">
                  {{ Number(row.quantities?.[sizeIdx] ?? 0) || 0 }}
                </template>
              </el-table-column>
              <el-table-column label="合计" width="72" align="center" header-align="center">
                <template #default="{ row }">{{ sumRowQty(row.quantities) }}</template>
              </el-table-column>
              <el-table-column label="出厂价" width="88" align="center" header-align="center">
                <template #default>
                  <el-input
                    v-if="metaEditing"
                    v-model="editForm.unitPrice"
                    placeholder="请输入"
                    clearable
                    size="small"
                  />
                  <template v-else>{{ tableUnitPrice }}</template>
                </template>
              </el-table-column>
              <el-table-column label="总价" width="120" align="center" header-align="center">
                <template #default="{ row }">{{ rowTotalPrice(row.quantities) }}</template>
              </el-table-column>
            </el-table>
          </div>
          <div v-else class="detail-muted">暂无颜色尺码明细（未关联订单或订单未维护颜色尺码）。</div>
        </div>

        <div class="detail-section">
          <div class="detail-section-title">操作记录</div>
          <div v-if="adjustLogs.length" class="detail-logs">
            <div v-for="log in adjustLogs" :key="log.id" class="detail-log-item">
              <div class="detail-log-head">
                <span class="detail-log-user">{{ log.operatorUsername || '-' }}</span>
                <span class="detail-log-time">{{ log.createdAt }}</span>
              </div>
              <div class="detail-log-body">{{ log.summary }}</div>
            </div>
          </div>
          <div v-else class="detail-muted">暂无操作记录</div>
        </div>
      </div>
      <div v-else class="detail-muted">暂无数据</div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { Edit } from '@element-plus/icons-vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import {
  getFinishedStockDetail,
  updateFinishedStockMeta,
  upsertFinishedStockColorImage,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    stockId: number | null
    initialColorName: string | null
    initialQuantity: number | null
    groupProductImage: string
    groupSizeHeaders: string[]
    inventoryTypeOptions: { id: number; label: string }[]
    warehouseOptions: { id: number; label: string }[]
    departmentOptions: { value: string; label: string }[]
  }>(),
  {
    initialColorName: null,
    initialQuantity: null,
    groupProductImage: '',
    groupSizeHeaders: () => [],
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'colorImagesSynced', stockId: number, colorImages: any[]): void
  (e: 'colorImageSaved', payload: { stockId: number; colorName: string; imageUrl: string }): void
  (e: 'metaSaved'): void
}>()

// ── drawer width / resize ─────────────────────────────────────────────────
const MIN_WIDTH = 760
const DEFAULT_WIDTH = 900
const MAX_MARGIN = 48
const STORAGE_KEY = 'inventory_finished_detail_drawer_width'

const drawerWidth = ref(DEFAULT_WIDTH)
const rafId = ref<number | null>(null)
const moveFn = ref<((e: MouseEvent) => void) | null>(null)
const upFn = ref<(() => void) | null>(null)

function maxWidth() {
  return Math.max(MIN_WIDTH, window.innerWidth - MAX_MARGIN)
}
function clampWidth(w: number) {
  return Math.min(Math.max(w, MIN_WIDTH), maxWidth())
}
function loadSavedWidth() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 ? clampWidth(n) : DEFAULT_WIDTH
  } catch {
    return DEFAULT_WIDTH
  }
}
function saveWidth(w: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(clampWidth(w)))
  } catch {}
}
function stopResize() {
  if (moveFn.value) { window.removeEventListener('mousemove', moveFn.value); moveFn.value = null }
  if (upFn.value) { window.removeEventListener('mouseup', upFn.value); upFn.value = null }
  if (rafId.value != null) { window.cancelAnimationFrame(rafId.value); rafId.value = null }
  document.body.classList.remove('detail-drawer-resizing')
}
function startResize(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startW = drawerWidth.value
  let latestX = startX
  const onMove = (evt: MouseEvent) => {
    latestX = evt.clientX
    if (rafId.value != null) return
    rafId.value = window.requestAnimationFrame(() => {
      rafId.value = null
      drawerWidth.value = clampWidth(startW + (startX - latestX))
    })
  }
  const onUp = () => { stopResize(); saveWidth(drawerWidth.value) }
  stopResize()
  moveFn.value = onMove
  upFn.value = onUp
  document.body.classList.add('detail-drawer-resizing')
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

onBeforeUnmount(stopResize)

// ── internal state ────────────────────────────────────────────────────────
const loading = ref(false)
const saving = ref(false)
const data = ref<any>(null)
const colorImageMap = ref<Record<string, string>>({})
const selectedColorName = ref<string | null>(null)
const selectedQuantity = ref<number | null>(null)
const internalGroupProductImage = ref('')
const internalGroupSizeHeaders = ref<string[]>([])
const metaEditing = ref(false)

const editForm = reactive({
  department: '',
  inventoryTypeId: null as number | null,
  warehouseId: null as number | null,
  location: '',
  unitPrice: '',
  imageUrl: '',
  remark: '',
})

// ── pure utilities ────────────────────────────────────────────────────────
function normalizeColorName(v: unknown): string {
  return String(v ?? '').trim()
}
function normalizeBreakdownHeaders(headers: string[]): string[] {
  if (!headers.length) return []
  return headers[headers.length - 1] === '合计' ? headers.slice(0, -1) : [...headers]
}
function mergeSizeHeaders(...sources: Array<string[] | null | undefined>): string[] {
  const result: string[] = []
  sources.forEach((source) => {
    normalizeBreakdownHeaders(Array.isArray(source) ? source : []).forEach((h) => {
      const s = String(h ?? '').trim()
      if (s && s !== '__UNASSIGNED__' && !result.includes(s)) result.push(s)
    })
  })
  return result
}
function remapValuesByHeaders(srcHeaders: string[], values: unknown[], tgtHeaders: string[]): number[] {
  const base = normalizeBreakdownHeaders(srcHeaders)
  const idx = new Map(base.map((h, i) => [h, i]))
  return tgtHeaders.map((h) => {
    const i = idx.get(h)
    return i == null ? 0 : Math.max(0, Math.trunc(Number(values?.[i]) || 0))
  })
}
function snapshotRowTotal(values: unknown[]): number {
  return (Array.isArray(values) ? values : []).reduce<number>(
    (s, v) => s + Math.max(0, Math.trunc(Number(v) || 0)),
    0,
  )
}
function sumRowQty(quantities: unknown[]): number {
  return snapshotRowTotal(Array.isArray(quantities) ? quantities : [])
}
function allocateByWeight(weights: number[], total: number): number[] {
  const safeTotal = Math.max(0, Math.trunc(Number(total) || 0))
  if (!weights.length) return []
  const sum = weights.reduce((s, w) => s + Math.max(0, Number(w) || 0), 0)
  if (safeTotal <= 0) return weights.map(() => 0)
  if (sum <= 0) { const a = weights.map(() => 0); a[0] = safeTotal; return a }
  const exact = weights.map((w) => (Math.max(0, Number(w) || 0) * safeTotal) / sum)
  const base = exact.map((v) => Math.floor(v))
  let remain = safeTotal - base.reduce((s, n) => s + n, 0)
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac)
  let oi = 0
  while (remain > 0 && order.length > 0) { base[order[oi % order.length].i] += 1; remain -= 1; oi += 1 }
  return base
}
function normalizeStoredSnapshot(snapshot: any): { headers: string[]; rows: Array<{ colorName: string; values: number[] }> } | null {
  if (!snapshot?.headers?.length || !snapshot.rows?.length) return null
  const normalizedHeaders = normalizeBreakdownHeaders(snapshot.headers)
  const visibleIdx = normalizedHeaders
    .map((h, i) => ({ h: String(h ?? '').trim(), i }))
    .filter((x) => x.h && x.h !== '__UNASSIGNED__')
  const headers = visibleIdx.map((x) => x.h)
  const rowOrder: string[] = []
  const rowMap = new Map<string, number[]>()
  const blank: number[][] = []
  const addRow = (colorName: string, values: number[]) => {
    let ex = rowMap.get(colorName)
    if (!ex) { ex = Array(headers.length).fill(0); rowMap.set(colorName, ex); rowOrder.push(colorName) }
    values.forEach((v, i) => { ex![i] += v })
  }
  snapshot.rows.forEach((item: any) => {
    const src = Array.isArray(item.values) ? item.values : []
    const values = visibleIdx.map(({ i }) => Math.max(0, Math.trunc(Number(src[i]) || 0)))
    if (String(item.colorName ?? '').trim() === '__UNASSIGNED__') { blank.push(values); return }
    const cn = normalizeColorName(item.colorName)
    if (!cn) blank.push(values)
    else addRow(cn, values)
  })
  blank.forEach((values) => {
    if (snapshotRowTotal(values) <= 0) return
    const matches = rowOrder.filter((cn) => {
      const ex = rowMap.get(cn) ?? []
      return ex.length === values.length && ex.every((v, i) => v === values[i])
    })
    if (matches.length === 1) addRow(matches[0], values)
    else if (rowOrder.length === 1) addRow(rowOrder[0], values)
    else addRow('', values)
  })
  const rows = rowOrder.map((cn) => ({ colorName: cn, values: [...(rowMap.get(cn) ?? [])] }))
    .filter((r) => snapshotRowTotal(r.values) > 0)
  return headers.length && rows.length ? { headers, rows } : null
}

// ── format helpers ────────────────────────────────────────────────────────
function formatPrice(unitPrice: string | undefined): string {
  if (unitPrice == null || unitPrice === '') return '￥0'
  const n = Number(unitPrice)
  return Number.isFinite(n) ? `￥${formatDisplayNumber(n)}` : '￥0'
}
function formatTotalPrice(qty: number, unitPrice: string | undefined): string {
  const n = Number(unitPrice)
  return Number.isFinite(n) && Number.isFinite(qty) ? `￥${formatDisplayNumber(qty * n)}` : '￥0'
}
function findInventoryTypeLabel(id: number | null | undefined): string {
  if (id == null) return ''
  return props.inventoryTypeOptions.find((o) => o.id === id)?.label ?? ''
}
function findWarehouseLabel(id: number | null | undefined): string {
  if (id == null) return ''
  return props.warehouseOptions.find((o) => o.id === id)?.label ?? ''
}

// ── adjust log helpers ────────────────────────────────────────────────────
function normalizeAdjustSnapshot(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as Record<string, any>
  const headers = (Array.isArray(s.headers) ? s.headers : [])
    .map((h: any) => String(h ?? '').trim())
    .filter((h: string) => h && h !== '__UNASSIGNED__' && h !== '合计')
  const rowsRaw = Array.isArray(s.rows) ? s.rows : []
  if (!headers.length || !rowsRaw.length) return null
  const rows = rowsRaw
    .map((row: any) => {
      const src = Array.isArray(row?.quantities) ? row.quantities : Array.isArray(row?.values) ? row.values : []
      return { colorName: String(row?.colorName ?? '').trim(), values: headers.map((_: any, i: number) => Math.max(0, Math.trunc(Number(src[i]) || 0))) }
    })
    .filter((row: any) => row.values.some((v: number) => v > 0))
  return rows.length ? { headers, rows } : null
}
function remapAdjustValues(snapshot: any, colorName: string, headers: string[]): number[] {
  if (!snapshot) return headers.map(() => 0)
  const row = snapshot.rows.find((r: any) => r.colorName === colorName)
  const idxMap = new Map(snapshot.headers.map((h: string, i: number) => [h, i]))
  return headers.map((h) => { const i = idxMap.get(h); return (i == null || i === undefined) ? 0 : Math.max(0, Math.trunc(Number(row?.values?.[i as number]) || 0)) })
}
function getAdjustActionLabel(remark: string, before: any, after: any): string {
  if (remark.includes('合并入库')) return '合并入库'
  const bq = Number(before?.quantity), aq = Number(after?.quantity)
  if (Number.isFinite(bq) && Number.isFinite(aq)) {
    if (aq > bq) return '入库调整'
    if (aq < bq) return '库存扣减'
  }
  return '尺码明细调整'
}
function getAdjustLogSummary(log: any): string {
  if (Array.isArray(log?.summaries) && log.summaries.length) return log.summaries.join('；')
  const before = log?.before ?? {}, after = log?.after ?? {}
  const parts: string[] = []
  const remark = String(log?.remark ?? '').trim()
  const beforeSnap = normalizeAdjustSnapshot(before?.colorSizeSnapshot)
  const afterSnap = normalizeAdjustSnapshot(after?.colorSizeSnapshot)
  if (beforeSnap || afterSnap) {
    const headers = mergeSizeHeaders(beforeSnap?.headers, afterSnap?.headers)
    const colorNames = [...(beforeSnap?.rows.map((r: any) => r.colorName) ?? []), ...(afterSnap?.rows.map((r: any) => r.colorName) ?? [])]
      .filter((cn, i, a) => a.indexOf(cn) === i)
    const sizeParts = colorNames.map((cn) => {
      const bv = remapAdjustValues(beforeSnap, cn, headers), av = remapAdjustValues(afterSnap, cn, headers)
      const deltas = headers.map((h, i) => ({ h, d: av[i] - bv[i] })).filter((x) => x.d !== 0).map((x) => `${x.h} ${x.d > 0 ? '+' : ''}${formatDisplayNumber(x.d)}件`)
      if (!deltas.length) return ''
      const label = cn && cn !== '__UNASSIGNED__' ? `${cn}：` : ''
      return `${label}${deltas.join('、')}`
    }).filter(Boolean)
    if (sizeParts.length) parts.push(`${getAdjustActionLabel(remark, before, after)}：${sizeParts.join('；')}`)
    else if (remark) parts.push(remark)
  } else if (remark) {
    parts.push(remark)
  }
  const bup = before?.unitPrice != null && before.unitPrice !== '' ? String(before.unitPrice) : ''
  const aup = after?.unitPrice != null && after.unitPrice !== '' ? String(after.unitPrice) : ''
  if (aup && bup !== aup) parts.push(`出厂价改为${formatPrice(aup)}`)
  const metaChanged = (before?.department ?? '') !== (after?.department ?? '') || (before?.inventoryTypeId ?? null) !== (after?.inventoryTypeId ?? null) || (before?.warehouseId ?? null) !== (after?.warehouseId ?? null) || (before?.location ?? '') !== (after?.location ?? '')
  if (metaChanged) parts.push(`基础信息改为 ${[after?.department || '-', findInventoryTypeLabel(after?.inventoryTypeId) || '-', findWarehouseLabel(after?.warehouseId) || '-', after?.location || '-'].join(' / ')}`)
  const bq = Number(before?.quantity), aq = Number(after?.quantity)
  if (Number.isFinite(bq) && Number.isFinite(aq) && bq !== aq && !remark && !(beforeSnap || afterSnap)) {
    const d = aq - bq
    parts.push(d > 0 ? `新增库存 +${formatDisplayNumber(d)} 件` : `库存数量改为${formatDisplayNumber(aq)}`)
  }
  return parts.join('，') || '更新库存信息'
}

// ── computed display data ─────────────────────────────────────────────────
const adjustLogs = computed(() => {
  const logs = Array.isArray(data.value?.adjustLogs) ? data.value.adjustLogs : []
  return logs.map((log: any, i: number) => ({
    id: String(log?.id ?? i),
    operatorUsername: String(log?.operatorUsername ?? ''),
    createdAt: String(log?.createdAt ?? ''),
    summary: getAdjustLogSummary(log),
  }))
})

const displayProductImage = computed(
  () => data.value?.stock?.imageUrl || internalGroupProductImage.value || data.value?.productImageUrl || '',
)

const displayColorSizeData = computed(() => {
  const d = data.value as any
  const headers: string[] = Array.isArray(d?.colorSize?.headers) ? d.colorSize.headers : []
  const rows: Array<{ colorName: string; quantities: number[] }> = Array.isArray(d?.colorSize?.rows) ? d.colorSize.rows : []
  const targetHeaders = mergeSizeHeaders(internalGroupSizeHeaders.value, headers)
  const hasSel = selectedColorName.value !== null
  const selCn = hasSel ? normalizeColorName(selectedColorName.value) : ''
  const filteredRows = hasSel ? rows.filter((r) => normalizeColorName(r.colorName) === selCn) : rows
  const stockQty = Math.max(0, Math.trunc(selectedQuantity.value != null ? Number(selectedQuantity.value) : Number(d?.stock?.quantity) || 0))
  if (!targetHeaders.length || !rows.length) return { headers: [], rows: [] }
  const rawSnap = d?.stock?.colorSizeSnapshot
  const hasStored = !!(rawSnap && typeof rawSnap === 'object' && Array.isArray(rawSnap.headers) && Array.isArray(rawSnap.rows) && rawSnap.headers.length && rawSnap.rows.length)
  if (hasStored) {
    const norm = normalizeStoredSnapshot({ headers, rows: rows.map((r) => ({ colorName: r.colorName, values: Array.isArray(r.quantities) ? [...r.quantities] : [] })) })
    if (!norm) return { headers: [], rows: [] }
    const visible = hasSel ? norm.rows.filter((r) => normalizeColorName(r.colorName) === selCn) : norm.rows
    if (!visible.length) return { headers: [], rows: [] }
    const dh = mergeSizeHeaders(targetHeaders, norm.headers)
    const dr = visible.map((r) => ({ colorName: r.colorName, quantities: remapValuesByHeaders(norm.headers, r.values, dh) })).filter((r) => snapshotRowTotal(r.quantities) > 0)
    if (!dr.length) return { headers: [], rows: [] }
    return { headers: dh, rows: dr }
  }
  if (!filteredRows.length) return { headers: [], rows: [] }
  const orderTotal = filteredRows.reduce((s, r) => s + (Array.isArray(r.quantities) ? r.quantities.reduce((rs, q) => rs + (Number(q) || 0), 0) : 0), 0)
  if (orderTotal === stockQty) {
    return { headers: [...targetHeaders], rows: filteredRows.map((r) => ({ ...r, quantities: remapValuesByHeaders(headers, r.quantities, targetHeaders) })).filter((r) => snapshotRowTotal(r.quantities) > 0) }
  }
  const weights: number[] = []
  filteredRows.forEach((r) => { for (let i = 0; i < headers.length; i++) weights.push(Math.max(0, Number(r.quantities?.[i]) || 0)) })
  const allocated = allocateByWeight(weights, stockQty)
  let cursor = 0
  const scaled = filteredRows.map((r) => {
    const q: number[] = []
    for (let i = 0; i < headers.length; i++) { q.push(allocated[cursor] ?? 0); cursor++ }
    return { colorName: r.colorName, quantities: q }
  })
  return { headers: [...targetHeaders], rows: scaled.map((r) => ({ ...r, quantities: remapValuesByHeaders(headers, r.quantities, targetHeaders) })).filter((r) => snapshotRowTotal(r.quantities) > 0) }
})

const displaySizeHeaders = computed(() => displayColorSizeData.value.headers)
const displayColorSizeRows = computed(() => displayColorSizeData.value.rows)
const totalQty = computed(() => displayColorSizeRows.value.reduce((s, r) => s + sumRowQty(r.quantities), 0))
const unitPriceValue = computed(() => metaEditing.value ? editForm.unitPrice : String(data.value?.stock?.unitPrice ?? ''))
const tableUnitPrice = computed(() => formatPrice(unitPriceValue.value))
const tableTotalPrice = computed(() => formatTotalPrice(totalQty.value, unitPriceValue.value))
function rowTotalPrice(quantities: unknown[]): string {
  return formatTotalPrice(sumRowQty(quantities as any[]), unitPriceValue.value)
}
function getColorSizeSummary({ columns }: { columns: Array<{ label?: string }> }) {
  const hl = displaySizeHeaders.value.length
  return columns.map((_, i) => {
    if (i === 0) return '汇总'
    if (i === 2 + hl) return String(totalQty.value)
    if (i === 3 + hl) return tableUnitPrice.value
    if (i === 4 + hl) return tableTotalPrice.value
    return ''
  })
}

// ── data loading ──────────────────────────────────────────────────────────
async function loadDetail(stockId: number) {
  loading.value = true
  saving.value = false
  data.value = null
  colorImageMap.value = {}
  try {
    const res = await getFinishedStockDetail(stockId)
    const d = res.data as any
    data.value = d
    internalGroupSizeHeaders.value = mergeSizeHeaders(
      internalGroupSizeHeaders.value,
      Array.isArray(d?.groupSizeHeaders) ? d.groupSizeHeaders : [],
      Array.isArray(d?.colorSize?.headers) ? d.colorSize.headers : [],
    )
    const map: Record<string, string> = {}
    ;(d?.colorImages ?? []).forEach((r: any) => { if (r?.colorName) map[String(r.colorName)] = String(r.imageUrl ?? '') })
    colorImageMap.value = map
    editForm.department = d?.stock?.department ?? ''
    editForm.inventoryTypeId = d?.stock?.inventoryTypeId ?? null
    editForm.warehouseId = d?.stock?.warehouseId ?? null
    editForm.location = d?.stock?.location ?? ''
    editForm.unitPrice = d?.stock?.unitPrice != null ? String(d.stock.unitPrice) : ''
    editForm.imageUrl = d?.stock?.imageUrl ?? ''
    editForm.remark = ''
    metaEditing.value = false
    emit('colorImagesSynced', stockId, d?.colorImages ?? [])
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function toggleEditMode() {
  if (!metaEditing.value && data.value?.stock) {
    editForm.department = data.value.stock.department ?? ''
    editForm.inventoryTypeId = data.value.stock.inventoryTypeId ?? null
    editForm.warehouseId = data.value.stock.warehouseId ?? null
    editForm.location = data.value.stock.location ?? ''
    editForm.unitPrice = data.value.stock.unitPrice != null ? String(data.value.stock.unitPrice) : ''
    editForm.imageUrl = data.value.stock.imageUrl ?? ''
    editForm.remark = ''
  }
  metaEditing.value = !metaEditing.value
}

async function saveMeta() {
  if (!props.stockId) return
  saving.value = true
  try {
    await updateFinishedStockMeta(props.stockId, {
      department: editForm.department,
      inventoryTypeId: editForm.inventoryTypeId,
      warehouseId: editForm.warehouseId,
      location: editForm.location,
      unitPrice: editForm.unitPrice?.trim() || '0',
      imageUrl: editForm.imageUrl?.trim() || '',
      remark: editForm.remark || undefined,
    })
    ElMessage.success('保存成功')
    await loadDetail(props.stockId)
    emit('metaSaved')
    metaEditing.value = false
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    saving.value = false
  }
}

async function saveColorImage(colorName: string, url: string) {
  if (!props.stockId) return
  const imageUrl = (url ?? '').trim()
  try {
    await upsertFinishedStockColorImage(props.stockId, { colorName, imageUrl })
    if (imageUrl) {
      colorImageMap.value[colorName] = imageUrl
      ElMessage.success('已保存图片')
    } else {
      delete colorImageMap.value[colorName]
      ElMessage.success('已清除图片')
    }
    emit('colorImageSaved', { stockId: props.stockId, colorName, imageUrl })
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

// ── watch to auto-load ────────────────────────────────────────────────────
watch(
  () => [props.modelValue, props.stockId] as const,
  ([visible, stockId]) => {
    if (visible && stockId) {
      drawerWidth.value = loadSavedWidth()
      internalGroupProductImage.value = props.groupProductImage
      internalGroupSizeHeaders.value = [...props.groupSizeHeaders]
      selectedColorName.value = props.initialColorName
      selectedQuantity.value = props.initialQuantity
      loadDetail(stockId)
    }
  },
)
</script>

<style scoped>
.detail-wrap {
  padding: 0 12px 12px 12px;
}
.detail-sections {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.detail-section-title {
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.detail-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.detail-section-head .detail-section-title { margin-bottom: 0; }
.detail-head-actions { display: flex; align-items: center; gap: 6px; }
.detail-head-btn { padding-inline: 8px; }
.detail-top-row { display: flex; gap: 0; align-items: stretch; }
.detail-section {
  min-width: 0;
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
}
.detail-top-row .detail-section { flex: 1 1 100%; width: 100%; }
.detail-basic-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px;
  gap: 12px;
  align-items: stretch;
}
.detail-basic-grid {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 96px minmax(0, 1fr);
  border: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
}
.detail-basic-label,
.detail-basic-value {
  min-width: 0;
  padding: 7px 10px;
  border-right: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  box-sizing: border-box;
}
.detail-basic-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-lighter);
}
.detail-basic-value { color: var(--el-text-color-regular); overflow: hidden; }
.detail-basic-value-span-3 { grid-column: 2 / 5; }
.detail-basic-grid > :nth-child(4n) { border-right: none; }
.detail-basic-grid > :nth-last-child(-n + 2) { border-bottom: none; }
.detail-product-image-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 170px;
  min-width: 170px;
}
.detail-images { display: flex; gap: 12px; flex-wrap: wrap; }
.detail-image-card { display: flex; flex-direction: column; gap: 6px; }
.detail-image-label { font-size: 12px; color: var(--el-text-color-secondary); }
.detail-image-empty,
.detail-muted { font-size: 12px; color: var(--el-text-color-secondary); }
.detail-color-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.detail-color-size-table-wrap { width: 100%; }
.detail-color-size-footer {
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  text-align: right;
  display: flex;
  justify-content: flex-end;
  gap: 20px;
  flex-wrap: wrap;
}
.detail-color-name { font-size: 12px; color: var(--el-text-color-regular); margin-bottom: 6px; }
.detail-edit-actions { display: flex; justify-content: flex-end; margin-top: 4px; }
.detail-logs { display: flex; flex-direction: column; gap: 10px; }
.detail-log-item {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}
.detail-log-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.detail-log-body { font-size: 12px; color: var(--el-text-color-regular); line-height: 1.5; }
.detail-drawer-resizer {
  position: absolute;
  left: 0;
  top: 0;
  width: 10px;
  height: 100%;
  z-index: 10;
  cursor: ew-resize;
}
.detail-drawer-resizer:hover { background: rgba(64, 158, 255, 0.12); }

/* el-drawer overrides */
:deep(.el-drawer__header) { margin-bottom: 6px; padding-bottom: 0; }
:deep(.el-drawer) { position: relative; }
:deep(.el-drawer__body) { padding-top: 0; }
:deep(.detail-color-size-table .el-table__cell) { overflow: visible; vertical-align: top; }
:deep(.detail-color-size-table .image-upload-area) { min-height: 92px; }
:deep(.el-form-item__label),
:deep(.el-input__inner),
:deep(.el-select__selected-item),
:deep(.el-table),
:deep(.el-table th),
:deep(.el-table td) { font-size: 12px; }
:deep(.detail-product-image-panel .image-upload-area) { width: 100%; }
:deep(.detail-basic-grid .el-select),
:deep(.detail-basic-grid .el-input) { width: 100%; max-width: 100%; }
:deep(.detail-basic-grid .el-select__wrapper) { min-width: 0 !important; }
:deep(.detail-color-image-editor.image-upload-area) { min-height: 64px; }
:deep(.detail-color-image-editor .preview-img) { width: 60px; height: 60px; }

@media (max-width: 860px) {
  .detail-top-row { flex-direction: column; }
  .detail-basic-main { grid-template-columns: 1fr; }
}
</style>

<style>
:global(body.detail-drawer-resizing) {
  cursor: ew-resize !important;
  user-select: none !important;
}

/* tooltip 弹层在 body 下，需用全局样式；通过 popper-class 精确作用范围 */
.finished-qty-popper {
  padding: 0;
}

.finished-qty-popper .el-popper__arrow::before {
  border: 1px solid var(--el-border-color-lighter);
}

.finished-qty-popper .qty-tooltip {
  max-width: 520px;
  padding: 10px 12px;
}

.finished-qty-popper .qty-tooltip-loading,
.finished-qty-popper .qty-tooltip-error,
.finished-qty-popper .qty-tooltip-empty {
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.4;
}

.finished-qty-popper .qty-tooltip-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.finished-qty-popper .qty-tooltip-row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(44px, auto);
  align-items: center;
  gap: 2px;
}

.finished-qty-popper .qty-tooltip-cell {
  padding: 4px 6px;
  border-radius: 4px;
  background: #f5f6f8;
  color: var(--el-text-color-regular);
  border: 1px solid var(--el-border-color-lighter);
  text-align: center;
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.finished-qty-popper .qty-tooltip-head .qty-tooltip-cell {
  background: #eef1f6;
  font-weight: 600;
}

.finished-qty-popper .qty-tooltip-color {
  min-width: 72px;
}
</style>
