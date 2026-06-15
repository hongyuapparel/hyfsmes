<template>
  <el-table
    :data="flatRows"
    border
    show-summary
    sum-text="合计"
    :summary-method="summaryMethod"
    :span-method="spanMethod"
    header-align="center"
    class="editable-grid packing-grid"
  >
    <el-table-column label="箱号" width="92" align="center" header-align="center">
      <template #default="{ row }">
        <div class="box-cell">
          <span class="box-seq">{{ row.boxIndex + 1 }}</span>
          <div v-if="!disabled" class="box-ops">
            <el-tooltip content="复制本箱" placement="top">
              <el-button link type="primary" size="small" @click="emit('copy-box', row.boxIndex)">
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </el-tooltip>
            <el-tooltip content="删除本箱" placement="top">
              <el-button link type="danger" size="small" @click="emit('remove-box', row.boxIndex)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </template>
    </el-table-column>
    <el-table-column label="款号" min-width="120" align="center" header-align="center">
      <template #default="{ row }">
        <el-input v-model="row.item.styleNo" :disabled="disabled" placeholder="款号" />
      </template>
    </el-table-column>
    <el-table-column label="图片" width="70" align="center" header-align="center">
      <template #default="{ row }">
        <ImageUploadArea v-if="!disabled" v-model="row.item.imageUrl" dense />
        <AppImageThumb v-else-if="row.item.imageUrl" :raw-url="row.item.imageUrl" :width="40" :height="40" />
        <span v-else class="text-placeholder">-</span>
      </template>
    </el-table-column>
    <el-table-column label="颜色" min-width="100" align="center" header-align="center">
      <template #default="{ row }">
        <el-input v-model="row.item.colorName" :disabled="disabled" placeholder="颜色" />
      </template>
    </el-table-column>
    <el-table-column
      v-for="(size, sIndex) in sizeHeaders"
      :key="`size-col-${sIndex}`"
      min-width="84"
      align="center"
      header-align="center"
    >
      <template #header>
        <div class="size-header-cell">
          <template v-if="!disabled">
            <el-tooltip v-if="sizeHeaders.length > 1" content="删除此码列" placement="top">
              <el-button link type="danger" class="size-header-remove" :aria-label="`删除第${sIndex + 1}列`" @click.stop="emit('remove-size-at', sIndex)">
                <el-icon><CircleClose /></el-icon>
              </el-button>
            </el-tooltip>
            <el-input
              :ref="(el) => setSizeHeaderRef(el, sIndex)"
              v-model="sizeHeaders[sIndex]"
              size="small"
              placeholder="码"
              class="size-header-input"
              :input-style="{ textAlign: 'center' }"
              @focus="onSizeHeaderFocus(sIndex)"
              @change="onSizeHeaderChange(sIndex)"
              @keydown.enter.stop="blurEvent"
              @click.stop
            />
            <el-tooltip content="在此列后新增尺码列" placement="top">
              <el-button link type="primary" class="size-header-insert" :aria-label="`在第${sIndex + 1}列后新增`" @click.stop="emit('add-size-at', sIndex + 1)">
                <el-icon><Plus /></el-icon>
              </el-button>
            </el-tooltip>
          </template>
          <span v-else>{{ size }}</span>
        </div>
      </template>
      <template #default="{ row }">
        <el-input-number
          :model-value="row.item.sizeQuantities[size] ?? undefined"
          :min="0"
          :controls="false"
          :disabled="disabled"
          class="qty-input"
          placeholder=""
          @update:model-value="setSizeQty(row.item, size, $event)"
        />
      </template>
    </el-table-column>
    <el-table-column width="92" label="合计" align="center" header-align="center">
      <template #default="{ row }">
        <span v-if="hasSizeQty(row.item)">{{ formatDisplayNumber(packingItemTotal(row.item)) }}</span>
        <el-input-number
          v-else
          v-model="row.item.totalQty"
          :min="0"
          :controls="false"
          :disabled="disabled"
          class="qty-input"
          placeholder="件数"
        />
      </template>
    </el-table-column>
    <el-table-column label="重量(kg)" width="92" align="center" header-align="center">
      <template #default="{ row }">
        <el-input-number
          v-model="row.box.weightKg"
          :min="0"
          :precision="2"
          :controls="false"
          :disabled="disabled"
          class="qty-input"
          placeholder=""
        />
      </template>
    </el-table-column>
    <el-table-column label="箱规(cm)" width="110" align="center" header-align="center">
      <template #default="{ row }">
        <el-input v-model="row.box.cartonSize" :disabled="disabled" placeholder="60x40x40" />
      </template>
    </el-table-column>
    <el-table-column label="箱备注" min-width="110" align="center" header-align="center">
      <template #default="{ row }">
        <el-input v-model="row.box.remark" :disabled="disabled" placeholder="" />
      </template>
    </el-table-column>
    <el-table-column v-if="!disabled" label="操作" width="116" align="center" header-align="center" fixed="right">
      <template #default="{ row }">
        <el-tooltip content="本箱加手工行" placement="top">
          <el-button link type="primary" size="small" @click="emit('add-item', row.boxIndex)">
            <el-icon><Plus /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="选货进本箱" placement="top">
          <el-button link type="primary" size="small" @click="emit('pick-goods', row.boxIndex)">
            <el-icon><ShoppingCart /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="删除此行" placement="top">
          <el-button link type="danger" size="small" @click="emit('remove-item', row.boxIndex, row.itemIndex)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
