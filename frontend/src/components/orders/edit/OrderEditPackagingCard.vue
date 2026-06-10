<template>
  <el-card class="block-card">
    <template #header>
      <div class="block-header">
        <span class="block-title">G 包装要求</span>
        <el-button link type="primary" @click="addPackagingHeader">新增列</el-button>
      </div>
    </template>
    <div ref="packagingGridRef" class="packaging-grid">
      <div
        v-for="(_header, idx) in packagingHeaders"
        :key="packagingCellKeys[idx] ?? `packaging-fallback-${idx}`"
        class="packaging-cell"
      >
        <div class="packaging-header">
          <span class="packaging-drag-handle" title="拖拽排序">≡</span>
          <el-input v-model="packagingHeaders[idx]" size="small" />
        </div>
        <div class="packaging-body">
          <ImageUploadArea v-model="packagingCells[idx].imageUrl" />
          <el-input v-model="packagingCells[idx].accessoryName" placeholder="选择/填写辅料" size="small">
            <template #suffix>
              <el-button link type="primary" size="small" @click.stop="openAccessoryDialog(idx)">选择</el-button>
            </template>
          </el-input>
          <el-input v-model="packagingCells[idx].description" placeholder="信息备注" size="small" />
        </div>
        <div class="packaging-footer">
          <el-tooltip content="删除列" placement="top">
            <el-button
              link
              type="danger"
              size="small"
              circle
              :aria-label="`Delete packaging column ${idx + 1}`"
              @click="removePackagingHeader(idx)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </div>
    <div class="packaging-method">
      <span>包装方式：</span>
      <el-input
        :model-value="packagingMethod"
        placeholder="如：每件单独装袋，每箱 20 件等"
        @update:model-value="emit('update:packagingMethod', String($event ?? ''))"
      />
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import type { PackagingCell } from '@/composables/useOrderPackaging'
import ImageUploadArea from '@/components/ImageUploadArea.vue'

const props = defineProps<{
  packagingHeaders: string[]
  packagingCells: PackagingCell[]
  packagingCellKeys: string[]
  packagingMethod: string
  addPackagingHeader: () => void
  removePackagingHeader: (index: number) => void
  movePackagingHeader: (from: number, to: number) => void
  openAccessoryDialog: (index: number) => void
}>()

const emit = defineEmits<{
  (e: 'update:packagingMethod', value: string): void
}>()

const packagingGridRef = ref<HTMLElement | null>(null)
let packagingSortable: Sortable | null = null

onMounted(() => {
  const grid = packagingGridRef.value
  if (!grid) return
  packagingSortable = Sortable.create(grid, {
    animation: 120,
    handle: '.packaging-drag-handle',
    draggable: '.packaging-cell',
    onEnd: (evt) => {
      const oldIndex = evt.oldDraggableIndex ?? evt.oldIndex
      const newIndex = evt.newDraggableIndex ?? evt.newIndex
      // 先把被 Sortable 移动的节点放回原位，再改数据，由 Vue 按 key 重排，避免 DOM 与 v-for 双重移动
      if (evt.item.parentNode === grid) {
        grid.removeChild(evt.item)
        grid.insertBefore(evt.item, grid.children[oldIndex ?? 0] ?? null)
      }
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
      props.movePackagingHeader(oldIndex, newIndex)
    },
  })
})

onBeforeUnmount(() => {
  packagingSortable?.destroy()
  packagingSortable = null
})
</script>

<style scoped src="./order-edit-card.css"></style>
<style scoped src="./order-edit-packaging.css"></style>
