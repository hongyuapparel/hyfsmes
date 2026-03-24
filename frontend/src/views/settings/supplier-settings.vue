<template>
  <div class="page-card">
    <p class="settings-hint">
      配置供应商类型与业务范围：树形展示，一级为供应商类型，二级为业务范围父分组，三级为业务范围子分组。新建/编辑供应商时，类型与业务范围下拉将按此配置联动显示。
    </p>

    <div class="settings-body">
      <div class="option-toolbar">
        <el-button type="primary" size="small" @click="openAdd(null)">添加供应商类型</el-button>
      </div>
      <div v-if="treeData.length === 0" class="option-empty">暂无配置，点击「添加供应商类型」新增</div>
      <el-table
        v-else
        ref="tableRef"
        :data="treeData"
        row-key="id"
        border
        class="option-table"
        lazy
        :load="loadChildren"
        :row-class-name="getRowClassName"
        :tree-props="{ hasChildren: 'hasChildren', children: 'children' }"
      >
        <el-table-column label="供应商类型" min-width="200">
          <template #default="{ row }">
            <span v-if="row.level === 0">{{ row.value }}</span>
          </template>
        </el-table-column>
        <el-table-column label="业务范围" min-width="220">
          <template #default="{ row }">
            <span v-if="row.level === 0" class="scope-empty">—</span>
            <span v-else class="scope-label" :class="`scope-level-${row.level}`">
              <el-icon
                v-if="row.level === 1 && row.hasChildren"
                class="scope-expand-icon"
                :class="{ expanded: isExpanded(row.id) }"
                @click.stop="toggleScopeExpand(row)"
              >
                <ArrowRight />
              </el-icon>
              <span v-else-if="row.level > 1" class="scope-branch">└</span>
              <span>{{ row.value }}</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.level < 2" link type="primary" size="small" @click="openAdd(row.id, row.level)">
              {{ row.level === 0 ? '添加父分组' : '添加子分组' }}
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
        :title="isEdit ? '编辑' : getAddTitle()"
        width="400"
        @close="form.value = ''"
      >
        <el-form label-width="110px">
          <el-form-item :label="getAddLabel()">
            <el-input
              v-model="form.value"
              :placeholder="`请输入${getAddLabel()}`"
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
import { ArrowRight, Delete } from '@element-plus/icons-vue'
import {
  getSystemOptionsRoots,
  getSystemOptionsChildren,
  getSystemOptionsTree,
  createSystemOption,
  updateSystemOption,
  deleteSystemOption,
  batchUpdateSystemOptionOrder,
  type SystemOptionLazyNode,
  type SystemOptionTreeNode,
} from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const OPTION_TYPE = 'supplier_types'

/** 表格行：含 level、parentId 便于操作 */
interface TreeRow extends SystemOptionLazyNode {
  level: number
  parentId?: number
  children?: TreeRow[]
}

const treeData = ref<TreeRow[]>([])
const tableRef = ref<any>(null)
const expandedIds = ref<Set<number>>(new Set())
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const parentId = ref<number | null>(null)
const addLevel = ref<0 | 1 | 2>(0)
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

function mapChildren(list: SystemOptionLazyNode[], parent: TreeRow): TreeRow[] {
  return list.map((o) => ({
    ...o,
    level: parent.level + 1,
    parentId: parent.id,
    hasChildren: o.hasChildren,
  }))
}

function getRowClassName({ row }: { row: TreeRow }) {
  return `row-level-${row.level}`
}

function isExpanded(id: number): boolean {
  return expandedIds.value.has(id)
}

function toggleScopeExpand(row: TreeRow) {
  const id = Number(row.id)
  const willExpand = !expandedIds.value.has(id)
  tableRef.value?.toggleRowExpansion?.(row, willExpand)
  if (willExpand) expandedIds.value.add(id)
  else expandedIds.value.delete(id)
}

