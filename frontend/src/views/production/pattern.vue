<template>
  <div class="page-card pattern-page">
    <!-- Tab：全部 / 待分单 / 打样中 / 订单完成 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in PATTERN_TABS"
            :key="tab.value"
            :label="tab.value"
          >
            {{ getTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 筛选区：与订单列表同一设计 -->
    <div class="filter-bar">
      <el-input
        v-model="filter.orderNo"
        placeholder="订单号"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getOrderNoFilterStyle(filter.orderNo, orderNoLabelVisible)"
        :input-style="getFilterInputStyle(filter.orderNo)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.orderNo && orderNoLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            订单号：
          </span>
        </template>
      </el-input>
      <el-input
        v-model="filter.skuCode"
        placeholder="SKU"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getSkuCodeFilterStyle(filter.skuCode, skuCodeLabelVisible)"
        :input-style="getFilterInputStyle(filter.skuCode)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.skuCode && skuCodeLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            SKU：
          </span>
        </template>
      </el-input>
      <el-tree-select
        v-model="filter.orderTypeId"
        :data="orderTypeTreeSelectData"
        placeholder="订单类型"
        filterable
        clearable
        default-expand-all
        :render-after-expand="false"
        node-key="value"
        :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.orderTypeId && `订单类型：${findOrderTypeLabelById(filter.orderTypeId)}`,
          )
        "
        @change="onSearch"
      >
        <template #prefix>
          <span v-if="filter.orderTypeId" :style="{ color: ACTIVE_FILTER_COLOR }">订单类型：</span>
        </template>
      </el-tree-select>
      <el-select
        v-model="filter.collaborationTypeId"
        placeholder="合作方式"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.collaborationTypeId && `合作方式：${findCollaborationLabelById(filter.collaborationTypeId)}`,
          )
        "
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.collaborationTypeId">合作方式：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in collaborationOptions"
          :key="opt.id"
          :label="opt.label"
          :value="opt.id"
        />
      </el-select>
      <el-select
        v-model="filter.purchaseStatus"
        placeholder="采购状态"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.purchaseStatus ? `采购状态：${purchaseStatusLabel(filter.purchaseStatus)}` : undefined)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.purchaseStatus">采购状态：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option label="全部" value="" />
        <el-option label="已完成" value="completed" />
        <el-option label="未完成" value="pending" />
      </el-select>
      <el-date-picker
        v-model="orderDateRange"
        type="daterange"
        range-separator=""
        start-placeholder="下单时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        unlink-panels
        size="large"
        class="filter-bar-item"
        :style="getFilterRangeStyle(orderDateRange)"
        @change="onSearch"
      />
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button size="large" :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button
          v-if="hasSelection"
          type="primary"
          size="large"
          @click="openAssignDialog"
        >
          分配纸样师和车版师
        </el-button>
        <el-button
          v-if="hasSelection && canCompleteSelection"
          type="success"
          size="large"
          @click="openCompleteDialog"
        >
          确认完成
        </el-button>
      </div>
    </div>

    <!-- 待纸样订单列表 -->
    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      class="pattern-table"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column prop="orderDate" label="下单时间" width="110" align="center">
        <template #default="{ row }">{{ formatDate(row.orderDate) }}</template>
      </el-table-column>
      <el-table-column prop="orderNo" label="订单号" min-width="100" show-overflow-tooltip />
      <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
      <el-table-column label="图片" width="72" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.imageUrl"
            :src="row.imageUrl"
            fit="cover"
            class="table-thumb"
            :preview-src-list="[row.imageUrl]"
          />
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="订单类型" width="100" show-overflow-tooltip>
        <template #default="{ row }">
          {{ orderTypeDisplay(row) }}
        </template>
      </el-table-column>
      <el-table-column prop="purchaseStatus" label="采购状态" width="96" align="center">
        <template #default="{ row }">
          <el-tag :type="row.purchaseStatus === 'completed' ? 'success' : 'info'" size="small">
            {{ row.purchaseStatus === 'completed' ? '已完成' : '未完成' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="合作方式" width="100" show-overflow-tooltip>
        <template #default="{ row }">
          {{ collaborationDisplay(row) }}
        </template>
      </el-table-column>
      <el-table-column prop="patternMaster" label="纸样师" width="90" show-overflow-tooltip />
      <el-table-column prop="sampleMaker" label="车版师" width="90" show-overflow-tooltip />
      <el-table-column prop="completedAt" label="完成时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.completedAt) }}</template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[20, 40, 60]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="onPageSizeChange"
      />
    </div>

    <!-- 分配纸样师和车版师弹窗 -->
    <el-dialog
      v-model="assignDialog.visible"
      title="分配纸样师和车版师"
      width="420"
      destroy-on-close
      @close="resetAssignForm"
    >
      <el-form
        ref="assignFormRef"
        :model="assignForm"
        :rules="assignRules"
        label-width="100px"
      >
        <el-form-item label="纸样师" prop="patternMaster">
          <el-select
            v-model="assignForm.patternMaster"
            placeholder="请选择纸样师"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="e in patternMasterOptions"
              :key="e.id"
              :label="e.name"
              :value="e.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="车版师" prop="sampleMaker">
          <el-select
            v-model="assignForm.sampleMaker"
            placeholder="请选择车版师"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="e in sampleMakerOptions"
              :key="e.id"
              :label="e.name"
              :value="e.name"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="assignDialog.submitting" @click="submitAssign">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 确认完成（上传样品图片）弹窗 -->
    <el-dialog
      v-model="completeDialog.visible"
      title="确认完成"
      width="480"
      destroy-on-close
      @close="resetCompleteForm"
    >
      <div v-if="completeDialog.row" class="complete-brief">
        <div>订单号：{{ completeDialog.row.orderNo }}</div>
        <div>SKU：{{ completeDialog.row.skuCode }}</div>
      </div>
      <div class="complete-hint">上传一张样品图片作为证据即可完成纸样</div>
      <el-form ref="completeFormRef" :model="completeForm" :rules="completeRules" label-width="100px">
        <el-form-item label="样品图片" prop="sampleImageUrl" required>
          <div
            class="sample-image-upload"
            @click="triggerSampleImageUpload"
          >
            <div v-if="completeForm.sampleImageUrl" class="image-preview-wrap">
              <el-image :src="completeForm.sampleImageUrl" fit="cover" :preview-src-list="[completeForm.sampleImageUrl]" />
              <el-button text type="danger" size="small" class="image-remove" @click.stop="clearSampleImage">移除</el-button>
            </div>
            <div v-else class="image-placeholder">
              <span>点击上传样品图片</span>
            </div>
          </div>
          <input
            ref="sampleImageFileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="hidden-file-input"
            @change="onSampleImageFileChange"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="completeDialog.submitting" :disabled="!completeForm.sampleImageUrl" @click="submitComplete">
          完成纸样
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { getPatternItems, assignPattern, completePattern, exportPatternItems, type PatternListItem, type PatternListQuery } from '@/api/production-pattern'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getDictTree, getDictItems } from '@/api/dicts'
import { uploadImage } from '@/api/uploads'
import type { SystemOptionTreeNode } from '@/api/system-options'
import { getEmployeeList, type EmployeeItem } from '@/api/hr'

const PATTERN_TABS = [
  { label: '全部', value: 'all' },
  { label: '待分单', value: 'pending_assign' },
  { label: '打样中', value: 'in_progress' },
  { label: '订单完成', value: 'completed' },
] as const

type PatternTabConfig = (typeof PATTERN_TABS)[number]

const orderTypeTree = ref<SystemOptionTreeNode[]>([])
const collaborationOptions = ref<{ id: number; label: string }[]>([])

function toOrderTypeTreeSelect(
  nodes: SystemOptionTreeNode[],
): { label: string; value: number; children?: unknown[]; disabled?: boolean }[] {
  return nodes.map((n) => {
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children) : []
    const hasChildren = children.length > 0
    return { label: n.value, value: n.id, children: hasChildren ? children : undefined, disabled: hasChildren }
  })
}
const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))

