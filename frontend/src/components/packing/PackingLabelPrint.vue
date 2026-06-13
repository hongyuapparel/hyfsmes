<template>
  <AppDialog
    :model-value="visible"
    title="箱贴预览（A4 横版，每箱一张；文字可点击修改，仅影响本次打印）"
    width="1060px"
    top="4vh"
    modal-class="packing-print-overlay"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="label-toolbar">
      <el-checkbox
        :model-value="selectedSeqs.size === detail.boxes.length"
        :indeterminate="selectedSeqs.size > 0 && selectedSeqs.size < detail.boxes.length"
        @change="toggleAll"
      >
        全选（已选 {{ selectedSeqs.size }}/{{ detail.boxes.length }} 箱）
      </el-checkbox>
      <el-button type="primary" :disabled="!selectedSeqs.size" @click="onPrint">打印箱贴</el-button>
    </div>

    <div ref="printAreaRef" class="packing-label-print-area">
      <div
        v-for="box in detail.boxes"
        :key="box.boxSeq"
        class="packing-label"
        :class="{ 'label-skip-print': !selectedSeqs.has(box.boxSeq) }"
      >
        <el-checkbox
          class="label-select no-print"
          :model-value="selectedSeqs.has(box.boxSeq)"
          @change="toggleBox(box.boxSeq)"
        >
          打印此箱
        </el-checkbox>

        <table class="label-table">
          <tbody>
            <tr class="lt-title-row">
              <td :colspan="totalCols(box)" class="lt-title-cell">
                <div class="label-boxno">{{ box.boxSeq }}</div>
                <div class="lt-title-text">
                  <span class="lt-brand" contenteditable="true">HONGYU APPAREL</span>
                </div>
                <div class="lt-cartonno">
                  <span class="lt-cartonno-label">CARTON NO.</span>
                  <span class="lt-cartonno-val" contenteditable="true">{{ box.boxSeq }} / {{ detail.boxes.length }}</span>
                </div>
              </td>
            </tr>
            <tr class="lt-customer">
              <td class="lt-label" colspan="2">CUSTOMER</td>
              <td :colspan="totalCols(box) - 2" class="lt-customer-val" contenteditable="true">{{ detail.poNo || detail.customerName }}</td>
            </tr>
            <tr v-if="detail.serviceManager" class="lt-info">
              <td class="lt-label" colspan="2">SHIP MARK</td>
              <td :colspan="totalCols(box) - 2" class="lt-info-val" contenteditable="true">{{ detail.serviceManager }}</td>
            </tr>

            <tr class="lt-matrix-head">
              <th v-if="boxHasImage(box)" class="lt-img">PHOTO</th>
              <th class="lt-style">STYLE NO</th>
              <th v-if="boxHasName(box)" class="lt-name">DESCRIPTION</th>
              <th class="lt-color">COLOUR</th>
              <th v-for="size in boxSizes(box)" :key="`h-${size}`">{{ size }}</th>
              <th class="lt-total">TOTAL</th>
            </tr>
            <tr v-for="item in box.items" :key="item.id">
              <td v-if="boxHasImage(box)" class="lt-img">
                <img v-if="item.imageUrl" :src="item.imageUrl" alt="" />
              </td>
              <td class="lt-style" contenteditable="true">{{ item.styleNo || '-' }}</td>
              <td v-if="boxHasName(box)" class="lt-name" contenteditable="true">{{ item.styleName || '-' }}</td>
              <td class="lt-color" contenteditable="true">{{ item.colorName || '-' }}</td>
              <td v-for="size in boxSizes(box)" :key="`${item.id}-${size}`" contenteditable="true">{{ itemSizeQty(item, size) }}</td>
              <td class="lt-total" contenteditable="true">{{ itemTotal(item) }}</td>
            </tr>
            <tr class="lt-sum">
              <td :colspan="leadCols(box)">TOTAL</td>
              <td v-for="size in boxSizes(box)" :key="`s-${size}`">{{ boxSizeTotal(box, size) }}</td>
              <td class="lt-total">{{ boxTotal(box) }}</td>
            </tr>

            <tr class="lt-info">
              <td class="lt-label" colspan="2">WEIGHT (KG)</td>
              <td :colspan="totalCols(box) - 2" class="lt-info-val" contenteditable="true">{{ box.weightKg != null ? box.weightKg : '' }}</td>
            </tr>
            <tr class="lt-info">
              <td class="lt-label" colspan="2">DIMENSION (CM)</td>
              <td :colspan="totalCols(box) - 2" class="lt-info-val" contenteditable="true">{{ box.cartonSize || '' }}</td>
            </tr>
            <tr>
              <td :colspan="totalCols(box)" class="lt-madein" contenteditable="true">MADE IN CHINA</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppDialog from '@/components/AppDialog.vue'