/** 同步父节点子列表到响应式数据与 ElTable 懒加载缓存 */
function syncParentChildren(parent: TreeRow, list: SystemOptionLazyNode[]) {
  const rows = mapChildren(list, parent)
  parent.children = rows
  parent.hasChildren = rows.length > 0
  tableRef.value?.updateKeyChildren?.(parent.id, rows)
  // 触发一次顶层引用更新，确保懒加载场景下立即重渲染
  treeData.value = [...treeData.value]
}

async function loadChildren(row: TreeRow, _treeNode: { level: number; expanded: boolean }, resolve: (rows: TreeRow[]) => void) {
  if (row.level >= 2) {
    resolve([])
    return
  }
  try {
    const res = await getSystemOptionsChildren(OPTION_TYPE, row.id)
    const list = res.data ?? []
    const rows = mapChildren(list, row)
    // 关键：懒加载不仅给表格渲染，还要回写到业务树，后续新增/编辑/删除才能定位父节点并即时刷新
    row.children = rows
    row.hasChildren = rows.length > 0
    resolve(rows)
  } catch {
    resolve([])
  }
}

/** 递归按 id 查找节点 */
function findNodeById(id: number, nodes: TreeRow[] = treeData.value): TreeRow | undefined {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children?.length) {
      const found = findNodeById(id, node.children)
      if (found) return found
    }
  }
  return undefined
}

