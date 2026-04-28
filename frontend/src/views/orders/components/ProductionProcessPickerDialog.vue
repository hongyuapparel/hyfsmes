<template>
  <el-dialog
    :model-value="modelValue"
    title="批量添加工序"
    width="760px"
    class="production-picker-dialog"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="production-picker-toolbar">
      <span class="import-template-hint">
        左侧选择工种，右侧可搜索并勾选工序，点击“添加所选”后自动加入并关闭弹窗。
      </span>
      <span v-if="selectedIds.length" class="picker-selected-summary">已选 {{ selectedIds.length }} 条工序</span>
    </div>
    <div class="production-picker-layout">
      <div v-loading="jobTypesLoading" class="production-picker-tree">
        <el-tree
          :data="treeData"
          node-key="key"
          :expand-on-click-node="false"
          default-expand-all
          highlight-current
          @node-click="onPickerTreeNodeClick"
        >
          <template #default="{ data }">
            <span class="picker-tree-node">
              <span>{{ data.label }}</span>
            </span>
          </template>
        </el-tree>
      </div>
      <div class="production-picker-list">
        <el-input
          v-model="keyword"
          placeholder="搜索工序关键词"
          clearable
          size="small"
          class="picker-search-input"
        />
        <div class="picker-table-v2-wrap">
          <el-table-v2
            v-if="tableRows.length"
            class="picker-process-table-v2"
            :columns="pickerColumns"
            :data="tableRows"
            :width="pickerTableWidth"
            :height="300"
            :row-height="28"
            :header-height="32"
            row-key="id"
            :cache="8"
          />
          <p v-else class="empty-hint">当前工种下暂无可选工序</p>
        </div>
      </div>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
      <el-button type="primary" :loading="appendSubmitting" :disabled="!selectedIds.length || appendSubmitting" @click="confirmAppend">
        添加所选（{{ selectedIds.length }}）
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElCheckbox, ElTableV2 } from 'element-plus'
import { computed, h, markRaw, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { ProductionProcessItem } from '@/api/production-processes'
import { getDictItems } from '@/api/dicts'
import type { SystemOptionItem } from '@/api/system-options'
import { formatDisplayNumber } from '@/utils/display-number'
import type { Column } from 'element-plus/es/components/table-v2/src/types'

const props = defineProps<{
  modelValue: boolean
  productionProcesses: ProductionProcessItem[]
  /** 已加入订单成本表的工序 ID 的稳定签名（排序后逗号拼接），避免父组件每次渲染用新数组引用触发子组件整表重算 */
  addedIdsSignature: string
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  append: [ProductionProcessItem[]]
}>()

const DEPARTMENT_ORDER = ['裁床', '车缝', '尾部']

interface PickerTreeNode {
  key: string
  label: string
  department: string
  jobType: string
  children?: PickerTreeNode[]
}

interface PickerRowLite {
  id: number
  name: string
  nameLower: string
  unitPrice: number
}

const activeDepartment = ref('')
const activeJobType = ref('')
const selectedIds = ref<number[]>([])
const keyword = ref('')
const debouncedKeyword = ref('')
const appendSubmitting = ref(false)

const jobTypeOptionsFlat = ref<SystemOptionItem[]>([])
const jobTypesLoading = ref(false)

/** 弹窗打开时从 props 拍一份非深层响应式的工序快照，避免 computed 深度追踪整表 productionProcesses */
const snapshotProcesses = shallowRef<ProductionProcessItem[]>([])
/** 工种 -> 工序轻量行（markRaw），仅用于右侧过滤展示 */
let processPoolByJob = new Map<string, PickerRowLite[]>()
/** 右侧表格数据源：仅在工种/关键词变化时整体替换，勾选不重建数组，避免 el-table 全量 diff */
const tableRows = shallowRef<PickerRowLite[]>([])
/** 左侧树：打开时构建一次，避免 computed 反复读 props.productionProcesses 建立深层依赖 */
const treeData = shallowRef<PickerTreeNode[]>([])
const pickerTableWidth = 500

let keywordDebounceTimer: ReturnType<typeof setTimeout> | null = null
let jobTypesController: AbortController | null = null
let loadToken = 0
let jobTypeCache: SystemOptionItem[] | null = null

const addedIdSet = computed(() => {
  const s = (props.addedIdsSignature ?? '').trim()
  if (!s) return new Set<number>()
  return new Set(
    s
      .split(',')
      .map((x) => Number(x.trim()))
      .filter((id) => Number.isInteger(id) && id > 0),
  )
})

const selectedIdSet = computed(() => new Set(selectedIds.value))

const idToSnapshotItem = computed(() => {
  const m = new Map<number, ProductionProcessItem>()
  snapshotProcesses.value.forEach((p) => {
    if (typeof p.id === 'number') m.set(p.id, p)
  })
  return m
})

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return formatDisplayNumber(0)
  return formatDisplayNumber(n)
}

