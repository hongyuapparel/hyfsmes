<template>
  <div class="option-list">
    <div v-if="!hideTopLevelButton" class="option-toolbar">
      <el-button type="primary" size="small" @click="openAdd(null)">添加顶级分组</el-button>
    </div>
    <div v-if="treeData.length === 0" class="option-empty">
      {{ hideTopLevelButton ? '暂无配置' : '暂无配置，点击「添加顶级分组」新增' }}
    </div>
    <el-table
      ref="optionTableRef"
      v-else
      :data="treeData"
      row-key="id"
      border
      :tree-props="{ children: 'children' }"
      class="option-table"
    >
      <el-table-column label="分组名称" min-width="240">
        <template #default="{ row }">
          <span class="option-name-cell">
            <span class="option-drag-handle" title="拖拽调整顺序">≡</span>
            <span>{{ row.value }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="primary" size="small" @click="openAdd(row.id)">新建下级分组</el-button>
          <el-tooltip content="删除" placement="top">
          <el-button link type="danger" size="small" circle @click="remove(row)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑' : (parentId ? '新建下级分组' : '添加顶级分组')" width="400" @close="form.value = ''">
      <el-form label-width="80">
        <el-form-item :label="label">
          <el-input v-model="form.value" :placeholder="`请输入${label}`" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import {
  getSystemOptionsTree,
  createSystemOption,
  updateSystemOption,
  deleteSystemOption,
  batchUpdateSystemOptionOrder,
  type SystemOptionTreeNode,
} from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { Delete } from '@element-plus/icons-vue'

const props = withDefaults(
  defineProps<{
    type: string
    label: string
    /** 为 true 时隐藏「添加顶级分组」，仅允许在现有节点下新建下级（如部门-工种固定根时使用） */
    hideTopLevelButton?: boolean
  }>(),
  { hideTopLevelButton: false },
)

const treeData = ref<SystemOptionTreeNode[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const parentId = ref<number | null>(null)
const form = ref({ value: '' })
const submitLoading = ref(false)
const optionTableRef = ref<{ $el?: HTMLElement }>()
let optionSortable: Sortable | null = null

async function load() {
  try {
    const res = await getSystemOptionsTree(props.type)
    treeData.value = res.data ?? []
    await nextTick()
    initDragSort()
  } catch {
    treeData.value = []
    if (optionSortable) {
      optionSortable.destroy()
      optionSortable = null
    }
  }
}

watch(
  () => props.type,
  () => load(),
  { immediate: true },
)

/** 收集同一父级下的兄弟节点（按 sortOrder 排序） */
function getSiblings(node: SystemOptionTreeNode, tree: SystemOptionTreeNode[]): SystemOptionTreeNode[] {
  const pid = node.parentId ?? (null as number | null)
  if (pid === null) return [...tree].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  function collect(list: SystemOptionTreeNode[]): SystemOptionTreeNode[] {
    let out: SystemOptionTreeNode[] = []
    for (const n of list) {
      if ((n.parentId ?? null) === pid) out.push(n)
      if (n.children?.length) out = out.concat(collect(n.children))
    }
    return out
  }
  return collect(tree).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
}

/** 将树按表格展示顺序平铺（default-expand-all） */
function flattenVisibleRows(nodes: SystemOptionTreeNode[]): SystemOptionTreeNode[] {
  const out: SystemOptionTreeNode[] = []
  const walk = (list: SystemOptionTreeNode[]) => {
    for (const n of list) {
      out.push(n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

function initDragSort() {
  const tableEl = optionTableRef.value?.$el
  if (!tableEl) return
  const tbody = tableEl.querySelector('.el-table__body-wrapper tbody') as HTMLElement | null
  if (!tbody) return

  if (optionSortable) {
    optionSortable.destroy()
    optionSortable = null
  }

  optionSortable = Sortable.create(tbody, {
    handle: '.option-drag-handle',
    animation: 150,
    ghostClass: 'option-drag-ghost',
    onEnd(evt) {
      if (evt.oldIndex == null || evt.newIndex == null) return
      if (evt.oldIndex === evt.newIndex) return
      void handleDragEnd(evt.oldIndex, evt.newIndex)
    },
  })
}

async function handleDragEnd(oldIndex: number, newIndex: number) {
  const visibleRows = flattenVisibleRows(treeData.value)
  const moved = visibleRows[oldIndex]
  const target = visibleRows[newIndex]
  if (!moved || !target) return

  const movedParentId = moved.parentId ?? null
  const targetParentId = target.parentId ?? null
  if (movedParentId !== targetParentId) {
    ElMessage.warning('仅支持同级分组内拖拽排序')
    await load()
    return
  }

  const siblings = getSiblings(moved, treeData.value)
  const oldSiblingIdx = siblings.findIndex((s) => s.id === moved.id)
  const newSiblingIdx = siblings.findIndex((s) => s.id === target.id)
  if (oldSiblingIdx < 0 || newSiblingIdx < 0 || oldSiblingIdx === newSiblingIdx) {
    await load()
    return
  }

  const reordered = [...siblings]
  const [node] = reordered.splice(oldSiblingIdx, 1)
  reordered.splice(newSiblingIdx, 0, node)
  const items = reordered.map((n, i) => ({ id: n.id, sort_order: i }))
  try {
    await batchUpdateSystemOptionOrder(props.type, movedParentId, items)
    ElMessage.success('已保存排序')
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    await load()
  }
}

function openAdd(pid: number | null) {
  isEdit.value = false
  editId.value = 0
  parentId.value = pid
  form.value = { value: '' }
  dialogVisible.value = true
}

function openEdit(node: SystemOptionTreeNode) {
  isEdit.value = true
  editId.value = node.id
  parentId.value = null
  form.value = { value: node.value }
  dialogVisible.value = true
}

async function submit() {
  const val = form.value.value?.trim()
  if (!val) {
    ElMessage.warning(`请输入${props.label}`)
    return
  }
  submitLoading.value = true
  try {
    if (isEdit.value) {
      await updateSystemOption(editId.value, { value: val })
      ElMessage.success('保存成功')
    } else {
      const siblings = parentId.value != null
        ? getSiblings({ id: 0, parentId: parentId.value } as SystemOptionTreeNode, treeData.value)
        : treeData.value
      const sortOrder = siblings.length
      await createSystemOption({
        type: props.type,
        value: val,
        sort_order: sortOrder,
        parent_id: parentId.value ?? undefined,
      })
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    submitLoading.value = false
  }
}

async function remove(node: SystemOptionTreeNode) {
  try {
    await ElMessageBox.confirm(
      node.children?.length
        ? `确定删除「${node.value}」及其下级分组？`
        : `确定删除「${node.value}」？`,
      '提示',
      { type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await deleteSystemOption(node.id)
    ElMessage.success('已删除')
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onBeforeUnmount(() => {
  if (optionSortable) {
    optionSortable.destroy()
    optionSortable = null
  }
})
</script>

<style scoped>
.option-list {
  padding-top: var(--space-sm);
}
.option-toolbar {
  margin-bottom: var(--space-sm);
}
.option-empty {
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  padding: var(--space-lg);
}
.option-table {
  margin-top: var(--space-xs);
}
.option-drag-handle {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  cursor: grab;
  user-select: none;
  color: var(--el-text-color-secondary);
}
.option-name-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.option-drag-handle:active {
  cursor: grabbing;
}
.option-drag-ghost {
  opacity: 0.6;
}
</style>
