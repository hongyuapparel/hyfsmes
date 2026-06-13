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

        <div class="label-header-row">
          <div class="label-boxno">{{ box.boxSeq }}</div>
          <div class="label-header-main">
            <div v-if="detail.showCompany" class="label-topbar">
              <span class="label-brand" contenteditable="true">HONGYU APPAREL</span>
              <span v-if="detail.serviceManager" class="label-topbar-sub" contenteditable="true">Service manager: {{ detail.serviceManager }}</span>
            </div>
            <div class="label-heading">
              <span class="label-client" contenteditable="true">{{ detail.poNo || detail.customerName }}</span>
              <span class="label-carton-no" contenteditable="true">CARTON NO# {{ box.boxSeq }} OF {{ detail.boxes.length }}</span>
            </div>
          </div>
        </div>

        <table class="label-table">
          <thead>
            <tr>
              <th v-if="boxHasImage(box)" class="lt-img">图片<span class="lt-en">Photo</span></th>
              <th class="lt-style">款号<span class="lt-en">Style No.</span></th>
              <th class="lt-color">颜色<span class="lt-en">Color</span></th>
              <th v-for="size in boxSizes(box)" :key="`h-${size}`">{{ size }}</th>
              <th class="lt-total">合计<span class="lt-en">Total</span></th>
            </tr>
          </thead>
          <tbody>
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
              <td :colspan="leadColspan(box)">合计 TOTAL</td>
              <td v-for="size in boxSizes(box)" :key="`s-${size}`">{{ boxSizeTotal(box, size) }}</td>
              <td class="lt-total">{{ boxTotal(box) }}</td>
            </tr>
          </tbody>
        </table>

        <div class="label-footer">
          <span contenteditable="true">WEIGHT 重量: {{ box.weightKg != null ? box.weightKg : '' }} KG</span>
          <span contenteditable="true">CARTON SIZE 箱规: {{ box.cartonSize || '' }} CM</span>
          <span v-if="box.remark" contenteditable="true">SHIPPING: {{ box.remark }}</span>
          <span class="label-madein" contenteditable="true">MADE IN CHINA</span>
        </div>
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

function itemSizeQty(item: PackingItemDetail, size: string): string {
  const q = Number(item.sizeQuantities[size]) || 0
  return q > 0 ? String(q) : ''
}

function boxSizeTotal(box: PackingBoxDetail, size: string): number {
  return box.items.reduce((sum, it) => sum + (Number(it.sizeQuantities[size]) || 0), 0)
}

/** 合计行前导列跨度：[图片] + 款号 + 颜色 */
function leadColspan(box: PackingBoxDetail): number {
  return (boxHasImage(box) ? 1 : 0) + 2
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

/* 顶部：左上角大号圈圈箱号 + 右侧公司/客户/CARTON NO */
.label-header-row {
  display: flex;
  align-items: center;
  gap: 22px;
  border-bottom: 3px solid #000;
  padding-bottom: 14px;
  margin-bottom: 18px;
}

.label-boxno {
  flex: 0 0 auto;
  width: 92px;
  height: 92px;
  border: 5px solid #000;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 54px;
  font-weight: 800;
  line-height: 1;
}

.label-header-main {
  flex: 1;
  min-width: 0;
}

.label-topbar {
  text-align: center;
  margin-bottom: 8px;
}

.label-brand {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 2px;
}

.label-topbar-sub {
  margin-left: 12px;
  font-size: 13px;
  font-weight: 600;
}

.label-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 24px;
}

.label-client {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 1px;
}

.label-carton-no {
  font-size: 24px;
  font-weight: 700;
  white-space: nowrap;
}

/* 内容统一表格：图片 / 款号 / 颜色 / 各码 / 合计 */
.label-table {
  width: 100%;
  border-collapse: collapse;
}

.label-table th,
.label-table td {
  border: 1px solid #000;
  padding: 8px 10px;
  font-size: 18px;
  text-align: center;
  vertical-align: middle;
}

.label-table thead th {
  font-weight: 700;
  background: #f2f2f2;
  line-height: 1.2;
}

.label-table .lt-en {
  display: block;
  font-size: 12px;
  font-weight: 500;
}

.label-table .lt-style,
.label-table .lt-color {
  text-align: left;
  font-weight: 700;
}

.label-table .lt-total {
  font-weight: 700;
}

.label-table .lt-img {
  width: 96px;
}

.label-table .lt-img img {
  width: 80px;
  height: 80px;
  object-fit: contain;
  display: block;
  margin: 0 auto;
}

.label-table .lt-sum td {
  font-weight: 700;
  background: #f8f8f8;
}

.label-table .lt-sum td:first-child {
  text-align: right;
}

.label-footer {
  margin-top: 24px;
  border-top: 3px solid #000;
  padding-top: 14px;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px 36px;
  font-size: 18px;
  font-weight: 700;
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
    width: 130px;
    height: 130px;
    border-width: 7px;
    font-size: 80px;
  }

  .packing-label-print-area .label-brand {
    font-size: 30px;
  }

  .packing-label-print-area .label-client {
    font-size: 46px;
  }

  .packing-label-print-area .label-carton-no {
    font-size: 32px;
  }

  .packing-label-print-area .label-table th,
  .packing-label-print-area .label-table td {
    font-size: 24px;
    padding: 12px 14px;
  }

  .packing-label-print-area .label-table .lt-en {
    font-size: 15px;
  }

  .packing-label-print-area .label-table .lt-img img {
    width: 120px;
    height: 120px;
  }

  .packing-label-print-area .label-table .lt-img {
    width: 140px;
  }

  .packing-label-print-area .label-footer {
    font-size: 23px;
  }

  .packing-label-print-area .label-skip-print,
  .packing-label-print-area .label-select.no-print {
    display: none;
  }
}
</style>