function getJobTypeLabel(v: string): string {
  if (!v) return ''
  const parts = v.split('>').map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : v
}

function buildPickerTreeFromProcessesOnly(processes: ProductionProcessItem[]): PickerTreeNode[] {
  const deptMap = new Map<string, Set<string>>()
  processes.forEach((p) => {
    const dept = (p.department ?? '').trim()
    const job = (p.jobType ?? '').trim()
    if (!dept || !job) return
    if (!deptMap.has(dept)) deptMap.set(dept, new Set())
    deptMap.get(dept)!.add(job)
  })
  const orderMap = new Map(DEPARTMENT_ORDER.map((d, i) => [d, i]))
  return Array.from(deptMap.entries())
    .sort((a, b) => {
      const ai = orderMap.get(a[0]) ?? DEPARTMENT_ORDER.length
      const bi = orderMap.get(b[0]) ?? DEPARTMENT_ORDER.length
      if (ai !== bi) return ai - bi
      return a[0].localeCompare(b[0])
    })
    .map(([dept, jobs]) => ({
      key: `dept:${dept}`,
      label: dept,
      department: dept,
      jobType: '',
      children: Array.from(jobs)
        .sort((a, b) => a.localeCompare(b))
        .map((job) => ({
          key: `job:${dept}::${job}`,
          label: getJobTypeLabel(job),
          department: dept,
          jobType: job,
        })),
    }))
}

function buildPickerTreeFromJobTypes(flat: SystemOptionItem[]): PickerTreeNode[] {
  const childrenMap = new Map<number | null, SystemOptionItem[]>()
  for (const item of flat) {
    const pid = item.parentId ?? null
    if (!childrenMap.has(pid)) childrenMap.set(pid, [])
    childrenMap.get(pid)!.push(item)
  }
  for (const arr of childrenMap.values()) {
    arr.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  }
  const roots = childrenMap.get(null) ?? []
  const orderMap = new Map(DEPARTMENT_ORDER.map((d, i) => [d, i]))
  const sortedRoots = roots.slice().sort((a, b) => {
    const ai = orderMap.get(a.value) ?? DEPARTMENT_ORDER.length
    const bi = orderMap.get(b.value) ?? DEPARTMENT_ORDER.length
    if (ai !== bi) return ai - bi
    return a.value.localeCompare(b.value)
  })

  function collectLeaves(department: string, nodeId: number, pathPrefix: string): PickerTreeNode[] {
    const kids = childrenMap.get(nodeId) ?? []
    if (kids.length === 0) {
      return [
        {
          key: `job:${department}::${pathPrefix}`,
          label: getJobTypeLabel(pathPrefix),
          department,
          jobType: pathPrefix,
        },
      ]
    }
    const out: PickerTreeNode[] = []
    for (const c of kids) {
      const nextPath = `${pathPrefix} > ${c.value}`
      out.push(...collectLeaves(department, c.id, nextPath))
    }
    return out
  }

  return sortedRoots.map((root) => {
    const department = root.value.trim()
    const topKids = childrenMap.get(root.id) ?? []
    const leaves: PickerTreeNode[] = []
    for (const c of topKids) {
      const path = `${department} > ${c.value}`
      leaves.push(...collectLeaves(department, c.id, path))
    }
    return {
      key: `dept:${department}`,
      label: department,
      department,
      jobType: '',
      children: leaves,
    }
  })
}