function findOrderTypeLabelById(id: number | null | undefined): string {
  if (!id) return ''
  const stack: SystemOptionTreeNode[] = [...orderTypeTree.value]
  while (stack.length) {
    const node = stack.pop()!
    if (node.id === id) return node.value
    if (node.children?.length) stack.push(...node.children)
  }
  return ''
}

function findCollaborationLabelById(id: number | null | undefined): string {
  if (!id) return ''
  const found = collaborationOptions.value.find((opt) => opt.id === id)
  return found?.label ?? ''
}
function purchaseStatusLabel(v: string): string {
  return v === 'completed' ? '已完成' : v === 'pending' ? '未完成' : v
}

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const DATE_RANGE_WIDTH_EMPTY = '140px'
const DATE_RANGE_WIDTH_FILLED = '220px'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeInputStyle = { color: ACTIVE_FILTER_COLOR }
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR as string }

function getFilterInputStyle(v: unknown) {
  return v ? activeInputStyle : undefined
}
function getFilterSelectAutoWidthStyle(v: unknown) {
  if (!v) return undefined
  const text = String(v)
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { ...activeSelectStyle, width: `${width}px`, flex: `0 0 ${width}px` }
}
function getOrderNoFilterStyle(orderNo: unknown, showLabel: boolean) {
  if (!orderNo || !showLabel) return undefined
  const text = `订单号：${String(orderNo)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}
function getSkuCodeFilterStyle(skuCode: unknown, showLabel: boolean) {
  if (!skuCode || !showLabel) return undefined
  const text = `SKU：${String(skuCode)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}
function getFilterRangeStyle(v: [string, string] | null) {
  const hasValue = v && v.length === 2
  const width = hasValue ? DATE_RANGE_WIDTH_FILLED : DATE_RANGE_WIDTH_EMPTY
  const base = { width, flex: `0 0 ${width}` }
  return hasValue ? { ...base, ...activeSelectStyle } : base
}

const filter = reactive({
  orderNo: '',
  skuCode: '',
  orderTypeId: null as number | null,
  collaborationTypeId: null as number | null,
  purchaseStatus: '',
})
const orderDateRange = ref<[string, string] | null>(null)
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)

