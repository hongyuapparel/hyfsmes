<template>
  <div class="option-list">
    <div class="option-toolbar">
      <el-button type="primary" size="small" @click="openAdd(null)">添加顶级分组</el-button>
    </div>
    <div v-if="treeData.length === 0" class="option-empty">暂无配置，点击「添加顶级分组」新增</div>
    <el-table
      v-else
      :data="treeData"
      row-key="id"
      border
      default-expand-all
      :tree-props="{ children: 'children' }"
      class="option-table"
    >
      <el-table-column prop="value" label="分组名称" min-width="200" />
      <el-table-column label="操作" width="320" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="primary" size="small" @click="openAdd(row.id)">新建下级分组</el-button>
          <el-button link size="small" :disabled="!canMoveUp(row)" @click="moveRow(row, -1)">上移</el-button>
          <el-button link size="small" :disabled="!canMoveDown(row)" @click="moveRow(row, 1)">下移</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
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
import { ref, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getSystemOptionsTree,
  createSystemOption,
  updateSystemOption,
  deleteSystemOption,
  batchUpdateSystemOptionOrder,
  type SystemOptionTreeNode,
} from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const props = defineProps<{
  type: string
  label: string
}>()

const treeData = ref<SystemOptionTreeNode[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const parentId = ref<number | null>(null)
const form = ref({ value: '' })
const submitLoading = ref(false)

async function load() {
  try {
    const res = await getSystemOptionsTree(props.type)
    treeData.value = res.data ?? []
  } catch {
    treeData.value = []
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

function canMoveUp(node: SystemOptionTreeNode): boolean {
  const siblings = getSiblings(node, treeData.value)
  const idx = siblings.findIndex((s) => s.id === node.id)
  return idx > 0
}

function canMoveDown(node: SystemOptionTreeNode): boolean {
  const siblings = getSiblings(node, treeData.value)
  const idx = siblings.findIndex((s) => s.id === node.id)
  return idx >= 0 && idx < siblings.length - 1
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

async function moveRow(node: SystemOptionTreeNode, delta: number) {
  const siblings = getSiblings(node, treeData.value)
  const idx = siblings.findIndex((s) => s.id === node.id)
  if (idx < 0) return
  const newIdx = idx + delta
  if (newIdx < 0 || newIdx >= siblings.length) return
  const arr = [...siblings]
  ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
  const items = arr.map((n, i) => ({ id: n.id, sort_order: i }))
  try {
    await batchUpdateSystemOptionOrder(
      props.type,
      node.parentId ?? null,
      items,
    )
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}
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
</style>
