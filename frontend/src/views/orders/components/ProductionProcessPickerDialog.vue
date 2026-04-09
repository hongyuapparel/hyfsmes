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
    </div>
    <div class="production-picker-layout">
      <div v-loading="jobTypesLoading" class="production-picker-tree">
        <el-tree
          :data="pickerTreeData"
          node-key="key"
          :expand-on-click-node="false"
          default-expand-all
          highlight-current
          @node-click="onPickerTreeNodeClick"
        >
          <template #default="{ data }">
            <span class="picker-tree-node">
              <span>{{ data.label }}</span>
              <span
                v-if="data.jobType && getPickerSelectedCountByJob(data.department, data.jobType) > 0"
                class="picker-tree-selected-count"
              >
                已选 {{ getPickerSelectedCountByJob(data.department, data.jobType) }}
              </span>
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
        <el-table
          :data="pickerProcessOptions"
          row-key="id"
          size="small"
          border
          height="300"
          class="picker-process-table"
        >
          <el-table-column label="选择" width="72" align="center" header-align="center">
            <template #default="{ row }">
              <el-checkbox
                :disabled="row.added"
                :model-value="pickerSelectedIdSet.has(row.id)"
                @change="(v) => onPickerProcessChecked(row.id, v === true)"
              />
            </template>
          </el-table-column>
          <el-table-column label="工序" min-width="260" align="center" header-align="center" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ row.name }}</span>
              <span v-if="row.added" class="picker-added-tag">（已添加）</span>
            </template>
          </el-table-column>
          <el-table-column label="价格(元)" width="110" align="center" header-align="center">
            <template #default="{ row }">
              {{ formatMoney(row.unitPrice) }}
            </template>
          </el-table-column>
        </el-table>
        <p v-if="!pickerProcessOptions.length" class="empty-hint">当前工种下暂无可选工序</p>
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
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { ProductionProcessItem } from '@/api/production-processes'
import { getSystemOptionsList, type SystemOptionItem } from '@/api/system-options'
import { formatDisplayNumber } from '@/utils/display-number'

const props = defineProps<{
  modelValue: boolean
  productionProcesses: ProductionProcessItem[]
  /** 订单成本表中已存在的工序 ID，用于标记「已添加」与去重 */
  addedProcessIds: number[]
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

const activeDepartment = ref('')
const activeJobType = ref('')
const selectedIds = ref<number[]>([])
const keyword = ref('')
const debouncedKeyword = ref('')
const appendSubmitting = ref(false)
/** 与「订单设置-生产工序」同源：process_job_types 扁平列表，用于左侧树与系统配置一致 */
const jobTypeOptionsFlat = ref<SystemOptionItem[]>([])
const jobTypesLoading = ref(false)
let keywordDebounceTimer: ReturnType<typeof setTimeout> | null = null
let jobTypesController: AbortController | null = null
let loadToken = 0
let jobTypeCache: SystemOptionItem[] | null = null

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return formatDisplayNumber(0)
  return formatDisplayNumber(n)
}

function getJobTypeLabel(v: string): string {
  if (!v) return ''
  const parts = v.split('>').map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : v
}

/** 仅从已有工序行推导树（无工种配置或接口失败时的兜底） */
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

/**
 * 与 order-settings 生产工序树一致：部门根下工种路径为 `部门 > 子 > 孙`，
 * 仅叶子工种节点可选（与懒加载树中「先有子工种则不出工序」一致）。
 */
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

  function collectLeaves(
    department: string,
    nodeId: number,
    pathPrefix: string,
  ): PickerTreeNode[] {
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

const pickerTreeData = computed<PickerTreeNode[]>(() => {
  if (jobTypeOptionsFlat.value.length) {
    return buildPickerTreeFromJobTypes(jobTypeOptionsFlat.value)
  }
  return buildPickerTreeFromProcessesOnly(props.productionProcesses)
})

const addedIdSet = computed(() => new Set(props.addedProcessIds))

const processById = computed(() => {
  const map = new Map<number, ProductionProcessItem>()
  props.productionProcesses.forEach((p) => {
    if (typeof p.id === 'number') map.set(p.id, p)
  })
  return map
})

const processPoolByDeptJob = computed(() => {
  const map = new Map<string, Array<{ id: number; name: string; nameLower: string; unitPrice: number }>>()
  props.productionProcesses.forEach((p) => {
    const dept = (p.department ?? '').trim()
    const job = (p.jobType ?? '').trim()
    const key = `${dept}::${job}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push({
      id: p.id,
      name: p.name || '未命名工序',
      nameLower: String(p.name ?? '').toLowerCase(),
      unitPrice: Number(p.unitPrice) || 0,
    })
  })
  return map
})

const pickerProcessOptions = computed(() => {
  const dept = activeDepartment.value.trim()
  const job = activeJobType.value.trim()
  const kw = debouncedKeyword.value.trim().toLowerCase()
  const key = `${dept}::${job}`
  const pool = processPoolByDeptJob.value.get(key) ?? []
  return pool
    .filter((p) => !kw || p.nameLower.includes(kw))
    .map((p) => ({
      id: p.id,
      name: p.name,
      added: addedIdSet.value.has(p.id),
      unitPrice: p.unitPrice,
    }))
})

/** O(1) 勾选判断，避免每格 selectedIds.includes */
const pickerSelectedIdSet = computed(() => new Set(selectedIds.value))

/** 仅遍历已选 ID，避免每次勾选全表工序 */
const pickerSelectedCountMap = computed(() => {
  const map = new Map<string, number>()
  for (const id of selectedIds.value) {
    const p = processById.value.get(id)
    if (!p) continue
    const d = (p.department ?? '').trim()
    const j = (p.jobType ?? '').trim()
    if (!d || !j) continue
    const key = `${d}::${j}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
})

function getPickerSelectedCountByJob(department: string, jobType: string): number {
  const key = `${(department ?? '').trim()}::${(jobType ?? '').trim()}`
  return pickerSelectedCountMap.value.get(key) ?? 0
}

function onPickerTreeNodeClick(node: PickerTreeNode) {
  if (!node?.jobType) return
  activeDepartment.value = node.department
  activeJobType.value = node.jobType
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
    const found = processById.value.get(id)
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
    const res = await getSystemOptionsList('process_job_types', { signal: controller.signal })
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
    selectedIds.value = []
    keyword.value = ''
    debouncedKeyword.value = ''
    await nextTick()
    const firstDept = pickerTreeData.value[0]
    const firstJob = firstDept?.children?.[0]
    if (firstJob?.department && firstJob?.jobType) {
      activeDepartment.value = firstJob.department
      activeJobType.value = firstJob.jobType
    } else {
      activeDepartment.value = ''
      activeJobType.value = ''
    }
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
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
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

.picker-tree-selected-count {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
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

.picker-process-table :deep(.el-table__header-wrapper .el-table__cell),
.picker-process-table :deep(.el-table__body-wrapper .el-table__cell) {
  height: var(--picker-row-height);
  padding-top: 0;
  padding-bottom: 0;
  box-sizing: border-box;
}

.picker-process-table :deep(.el-table__header-wrapper tr),
.picker-process-table :deep(.el-table__body-wrapper tr) {
  height: var(--picker-row-height);
}

.picker-process-table :deep(.el-table__header-wrapper .el-table__cell .cell),
.picker-process-table :deep(.el-table__body-wrapper .el-table__cell .cell) {
  height: var(--picker-row-height);
  line-height: var(--picker-row-height);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-sizing: border-box;
}

.picker-process-table :deep(.el-checkbox) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
