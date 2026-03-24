<template>
  <div class="order-detail-page" v-loading="loading">
    <div class="toolbar no-print">
      <el-button @click="goBack">返回列表</el-button>
      <el-button type="primary" @click="handlePrint" :disabled="!detail">打印</el-button>
    </div>

    <div class="a4-sheet" ref="sheetRef" v-if="detail">
      <!-- 页眉：一行内紧凑排列，与 A 区不重复字段 -->
      <header class="sheet-header">
        <span class="brand">鸿宇服饰 · 订单</span>
        <span class="header-sep" v-if="detail.orderNo">订单号：</span>
        <span class="header-order-no" v-if="detail.orderNo">{{ detail.orderNo }}</span>
        <span class="header-sep" v-if="detail.orderDate">下单日期：</span>
        <span v-if="detail.orderDate">{{ formatDate(detail.orderDate) }}</span>
        <span class="header-meta-right" v-if="headerMetaValues.length">
          {{ headerMetaValues.join('  ') }}
        </span>
      </header>

      <!-- 缩略图在左，A 区 + B 区在右，占满右侧减少空白 -->
      <div class="block block-ab-layout">
        <div class="ab-left">
          <div v-if="detail.imageUrl" class="main-image">
            <el-image :src="detail.imageUrl" fit="contain" />
          </div>
          <div v-else class="main-image placeholder">
            无主图
          </div>
        </div>
        <div class="ab-right">
          <!-- A 区：基本信息 -->
          <div class="block-body block-body-a">
            <div class="kv-grid">
              <div v-if="detail.skuCode" class="kv-item">
                <span class="kv-label">SKU</span>
                <span class="kv-value">{{ detail.skuCode }}</span>
              </div>
              <div v-if="detail.xiaomanOrderNo" class="kv-item">
                <span class="kv-label">小满单号</span>
                <span class="kv-value ellipsis">{{ detail.xiaomanOrderNo }}</span>
              </div>
              <div v-if="collaborationDisplay" class="kv-item">
                <span class="kv-label">合作方式</span>
                <span class="kv-value">{{ collaborationDisplay }}</span>
              </div>
              <div v-if="orderTypeDisplay" class="kv-item">
                <span class="kv-label">订单类型</span>
                <span class="kv-value ellipsis">{{ orderTypeDisplay }}</span>
              </div>
              <div v-if="detail.customerName" class="kv-item">
                <span class="kv-label">客户</span>
                <span class="kv-value ellipsis">{{ detail.customerName }}</span>
              </div>
              <div v-if="detail.customerDueDate" class="kv-item">
                <span class="kv-label">客户交期</span>
                <span class="kv-value">{{ formatDate(detail.customerDueDate) }}</span>
              </div>
              <div v-if="detail.merchandiser" class="kv-item">
                <span class="kv-label">跟单员</span>
                <span class="kv-value">{{ detail.merchandiser }}</span>
              </div>
              <div v-if="detail.merchandiserPhone" class="kv-item">
                <span class="kv-label">跟单电话</span>
                <span class="kv-value">{{ detail.merchandiserPhone }}</span>
              </div>
              <div v-if="detail.salesperson" class="kv-item">
                <span class="kv-label">业务员</span>
                <span class="kv-value">{{ detail.salesperson }}</span>
              </div>
            </div>
          </div>
          <!-- B 区：颜色 / 数量（与 A 区一致用 block-body 做外框） -->
          <section v-if="hasColorSize" class="block block-color-qty">
            <div class="block-title">B 颜色 / 数量</div>
            <div class="block-body">
            <el-table
              :data="colorSizeRowsForView"
              border
              size="small"
              class="compact-table table-full"
            >
              <el-table-column prop="colorName" label="颜色" min-width="80" />
              <el-table-column
                v-for="(header, index) in colorSizeHeadersForView"
                :key="header + index"
                :label="header"
                min-width="60"
              >
                <template #default="{ row }">
                  <span>{{ row.quantities[index] ?? '' }}</span>
                </template>
              </el-table-column>
              <el-table-column label="合计" min-width="60">
                <template #default="{ row }">
                  <span>{{ row.total }}</span>
                </template>
              </el-table-column>
              <el-table-column v-if="hasColorRemark" label="备注" min-width="100">
                <template #default="{ row }">
                  <span>{{ row.remark }}</span>
                </template>
              </el-table-column>
            </el-table>
            </div>
          </section>
        </div>
      </div>

      <!-- C 区：物料信息（与 A 区一致用 block-body 做外框） -->
      <section v-if="hasMaterials" class="block block-materials">
        <div class="block-title">C 物料信息</div>
        <div class="block-body">
        <el-table
          :data="materialsForView"
          border
          size="small"
          class="compact-table table-full materials-table"
        >
          <el-table-column
            v-for="col in materialColumns"
            :key="`material-col-${col.key}`"
            :prop="col.key"
            :label="col.label"
            :min-width="col.minWidth"
            :show-overflow-tooltip="col.showOverflowTooltip"
          />
        </el-table>
        </div>
      </section>

      <!-- D 区：尺寸信息（与 A 区一致用 block-body 做外框） -->
      <section v-if="hasSizeInfo" class="block">
        <div class="block-title">D 尺寸信息</div>
        <div class="block-body">
        <el-table
          :data="sizeInfoRowsForView"
          border
          size="small"
          class="compact-table table-full size-table"
        >
          <el-table-column
            v-for="(header, index) in sizeMetaHeadersForView"
            :key="'meta-' + index"
            :label="header"
            :min-width="sizeMetaColWidth"
          >
            <template #default="{ row }">
              <span>{{ row.metaValues[index] ?? '' }}</span>
            </template>
          </el-table-column>
          <el-table-column
            v-for="(header, index) in sizeHeadersForView"
            :key="'size-' + index"
            :label="header"
            :min-width="sizeValueColWidth"
          >
            <template #default="{ row }">
              <span>{{ row.sizeValues[index] ?? '' }}</span>
            </template>
          </el-table-column>
        </el-table>
        </div>
      </section>

      <!-- E 区：工艺项目（与 A 区一致用 block-body 做外框） -->
      <section v-if="hasProcessItems" class="block">
        <div class="block-title">E 工艺项目</div>
        <div class="block-body">
        <el-table
          :data="processItemsForView"
          border
          size="small"
          class="compact-table table-full"
        >
          <el-table-column
            v-for="col in processColumns"
            :key="`process-col-${col.key}`"
            :prop="col.key"
            :label="col.label"
            :min-width="col.minWidth"
            :show-overflow-tooltip="col.showOverflowTooltip"
          />
        </el-table>
        </div>
      </section>

      <!-- F 区：生产要求（文字颜色与整页一致） -->
      <section v-if="detail.productionRequirement" class="block">
        <div class="block-title">F 生产要求</div>
        <div class="block-text production-text">
          {{ detail.productionRequirement }}
        </div>
      </section>

      <!-- G 区：包装要求（仅表头+说明，无辅料字段；文字在上、图片在下，图片加大） -->
      <section v-if="hasPackaging" class="block">
        <div class="block-title">G 包装要求</div>
        <div class="packaging-list">
          <div
            v-for="(cell, index) in packagingCellsForView"
            :key="cell.header + index"
            class="packaging-item"
          >
            <div class="packaging-header-text">
              {{ cell.header }}
            </div>
            <div v-if="cell.description" class="packaging-desc">
              {{ cell.description }}
            </div>
            <div v-if="cell.imageUrl" class="packaging-image-wrap">
              <el-image :src="cell.imageUrl" fit="contain" />
            </div>
          </div>
        </div>
        <div v-if="detail.packagingMethod" class="block-text packaging-method">
          包装方式：{{ detail.packagingMethod }}
        </div>
      </section>

      <!-- H 区：图片附件 -->
      <section v-if="hasAttachments" class="block block-attachments">
        <div class="block-title">H 图片附件</div>
        <div class="attachments-grid">
          <div
            v-for="(url, index) in attachmentsForView"
            :key="url + index"
            class="attachment-item"
          >
            <el-image :src="url" fit="contain" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { OrderDetail } from '@/api/orders'
