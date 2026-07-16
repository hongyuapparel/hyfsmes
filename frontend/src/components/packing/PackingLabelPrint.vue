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

        <div class="label-body">
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
              <td :colspan="totalCols(box) - 2" class="lt-customer-val" contenteditable="true">
                {{ detail.poNo || detail.customerName }}
                <span v-if="addressLine" class="lt-addr">{{ addressLine }}</span>
              </td>
            </tr>

            <tr class="lt-matrix-head">
              <th v-if="boxHasImage(box)" class="lt-img">PHOTO</th>
              <th class="lt-style">STYLE NO</th>
              <th class="lt-color">COLOUR</th>
              <th v-for="size in boxSizes(box)" :key="`h-${size}`">{{ size }}</th>
              <th class="lt-total">TOTAL</th>
            </tr>
            <tr v-for="item in box.items" :key="item.id">
              <td v-if="boxHasImage(box)" class="lt-img">
                <img v-if="item.imageUrl" :src="item.imageUrl" alt="" />
              </td>
              <td class="lt-style" contenteditable="true">{{ item.styleNo || '-' }}</td>
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
            <tr v-if="orderRemark" class="lt-info">
              <td class="lt-label" colspan="2">REMARK</td>
              <td :colspan="totalCols(box) - 2" class="lt-info-val" contenteditable="true">{{ orderRemark }}</td>
            </tr>
            <tr>
              <td :colspan="totalCols(box)" class="lt-madein" contenteditable="true">MADE IN CHINA</td>
            </tr>
            <tr v-if="detail.serviceManager">
              <td :colspan="totalCols(box)" class="lt-svc-sm" contenteditable="true">Service Manager: {{ detail.serviceManager }}</td>
            </tr>
          </tbody>
          </table>
        </div>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import AppDialog from '@/components/AppDialog.vue'
import type { PackingBoxDetail, PackingItemDetail, PackingListDetail } from '@/api/packing-lists'

const props = defineProps<{
  visible: boolean
  detail: PackingListDetail
}>()

/** 收货地址行：邮编 + 国家（国名大写，便于卡车/报关扫读），跟客户名组成地址块 */
const addressLine = computed(() => {
  const zip = (props.detail.postalCode || '').trim()
  const country = (props.detail.country || '').trim().toUpperCase()
  return [zip, country].filter(Boolean).join(' ')
})

const orderRemark = computed(() => props.detail.remark.trim())

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

function itemSizeQty(item: PackingItemDetail, size: string): string {
  const q = Number(item.sizeQuantities[size]) || 0
  return q > 0 ? String(q) : ''
}

function boxSizeTotal(box: PackingBoxDetail, size: string): number {
  return box.items.reduce((sum, it) => sum + (Number(it.sizeQuantities[size]) || 0), 0)
}

/** 尺码列前的列数：[图片] + 款号 + 颜色 */
function leadCols(box: PackingBoxDetail): number {
  return (boxHasImage(box) ? 1 : 0) + 1 + 1
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

// @page margin:0（去浏览器页眉页脚），边距改由 .packing-label 自身 padding(10mm 14mm) 补回。
// 所以打印根用整页宽 297mm，扣掉左右 padding 后内容宽仍是 269mm；内容高目标 180mm 不变。
const PRINT_CONTENT_WIDTH = '297mm'
const PAGE_FIT_PX = (180 * 96) / 25.4

// 保证「一箱 = 一页」：克隆已是打印尺寸，量出每箱实际内容高，超过一页就按比例 zoom 整体缩小塞进一页。
function fitLabelsToPage(root: HTMLElement) {
  root.style.width = PRINT_CONTENT_WIDTH
  root.querySelectorAll<HTMLElement>('.packing-label').forEach((label) => {
    const body = label.querySelector<HTMLElement>('.label-body')
    if (!body) return
    body.style.setProperty('zoom', '1')
    const height = body.getBoundingClientRect().height
    body.style.setProperty('zoom', height > PAGE_FIT_PX ? String(PAGE_FIT_PX / height) : '1')
  })
}

function cleanupPrintArtifacts() {
  document.body.classList.remove('printing-packing-label')
  printRoot?.remove()
  printRoot = null
  pageStyle?.remove()
  pageStyle = null
  // 清掉历次打印残留（afterprint 偶发未触发、或多 keep-alive 实例叠根时会把前面打开过的装箱单一起打出来）
  document.querySelectorAll('#packing-print-root').forEach((el) => el.remove())
}

/** keep-alive 缓存的编辑页仍挂着 beforeprint；只有当前激活页才允许建打印根 */
let pageActive = true

function onBeforePrint() {
  if (!pageActive || !props.visible || !printAreaRef.value) return
  cleanupPrintArtifacts()
  printRoot = document.createElement('div')
  printRoot.id = 'packing-print-root'
  printRoot.appendChild(printAreaRef.value.cloneNode(true))
  document.body.appendChild(printRoot)
  pageStyle = document.createElement('style')
  pageStyle.textContent = '@page { size: A4 landscape; margin: 0; }'
  document.head.appendChild(pageStyle)
  document.body.classList.add('printing-packing-label')
  fitLabelsToPage(printRoot)
}

function onAfterPrint() {
  cleanupPrintArtifacts()
}

onMounted(() => {
  window.addEventListener('beforeprint', onBeforePrint)
  window.addEventListener('afterprint', onAfterPrint)
})

onActivated(() => {
  pageActive = true
})

onDeactivated(() => {
  pageActive = false
  cleanupPrintArtifacts()
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

<style scoped src="./PackingLabelPrint.css"></style>
<style src="./PackingLabelPrint.print.css"></style>