import type { PackingBoxDetail, PackingItemDetail, PackingListDetail } from '@/api/packing-lists'

const props = defineProps<{
  visible: boolean
  detail: PackingListDetail
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
}>()

const selectedSeqs = ref<Set<number>>(new Set())

watch(
  () => [props.visible, props.detail] as const,
  ([visible]) => {
    if (visible) selectedSeqs.value = new Set(props.detail.boxes.map((b) => b.boxSeq))
  },
  { immediate: true },
)

function toggleAll() {
  if (selectedSeqs.value.size === props.detail.boxes.length) selectedSeqs.value = new Set()
  else selectedSeqs.value = new Set(props.detail.boxes.map((b) => b.boxSeq))
}

function toggleBox(seq: number) {
  const next = new Set(selectedSeqs.value)
  if (next.has(seq)) next.delete(seq)
  else next.add(seq)
  selectedSeqs.value = next
}

function sizeEntries(item: PackingItemDetail): Array<{ size: string; qty: number }> {
  const headers = props.detail.sizeHeaders.length ? props.detail.sizeHeaders : Object.keys(item.sizeQuantities)
  const entries = headers
    .filter((size) => (item.sizeQuantities[size] ?? 0) > 0)
    .map((size) => ({ size, qty: item.sizeQuantities[size] }))
  if (!entries.length && item.totalQty > 0) return [{ size: 'QTY', qty: item.totalQty }]
  return entries
}

function itemTotal(item: PackingItemDetail): number {
  return sizeEntries(item).reduce((sum, entry) => sum + entry.qty, 0)
}

function boxTotal(box: PackingBoxDetail): number {
  return box.items.reduce((sum, item) => sum + itemTotal(item), 0)
}

/** 本箱涉及的尺码列（按整单码序，仅取本箱有量的码） */
function boxSizes(box: PackingBoxDetail): string[] {
  return props.detail.sizeHeaders.filter((size) => box.items.some((it) => (Number(it.sizeQuantities[size]) || 0) > 0))
}

function boxHasImage(box: PackingBoxDetail): boolean {
  return box.items.some((it) => !!it.imageUrl)
}

function boxHasName(box: PackingBoxDetail): boolean {
  return box.items.some((it) => !!it.styleName)
}

function itemSizeQty(item: PackingItemDetail, size: string): string {
  const q = Number(item.sizeQuantities[size]) || 0
  return q > 0 ? String(q) : ''
}

function boxSizeTotal(box: PackingBoxDetail, size: string): number {
  return box.items.reduce((sum, it) => sum + (Number(it.sizeQuantities[size]) || 0), 0)
}

/** 尺码列前的列数：[图片] + 款号 + [描述] + 颜色 */
function leadCols(box: PackingBoxDetail): number {
  return (boxHasImage(box) ? 1 : 0) + 1 + (boxHasName(box) ? 1 : 0) + 1
}

/** 整表总列数 = 前导列 + 各码 + 合计 */
function totalCols(box: PackingBoxDetail): number {
  return leadCols(box) + boxSizes(box).length + 1
}

// 弹窗渲染在 #app 内部，直接打印会被对话框层裁切/无法正常分页。
// 打印前把内容克隆到 body 顶层的打印根，注入横版 @page，仅当本弹窗打开时生效；打印后清理。
// 用 beforeprint/afterprint 监听，使点「打印箱贴」按钮和直接按 Ctrl+P 都生效，且与客户单(纵版)互不干扰。
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
  pageStyle.textContent = '@page { size: A4 landscape; margin: 12mm 16mm; }'
  document.head.appendChild(pageStyle)
  document.body.classList.add('printing-packing-label')
}

function onAfterPrint() {
  document.body.classList.remove('printing-packing-label')
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

<style scoped>
.label-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-sm);
}

/* 横版唛头：抬头band → 客户/箱号左右大字 → 横向尺码表 → 横向底部信息 */
.packing-label {
  position: relative;
  width: 100%;
  max-width: 1000px;
  margin: 0 auto var(--space-md);
  padding: 28px 44px;
  border: 1px dashed var(--color-border);
  background: #ffffff;
  color: #000000;
  font-family: Arial, Helvetica, sans-serif;
}