import { getOrderDetail } from '@/api/orders'
import { ElMessage } from 'element-plus'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getDictItems, getDictTree } from '@/api/dicts'
import type { SystemOptionTreeNode } from '@/api/system-options'
import { formatDate } from '@/utils/date-format'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const detail = ref<OrderDetail | null>(null)
const sheetRef = ref<HTMLDivElement | null>(null)

const statusLabelMap: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审单',
  pending_purchase: '待采购',
  pending_pattern: '待纸样',
  pending_cutting: '待裁床',
  pending_sewing: '待车缝',
  pending_finishing: '待尾部',
  completed: '订单完成',
}

const statusLabel = computed(() => {
  if (!detail.value?.status) return ''
  return statusLabelMap[detail.value.status] ?? detail.value.status
})

const orderTypeTree = ref<SystemOptionTreeNode[]>([])
const collaborationItems = ref<Array<{ id: number; value: string }>>([])
const materialTypeItems = ref<Array<{ id: number; value: string }>>([])

function findOrderTypeLabelById(id: number | null | undefined): string {
  if (!id) return ''
  const stack: SystemOptionTreeNode[] = [...orderTypeTree.value]
  while (stack.length) {
    const node = stack.pop()!
    if (node.id === id) return node.value
    if (node.children?.length) stack.push(...node.children)
  }
  return ''
}

