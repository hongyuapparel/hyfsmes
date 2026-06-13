<template>
  <AppDialog
    :model-value="visible"
    title="客户单预览（可直接截图，或打印 A4）"
    width="900px"
    top="3vh"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="doc-toolbar no-print">
      <span class="doc-toolbar-tip">中英双语单据，截图或打印后即可发客户</span>
      <el-button type="primary" @click="onPrint">打印 A4</el-button>
    </div>

    <div class="packing-doc-print-area">
      <div class="packing-doc a4-sheet">
        <header class="doc-head">
          <div v-if="detail.showCompany" class="doc-brand">
            <span class="doc-brand-cn">鸿宇服饰</span>
            <span class="doc-brand-en">HONGYU APPAREL</span>
          </div>
          <div class="doc-title">
            <span class="doc-title-cn">装箱单</span>
            <span class="doc-title-en">PACKING LIST</span>
          </div>
        </header>

        <div class="doc-meta">
          <div class="doc-meta-item">
            <span class="doc-meta-label">客户 Customer</span>
            <span class="doc-meta-value">{{ detail.customerName || '—' }}</span>
          </div>
          <div class="doc-meta-item">
            <span class="doc-meta-label">单号 No.</span>
            <span class="doc-meta-value">{{ detail.code || '—' }}</span>
          </div>
          <div v-if="detail.poNo" class="doc-meta-item">
            <span class="doc-meta-label">PO#</span>
            <span class="doc-meta-value">{{ detail.poNo }}</span>
          </div>
          <div class="doc-meta-item">
            <span class="doc-meta-label">装箱日期 Date</span>
            <span class="doc-meta-value">{{ detail.packDate || '—' }}</span>
          </div>
          <div v-if="detail.serviceManager" class="doc-meta-item">
            <span class="doc-meta-label">业务员 Sales</span>
            <span class="doc-meta-value">{{ detail.serviceManager }}</span>
          </div>
          <div class="doc-meta-item">
            <span class="doc-meta-label">箱数 Cartons</span>
            <span class="doc-meta-value">{{ totals.boxCount }}</span>
          </div>
        </div>

        <table class="doc-table">
          <thead>
            <tr>
              <th class="col-box">箱号<span class="en">Ctn</span></th>
              <th v-if="hasImage" class="col-img">图片<span class="en">Photo</span></th>
              <th class="col-style">款号<span class="en">Style No.</span></th>
              <th class="col-color">颜色<span class="en">Color</span></th>
              <th v-for="size in detail.sizeHeaders" :key="`h-${size}`" class="col-size">{{ size }}</th>
              <th class="col-qty">合计<span class="en">Qty</span></th>
              <th class="col-weight">重量<span class="en">Weight(kg)</span></th>
              <th class="col-carton">箱规<span class="en">Carton(cm)</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in docRows" :key="row.key">
              <td v-if="row.isFirstOfBox" :rowspan="row.rowspan" class="col-box num">{{ row.boxSeq }}</td>
              <td v-if="hasImage" class="col-img">
                <AppImageThumb v-if="row.item.imageUrl" :raw-url="row.item.imageUrl" variant="table" :width="40" :height="40" />
                <span v-else class="muted">—</span>
              </td>
              <td class="col-style">{{ row.item.styleNo || '—' }}</td>
              <td class="col-color">{{ row.item.colorName || '—' }}</td>
              <td v-for="size in detail.sizeHeaders" :key="`${row.key}-${size}`" class="col-size num">{{ sizeDisplay(row.item, size) }}</td>
              <td class="col-qty num">{{ formatDisplayNumber(row.itemTotal) }}</td>
              <td v-if="row.isFirstOfBox" :rowspan="row.rowspan" class="col-weight num">{{ weightDisplay(row.weightKg) }}</td>
              <td v-if="row.isFirstOfBox" :rowspan="row.rowspan" class="col-carton">{{ row.cartonSize || '—' }}</td>
            </tr>
            <tr class="doc-total">
              <td :colspan="leadCols">合计 TOTAL · {{ totals.boxCount }} 箱 Cartons</td>
              <td v-for="size in detail.sizeHeaders" :key="`t-${size}`" class="col-size num">{{ sizeTotalDisplay(size) }}</td>
              <td class="col-qty num">{{ formatDisplayNumber(totals.totalQty) }}</td>
              <td class="col-weight num">{{ weightDisplay(totals.totalWeight) }}</td>
              <td class="col-carton">—</td>
            </tr>
          </tbody>
        </table>

        <div class="doc-footer">
          <div v-if="detail.remark" class="doc-remark">备注 Remark：{{ detail.remark }}</div>
          <div class="doc-madein">MADE IN CHINA</div>
        </div>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppDialog from '@/components/AppDialog.vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { formatDisplayNumber } from '@/utils/display-number'
import type { PackingItemDetail, PackingListDetail } from '@/api/packing-lists'

const props = defineProps<{
  visible: boolean
  detail: PackingListDetail
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
}>()

interface DocRow {
  key: string
  boxSeq: number
  isFirstOfBox: boolean
  rowspan: number
  weightKg: number | null
  cartonSize: string
  item: PackingItemDetail
  itemTotal: number
}

function itemTotal(item: PackingItemDetail): number {
  const sum = Object.values(item.sizeQuantities).reduce((acc, n) => acc + (Number(n) || 0), 0)
  return sum > 0 ? sum : item.totalQty || 0
}

const docRows = computed<DocRow[]>(() => {
  const rows: DocRow[] = []
  for (const box of props.detail.boxes) {
    const items = box.items.length ? box.items : []
    items.forEach((item, index) => {
      rows.push({
        key: `${box.id}-${item.id}-${index}`,
        boxSeq: box.boxSeq,
        isFirstOfBox: index === 0,
        rowspan: items.length,
        weightKg: box.weightKg,
        cartonSize: box.cartonSize,
        item,
        itemTotal: itemTotal(item),
      })
    })
  }
  return rows
})

const hasImage = computed(() => props.detail.boxes.some((box) => box.items.some((item) => !!item.imageUrl)))

/** 合计行前导列跨度：箱号 + [图片] + 款号 + 颜色 */
const leadCols = computed(() => 3 + (hasImage.value ? 1 : 0))

const totals = computed(() => {
  let totalQty = 0
  let totalWeight = 0
  const bySize: Record<string, number> = {}
  for (const box of props.detail.boxes) {
    totalWeight += Number(box.weightKg) || 0
    for (const item of box.items) {
      totalQty += itemTotal(item)
      for (const size of props.detail.sizeHeaders) {
        const qty = Number(item.sizeQuantities[size]) || 0
        if (qty > 0) bySize[size] = (bySize[size] ?? 0) + qty
      }
    }
  }
  return { boxCount: props.detail.boxes.length, totalQty, totalWeight, bySize }
})

function sizeDisplay(item: PackingItemDetail, size: string): string {
  const qty = Number(item.sizeQuantities[size]) || 0
  return qty > 0 ? formatDisplayNumber(qty) : ''
}

function sizeTotalDisplay(size: string): string {
  const sum = totals.value.bySize[size] ?? 0
  return sum > 0 ? formatDisplayNumber(sum) : ''
}

function weightDisplay(weight: number | null): string {
  if (weight == null || weight <= 0) return ''
  return `${Math.round(weight * 100) / 100}`
}

function onPrint() {
  window.print()
}
</script>

<style src="./PackingDocument.css"></style>
