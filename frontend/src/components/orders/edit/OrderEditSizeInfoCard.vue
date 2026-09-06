<template>
  <el-card class="block-card" @keydown.capture="grid.keydown">
    <template #header>
      <div class="block-header">
        <span class="block-title">D 尺寸信息</span>
        <div class="block-actions">
          <el-button link :disabled="!grid.history.canUndo.value" @click="grid.history.undo">撤销</el-button>
          <el-button link :disabled="!grid.history.canRedo.value" @click="grid.history.redo">重做</el-button>
          <el-button link type="primary" @click="grid.action(addSizeMetaColumn)">新增信息列</el-button>
          <el-button link type="primary" @click="grid.action(addSizeInfoRow)">新增部位行</el-button>
          <el-button link type="primary" @click="copySizeInfoToClipboard">复制整表（含表头）</el-button>
        </div>
      </div>
    </template>
    <div class="size-grid-hint">{{ grid.selectionLabel.value }} · Ctrl+Z 撤销 · Ctrl+Y 重做</div>
    <el-table
      :ref="setSizeInfoTableRef"
      :data="sizeInfoRows"
      row-key="__rowKey"
      border
      size="small"
      class="size-info-table editable-grid"
      header-align="center"
    >
      <el-table-column width="32" align="center" header-align="center">
        <template #default>
          <span class="size-row-drag-handle" title="拖拽排序">≡</span>
        </template>
      </el-table-column>
      <el-table-column
        v-for="(header, idx) in sizeMetaHeaders"
        :key="'meta-' + idx"
        :label="header"
        min-width="100"
        align="center"
        header-align="center"
      >
        <template #header>
          <div class="b-header-cell">
            <el-input v-model="sizeMetaHeaders[idx]" size="small" class="b-header-input" @click.stop
              @focus="grid.history.begin" @beforeinput="grid.history.begin" @change="grid.history.commit" />
            <el-tooltip v-if="sizeMetaHeaders.length > 1" content="删除此列" placement="top">
              <el-button
                link
                type="danger"
                size="small"
                class="b-header-remove"
                @click.stop="grid.action(() => removeSizeMetaColumn(idx))"
              >
                <el-icon><CircleClose /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </template>
        <template #default="{ row, $index }">
          <el-input
            v-model="row.metaValues[idx]"
            :class="{ 'size-cell-selected': grid.selected($index, idx) }"
            @mousedown="grid.pick($event, $index, idx)"
            @mouseenter="grid.extend($event, $index, idx)"
            @copy="grid.copy($event, $index, idx)"
            @beforeinput="grid.history.begin"
            @focus="grid.history.begin"
            @change="grid.history.commit"
            :ref="(el) => setSizeGridCellRef(el, $index, idx)"
            @keydown.stop="onSizeGridKeydown($event, $index, idx)"
            @paste.stop.prevent="grid.paste($event, $index, idx)"
          />
        </template>
      </el-table-column>
      <el-table-column
        v-for="(size, sIndex) in sizeHeaders"
        :key="'size-' + sIndex"
        :label="size"
        min-width="72"
        align="center"
        header-align="center"
      >
        <template #header>
          <span>{{ sizeHeaders[sIndex] }}</span>
        </template>
        <template #default="{ row, $index }">
          <el-input
            v-model="row.sizeValues[sIndex]"
            :class="{ 'size-cell-selected': grid.selected($index, sizeMetaHeaders.length + sIndex) }"
            @mousedown="grid.pick($event, $index, sizeMetaHeaders.length + sIndex)"
            @mouseenter="grid.extend($event, $index, sizeMetaHeaders.length + sIndex)"
            @copy="grid.copy($event, $index, sizeMetaHeaders.length + sIndex)"
            @beforeinput="grid.history.begin"
            @focus="grid.history.begin"
            @change="grid.history.commit"
            size="small"
            :ref="(el) => setSizeGridCellRef(el, $index, sizeMetaHeaders.length + sIndex)"
            @keydown.stop="onSizeGridKeydown($event, $index, sizeMetaHeaders.length + sIndex)"
            @paste.stop.prevent="grid.paste($event, $index, sizeMetaHeaders.length + sIndex)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right" align="center" header-align="center">
        <template #default="{ $index }">
          <el-tooltip content="删除" placement="top">
            <el-button
              link
              type="danger"
              size="small"
              circle
              :aria-label="`Delete size row ${$index + 1}`"
              @click="grid.action(() => removeSizeInfoRow($index))"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { Delete, CircleClose } from '@element-plus/icons-vue'
import type { SizeInfoRow } from '@/composables/useOrderSizeInfo'
import { useSizeGridInteraction } from './useSizeGridInteraction'

const props = defineProps<{
  historyKey?: string
  setSizeInfoTableRef: (el: unknown) => void
  sizeInfoRows: SizeInfoRow[]
  sizeMetaHeaders: string[]
  sizeHeaders: string[]
  setSizeGridCellRef: (el: unknown, rowIndex: number, colIndex: number) => void
  onSizeGridKeydown: (event: KeyboardEvent, rowIndex: number, colIndex: number) => void
  onSizeGridPaste: (event: ClipboardEvent, rowIndex: number, colIndex: number) => void
  addSizeMetaColumn: () => void
  removeSizeMetaColumn: (index: number) => void
  addSizeInfoRow: () => void
  removeSizeInfoRow: (index: number) => void
  copySizeInfoToClipboard: () => void
}>()
const grid = useSizeGridInteraction(props)
</script>

<style scoped src="./order-edit-card.css"></style>
<style scoped src="./order-edit-matrix.css"></style>
<style scoped src="./order-edit-size-info.css"></style>
