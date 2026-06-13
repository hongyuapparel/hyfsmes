<template>
  <AppDialog
    :model-value="visible"
    title="箱贴预览（文字可点击修改，仅影响本次打印）"
    width="860px"
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
          <span contenteditable="true">HONGYU APPAREL</span>
          <span v-if="detail.serviceManager" contenteditable="true">Service manager: {{ detail.serviceManager }}</span>
        </div>

        <div class="label-heading">
          <span class="label-client" contenteditable="true">{{ detail.poNo || detail.customerName }}</span>
          <span class="label-carton-no" contenteditable="true">CARTON NO# {{ box.boxSeq }} OF {{ detail.boxes.length }}</span>
        </div>

        <div v-for="item in box.items" :key="item.id" class="label-style-block">
          <img v-if="item.imageUrl" :src="item.imageUrl" class="label-style-image" alt="" />
          <div class="label-style-info">
            <div class="label-style-line" contenteditable="true">STYLE NO# {{ item.styleNo || '-' }}</div>
            <div v-if="item.colorName" class="label-style-line" contenteditable="true">COLOR: {{ item.colorName }}</div>
            <table class="label-size-table">
              <tbody>
                <tr v-for="entry in sizeEntries(item)" :key="entry.size">
                  <td contenteditable="true">{{ entry.size }}</td>
                  <td contenteditable="true">{{ entry.qty }} PCS</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="label-footer">
          <div contenteditable="true">TOTAL PCS: {{ boxTotal(box) }}</div>
          <div v-if="box.weightKg != null" contenteditable="true">WEIGHT: {{ box.weightKg }} KG</div>
          <div v-if="box.cartonSize" contenteditable="true">CARTON SIZE: {{ box.cartonSize }} CM</div>
          <div v-if="box.remark" contenteditable="true">SHIPPING: {{ box.remark }}</div>
          <div contenteditable="true">MADE IN CHINA</div>
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

function boxTotal(box: PackingBoxDetail): number {
  return box.items.reduce((sum, item) => sum + (item.totalQty || 0), 0)
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

.packing-label {
  position: relative;
  width: 100%;
  max-width: 720px;
  margin: 0 auto var(--space-md);
  padding: 32px 36px;
  border: 1px dashed var(--color-border);
  background: #ffffff;
  color: #000000;
  font-family: Arial, Helvetica, sans-serif;
  text-align: center;
}

.label-select {
  position: absolute;
  top: 8px;
  right: 12px;
}

.label-topbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 15px;
  font-weight: 600;
  border-bottom: 2px solid #000;
  padding-bottom: 10px;
  margin-bottom: 16px;
}

.label-heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 20px;
}

.label-client {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: 1px;
}

.label-carton-no {
  font-size: 22px;
  font-weight: 700;
}

.label-style-block {
  display: flex;
  gap: 18px;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
}

.label-style-image {
  width: 104px;
  height: 104px;
  object-fit: contain;
}

.label-style-info {
  text-align: center;
}

.label-style-line {
  font-size: 17px;
  font-weight: 600;
  margin-bottom: 4px;
}

.label-size-table {
  border-collapse: collapse;
  margin: 6px auto 0;
}

.label-size-table td {
  border: 1px solid #000;
  padding: 3px 18px;
  font-size: 15px;
  text-align: center;
}

.label-footer {
  margin-top: 18px;
  border-top: 2px solid #000;
  padding-top: 12px;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
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

  /* A4 上放大字号，唛头更醒目 */
  .packing-label-print-area .label-client {
    font-size: 40px;
  }

  .packing-label-print-area .label-carton-no {
    font-size: 28px;
  }

  .packing-label-print-area .label-style-line {
    font-size: 20px;
  }

  .packing-label-print-area .label-size-table td {
    font-size: 18px;
    padding: 4px 22px;
  }

  .packing-label-print-area .label-footer {
    font-size: 18px;
  }

  .packing-label-print-area .label-skip-print,
  .packing-label-print-area .label-select.no-print {
    display: none;
  }
}
</style>