/** 获取同一父级下的兄弟：一级用 treeData，其他层级用父节点 children */
function getSiblings(row: TreeRow): TreeRow[] {
  if (row.level === 0) {
    return [...treeData.value].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  }
  const parent = row.parentId != null ? findNodeById(row.parentId) : undefined
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

function getAddLabel() {
  if (addLevel.value === 0) return '供应商类型'
  if (addLevel.value === 1) return '父分组'
  return '子分组'
}

function getAddTitle() {
  if (addLevel.value === 0) return '添加供应商类型'
  if (addLevel.value === 1) return '添加父分组'
  return '添加子分组'
}

function normalizeValue(v: string): string {
  return v.trim()
}

function findRootIdByTargetId(nodes: SystemOptionTreeNode[], targetId: number): number | null {
  for (const root of nodes) {
    if (root.id === targetId) return root.id
    const stack = [...(root.children ?? [])]
    while (stack.length) {
      const cur = stack.shift()!
      if (cur.id === targetId) return root.id
      if (cur.children?.length) stack.unshift(...cur.children)
    }
  }
  return null
}

function collectDescendants(nodes: SystemOptionTreeNode[]): SystemOptionTreeNode[] {
  const out: SystemOptionTreeNode[] = []
  const stack = [...nodes]
  while (stack.length) {
    const cur = stack.shift()!
    out.push(cur)
    if (cur.children?.length) stack.unshift(...cur.children)
  }
  return out
}

/** 规则：同一供应商类型（根）下，业务范围（父/子分组）不允许重名；供应商类型本身也不允许重名 */
async function validateNoDuplicate(val: string): Promise<boolean> {
  const value = normalizeValue(val)
  const res = await getSystemOptionsTree(OPTION_TYPE)
  const tree = res.data ?? []
  const editingId = isEdit.value ? editId.value : null

  // 新增供应商类型 / 编辑供应商类型：根节点名称全局唯一
  if ((parentId.value == null && !isEdit.value) || (isEdit.value && addLevel.value === 0)) {
    const existed = tree.some((root) => root.value.trim() === value && root.id !== editingId)
    if (existed) {
      ElMessage.warning('供应商类型名称不能重复')
      return false
    }
    return true
  }

  // 新增/编辑业务范围：同一根类型下名称唯一（包含父分组和子分组）
  let rootId: number | null = null
  if (isEdit.value && editingId != null) {
    rootId = findRootIdByTargetId(tree, editingId)
  } else if (parentId.value != null) {
    rootId = findRootIdByTargetId(tree, parentId.value)
  }
  if (rootId == null) return true

  const root = tree.find((r) => r.id === rootId)
  if (!root) return true
  const descendants = collectDescendants(root.children ?? [])
  const existed = descendants.some((n) => n.value.trim() === value && n.id !== editingId)
  if (existed) {
    ElMessage.warning('同一供应商类型下业务范围名称不能重复')
    return false
  }
  return true
}

function openAdd(pid: number | null, parentLevel?: number) {
  isEdit.value = false
  editId.value = 0
  parentId.value = pid
  addLevel.value = pid == null ? 0 : ((parentLevel ?? 0) + 1 as 1 | 2)
  form.value = { value: '' }
  dialogVisible.value = true
}

function openEdit(row: TreeRow) {
  isEdit.value = true
  editId.value = row.id
  addLevel.value = (row.level as 0 | 1 | 2)
  parentId.value = null
  form.value = { value: row.value }
  dialogVisible.value = true
}

async function submit() {
  const val = form.value.value?.trim()
  const label = getAddLabel()
  if (!val) {
    ElMessage.warning(`请输入${label}`)
    return
  }
  const ok = await validateNoDuplicate(val)
  if (!ok) return
  submitLoading.value = true
  try {
    let handledByLocalSync = false
    if (isEdit.value) {
      await updateSystemOption(editId.value, { value: val })
      const target = findNodeById(editId.value)
      if (target) {
        target.value = val
        // 二/三级节点编辑后，同步父节点 children 到懒加载缓存，确保立即可见
        if (target.level > 0 && target.parentId != null) {
          const parent = findNodeById(target.parentId)
          if (parent) {
            const list: SystemOptionLazyNode[] = (parent.children ?? []).map((n) => ({
              id: n.id,
              value: n.value,
              sortOrder: n.sortOrder,
              hasChildren: !!n.hasChildren,
            }))
            syncParentChildren(parent, list)
          }
        }
        handledByLocalSync = true
      }
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
    if (isEdit.value) {
      if (!handledByLocalSync) await loadRoots()
    } else if (parentId.value != null) {
      const parent = findNodeById(parentId.value)
      if (parent) {
        const res = await getSystemOptionsChildren(OPTION_TYPE, parentId.value)
        const list = res.data ?? []
        syncParentChildren(parent, list)
        // 新增后自动展开父节点，确保第一时间看到新增项
        if (list.length > 0) {
          tableRef.value?.toggleRowExpansion?.(parent, true)
          expandedIds.value.add(Number(parent.id))
        }
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
  const label = row.level === 0 ? '供应商类型' : row.level === 1 ? '父分组' : '子分组'
  try {
    await ElMessageBox.confirm(`确定删除「${row.value}」？`, '提示', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deleteSystemOption(row.id)
    ElMessage.success('已删除')
    // 懒加载树：优先局部刷新当前父节点，保证删除后立即可见
    if (row.level > 0 && row.parentId != null) {
      const parent = findNodeById(row.parentId)
      if (parent) {
        const res = await getSystemOptionsChildren(OPTION_TYPE, parent.id)
        const list = res.data ?? []
        syncParentChildren(parent, list)
        expandedIds.value.delete(Number(row.id))
      } else {
        await loadRoots()
      }
    } else {
      // 删除根节点时刷新根列表
      await loadRoots()
      expandedIds.value.delete(Number(row.id))
    }
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
    if (row.level > 0 && row.parentId != null) {
      const parent = findNodeById(row.parentId)
      if (parent) {
        const res = await getSystemOptionsChildren(OPTION_TYPE, parent.id)
        const list = res.data ?? []
        syncParentChildren(parent, list)
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

.scope-empty {
  color: var(--color-text-muted);
}

.scope-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.scope-expand-icon {
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: transform 0.2s;
}

.scope-expand-icon.expanded {
  transform: rotate(90deg);
}

.scope-level-1 {
  color: var(--color-text-primary);
}

.scope-level-2 {
  padding-left: 12px;
  color: var(--color-text-secondary);
}

.scope-branch {
  color: var(--color-text-muted);
}

/* 父分组（level=1）的默认树展开图标隐藏，改由业务范围列自定义图标承载 */
.option-table :deep(.row-level-1 .el-table__expand-icon) {
  display: none;
}
</style>