function rebuildProcessPoolFromSnapshot(list: ProductionProcessItem[]) {
  const map = new Map<string, PickerRowLite[]>()
  for (const p of list) {
    const dept = (p.department ?? '').trim()
    const job = (p.jobType ?? '').trim()
    const key = `${dept}::${job}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(
      markRaw({
        id: p.id,
        name: p.name || '未命名工序',
        nameLower: String(p.name ?? '').toLowerCase(),
        unitPrice: Number(p.unitPrice) || 0,
      }),
    )
  }
  processPoolByJob = map
}

function refreshFilteredTableRows() {
  const dept = activeDepartment.value.trim()
  const job = activeJobType.value.trim()
  const kw = debouncedKeyword.value.trim().toLowerCase()
  const key = `${dept}::${job}`
  const pool = processPoolByJob.get(key) ?? []
  const next = pool.filter((p) => !kw || p.nameLower.includes(kw)).map((p) => markRaw({ ...p }))
  tableRows.value = next
}

/** 依赖勾选与已添加签名，保证虚拟表在 selection / 禁用态变化时刷新可见单元格 */
const pickerColumns = computed<Column<any>[]>(() => {
  const sel = selectedIdSet.value
  const added = addedIdSet.value
  return [
    {
      key: 'select',
      width: 72,
      title: '选择',
      align: 'center',
      cellRenderer: ({ rowData }) =>
        h(ElCheckbox, {
          modelValue: sel.has(rowData.id),
          disabled: added.has(rowData.id),
          onChange: (v: unknown) => onPickerProcessChecked(rowData.id, v === true),
        }),
    },
    {
      key: 'name',
      title: '工序',
      width: 268,
      align: 'center',
      cellRenderer: ({ rowData }) => {
        const isAdded = added.has(rowData.id)
        return h('div', { class: 'picker-name-cell' }, [
          h('span', rowData.name),
          isAdded ? h('span', { class: 'picker-added-tag' }, '（已添加）') : null,
        ])
      },
    },
    {
      key: 'unitPrice',
      dataKey: 'unitPrice',
      title: '价格(元)',
      width: 110,
      align: 'center',
      cellRenderer: ({ rowData }) => h('span', formatMoney(rowData.unitPrice)),
    },
  ]
})

function onPickerTreeNodeClick(node: PickerTreeNode) {
  if (!node?.jobType) return
  activeDepartment.value = node.department
  activeJobType.value = node.jobType
  refreshFilteredTableRows()
}

function onPickerProcessChecked(id: number, checked: boolean) {
  const current = new Set(selectedIds.value)
  if (checked) current.add(id)
  else current.delete(id)
  selectedIds.value = Array.from(current)
}

function confirmAppend() {
  if (appendSubmitting.value) return
  const ids = selectedIds.value.filter((id) => Number.isInteger(id) && id > 0)
  if (!ids.length) return
  const existing = addedIdSet.value
  const toAdd: ProductionProcessItem[] = []
  for (const id of ids) {
    if (existing.has(id)) continue
    const found = idToSnapshotItem.value.get(id)
    if (found) toAdd.push(found)
  }
  if (!toAdd.length) {
    ElMessage.warning('所选工序均已存在')
    return
  }
  appendSubmitting.value = true
  emit('append', toAdd)
  selectedIds.value = []
  emit('update:modelValue', false)
  ElMessage.success(`已添加 ${toAdd.length} 条工序`)
  nextTick(() => {
    appendSubmitting.value = false
  })
}

watch(keyword, (v) => {
  if (keywordDebounceTimer) clearTimeout(keywordDebounceTimer)
  keywordDebounceTimer = setTimeout(() => {
    debouncedKeyword.value = v
    keywordDebounceTimer = null
  }, 120)
})

watch(debouncedKeyword, () => {
  if (!props.modelValue) return
  refreshFilteredTableRows()
})

function cancelPendingJobTypeRequest() {
  if (jobTypesController) {
    jobTypesController.abort()
    jobTypesController = null
  }
  jobTypesLoading.value = false
}

async function ensureJobTypesLoaded() {
  if (jobTypeCache) {
    jobTypeOptionsFlat.value = jobTypeCache
    return
  }
  cancelPendingJobTypeRequest()
  const token = ++loadToken
  const controller = new AbortController()
  jobTypesController = controller
  jobTypesLoading.value = true
  try {
    const res = await getDictItems('process_job_types', { signal: controller.signal })
    if (token !== loadToken) return
    jobTypeCache = res.data ?? []
    jobTypeOptionsFlat.value = jobTypeCache
  } catch {
    if (token !== loadToken) return
    jobTypeOptionsFlat.value = []
  } finally {
    if (token === loadToken) jobTypesLoading.value = false
    if (jobTypesController === controller) jobTypesController = null
  }
}

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) {
      cancelPendingJobTypeRequest()
      appendSubmitting.value = false
      return
    }
    await ensureJobTypesLoaded()

    const snap = (props.productionProcesses ?? []).map((p) => markRaw({ ...p }))
    snapshotProcesses.value = snap
    rebuildProcessPoolFromSnapshot(snap)

    if (jobTypeOptionsFlat.value.length) {
      treeData.value = markRaw(buildPickerTreeFromJobTypes(jobTypeOptionsFlat.value))
    } else {
      treeData.value = markRaw(buildPickerTreeFromProcessesOnly(snap))
    }

    selectedIds.value = []
    keyword.value = ''
    debouncedKeyword.value = ''
    await nextTick()
    const firstDept = treeData.value[0]
    const firstJob = firstDept?.children?.[0]
    if (firstJob?.department && firstJob?.jobType) {
      activeDepartment.value = firstJob.department
      activeJobType.value = firstJob.jobType
    } else {
      activeDepartment.value = ''
      activeJobType.value = ''
    }
    refreshFilteredTableRows()
  },
)

onBeforeUnmount(() => {
  cancelPendingJobTypeRequest()
  if (keywordDebounceTimer) {
    clearTimeout(keywordDebounceTimer)
    keywordDebounceTimer = null
  }
})
</script>

<style scoped>
.import-template-hint {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
  margin: 0 0 var(--space-sm);
  line-height: 1.5;
}

.production-picker-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  flex-wrap: wrap;
}

.picker-selected-summary {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
}

.production-picker-layout {
  --picker-row-height: 28px;
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: var(--space-sm);
}

.production-picker-tree {
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: var(--space-xs);
}

.production-picker-tree :deep(.el-tree-node__content) {
  height: var(--picker-row-height);
  line-height: var(--picker-row-height);
}

.picker-tree-node {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.production-picker-list {
  height: 360px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  padding: var(--space-xs);
  overflow: hidden;
}

.picker-search-input {
  margin-bottom: var(--space-xs);
}

.empty-hint {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
  margin: 0;
}

.picker-table-v2-wrap {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  overflow: hidden;
}

.picker-process-table-v2 {
  font-size: var(--font-size-caption);
}

.picker-name-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-wrap: wrap;
}

.picker-added-tag {
  color: var(--el-text-color-secondary);
}
</style>

<style>
.el-dialog.production-picker-dialog {
  resize: both;
  overflow: auto;
  min-width: 720px;
  min-height: 520px;
  max-width: 95vw;
  max-height: 90vh;
}
</style>
