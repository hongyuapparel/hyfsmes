<template>
  <el-card class="block-card">
    <template #header>
      <div class="block-header">
        <span class="block-title">D 尺寸信息</span>
        <div class="block-actions">
          <el-button link type="primary" @click="addSizeMetaColumn">新增部位列</el-button>
          <el-button link type="primary" @click="addSizeInfoRow">新增行</el-button>
          <el-button link type="primary" @click="copySizeInfoToClipboard">复制到剪贴板</el-button>
        </div>
      </div>
    </template>
    <el-table
      :ref="sizeInfoTableRef"
      :data="sizeInfoRows"
      row-key="__rowKey"
      border
      size="small"
      class="size-info-table"
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
            <el-input v-model="sizeMetaHeaders[idx]" size="small" class="b-header-input" @click.stop />
            <el-tooltip v-if="sizeMetaHeaders.length > 1" content="删除此列" placement="top">
              <el-button
                link
                type="danger"
                size="small"
                class="b-header-remove"
                @click.stop="removeSizeMetaColumn(idx)"
              >
                <el-icon><CircleClose /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </template>
        <template #default="{ row, $index }">
          <el-input
            v-model="row.metaValues[idx]"
            :ref="(el) => setSizeGridCellRef(el, $index, idx)"
            @keydown.stop="onSizeGridKeydown($event, $index, idx)"
            @paste.stop.prevent="onSizeGridPaste($event, $index, idx)"
          />
        </template>
      </el-table-column>
      <el-table-column
        v-for="(size, sIndex) in sizeHeaders"
        :key="'size-' + size"
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
            size="small"
            :ref="(el) => setSizeGridCellRef(el, $index, sizeMetaHeaders.length + sIndex)"
            @keydown.stop="onSizeGridKeydown($event, $index, sizeMetaHeaders.length + sIndex)"
            @paste.stop.prevent="onSizeGridPaste($event, $index, sizeMetaHeaders.length + sIndex)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right" align="center" header-align="center">
        <template #default="{ $index }">
          <el-tooltip content="删除" placement="top">
            <el-button link type="danger" size="small" circle @click="removeSizeInfoRow($index)">
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

defineProps<{
  sizeInfoTableRef: any
  sizeInfoRows: any[]
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
</script>

<style scoped src="./order-edit-card.css"></style>
<style scoped src="./order-edit-matrix.css"></style>
<style scoped src="./order-edit-size-info.css"></style>