const currentTab = ref<string>('all')
const tabCounts = ref<Record<string, number>>({})
const tabTotal = ref(0)
const list = ref<PatternListItem[]>([])
const loading = ref(false)
const exporting = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<PatternListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
const canCompleteSelection = computed(() =>
  selectedRows.value.length > 0 && selectedRows.value.every((r) => r.patternStatus !== 'completed'),
)

function getTabLabel(tab: PatternTabConfig): string {
  const counts = tabCounts.value
  const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
  return `${tab.label}(${count})`
}

const assignDialog = reactive<{ visible: boolean; submitting: boolean }>({ visible: false, submitting: false })
const assignFormRef = ref<FormInstance>()
const assignForm = reactive({ patternMaster: '', sampleMaker: '' })
const assignRules: FormRules = {
  patternMaster: [{ required: true, message: '请选择纸样师', trigger: 'change' }],
  sampleMaker: [{ required: true, message: '请选择车版师', trigger: 'change' }],
}

const patternMasterOptions = ref<EmployeeItem[]>([])
const sampleMakerOptions = ref<EmployeeItem[]>([])

const completeDialog = reactive<{ visible: boolean; submitting: boolean; row: PatternListItem | null }>({
  visible: false,
  submitting: false,
  row: null,
})
const completeFormRef = ref<FormInstance>()
const completeForm = reactive({ sampleImageUrl: '' })
const completeRules: FormRules = {
  sampleImageUrl: [{ required: true, message: '请上传样品图片', trigger: 'change' }],
}
const sampleImageFileInputRef = ref<HTMLInputElement | null>(null)
const sampleImageUploading = ref(false)

