<template>
  <div class="cutting-mat-usage">
    <el-empty
      v-if="!modelValue.length"
      :description="readonly ? '未登记物料用量明细' : '当前订单 C 区无主布/里布/配布/衬布物料'"
      :image-size="64"
    />
    <el-table
      v-else
      :data="modelValue"
      border
      size="small"
      class="cutting-mat-usage__table"
      :max-height="tableMaxHeight"
      table-layout="fixed"
    >
      <el-table-column prop="categoryLabel" label="物料类别" width="72" fixed />
      <el-table-column prop="materialName" label="物料名称" min-width="100" show-overflow-tooltip />
      <el-table-column prop="colorSpec" label="颜色/规格" min-width="100" show-overflow-tooltip />
      <el-table-column label="预计单件用量" width="118" align="right">
        <template #default="{ row, $index }">
          <template v-if="readonly">
            <span class="cutting-mat-usage__readonly">{{ fmtExpected(row.expectedUsagePerPiece) }}</span>
          </template>
          <el-input-number
            v-else
            :model-value="row.expectedUsagePerPiece ?? undefined"
            :min="0"
            :precision="2"
            :controls="false"
            size="small"
            class="cutting-mat-usage__num"
            placeholder="米/件"
            @update:model-value="
              (v) =>
                patchRow($index, {
                  expectedUsagePerPiece: v == null ? null : roundMoney2(Number(v)),
                })
            "
          />
        </template>
      </el-table-column>
      <el-table-column label="本次领用(米)" width="112" align="right">
        <template #default="{ row, $index }">
          <span v-if="readonly" class="cutting-mat-usage__readonly">{{ formatDisplayNumber(row.issuedMeters) }}</span>
          <el-input-number
            v-else
            :model-value="row.issuedMeters"
            :min="0"
            :precision="2"
            :controls="false"
            size="small"
            class="cutting-mat-usage__num"
            @update:model-value="(v) => patchRow($index, { issuedMeters: roundMeters2(v) })"
          />
        </template>
      </el-table-column>
      <el-table-column label="退回(米)" width="100" align="right">
        <template #default="{ row, $index }">
          <span v-if="readonly" class="cutting-mat-usage__readonly">{{ formatDisplayNumber(row.returnedMeters) }}</span>
          <el-input-number
            v-else
            :model-value="row.returnedMeters"
            :min="0"
            :precision="2"
            :controls="false"
            size="small"
            class="cutting-mat-usage__num"
            @update:model-value="(v) => patchRow($index, { returnedMeters: roundMeters2(v) })"
          />
        </template>
      </el-table-column>
      <el-table-column label="异常损耗(米)" width="112" align="right">
        <template #default="{ row, $index }">
          <span v-if="readonly" class="cutting-mat-usage__readonly">{{
            formatDisplayNumber(row.abnormalLossMeters)
          }}</span>
          <el-input-number
            v-else
            :model-value="row.abnormalLossMeters"
            :min="0"
            :precision="2"
            :controls="false"
            size="small"
            class="cutting-mat-usage__num"
            @update:model-value="(v) => patchRow($index, { abnormalLossMeters: roundMeters2(v) })"
          />
        </template>
      </el-table-column>
      <el-table-column label="异常原因" width="130">
        <template #default="{ row, $index }">
          <span v-if="readonly" class="cutting-mat-usage__readonly">{{ row.abnormalReason || '—' }}</span>
          <el-select
            v-else
            :model-value="row.abnormalReason"
            placeholder="选择"
            clearable
            filterable
            size="small"
            class="cutting-mat-usage__select"
            @update:model-value="(v) => patchRow($index, { abnormalReason: v || null })"
          >
            <el-option v-for="opt in CUTTING_ABNORMAL_REASONS" :key="opt" :label="opt" :value="opt" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="实际净耗(米)" width="108" align="right">
        <template #default="{ row }">
          <span class="cutting-mat-usage__readonly">{{ formatDisplayNumber(netMeters(row)) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="单件实际用量" width="112" align="right">
        <template #default="{ row }">
          <span class="cutting-mat-usage__readonly">{{
            formatDisplayNumber(perPieceActual(row), { emptyDisplay: '—' })
          }}</span>
        </template>
      </el-table-column>
      <el-table-column label="标准单件用量" width="112" align="right">
        <template #default="{ row }">
          <span class="cutting-mat-usage__readonly">{{
            formatDisplayNumber(standardPerPiece(row), { emptyDisplay: '—' })
          }}</span>
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="96">
        <template #default="{ row, $index }">
          <span v-if="readonly" class="cutting-mat-usage__readonly">{{ (row.remark || '').trim() || '—' }}</span>
          <el-input
            v-else
            :model-value="row.remark"
            size="small"
            placeholder="备注"
            clearable
            @update:model-value="(v) => patchRow($index, { remark: v ?? '' })"
          />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import type { CuttingMaterialUsagePayloadRow } from '@/api/production-cutting'
import { CUTTING_ABNORMAL_REASONS } from '@/constants/cutting-register'
import { formatDisplayNumber } from '@/utils/display-number'

const props = withDefaults(
  defineProps<{
    modelValue: CuttingMaterialUsagePayloadRow[]
    /** 实际裁剪数量合计，作除数 */
    grandPieces: number
    tableMaxHeight?: number
    /** 只读：用于裁床完成后的详情抽屉 */
    readonly?: boolean
  }>(),
  { tableMaxHeight: 320, readonly: false },
)

const emit = defineEmits<{
  'update:modelValue': [v: CuttingMaterialUsagePayloadRow[]]
}>()

function fmtExpected(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return formatDisplayNumber(v)
}

function numOrZero(v: number | undefined | null) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function roundMeters2(v: number | undefined | null) {
  const n = numOrZero(v)
  return Math.round(n * 100) / 100
}

function roundMoney2(v: number) {
  if (!Number.isFinite(v) || v < 0) return 0
  return Math.round(v * 100) / 100
}

function patchRow(index: number, patch: Partial<CuttingMaterialUsagePayloadRow>) {
  if (props.readonly) return
  const next = props.modelValue.map((r, j) => (j === index ? { ...r, ...patch } : r))
  emit('update:modelValue', next)
}

function netMeters(r: CuttingMaterialUsagePayloadRow): number {
  const a = numOrZero(r.issuedMeters)
  const b = numOrZero(r.returnedMeters)
  return Math.max(0, a - b)
}

function perPieceActual(r: CuttingMaterialUsagePayloadRow): number | null {
  const g = props.grandPieces
  if (!Number.isFinite(g) || g <= 0) return null
  return netMeters(r) / g
}

function standardPerPiece(r: CuttingMaterialUsagePayloadRow): number | null {
  const g = props.grandPieces
  if (!Number.isFinite(g) || g <= 0) return null
  const net = netMeters(r)
  const loss = numOrZero(r.abnormalLossMeters)
  return (net - loss) / g
}
</script>

<style scoped>
.cutting-mat-usage__table {
  width: 100%;
}

.cutting-mat-usage__num {
  width: 100%;
  max-width: 104px;
}

.cutting-mat-usage__select {
  width: 100%;
}

.cutting-mat-usage__readonly {
  font-variant-numeric: tabular-nums;
  color: var(--el-text-color-regular);
}
</style>
