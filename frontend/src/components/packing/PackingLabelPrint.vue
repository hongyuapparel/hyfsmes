<template>
  <AppDialog
    :model-value="visible"
    title="箱贴预览（A4 横版，每箱一张；文字可点击修改，仅影响本次打印）"
    width="1060px"
    top="4vh"
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

    <div class="packing-label-print-area">
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
                  <span v-if="detail.showCompany" class="lt-brand" contenteditable="true">HONGYU APPAREL</span>
                  <span class="lt-title" contenteditable="true">PACKING LIST</span>
                </div>
              </td>
            </tr>
            <tr class="lt-info">
              <td class="lt-label" colspan="2" contenteditable="true">CUSTOMER:</td>
              <td :colspan="totalCols(box) - 2" class="lt-info-val" contenteditable="true">{{ detail.poNo || detail.customerName }}</td>
            </tr>
            <tr v-if="detail.serviceManager" class="lt-info">
              <td class="lt-label" colspan="2" contenteditable="true">SHIP MARK:</td>
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
              <td class="lt-label" colspan="2" contenteditable="true">CARTON NO#:</td>
              <td :colspan="totalCols(box) - 2" class="lt-info-val" contenteditable="true">{{ box.boxSeq }} OF {{ detail.boxes.length }}</td>
            </tr>
            <tr class="lt-info">
              <td class="lt-label" colspan="2" contenteditable="true">WEIGHT(KG):</td>
              <td :colspan="totalCols(box) - 2" class="lt-info-val" contenteditable="true">{{ box.weightKg != null ? box.weightKg : '' }}</td>
            </tr>
            <tr class="lt-info">
              <td class="lt-label" colspan="2" contenteditable="true">DIMENSION(CM):</td>
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
import { ref, watch } from 'vue'
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

/* 标题行：左上角大圈号 + 居中 PACKING LIST */
.lt-title-cell {
  position: relative;
  padding: 14px 10px;
}

.label-boxno {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 84px;
  height: 84px;
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
  gap: 2px;
}

.lt-brand {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 2px;
}

.lt-title {
  font-size: 30px;
  font-weight: 800;
  letter-spacing: 3px;
}

/* 客户/箱号/重量/箱规信息行：左标签 + 值 */
.lt-info .lt-label {
  text-align: left;
  font-weight: 700;
  background: #f2f2f2;
  white-space: nowrap;
}

.lt-info .lt-info-val {
  text-align: center;
  font-weight: 700;
  font-size: 20px;
}

/* 尺码矩阵 */
.lt-matrix-head th {
  font-weight: 700;
  background: #f2f2f2;
}

.label-table .lt-style,
.label-table .lt-name,
.label-table .lt-color {
  text-align: left;
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
  text-align: right;
}

.lt-madein {
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
/* 打印：只显示箱贴区域，每箱一页，内容在 A4 可打印区内居中（@page 控制页边距） */
@media print {
  @page {
    size: A4 landscape;
    margin: 12mm 16mm;
  }

  body * {
    visibility: hidden;
  }

  .packing-label-print-area,
  .packing-label-print-area * {
    visibility: visible;
  }

  .packing-label-print-area {
    position: absolute;
    inset: 0;
  }

  /* 每箱一张，A4 横版整页内上下居中 */
  .packing-label-print-area .packing-label {
    max-width: none;
    width: 100%;
    min-height: 175mm;
    margin: 0;
    border: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    page-break-after: always;
  }

  .packing-label-print-area .packing-label:last-child {
    page-break-after: auto;
  }

  /* A4 横版放大字号，唛头更醒目、铺满版面 */
  .packing-label-print-area .label-boxno {
    width: 120px;
    height: 120px;
    border-width: 7px;
    font-size: 74px;
    left: 24px;
  }

  .packing-label-print-area .lt-brand {
    font-size: 22px;
  }

  .packing-label-print-area .lt-title {
    font-size: 44px;
  }

  .packing-label-print-area .label-table th,
  .packing-label-print-area .label-table td {
    font-size: 25px;
    padding: 12px 14px;
  }

  .packing-label-print-area .lt-info .lt-info-val,
  .packing-label-print-area .lt-madein {
    font-size: 28px;
  }

  .packing-label-print-area .label-table .lt-img img {
    width: 120px;
    height: 120px;
  }

  .packing-label-print-area .label-table .lt-img {
    width: 150px;
  }

  .packing-label-print-area .label-skip-print,
  .packing-label-print-area .label-select.no-print {
    display: none;
  }
}
</style>