function formatDate(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('zh-CN')
}
function formatDateTime(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN')
}

function buildQuery(): PatternListQuery {
  const q: PatternListQuery = {
    tab: currentTab.value,
    orderNo: filter.orderNo || undefined,
    skuCode: filter.skuCode || undefined,
    orderTypeId: filter.orderTypeId ?? undefined,
    collaborationTypeId: filter.collaborationTypeId ?? undefined,
    purchaseStatus: filter.purchaseStatus || undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
  if (orderDateRange.value && orderDateRange.value.length === 2) {
    q.orderDateStart = orderDateRange.value[0]
    q.orderDateEnd = orderDateRange.value[1]
  }
  return q
}

async function loadTabCounts() {
  const base = buildQuery()
  base.page = 1
  base.pageSize = 1
  const counts: Record<string, number> = {}
  await Promise.all(
    PATTERN_TABS.map(async (tab) => {
      try {
        const res = await getPatternItems({ ...base, tab: tab.value })
        const data = res.data
        counts[tab.value] = data?.total ?? 0
      } catch {
        counts[tab.value] = 0
      }
    }),
  )
  tabCounts.value = counts
  tabTotal.value = counts.all ?? 0
}

async function load() {
  loading.value = true
  try {
    const res = await getPatternItems(buildQuery())
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

async function onExport() {
  const query = buildQuery()
  const { page, pageSize, ...rest } = query
  exporting.value = true
  try {
    const res = await exportPatternItems(rest)
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `纸样管理_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '导出失败'))
  } finally {
    exporting.value = false
  }
}

function onSearch(byUser = false) {
  if (byUser) {
    if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
    if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
  }
  pagination.page = 1
  load()
  void loadTabCounts()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { searchTimer = null; onSearch(false) }, 400)
}

function onReset() {
  orderNoLabelVisible.value = false
  skuCodeLabelVisible.value = false
  filter.orderNo = ''
  filter.skuCode = ''
  filter.orderTypeId = null
  filter.collaborationTypeId = null
  filter.purchaseStatus = ''
  orderDateRange.value = null
  currentTab.value = 'all'
  pagination.page = 1
  selectedRows.value = []
  load()
  void loadTabCounts()
}

function onTabChange() {
  pagination.page = 1
  selectedRows.value = []
  load()
  void loadTabCounts()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function onSelectionChange(rows: PatternListItem[]) {
  selectedRows.value = rows
}

function openAssignDialog() {
  if (selectedRows.value.length === 0) return
  assignForm.patternMaster = selectedRows.value[0].patternMaster ?? ''
  assignForm.sampleMaker = selectedRows.value[0].sampleMaker ?? ''
  assignDialog.visible = true
}

function resetAssignForm() {
  assignForm.patternMaster = ''
  assignForm.sampleMaker = ''
  assignFormRef.value?.clearValidate()
}

async function submitAssign() {
  await assignFormRef.value?.validate().catch(() => {})
  if (selectedRows.value.length === 0) return
  assignDialog.submitting = true
  try {
    for (const row of selectedRows.value) {
      await assignPattern({
        orderId: row.orderId,
        patternMaster: assignForm.patternMaster,
        sampleMaker: assignForm.sampleMaker,
      })
    }
    ElMessage.success('分配成功')
    assignDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '分配失败'))
  } finally {
    assignDialog.submitting = false
  }
}

function openCompleteDialog() {
  if (selectedRows.value.length === 0) return
  completeDialog.row = selectedRows.value[0]
  completeForm.sampleImageUrl = ''
  completeDialog.visible = true
}

function resetCompleteForm() {
  completeDialog.row = null
  completeForm.sampleImageUrl = ''
  completeFormRef.value?.clearValidate()
  if (sampleImageFileInputRef.value) sampleImageFileInputRef.value.value = ''
}

function triggerSampleImageUpload() {
  sampleImageFileInputRef.value?.click()
}

function clearSampleImage() {
  completeForm.sampleImageUrl = ''
  if (sampleImageFileInputRef.value) sampleImageFileInputRef.value.value = ''
}

async function onSampleImageFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  sampleImageUploading.value = true
  try {
    const url = await uploadImage(file)
    completeForm.sampleImageUrl = url
    completeFormRef.value?.validateField('sampleImageUrl').catch(() => {})
  } catch (err) {
    if (!isErrorHandled(err)) ElMessage.error(getErrorMessage(err, '上传失败'))
  } finally {
    sampleImageUploading.value = false
    target.value = ''
  }
}

async function submitComplete() {
  if (!completeDialog.row || !completeForm.sampleImageUrl) return
  completeDialog.submitting = true
  try {
    await completePattern({
      orderId: completeDialog.row.orderId,
      sampleImageUrl: completeForm.sampleImageUrl,
    })
    ElMessage.success('纸样已完成，订单已进入待采购')
    completeDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
  } finally {
    completeDialog.submitting = false
  }
}

async function loadOptions() {
  try {
    const [orderTypeRes, collabRes] = await Promise.all([
      getDictTree('order_types'),
      getDictItems('collaboration'),
    ])
    orderTypeTree.value = Array.isArray(orderTypeRes.data) ? orderTypeRes.data : []
    const items = collabRes.data ?? []
    collaborationOptions.value = (Array.isArray(items) ? items : []).map((item: any) => ({
      id: item.id,
      label: item.value,
    }))
  } catch {
    orderTypeTree.value = []
    collaborationOptions.value = []
  }
}

function orderTypeDisplay(row: PatternListItem): string {
  if (typeof row.orderTypeId === 'number') {
    const label = findOrderTypeLabelById(row.orderTypeId)
    if (label && label.trim()) return label.trim()
  }
  return ''
}

function collaborationDisplay(row: PatternListItem): string {
  if (typeof row.collaborationTypeId === 'number') {
    const label = findCollaborationLabelById(row.collaborationTypeId)
    if (label && label.trim()) return label.trim()
  }
  return ''
}

async function loadPatternStaffOptions() {
  try {
    const res = await getEmployeeList({ status: 'active', page: 1, pageSize: 200 })
    const data = res.data
    const employees = data?.list ?? []
    patternMasterOptions.value = employees.filter((e) => e.jobTitleName === '纸样师')
    sampleMakerOptions.value = employees.filter((e) => e.jobTitleName === '车版师')
  } catch {
    patternMasterOptions.value = []
    sampleMakerOptions.value = []
  }
}

onMounted(() => {
  loadOptions()
  load()
  void loadTabCounts()
  void loadPatternStaffOptions()
})
</script>

<style scoped>
.pattern-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.status-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.status-tabs-left {
  flex-shrink: 0;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-sm);
  padding: var(--space-sm);
  margin-bottom: var(--space-md);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg-subtle, #f5f6f8);
}

.filter-bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

.pattern-table {
  margin-bottom: var(--space-md);
}

.table-thumb {
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  display: block;
}

.text-muted {
  color: var(--el-text-color-secondary);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
}

.complete-brief {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  font-size: var(--font-size-caption, 12px);
}

.complete-brief > div + div {
  margin-top: 4px;
}

.complete-hint {
  margin-bottom: var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption, 12px);
}

.sample-image-upload {
  border: 1px dashed var(--el-border-color);
  border-radius: var(--radius);
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: var(--el-fill-color-lighter);
}

.sample-image-upload:hover {
  border-color: var(--el-color-primary);
}

.image-preview-wrap {
  position: relative;
  width: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-wrap :deep(.el-image) {
  max-width: 200px;
  max-height: 200px;
  border-radius: var(--radius);
}

.image-remove {
  position: absolute;
  top: 8px;
  right: 8px;
}

.image-placeholder {
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption, 12px);
}

.hidden-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
