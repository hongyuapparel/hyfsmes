<template>
  <el-card :ref="bTableRef" class="block-card">
    <template #header>
      <div class="block-header">
        <span class="block-title">B 颜色 / 数量</span>
        <div class="block-actions">
          <el-button link type="primary" @click="addSizeColumn">新增尺码列</el-button>
          <el-button link type="primary" @click="addColorRow">新增颜色</el-button>
        </div>
      </div>
    </template>
    <el-table
      :data="colorRows"
      border
      show-summary
      sum-text="合计"
      :summary-method="bSummaryMethod"
      header-align="center"
    >
      <el-table-column label="颜色名称" min-width="120" align="center" header-align="center">
        <template #default="{ row, $index }">
          <div
            v-if="editingCell?.rowIndex === $index && editingCell?.col === 'color'"
            class="b-cell-edit"
            @blur="onBCellBlur"
          >
            <el-input
              :ref="colorNameInputRef"
              v-model="row.colorName"
              placeholder="颜色名称"
              size="small"
              borderless
              @keydown.enter="setEditingCellNull"
            />
          </div>
          <div
            v-else
            class="b-cell-text"
            tabindex="0"
            @click="startEditBCell($index, 'color')"
            @focus="startEditBCell($index, 'color')"
          >
            {{ row.colorName || '—' }}
          </div>
        </template>
      </el-table-column>
      <el-table-column
        v-for="(size, sIndex) in sizeHeaders"
        :key="'size-' + sIndex"
        :label="size"
        min-width="90"
        align="center"
        header-align="center"
      >
        <template #header>
          <div class="b-header-cell">
            <el-tooltip content="在当前列前新增尺码列" placement="top">
              <el-button
                link
                type="primary"
                size="small"
                class="b-header-insert"
                @click.stop="insertSizeColumnBefore(sIndex)"
              >
                <el-icon><Plus /></el-icon>
              </el-button>
            </el-tooltip>
            <el-input
              v-model="sizeHeaders[sIndex]"
              size="small"
              class="b-header-input"
              :input-style="{ textAlign: 'center' }"
              @click.stop
            />
            <el-tooltip v-if="sizeHeaders.length > 1" content="删除此列" placement="top">
              <el-button
                link
                type="danger"
                size="small"
                class="b-header-remove"
                @click.stop="removeSizeColumn(sIndex)"
              >
                <el-icon><CircleClose /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </template>
        <template #default="{ row, $index }">
          <div
            v-if="editingCell?.rowIndex === $index && editingCell?.col === sIndex"
            class="b-cell-edit"
            @blur="onBCellBlur"
          >
            <el-input-number
              v-model="row.quantities[sIndex]"
              :min="0"
              :controls="false"
              class="qty-input"
              size="small"
              :ref="(el) => setColorCellRef(el, $index, sIndex)"
              @focus="setActiveColorCell($index, sIndex)"
              @keydown.stop="onColorCellKeydown($event, $index, sIndex)"
              @paste.stop.prevent="onColorCellPaste($event, $index, sIndex)"
            />
          </div>
          <div
            v-else
            class="b-cell-text"
            tabindex="0"
            @click="startEditBCell($index, sIndex)"
            @focus="startEditBCell($index, sIndex)"
          >
            {{ formatDisplayNumber(row.quantities[sIndex] ?? 0) }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="合计" width="80" align="center" header-align="center">
        <template #default="{ row }">
          {{ formatDisplayNumber(calcRowTotal(row)) }}
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="120" align="center" header-align="center">
        <template #default="{ row, $index }">
          <div
            v-if="editingCell?.rowIndex === $index && editingCell?.col === 'remark'"
            class="b-cell-edit"
            @blur="onBCellBlur"
          >
            <el-input
              :ref="remarkInputRef"
              v-model="row.remark"
              placeholder="备注"
              size="small"
              borderless
              @keydown.enter="setEditingCellNull"
            />
          </div>
          <div
            v-else
            class="b-cell-text"
            tabindex="0"
            @click="startEditBCell($index, 'remark')"
            @focus="startEditBCell($index, 'remark')"
          >
            {{ row.remark || '—' }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right" align="center" header-align="center">
        <template #default="{ $index }">
          <el-tooltip content="删除" placement="top">
            <el-button link type="danger" size="small" circle @click="removeColorRow($index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { Delete, CircleClose, Plus } from '@element-plus/icons-vue'
import { formatDisplayNumber } from '@/utils/display-number'

interface ColorRow {
  colorName: string
  quantities: number[]
  remark: string
}

const props = defineProps<{
  bTableRef: { $el?: HTMLElement } | null
  colorRows: ColorRow[]
  sizeHeaders: string[]
  editingCell: { rowIndex: number; col: number | 'color' | 'remark' } | null
  colorNameInputRef: { focus: () => void; $el?: HTMLElement } | null
  remarkInputRef: { focus: () => void; $el?: HTMLElement } | null
  bSummaryMethod: (...args: unknown[]) => unknown[]
  addSizeColumn: () => void
  addColorRow: () => void
  startEditBCell: (rowIndex: number, col: number | 'color' | 'remark') => void
  onBCellBlur: () => void
  insertSizeColumnBefore: (index: number) => void
  removeSizeColumn: (index: number) => void
  setColorCellRef: (el: unknown, rowIndex: number, colIndex: number) => void
  setActiveColorCell: (rowIndex: number, colIndex: number) => void
  onColorCellKeydown: (event: KeyboardEvent, rowIndex: number, colIndex: number) => void
  onColorCellPaste: (event: ClipboardEvent, rowIndex: number, colIndex: number) => void
  calcRowTotal: (row: ColorRow) => number
  removeColorRow: (index: number) => void
  setEditingCellNull: () => void
}>()

void props
</script>

<style scoped src="./order-edit-card.css"></style>
<style scoped src="./order-edit-matrix.css"></style>
<style scoped src="./order-edit-color-size.css"></style>
