<template>
  <div class="page-card">
    <p class="settings-hint">
      配置供应商类型与业务范围：树形展示，一级为供应商类型，二级为该类型下的业务范围。新建/编辑供应商时，类型与业务范围下拉将按此配置联动显示。
    </p>

    <div class="settings-body">
      <div class="option-toolbar">
        <el-button type="primary" size="small" @click="openAdd(null)">添加供应商类型</el-button>
      </div>
      <div v-if="treeData.length === 0" class="option-empty">暂无配置，点击「添加供应商类型」新增</div>
      <el-table
        v-else
        :data="treeData"
        row-key="id"
        border
        class="option-table"
        lazy
        :load="loadChildren"
        :tree-props="{ hasChildren: 'hasChildren', children: 'children' }"
      >
        <el-table-column label="供应商类型" min-width="200">
          <template #default="{ row }">
            {{ row.level === 0 ? row.value : '' }}
          </template>
        </el-table-column>
        <el-table-column label="业务范围" min-width="180">
          <template #default="{ row }">
            {{ row.level === 0 ? '—' : row.value }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button
              v-if="row.level === 0"
              link
              type="primary"
              size="small"
              @click="openAdd(row.id)"
            >
              添加业务范围
            </el-button>
            <el-button link size="small" :disabled="!canMoveUp(row)" @click="moveRow(row, -1)">
              上移
            </el-button>
            <el-button link size="small" :disabled="!canMoveDown(row)" @click="moveRow(row, 1)">
              下移
            </el-button>
            <el-tooltip content="删除" placement="top">
              <el-button link type="danger" size="small" circle @click="remove(row)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog
        v-model="dialogVisible"
        :title="isEdit ? '编辑' : (parentId != null ? '添加业务范围' : '添加供应商类型')"
        width="400"
        @close="form.value = ''"
      >
        <el-form label-width="80">
          <el-form-item :label="parentId != null ? '业务范围' : '供应商类型'">
            <el-input
              v-model="form.value"
              :placeholder="parentId != null ? '请输入业务范围' : '请输入供应商类型'"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitLoading" @click="submit">确定</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import {
  getSystemOptionsRoots,
  getSystemOptionsChildren,
  createSystemOption,
  updateSystemOption,
  deleteSystemOption,
  batchUpdateSystemOptionOrder,
  type SystemOptionLazyNode,
} from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const OPTION_TYPE = 'supplier_types'

/** 表格行：含 level、parentId 便于操作 */
interface TreeRow extends SystemOptionLazyNode {
  level: 0 | 1
  parentId?: number
  children?: TreeRow[]
}

