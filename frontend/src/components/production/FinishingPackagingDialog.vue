<template>
  <AppDialog
    v-model="visible"
    :title="dialog.mode === 'amend' ? '修改入库/次品' : '登记入库'"
    width="1000"
    destroy-on-close
    @close="emit('close')"
  >
    <p v-if="dialog.mode === 'register'" class="dialog-tip">
      可分多次登记。「部分入库」保留在「尾部中」等待下一批；「全部入库」补齐剩余并推进到「尾部完成」。
    </p>
    <p v-else class="dialog-tip">
      在仓库尚未对「待仓处理」记录完成入库或发货前，可修正入库数与次品数；保存后将按新数量重建待仓记录。
    </p>
    <div v-if="dialog.formLoading" class="register-loading">加载尺寸细数...</div>
    <template v-else>
      <div
        v-for="item in dialog.items"
        :key="item.row.orderId"
        class="packaging-block"
      >
        <div class="register-brief register-brief-inline">
          <span><span class="brief-label">订单号</span>{{ item.row.orderNo }}</span>
          <span class="brief-sep">·</span>
          <span><span class="brief-label">SKU</span>{{ item.row.skuCode }}</span>
          <span class="brief-sep">·</span>
          <span><span class="brief-label">尾部收货</span>{{ formatDisplayNumber(item.row.tailReceivedQty ?? 0) }}</span>
          <template v-if="dialog.mode === 'register'">
            <template v-if="alreadyInboundQty(item) > 0">
              <span class="brief-sep">·</span>
              <span><span class="brief-label">已登记入库</span>{{ formatDisplayNumber(alreadyInboundQty(item)) }}</span>
              <el-tag size="small" type="warning">分批续登</el-tag>
            </template>
            <span class="brief-sep">·</span>
            <span><span class="brief-label">剩余可登记</span>{{ formatDisplayNumber(remainingQty(item)) }}</span>
          </template>
        </div>

        <template v-if="item.sizeHeaders?.length">
          <div class="register-qty-toolbar">
            <p class="register-qty-tip">按颜色分别填写本次入库与本次次品；每格不可超过该颜色"尾部收货 − 已入库 − 已次品"剩余。</p>
            <div class="register-qty-actions">
              <el-button v-if="dialog.mode === 'register'" size="small" link @click="packagingSetInboundToReceived(item)">
                按剩余可登记全部填入
              </el-button>
              <el-button size="small" link @click="packagingSetZero(item)">清零</el-button>
            </div>
          </div>
          <div
            v-for="(plan, ri) in item.tailReceivedColorRows"
            :key="plan.colorName + ri"
            class="color-register-block"
          >
            <div class="color-register-title">
              <AppImageThumb
                v-if="item.planColorRows[ri]?.imageUrl"
                :raw-url="item.planColorRows[ri].imageUrl"
                variant="compact"
              />
              <span>{{ plan.colorName }}</span>
            </div>
            <el-table
              :data="rowsForColor(item, ri)"
              border
              size="small"
              class="editable-grid color-register-table"
              style="width: 100%"
              :row-class-name="rowClassName"
            >
              <el-table-column label="" width="90" align="right">
                <template #default="{ row }">
                  <span :class="{ 'cell-input-label': row.kind === 'input' }">{{ row.label }}</span>
                </template>
              </el-table-column>
              <el-table-column
                v-for="(h, ci) in item.sizeHeaders"
                :key="ci"
                :label="h"
                min-width="72"
                align="center"
              >
                <template #default="{ row }">
                  <template v-if="row.kind === 'readonly'">
                    {{ formatDisplayNumber(row.values[ci] ?? 0) }}
                  </template>
                  <span
                    v-else-if="row.field === 'inbound'"
                    :data-cell-r="0"
                    :data-cell-c="ci"
                    class="cell-input"
                  >
                    <el-input-number
                      v-model="item.inboundQuantitiesByColor[ri].quantities[ci]"
                      :min="0"
                      :max="inboundCellMax(item, ri, ci)"
                      :precision="0"
                      :controls="false"
                      size="small"
                      style="width: 100%"
                      @keydown="onMatrixCellKeydown"
                      @focus="selectAllOnFocus"
                    />
                  </span>
                  <span v-else :data-cell-r="1" :data-cell-c="ci" class="cell-input">
                    <el-input-number
                      v-model="item.defectQuantitiesByColor[ri].quantities[ci]"
                      :min="0"
                      :max="defectCellMax(item, ri, ci)"
                      :precision="0"
                      :controls="false"
                      size="small"
                      style="width: 100%"
                      @keydown="onMatrixCellKeydown"
                      @focus="selectAllOnFocus"
                    />
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="合计" width="68" align="right">
                <template #default="{ row }">
                  <strong v-if="row.kind === 'input' && row.field === 'inbound'">{{ formatDisplayNumber(sumInputInbound(item, ri)) }}</strong>
                  <strong v-else-if="row.kind === 'input'">{{ formatDisplayNumber(sumInputDefect(item, ri)) }}</strong>
                  <span v-else>{{ formatDisplayNumber(sumReadonly(row.values)) }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <p class="register-qty-grand">
            本次入库总合计：<strong>{{ formatDisplayNumber(inboundTotal(item)) }}</strong>
            ｜ 本次次品总合计：<strong>{{ formatDisplayNumber(defectTotal(item)) }}</strong>
          </p>

          <div class="packaging-extra">
            <el-form-item label="备注" class="packaging-form-item">
              <el-input
                v-model="item.remark"
                placeholder="选填"
                size="small"
                maxlength="200"
                clearable
                style="width: 320px"
              />
            </el-form-item>
          </div>
        </template>
      </div>
    </template>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <template v-if="dialog.mode === 'amend'">
        <el-button type="primary" :loading="dialog.submitting" @click="emit('submit', 'full')">
          保存修改
        </el-button>
      </template>
      <template v-else>
        <el-button :loading="dialog.submitting" @click="emit('submit', 'partial')">部分入库</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="emit('submit', 'full')">全部入库</el-button>
      </template>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { formatDisplayNumber } from '@/utils/display-number'
import { onMatrixCellKeydown, selectAllOnFocus } from '@/utils/matrix-cell-nav'
import type { PackagingCompleteItem } from '@/composables/useFinishingPackaging'

interface PackagingSizeTableRow {
  key: string
  label: string
  values: (number | null | string)[]
}

interface PackagingDialogState {
  visible: boolean
  submitting: boolean
  formLoading: boolean
  mode: 'register' | 'amend'
  items: PackagingCompleteItem[]
}

const props = defineProps<{
  modelValue: boolean
  dialog: PackagingDialogState
  packagingSizeTableRows: (item: PackagingCompleteItem) => PackagingSizeTableRow[]
  defectTotal: (item: PackagingCompleteItem) => number
  inboundTotal: (item: PackagingCompleteItem) => number
  alreadyInboundQty: (item: PackagingCompleteItem) => number
  remainingQty: (item: PackagingCompleteItem) => number
  inboundCellMax: (item: PackagingCompleteItem, ri: number, ci: number) => number | undefined
  defectCellMax: (item: PackagingCompleteItem, ri: number, ci: number) => number | undefined
  packagingSetInboundToReceived: (item: PackagingCompleteItem) => void
  packagingSetZero: (item: PackagingCompleteItem) => void
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: [mode: 'partial' | 'full']
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))