function findCollaborationLabelById(id: number | null | undefined): string {
  if (!id) return ''
  const found = collaborationItems.value.find((item) => item.id === id)
  return found?.value ?? ''
}

function findMaterialTypeLabelById(id: number | null | undefined): string {
  if (!id) return ''
  const found = materialTypeItems.value.find((item) => item.id === id)
  return found?.value ?? ''
}

const orderTypeDisplay = computed(() => {
  const id = (detail.value as any)?.orderTypeId as number | null | undefined
  if (id) {
    const label = findOrderTypeLabelById(id)
    if (label) return label
  }
  const legacy = (detail.value as any)?.orderType ?? detail.value?.label
  return legacy ? String(legacy).trim() : ''
})

const collaborationDisplay = computed(() => {
  const id = (detail.value as any)?.collaborationTypeId as number | null | undefined
  if (id) {
    const label = findCollaborationLabelById(id)
    if (label) return label
  }
  const legacy = (detail.value as any)?.collaborationType
  return legacy ? String(legacy).trim() : ''
})

function toLeafOptionLabel(value: string | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const parts = raw
    .split('>')
    .map((item) => item.trim())
    .filter(Boolean)
  return parts.length ? parts[parts.length - 1] : raw
}

const headerMetaValues = computed(() => {
  const values = [
    toLeafOptionLabel((detail.value as any)?.productGroupName),
    String((detail.value as any)?.applicablePeopleName ?? '').trim(),
  ].filter(Boolean)
  return values
})

function goBack() {
  router.push({ name: 'OrdersList' })
}

function handlePrint() {
  window.print()
}

function normalizeNumber(n: unknown): number {
  const num = Number(n)
  return Number.isFinite(num) ? num : 0
}

// B 区
const colorSizeHeadersForView = computed(() => {
  const headers = (detail.value?.colorSizeHeaders ?? []).filter((h) => String(h || '').trim())
  return headers.length ? headers : []
})

const colorSizeRowsForView = computed(() => {
  const rows = (detail.value?.colorSizeRows ?? []).map((row) => {
    const quantities = Array.isArray(row.quantities) ? row.quantities : []
    const total = quantities.reduce((sum, n) => sum + normalizeNumber(n), 0)
    return {
      colorName: row.colorName?.trim?.() ?? '',
      quantities,
      remark: row.remark?.trim?.() ?? '',
      total,
    }
  })
  return rows.filter((row) => row.colorName || row.total || row.remark)
})

const hasColorSize = computed(() => {
  return colorSizeHeadersForView.value.length > 0 && colorSizeRowsForView.value.length > 0
})

const hasColorRemark = computed(() =>
  colorSizeRowsForView.value.some((row) => !!row.remark),
)

// C 区
const materialsForView = computed(() => {
  const list = (detail.value?.materials ?? []).map((m: any) => {
    const materialTypeId = m.materialTypeId as number | null | undefined
    const labelFromId = materialTypeId ? findMaterialTypeLabelById(materialTypeId) : ''
    const fallback = m.materialType ?? ''
    return {
      materialTypeLabel: labelFromId || fallback || '',
      supplierName: m.supplierName ?? '',
      materialName: m.materialName ?? '',
      color: m.color ?? '',
      fabricWidth: m.fabricWidth ?? '',
      usagePerPiece: m.usagePerPiece ?? '',
      lossPercent: m.lossPercent ?? '',
      orderPieces: m.orderPieces ?? '',
      purchaseQuantity: m.purchaseQuantity ?? '',
      cuttingQuantity: m.cuttingQuantity ?? '',
      remark: m.remark ?? '',
    }
  })
  return list.filter((m) =>
    Object.values(m).some((v) => v !== '' && v != null),
  )
})