const treeData = ref<TreeRow[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const parentId = ref<number | null>(null)
const form = ref({ value: '' })
const submitLoading = ref(false)

async function loadRoots() {
  try {
    const res = await getSystemOptionsRoots(OPTION_TYPE)
    const list = res.data ?? []
    treeData.value = list.map((o) => ({
      ...o,
      level: 0 as const,
      hasChildren: o.hasChildren,
    }))
  } catch {
    treeData.value = []
  }
}

async function loadChildren(row: TreeRow, _treeNode: { level: number; expanded: boolean }, resolve: (rows: TreeRow[]) => void) {
  if (row.level !== 0) {
    resolve([])
    return
  }
  try {
    const res = await getSystemOptionsChildren(OPTION_TYPE, row.id)
    const list = res.data ?? []
    const rows: TreeRow[] = list.map((o) => ({
      ...o,
      level: 1 as const,
      parentId: row.id,
      hasChildren: o.hasChildren,
    }))
    resolve(rows)
  } catch {
    resolve([])
  }
}

/** 根据 parentId 取父节点（一级行在 treeData 里） */
function getParentRow(parentId: number): TreeRow | undefined {
  const pid = Number(parentId)
  return treeData.value.find((r) => Number(r.id) === pid)
}

/** 通过子节点 id 在树中查找父节点（兜底：表格传入的 row 可能无 parentId） */
function getParentByChildId(childId: number): TreeRow | undefined {
  const cid = Number(childId)
  return treeData.value.find((r) =>
    r.children?.some((c) => Number(c.id) === cid),
  )
}

/** 获取同一父级下的兄弟：一级用 treeData，二级用父节点的 children（先按 parentId 取父，否则按子 id 在树中查父） */
function getSiblings(row: TreeRow): TreeRow[] {
  if (row.level === 0) {
    return [...treeData.value].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  }
  const parent =
    row.parentId != null ? getParentRow(row.parentId) : getParentByChildId(row.id)
  const list = parent?.children ?? []
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
}

function canMoveUp(row: TreeRow): boolean {
  const siblings = getSiblings(row)
  const idx = siblings.findIndex((s) => Number(s.id) === Number(row.id))
  return idx > 0
}

function canMoveDown(row: TreeRow): boolean {
  const siblings = getSiblings(row)
  const idx = siblings.findIndex((s) => Number(s.id) === Number(row.id))
  return idx >= 0 && idx < siblings.length - 1
}

function openAdd(pid: number | null) {
  isEdit.value = false
  editId.value = 0
  parentId.value = pid
  form.value = { value: '' }
  dialogVisible.value = true
}

function openEdit(row: TreeRow) {
  isEdit.value = true
  editId.value = row.id
  parentId.value = null
  form.value = { value: row.value }
  dialogVisible.value = true
}

async function submit() {
  const val = form.value.value?.trim()
  const label = parentId.value != null ? '业务范围' : '供应商类型'
  if (!val) {
    ElMessage.warning(`请输入${label}`)
    return
  }
  submitLoading.value = true
  try {
    if (isEdit.value) {
      await updateSystemOption(editId.value, { value: val })
      ElMessage.success('保存成功')
    } else {
      let sortOrder: number
      if (parentId.value != null) {
        const res = await getSystemOptionsChildren(OPTION_TYPE, parentId.value)
        sortOrder = (res.data ?? []).length
      } else {
        sortOrder = treeData.value.length
      }
      await createSystemOption({
        type: OPTION_TYPE,
        value: val,
        sort_order: sortOrder,
        parent_id: parentId.value ?? undefined,
      })
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    if (parentId.value != null) {
      const parent = getParentRow(parentId.value)
      if (parent) {
        const res = await getSystemOptionsChildren(OPTION_TYPE, parentId.value)
        const list = res.data ?? []
        parent.children = list.map((o) => ({
          ...o,
          level: 1 as const,
          parentId: parent.id,
          hasChildren: o.hasChildren,
        }))
        parent.hasChildren = list.length > 0
      } else {
        await loadRoots()
      }
    } else {
      await loadRoots()
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    submitLoading.value = false
  }
}

async function remove(row: TreeRow) {
  const label = row.level === 0 ? '供应商类型' : '业务范围'
  try {
    await ElMessageBox.confirm(`确定删除「${row.value}」？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteSystemOption(row.id)
    ElMessage.success('已删除')
    await loadRoots()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

async function moveRow(row: TreeRow, delta: number) {
  const siblings = getSiblings(row)
  const idx = siblings.findIndex((s) => Number(s.id) === Number(row.id))
  if (idx < 0) return
  const newIdx = idx + delta
  if (newIdx < 0 || newIdx >= siblings.length) return
  const arr = [...siblings]
  ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
  const items = arr.map((n, i) => ({ id: n.id, sort_order: i }))
  const pid = row.level === 0 ? null : row.parentId ?? null
  try {
    await batchUpdateSystemOptionOrder(OPTION_TYPE, pid, items)
    if (row.level === 1) {
      const parent = getParentRow(row.parentId!) ?? getParentByChildId(row.id)
      if (parent) {
        const res = await getSystemOptionsChildren(OPTION_TYPE, parent.id)
        const list = res.data ?? []
        parent.children = list.map((o) => ({
          ...o,
          level: 1 as const,
          parentId: parent.id,
          hasChildren: o.hasChildren,
        }))
      }
    } else {
      await loadRoots()
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onMounted(() => loadRoots())
</script>

<style scoped>
.settings-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  margin-bottom: var(--space-md);
  line-height: 1.6;
}

.settings-body {
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