import { CircleClose, CopyDocument, Delete, Plus, ShoppingCart } from '@element-plus/icons-vue'
import type { InputInstance, TableColumnCtx } from 'element-plus'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { formatDisplayNumber } from '@/utils/display-number'
import { packingItemTotal, type PackingFlatRow, type PackingItemDraft } from '@/composables/usePackingGridRows'

const props = withDefaults(
  defineProps<{
    flatRows: PackingFlatRow[]
    sizeHeaders: string[]
    totals: { boxCount: number; totalQty: number; totalWeight: number; bySize: Record<string, number> }
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  'add-size-at': [index: number]
  'rename-size': [index: number, oldName: string]
  'remove-size-at': [index: number]
  'copy-box': [boxIndex: number]
  'remove-box': [boxIndex: number]
  'add-item': [boxIndex: number]
  'pick-goods': [boxIndex: number]
  'remove-item': [boxIndex: number, itemIndex: number]
}>()

const sizeHeaderRefs = new Map<number, InputInstance>()
let editingOldName = ''

function setSizeHeaderRef(el: unknown, index: number): void {
  if (el) sizeHeaderRefs.set(index, el as InputInstance)
  else sizeHeaderRefs.delete(index)
}

function onSizeHeaderFocus(index: number): void {
  editingOldName = props.sizeHeaders[index] ?? ''
}

function onSizeHeaderChange(index: number): void {
  emit('rename-size', index, editingOldName)
}

function blurEvent(e: Event): void {
  ;(e.target as HTMLElement | null)?.blur()
}

async function focusSizeHeader(index: number): Promise<void> {
  await nextTick()
  sizeHeaderRefs.get(index)?.focus()
}

defineExpose({ focusSizeHeader })

function hasSizeQty(item: PackingItemDraft): boolean {
  return Object.values(item.sizeQuantities).some((n) => (Number(n) || 0) > 0)
}

function setSizeQty(item: PackingItemDraft, size: string, value: number | undefined | null): void {
  if (value == null || value <= 0) delete item.sizeQuantities[size]
  else item.sizeQuantities[size] = value
}

/** 箱级列（箱号/重量/箱规/箱备注）在箱首行 rowspan 合并 */
function spanMethod({ row, columnIndex }: { row: PackingFlatRow; column: TableColumnCtx<PackingFlatRow>; rowIndex: number; columnIndex: number }): [number, number] {
  const sizeCount = props.sizeHeaders.length
  const boxLevelColumns = new Set([0, 5 + sizeCount, 6 + sizeCount, 7 + sizeCount])
  if (!boxLevelColumns.has(columnIndex)) return [1, 1]
  return row.isFirstRow ? [row.rowspan, 1] : [0, 0]
}

function summaryMethod({ columns }: { columns: Array<TableColumnCtx<PackingFlatRow>>; data: PackingFlatRow[] }): string[] {
  const sizeCount = props.sizeHeaders.length
  return columns.map((_, index) => {
    if (index === 0) return `${props.totals.boxCount} 箱`
    if (index >= 4 && index < 4 + sizeCount) {
      const size = props.sizeHeaders[index - 4]
      const sum = props.totals.bySize[size] ?? 0
      return sum > 0 ? formatDisplayNumber(sum) : ''
    }
    if (index === 4 + sizeCount) return formatDisplayNumber(props.totals.totalQty)
    if (index === 5 + sizeCount) return props.totals.totalWeight > 0 ? `${Math.round(props.totals.totalWeight * 100) / 100}` : ''
    return ''
  })
}
</script>

<style scoped>
/* 含图片列：该表局部行高改回自适应，避免压坏图片（CLAUDE.md 既定做法） */
.packing-grid :deep(.el-table__body .el-table__cell) {
  height: auto;
  min-height: var(--editable-grid-row-h);
}

.box-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.box-seq {
  font-weight: 600;
}

.box-ops {
  display: flex;
  gap: 0;
}

.box-ops .el-button + .el-button {
  margin-left: 4px;
}

/* 列头：码名居中可编辑，左右缝隙在 hover 时浮出「×删除 / +在后插入」（复用 order 编辑列头交互） */
.size-header-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  padding: 0 10px;
}

/* 码名做成"像表头文字"的可编辑框：常态无边框，聚焦才高亮 */
.size-header-input {
  flex: 1;
  min-width: 0;
}

.size-header-input :deep(.el-input__wrapper) {
  background: transparent;
  box-shadow: none;
  padding: 0 2px;
}

.size-header-input :deep(.el-input__inner) {
  text-align: center;
  font-weight: 700;
  color: var(--color-text-primary);
}

.size-header-input :deep(.el-input__wrapper.is-focus) {
  background: var(--color-card);
  box-shadow: 0 0 0 1px var(--color-primary) inset;
}

.size-header-insert,
.size-header-remove {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 12px;
  min-width: 12px;
  height: 16px;
  min-height: 16px;
  padding: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.size-header-remove {
  left: 0;
}

.size-header-insert {
  right: 0;
}

.size-header-insert :deep(.el-icon),
.size-header-remove :deep(.el-icon) {
  font-size: 11px;
}

.size-header-cell:hover .size-header-insert,
.size-header-cell:hover .size-header-remove {
  opacity: 0.7;
}

.qty-input {
  width: 100%;
}
</style>