const hasMaterials = computed(() => materialsForView.value.length > 0)

function toPrintLabelByKey(key: string): string {
  const labelMap: Record<string, string> = {
    materialTypeLabel: '类型',
    supplierName: '供应商',
    materialName: '名称',
    color: '颜色',
    fabricWidth: '门幅',
    usagePerPiece: '单件用量',
    lossPercent: '损耗%',
    orderPieces: '订单件数',
    purchaseQuantity: '采购总量',
    cuttingQuantity: '裁床用量',
    remark: '备注',
    processName: '工艺项目',
    part: '部位',
  }
  if (labelMap[key]) return labelMap[key]
  return key
}

interface DynamicColumn {
  key: string
  label: string
  minWidth: number
  showOverflowTooltip?: boolean
}

function buildDynamicColumns(
  rows: Record<string, unknown>[],
  preferredOrder: string[],
  defaultMinWidth = 100,
): DynamicColumn[] {
  const allKeys = new Set<string>()
  rows.forEach((row) => {
    Object.entries(row).forEach(([key, value]) => {
      if (value !== '' && value != null) allKeys.add(key)
    })
  })
  const orderedKeys = [...preferredOrder.filter((k) => allKeys.has(k)), ...[...allKeys].filter((k) => !preferredOrder.includes(k))]
  return orderedKeys.map((key) => ({
    key,
    label: toPrintLabelByKey(key),
    minWidth: key === 'remark' ? 160 : defaultMinWidth,
    showOverflowTooltip: key === 'remark',
  }))
}

const materialColumns = computed(() =>
  buildDynamicColumns(
    materialsForView.value as Record<string, unknown>[],
    [
      'materialTypeLabel',
      'supplierName',
      'materialName',
      'color',
      'fabricWidth',
      'usagePerPiece',
      'lossPercent',
      'orderPieces',
      'purchaseQuantity',
      'cuttingQuantity',
      'remark',
    ],
    80,
  ),
)

// D 区
const sizeMetaHeadersForView = computed(() => {
  const headers = (detail.value?.sizeInfoMetaHeaders ?? []).filter((h) => String(h || '').trim())
  return headers.length ? headers : []
})

const sizeHeadersForView = computed(() => {
  const headers = (detail.value?.colorSizeHeaders ?? []).filter((h) => String(h || '').trim())
  return headers.length ? headers : []
})

/**
 * D 区列宽自适应压缩：
 * 打印页不可滚动，尺码列越多时越需要压缩前置信息列与尺码列宽度。
 */
const sizeMetaColWidth = computed(() => {
  const sizeCount = sizeHeadersForView.value.length
  if (sizeCount >= 8) return 56
  if (sizeCount >= 6) return 62
  return 72
})

const sizeValueColWidth = computed(() => {
  const sizeCount = sizeHeadersForView.value.length
  if (sizeCount >= 8) return 34
  if (sizeCount >= 6) return 40
  return 52
})

const sizeInfoRowsForView = computed(() => {
  const metaLen = sizeMetaHeadersForView.value.length
  const sizeLen = sizeHeadersForView.value.length
  if (!metaLen && !sizeLen) return []
  const rows = (detail.value?.sizeInfoRows ?? []).map((r) => ({
    metaValues: Array.isArray(r.metaValues) ? r.metaValues : [],
    sizeValues: Array.isArray(r.sizeValues) ? r.sizeValues : [],
  }))
  return rows.filter((row) => {
    const hasMeta = row.metaValues.slice(0, metaLen).some((v) => String(v || '').trim())
    const hasSize = row.sizeValues.slice(0, sizeLen).some((v) => String(v || '').trim())
    return hasMeta || hasSize
  })
})

const hasSizeInfo = computed(() => sizeInfoRowsForView.value.length > 0)