.label-select {
  position: absolute;
  top: 8px;
  right: 12px;
}

/* 整张箱贴 = 一张边框表格（全英文，给国外客户） */
.label-table {
  width: 100%;
  border-collapse: collapse;
}

.label-table th,
.label-table td {
  border: 1.5px solid #000;
  padding: 8px 10px;
  font-size: 18px;
  text-align: center;
  vertical-align: middle;
  word-break: break-word;
}

/* 标题行：左上角大圈号 + 居中品牌/PACKING LIST + 右上角 CARTON NO. */
.lt-title-cell {
  position: relative;
  height: 104px;
  padding: 10px 160px;
  background: #fafafa;
}

.label-boxno {
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  width: 86px;
  height: 86px;
  border: 5px solid #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 50px;
  font-weight: 800;
  line-height: 1;
}

.lt-title-text {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.lt-brand {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: 3px;
}

.lt-cartonno {
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  text-align: center;
  line-height: 1.1;
}

.lt-cartonno-label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 1px;
}

.lt-cartonno-val {
  display: block;
  font-size: 30px;
  font-weight: 800;
}

/* 信息行：标签（灰底）+ 值，全部居中 */
.lt-label {
  text-align: center;
  font-weight: 700;
  background: #f2f2f2;
  white-space: nowrap;
}

.lt-info .lt-info-val {
  text-align: center;
  font-weight: 700;
  font-size: 20px;
}

/* 客户行：客户名放大加粗，作视觉焦点 */
.label-table .lt-customer-val {
  text-align: center;
  font-weight: 800;
  font-size: 26px;
  letter-spacing: 1px;
}

/* 尺码矩阵 */
.lt-matrix-head th {
  font-weight: 700;
  background: #f2f2f2;
}

.label-table .lt-style,
.label-table .lt-name,
.label-table .lt-color {
  text-align: center;
  font-weight: 700;
}

.label-table .lt-total {
  font-weight: 700;
}

.label-table .lt-img {
  width: 110px;
}

.label-table .lt-img img {
  width: 88px;
  height: 88px;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}

.lt-sum td {
  font-weight: 700;
  background: #f8f8f8;
}

.lt-sum td:first-child {
  text-align: center;
}

.label-table .lt-madein {
  font-weight: 800;
  letter-spacing: 2px;
  font-size: 20px;
}

[contenteditable='true']:hover {
  outline: 1px dashed var(--color-primary, #409eff);
  outline-offset: 2px;
}
</style>

<style>
/* 打印：内容已被克隆到 body 顶层 #packing-print-root，隐藏其余 body 子节点，按正常文档流分页 */
@media print {
  body.printing-packing-label > *:not(#packing-print-root) {
    display: none !important;
  }

  #packing-print-root {
    display: block !important;
  }

  #packing-print-root .label-skip-print,
  #packing-print-root .no-print {
    display: none !important;
  }

  /* 每箱独占一页、整页上下居中 */
  #packing-print-root .packing-label {
    width: 100%;
    min-height: 180mm;
    margin: 0;
    border: none;
    display: flex;
    flex-direction: column;
    justify-content: center;
    page-break-after: always;
    break-after: page;
  }

  #packing-print-root .packing-label:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  /* 标题行加高容下大圈号；放大字号铺满版面 */
  #packing-print-root .lt-title-cell {
    height: 150px;
    padding: 10px 200px;
  }

  #packing-print-root .label-boxno {
    width: 124px;
    height: 124px;
    border-width: 7px;
    font-size: 74px;
    left: 28px;
  }

  #packing-print-root .lt-brand {
    font-size: 48px;
  }

  #packing-print-root .lt-cartonno-label {
    font-size: 16px;
  }

  #packing-print-root .lt-cartonno-val {
    font-size: 44px;
  }

  #packing-print-root .label-table th,
  #packing-print-root .label-table td {
    font-size: 25px;
    padding: 12px 14px;
  }

  #packing-print-root .label-table .lt-customer-val {
    font-size: 38px;
  }

  #packing-print-root .lt-info .lt-info-val,
  #packing-print-root .label-table .lt-madein {
    font-size: 28px;
  }

  #packing-print-root .label-table .lt-img img {
    width: 120px;
    height: 120px;
  }

  #packing-print-root .label-table .lt-img {
    width: 150px;
  }
}
</style>
