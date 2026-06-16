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
      <span class="doc-toolbar-tip">英文单据（A4 横版），截图或打印后即可发客户</span>
      <el-button type="primary" @click="onPrint">打印 A4</el-button>
    </div>

    <div ref="printAreaRef" class="packing-doc-print-area">
      <div class="packing-doc a4-sheet">
        <header class="doc-head">
          <div v-if="detail.showCompany" class="doc-brand">
            <span class="doc-brand-en">HONGYU APPAREL CO., LTD.</span>
          </div>
          <div class="doc-title">
            <span class="doc-title-en">PACKING LIST</span>
          </div>
        </header>

        <div class="doc-meta">
          <div class="doc-meta-item">
            <span class="doc-meta-label">Customer</span>
            <span class="doc-meta-value">{{ detail.customerName || '—' }}</span>
          </div>
          <div class="doc-meta-item">
            <span class="doc-meta-label">No.</span>
            <span class="doc-meta-value">{{ detail.code || '—' }}</span>
          </div>
          <div v-if="detail.poNo" class="doc-meta-item">
            <span class="doc-meta-label">PO#</span>
            <span class="doc-meta-value">{{ detail.poNo }}</span>
          </div>
          <div class="doc-meta-item">
            <span class="doc-meta-label">Date</span>
            <span class="doc-meta-value">{{ detail.packDate || '—' }}</span>
          </div>
          <div v-if="detail.serviceManager" class="doc-meta-item">
            <span class="doc-meta-label">Service Manager</span>
            <span class="doc-meta-value">{{ detail.serviceManager }}</span>
          </div>
          <div class="doc-meta-item">
            <span class="doc-meta-label">Cartons</span>
            <span class="doc-meta-value">{{ totals.boxCount }}</span>
          </div>
        </div>

        <table class="doc-table">
          <thead>
            <tr>
              <th class="col-box">Ctn</th>
              <th v-if="hasImage" class="col-img">Photo</th>
              <th class="col-style">Style No.</th>
              <th class="col-color">Color</th>
              <th v-for="size in detail.sizeHeaders" :key="`h-${size}`" class="col-size">{{ size }}</th>
              <th class="col-qty">Qty</th>
              <th class="col-weight">Weight(kg)</th>
              <th class="col-carton">Carton(cm)</th>
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
          <div v-if="detail.remark" class="doc-remark">Remark: {{ detail.remark }}</div>
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
// 注入横版 @page，仅当本弹窗打开时生效；打印后清理。beforeprint/afterprint 让按钮和 Ctrl+P 都生效，且与箱贴互不干扰。
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
  // margin:0 让浏览器没有页边可画"页眉页脚"(日期/网址/页码)，留白改由 .packing-doc 自身 padding 补回
  pageStyle.textContent = '@page { size: A4 landscape; margin: 0; }'
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