type BlockRow =
  | { kind: 'readonly'; label: string; values: number[] }
  | { kind: 'input'; field: 'inbound' | 'defect'; label: string }

function hasNonZero(values: number[] | undefined | null): boolean {
  if (!Array.isArray(values)) return false
  return values.some((n) => Number(n) > 0)
}

function rowsForColor(item: PackagingCompleteItem, ri: number): BlockRow[] {
  const plan = item.planColorRows[ri]?.quantities ?? []
  const cut = item.cutColorRows[ri]?.quantities ?? []
  const sew = item.sewingColorRows[ri]?.quantities ?? []
  const received = item.tailReceivedColorRows[ri]?.quantities ?? []
  const alreadyIn = item.alreadyInboundColorRows[ri]?.quantities ?? []
  const alreadyDef = item.alreadyDefectColorRows[ri]?.quantities ?? []
  const rows: BlockRow[] = []
  // 上游生产链对照（按"该色有数据才显示"，避免老订单缺真值时全 0 占行）
  if (hasNonZero(plan)) rows.push({ kind: 'readonly', label: '订单数量', values: plan })
  if (hasNonZero(cut)) rows.push({ kind: 'readonly', label: '裁床数量', values: cut })
  if (hasNonZero(sew)) rows.push({ kind: 'readonly', label: '车缝数量', values: sew })
  // 尾部收货：即便全 0 也展示（老订单 byColor 缺真值时也要让仓管看到收货 = 0/未登记）
  rows.push({ kind: 'readonly', label: '尾部收货', values: received })
  if (hasNonZero(alreadyIn)) rows.push({ kind: 'readonly', label: '已累计入库', values: alreadyIn })
  if (hasNonZero(alreadyDef)) rows.push({ kind: 'readonly', label: '已累计次品', values: alreadyDef })
  rows.push({ kind: 'input', field: 'inbound', label: '本次入库' })
  rows.push({ kind: 'input', field: 'defect', label: '本次次品' })
  return rows
}

function sumReadonly(values: number[]): number {
  return (values ?? []).reduce((s, n) => s + (Number(n) || 0), 0)
}

function sumInputInbound(item: PackagingCompleteItem, ri: number): number {
  return (item.inboundQuantitiesByColor[ri]?.quantities ?? []).reduce((s, n) => s + (Number(n) || 0), 0)
}

function sumInputDefect(item: PackagingCompleteItem, ri: number): number {
  return (item.defectQuantitiesByColor[ri]?.quantities ?? []).reduce((s, n) => s + (Number(n) || 0), 0)
}

function rowClassName({ row }: { row: BlockRow }): string {
  return row.kind === 'input' ? 'register-input-row' : ''
}
</script>

<style scoped>
.dialog-tip {
  margin: 0 0 var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.register-brief {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  font-size: var(--font-size-caption, 12px);
}

.register-brief > div + div {
  margin-top: 4px;
}

.register-brief-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  margin-bottom: 8px;
}

.register-brief-inline .brief-label {
  color: var(--el-text-color-secondary);
  margin-right: 4px;
}

.register-brief-inline .brief-sep {
  color: var(--el-text-color-placeholder);
}

.register-loading {
  padding: var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.register-qty-tip {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.register-qty-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 8px;
  gap: 12px;
}

.register-qty-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.color-register-block {
  margin-bottom: 14px;
}

.color-register-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 6px;
  color: var(--el-text-color-primary);
}

.color-register-block:last-child {
  margin-bottom: 0;
}

.cell-input-label {
  font-weight: 600;
  color: var(--el-color-primary);
}

:deep(.register-input-row > td.el-table__cell) {
  background-color: var(--el-color-primary-light-9);
}

.register-qty-grand {
  margin: 12px 0 0;
  text-align: right;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.register-qty-grand strong {
  color: var(--el-text-color-primary);
  font-size: 14px;
}

.packaging-block {
  margin-bottom: var(--space-md);
}

.packaging-block:last-child {
  margin-bottom: 0;
}

.packaging-extra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
  margin-top: 8px;
}

.packaging-extra .packaging-form-item {
  margin-bottom: 0;
}
</style>