// E 区
const processItemsForView = computed(() => {
  const list = (detail.value?.processItems ?? []).map((p: any) => {
    const extras = Object.entries(p ?? {}).reduce((acc, [key, value]) => {
      if (['processName', 'supplierName', 'part', 'remark'].includes(key)) return acc
      if (key === 'id' || key.endsWith('Id') || key === 'createdAt' || key === 'updatedAt') return acc
      ;(acc as any)[key] = value
      return acc
    }, {} as Record<string, unknown>)
    return {
      processName: p.processName ?? '',
      supplierName: p.supplierName ?? '',
      part: p.part ?? '',
      remark: p.remark ?? '',
      ...extras,
    }
  })
  return list.filter((p) =>
    Object.values(p).some((v) => String(v || '').trim()),
  )
})

const hasProcessItems = computed(() => processItemsForView.value.length > 0)
const processColumns = computed(() =>
  buildDynamicColumns(
    processItemsForView.value as Record<string, unknown>[],
    ['processName', 'supplierName', 'part', 'remark'],
    100,
  ),
)

// G 区
const packagingCellsForView = computed(() => {
  const headers = detail.value?.packagingHeaders ?? []
  const cells = detail.value?.packagingCells ?? []
  return headers.map((header, index) => {
    const cell = cells[index] ?? ({} as any)
    return {
      header,
      imageUrl: cell.imageUrl ?? '',
      accessoryName: cell.accessoryName ?? '',
      description: cell.description ?? '',
    }
  }).filter((c) => {
    const header = String(c.header || '').trim()
    const hasText = header || c.accessoryName || c.description
    const hasImage = !!c.imageUrl
    return hasText || hasImage
  })
})

const hasPackaging = computed(
  () =>
    packagingCellsForView.value.length > 0 ||
    !!detail.value?.packagingMethod,
)

// H 区
const attachmentsForView = computed(() => {
  const list = (detail.value?.attachments ?? []) as string[]
  return list.slice(0, 6)
})

const hasAttachments = computed(() => attachmentsForView.value.length > 0)

async function loadDetail() {
  const idParam = route.params.id
  const id = Number(idParam)
  if (!id || Number.isNaN(id)) {
    ElMessage.error('订单ID无效')
    router.push({ name: 'OrdersList' })
    return
  }
  loading.value = true
  try {
    const res = await getOrderDetail(id)
    detail.value = res.data ?? null
  } catch (e: unknown) {
    if (!isErrorHandled(e)) {
      ElMessage.error(getErrorMessage(e))
    }
  } finally {
    loading.value = false
  }
}

async function loadDicts() {
  try {
    const [orderTypeRes, collabRes, materialTypeRes] = await Promise.all([
      getDictTree('order_types'),
      getDictItems('collaboration'),
      getDictItems('material_types'),
    ])
    const orderTypeVals = orderTypeRes.data ?? []
    orderTypeTree.value = Array.isArray(orderTypeVals) ? orderTypeVals : []

    const collabVals = collabRes.data ?? []
    collaborationItems.value = Array.isArray(collabVals)
      ? collabVals.map((item: any) => ({ id: item.id, value: item.value }))
      : []

    const materialVals = materialTypeRes.data ?? []
    materialTypeItems.value = Array.isArray(materialVals)
      ? materialVals.map((item: any) => ({ id: item.id, value: item.value }))
      : []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) {
      console.warn('订单字典加载失败', getErrorMessage(e))
    }
  }
}

onMounted(async () => {
  await Promise.all([loadDicts(), loadDetail()])
  if (route.query.print === '1' && detail.value) {
    await nextTick()
    window.print()
    // 打印后移除 URL 中的 print 参数，避免用户刷新或返回时再次自动打印
    router.replace({ name: 'OrdersDetail', params: route.params })
  }
})
</script>

<style scoped>
.order-detail-page {
  padding: var(--space-md);
  background: var(--color-card);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.toolbar {
  margin-bottom: var(--space-md);
  display: flex;
  justify-content: space-between;
}

/* 统一整页文字颜色，不用双色 */
.a4-sheet {
  margin: 0 auto;
  background: #ffffff;
  color: #303133;
  padding: 16px 18px;
  width: 210mm;
  min-height: 297mm;
  box-sizing: border-box;
  font-size: 12px;
  line-height: 1.3;
}

/* 页眉：单行流式排列，避免左侧紧凑、右侧大块空白 */
.sheet-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 16px;
  margin-bottom: 8px;
  border-bottom: 1px solid #dcdfe6;
  padding-bottom: 6px;
  font-size: 12px;
}

