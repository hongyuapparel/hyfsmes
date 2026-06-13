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

        <div v-if="detail.showCompany" class="label-topbar">
          <span class="label-brand" contenteditable="true">HONGYU APPAREL</span>
          <span v-if="detail.serviceManager" class="label-topbar-sub" contenteditable="true">Service manager: {{ detail.serviceManager }}</span>
        </div>

        <div class="label-heading">
          <span class="label-client" contenteditable="true">{{ detail.poNo || detail.customerName }}</span>
          <span class="label-carton-no" contenteditable="true">CARTON NO# {{ box.boxSeq }} OF {{ detail.boxes.length }}</span>
        </div>

        <div class="label-body">
          <div v-for="item in box.items" :key="item.id" class="label-style-block">
            <img v-if="item.imageUrl" :src="item.imageUrl" class="label-style-image" alt="" />
            <div class="label-style-info">
              <div class="label-style-line" contenteditable="true">
                STYLE NO# {{ item.styleNo || '-' }}<template v-if="item.colorName">　·　COLOR: {{ item.colorName }}</template>
              </div>
              <table class="label-size-table">
                <thead>
                  <tr>
                    <th v-for="entry in sizeEntries(item)" :key="entry.size" contenteditable="true">{{ entry.size }}</th>
                    <th class="label-size-total">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td v-for="entry in sizeEntries(item)" :key="entry.size" contenteditable="true">{{ entry.qty }}</td>
                    <td class="label-size-total" contenteditable="true">{{ itemTotal(item) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="label-footer">
          <span contenteditable="true">TOTAL PCS: {{ boxTotal(box) }}</span>
          <span v-if="box.weightKg != null" contenteditable="true">WEIGHT: {{ box.weightKg }} KG</span>
          <span v-if="box.cartonSize" contenteditable="true">CARTON SIZE: {{ box.cartonSize }} CM</span>
          <span v-if="box.remark" contenteditable="true">SHIPPING: {{ box.remark }}</span>
          <span contenteditable="true">MADE IN CHINA</span>
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

.label-topbar {
  text-align: center;
  border-bottom: 3px solid #000;
  padding-bottom: 10px;
  margin-bottom: 20px;
}

.label-brand {
  display: block;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 2px;
}

.label-topbar-sub {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-top: 2px;
}

.label-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.label-client {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: 1px;
}

.label-carton-no {
  font-size: 26px;
  font-weight: 700;
  white-space: nowrap;
}

.label-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.label-style-block {
  display: flex;
  gap: 28px;
  align-items: center;
  justify-content: center;
}

.label-style-image {
  width: 120px;
  height: 120px;
  object-fit: contain;
}

.label-style-info {
  text-align: center;
}

.label-style-line {
  font-size: 19px;
  font-weight: 700;
  margin-bottom: 10px;
}

.label-size-table {
  border-collapse: collapse;
  margin: 0 auto;
}

.label-size-table th,
.label-size-table td {
  border: 1px solid #000;
  padding: 5px 22px;
  font-size: 17px;
  text-align: center;
  min-width: 46px;
}

.label-size-table th {
  font-weight: 700;
  background: #f2f2f2;
}

.label-size-total {
  font-weight: 700;
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
  .packing-label-print-area .label-brand {
    font-size: 30px;
  }

  .packing-label-print-area .label-client {
    font-size: 48px;
  }

  .packing-label-print-area .label-carton-no {
    font-size: 34px;
  }

  .packing-label-print-area .label-style-line {
    font-size: 26px;
  }

  .packing-label-print-area .label-size-table th,
  .packing-label-print-area .label-size-table td {
    font-size: 24px;
    padding: 8px 30px;
  }

  .packing-label-print-area .label-style-image {
    width: 150px;
    height: 150px;
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
