<template>
  <AppDialog
    :model-value="visible"
    title="客户单预览（可直接截图，或打印 A4）"
    width="min(1180px, 94vw)"
    top="3vh"
    modal-class="packing-print-overlay"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="doc-toolbar no-print">
      <span class="doc-toolbar-tip">中英双语单据，截图或打印后即可发客户</span>
      <el-button type="primary" @click="onPrint">打印 A4</el-button>
    </div>

    <div ref="printAreaRef" class="packing-doc-print-area">
      <div class="packing-doc a4-sheet">
        <header class="doc-head">
          <div v-if="detail.showCompany" class="doc-brand">
            <span class="doc-brand-en">HONGYU APPAREL</span>
            <span class="doc-brand-cn">鸿宇服饰</span>
          </div>
          <div class="doc-title">
            <span class="doc-title-en">PACKING LIST</span>
            <span class="doc-title-cn">装箱单</span>
          </div>
        </header>

        <div class="doc-meta">
          <div class="doc-meta-item">
            <span class="doc-meta-label">Customer<span class="cn">客户</span></span>
            <span class="doc-meta-value">{{ detail.customerName || '—' }}</span>
          </div>
          <div class="doc-meta-item">
            <span class="doc-meta-label">No.<span class="cn">单号</span></span>
            <span class="doc-meta-value">{{ detail.code || '—' }}</span>
          </div>
          <div v-if="detail.poNo" class="doc-meta-item">
            <span class="doc-meta-label">PO#</span>
            <span class="doc-meta-value">{{ detail.poNo }}</span>
          </div>
          <div class="doc-meta-item">
            <span class="doc-meta-label">Date<span class="cn">装箱日期</span></span>
            <span class="doc-meta-value">{{ detail.packDate || '—' }}</span>
          </div>
          <div v-if="detail.serviceManager" class="doc-meta-item">
            <span class="doc-meta-label">Sales<span class="cn">业务员</span></span>
            <span class="doc-meta-value">{{ detail.serviceManager }}</span>
          </div>
          <div class="doc-meta-item">
            <span class="doc-meta-label">Cartons<span class="cn">箱数</span></span>
            <span class="doc-meta-value">{{ totals.boxCount }}</span>
          </div>
        </div>

        <table class="doc-table">
          <thead>
            <tr>
              <th class="col-box">Ctn<span class="cn">箱号</span></th>
              <th v-if="hasImage" class="col-img">Photo<span class="cn">图片</span></th>
              <th class="col-style">Style No.<span class="cn">款号</span></th>
              <th class="col-color">Color<span class="cn">颜色</span></th>
              <th v-for="size in detail.sizeHeaders" :key="`h-${size}`" class="col-size">{{ size }}</th>
              <th class="col-qty">Qty<span class="cn">合计</span></th>
              <th class="col-weight">Weight(kg)<span class="cn">重量</span></th>
              <th class="col-carton">Carton(cm)<span class="cn">箱规</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in docRows" :key="row.key">
              <td v-if="row.isFirstOfBox" :rowspan="row.rowspan" class="col-box num">{{ row.boxSeq }}</td>
              <td v-if="hasImage" class="col-img">
                <AppImageThumb v-if="row.item.imageUrl" :raw-url="row.item.imageUrl" variant="table" :width="48" :height="48" />
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
              <td :colspan="leadCols">TOTAL · {{ totals.boxCount }} Cartons</td>
              <td v-for="size in detail.sizeHeaders" :key="`t-${size}`" class="col-size num">{{ sizeTotalDisplay(size) }}</td>
              <td class="col-qty num">{{ formatDisplayNumber(totals.totalQty) }}</td>
              <td class="col-weight num">{{ weightDisplay(totals.totalWeight) }}</td>
              <td class="col-carton">—</td>
            </tr>
          </tbody>
        </table>

        <div class="doc-footer">
          <div v-if="detail.remark" class="doc-remark">Remark 备注：{{ detail.remark }}</div>
          <div class="doc-madein">MADE IN CHINA</div>
        </div>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
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

// 弹窗渲染在 #app 内部，直接打印会被对话框层裁切。打印前把内容克隆到 body 顶层打印根，
// 注入纵版 @page，仅当本弹窗打开时生效；打印后清理。beforeprint/afterprint 让按钮和 Ctrl+P 都生效，且与箱贴(横版)互不干扰。
const printAreaRef = ref<HTMLElement | null>(null)
let printRoot: HTMLElement | null = null
let pageStyle: HTMLStyleElement | null = null

function onBeforePrint() {
  if (!props.visible || !printAreaRef.value) return
  printRoot = document.createElement('div')
  printRoot.id = 'packing-print-root'
  printRoot.appendChild(printAreaRef.value.cloneNode(true))
  document.body.appendChild(printRoot)
  pageStyle = document.createElement('style')
  pageStyle.textContent = '@page { size: A4 portrait; margin: 12mm 12mm 14mm; }'
  document.head.appendChild(pageStyle)
  document.body.classList.add('printing-packing-doc')
}

function onAfterPrint() {
  document.body.classList.remove('printing-packing-doc')
  printRoot?.remove()
  printRoot = null
  pageStyle?.remove()
  pageStyle = null
}

onMounted(() => {
  window.addEventListener('beforeprint', onBeforePrint)
  window.addEventListener('afterprint', onAfterPrint)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeprint', onBeforePrint)
  window.removeEventListener('afterprint', onAfterPrint)
  onAfterPrint()
})

function onPrint() {
  window.print()
}
</script>

<style src="./PackingDocument.css"></style>