.sheet-header .brand {
  font-weight: 600;
  margin-right: 4px;
}

.sheet-header .header-sep {
  color: #909399;
  margin-left: 4px;
}

.sheet-header .header-order-no {
  font-weight: 600;
}

.sheet-header .header-meta-right {
  margin-left: auto;
  font-weight: 500;
  white-space: nowrap;
}

.block {
  margin-top: 8px;
}

.block-title {
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 12px;
}

/* 缩略图在左，A+B 在右，占满宽度减少右侧空白 */
.block-ab-layout {
  margin-top: 6px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.ab-left {
  flex-shrink: 0;
  display: flex;
}

.main-image {
  width: 100px;
  max-height: 120px;
  border: 1px solid #dcdfe6;
  border-radius: 2px;
  overflow: hidden;
}

.main-image.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #909399;
}

.main-image :deep(.el-image) {
  width: 100%;
  height: auto;
  max-height: 120px;
}

.ab-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.block-body {
  border: 1px solid #dcdfe6;
  border-radius: 2px;
  padding: 6px 8px;
}

.block-body-a {
  flex-shrink: 0;
}

.block-ab-layout .block-color-qty {
  margin-top: 0;
}

.kv-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2px 8px;
}

.kv-item {
  display: flex;
  gap: 4px;
  font-size: 12px;
}

.kv-label {
  flex-shrink: 0;
  color: #303133;
}

.kv-value {
  flex: 1;
  min-width: 0;
}

.kv-value.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 表格统一占满宽，避免 B 区显得松散 */
.table-full {
  width: 100%;
}

.compact-table :deep(.el-table__cell) {
  padding: 1px 1px;
  font-size: 12px;
  color: #303133;
}

/* B 区：列均分宽度，表不缩成一小条 */
.block-color-qty .compact-table :deep(.el-table) {
  table-layout: fixed;
}

/* D 区尺寸表与其他表格字号保持一致 */
.size-table :deep(.el-table__cell) {
  font-size: 12px;
}

/* C 区：允许长文本换行，避免挤出表格 */
.materials-table :deep(.el-table__body .el-table__cell) {
  word-break: break-word;
}

/* 与整页统一文字颜色，避免 F/G 区与表格等不一致 */
.block-text {
  border: 1px solid #dcdfe6;
  border-radius: 2px;
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  color: #303133;
}

.production-text {
  color: #303133;
}

.packaging-list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

/* G 区：表头+说明在上，图片在下，文字统一在一侧 */
.packaging-item {
  border: 1px solid #dcdfe6;
  border-radius: 2px;
  padding: 6px 8px;
  font-size: 12px;
  color: #303133;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.packaging-header-text {
  font-weight: 600;
}

.packaging-desc {
  line-height: 1.4;
  word-break: break-word;
}

.packaging-image-wrap {
  width: 100%;
  height: 100px;
  border-radius: 2px;
  border: 1px solid #dcdfe6;
  overflow: hidden;
  margin-top: 2px;
}

.packaging-image-wrap :deep(.el-image) {
  width: 100%;
  height: 100%;
}

.packaging-method {
  margin-top: 8px;
  color: #303133;
}

.block-attachments {
  margin-top: 10px;
}

/* H 区：图片加大，两列布局 */
.attachments-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.attachment-item {
  width: 100%;
  height: 200px;
  position: relative;
  border: 1px solid #dcdfe6;
  border-radius: 2px;
  overflow: hidden;
}

.attachment-item :deep(.el-image) {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.no-print {
  /* will be hidden in print */
}

@media print {
  :host,
  .order-detail-page {
    margin: 0;
    padding: 0;
    border: none;
    border-radius: 0;
    background: #ffffff;
  }

  .no-print {
    display: none;
  }

  .a4-sheet {
    margin: 0;
    width: 100%;
    min-height: auto;
    box-shadow: none;
  }
}

@page {
  size: A4 portrait;
  margin: 10mm 10mm 10mm 10mm;
}
</style>
