<template>
  <div class="page-card suppliers-page">
    <div class="filter-bar">
      <el-input
        v-model="filter.name"
        placeholder="供应商名称"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getTextFilterStyle('供应商名称：', filter.name, nameLabelVisible)"
        :input-style="getFilterInputStyle(filter.name)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.name && nameLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            供应商名称：
          </span>
        </template>
      </el-input>
      <el-select
        v-model="filter.supplierTypeId"
        placeholder="供应商类型"
        clearable
        filterable
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.supplierTypeId != null
              ? `供应商类型：${findSupplierTypeLabelById(filter.supplierTypeId)}`
              : '供应商类型',
            filter.supplierTypeId != null
          )
        "
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.supplierTypeId != null">供应商类型：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in supplierTypeOptions"
          :key="opt.id"
          :label="opt.label"
          :value="opt.id"
        />
      </el-select>
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button v-if="selectedIds.length" type="danger" size="large" circle @click="onBatchDelete">
          <el-icon><Delete /></el-icon>
        </el-button>
        <el-button type="primary" size="large" @click="openForm(null)">新建供应商</el-button>
      </div>
    </div>

    <div v-if="selectedIds.length" class="table-selection-count">已选 {{ selectedIds.length }} 项</div>

    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      row-key="id"
      class="suppliers-table"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column label="供应商名称" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetailDrawer(row)">
            {{ row.name }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="供应商类型" width="100" show-overflow-tooltip>
        <template #default="{ row }">
          {{ findSupplierTypeLabelById(row.supplierTypeId) || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="业务范围" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">
          {{ formatBusinessScopes(row.businessScopeIds, row.businessScopeId) }}
        </template>
      </el-table-column>
      <el-table-column label="最近活跃时间" width="160" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.lastActiveAt) }}
        </template>
      </el-table-column>
      <el-table-column prop="contactPerson" label="联系人" width="90" show-overflow-tooltip />
      <el-table-column prop="contactInfo" label="联系电话" width="120" show-overflow-tooltip />
      <el-table-column prop="factoryAddress" label="工厂地址" min-width="140" show-overflow-tooltip />
      <el-table-column prop="settlementTime" label="结款时间" width="100" show-overflow-tooltip />
      <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
      <el-table-column label="操作" width="80" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openForm(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="onPageSizeChange"
      />
    </div>

    <el-dialog
      v-model="formDialog.visible"
      :title="formDialog.isEdit ? '编辑供应商' : '新建供应商'"
      width="560"
      destroy-on-close
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="供应商名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入供应商名称" clearable />
        </el-form-item>
      <el-form-item label="供应商类型" prop="supplierTypeId">
          <el-select
          v-model="form.supplierTypeId"
            placeholder="请选择供应商类型"
            clearable
            filterable
            style="width: 100%"
            @change="onFormTypeChange"
          >
            <el-option
              v-for="opt in supplierTypeOptions"
            :key="opt.id"
            :label="opt.label"
            :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="业务范围" prop="businessScopeIds">
          <el-tree-select
            v-model="form.businessScopeIds"
            placeholder="先选供应商类型后选择业务范围"
            clearable
            filterable
            multiple
            show-checkbox
            collapse-tags
            collapse-tags-tooltip
            :check-strictly="false"
            style="width: 100%"
            :disabled="!form.supplierTypeId"
            :data="businessScopeOptions"
            value-key="value"
            :props="{ label: 'label', value: 'value', children: 'children' }"
          />
        </el-form-item>
        <el-form-item label="联系人" prop="contactPerson">
          <el-input v-model="form.contactPerson" placeholder="联系人" clearable />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactInfo">
          <el-input v-model="form.contactInfo" placeholder="联系电话" clearable />
        </el-form-item>
        <el-form-item label="工厂地址" prop="factoryAddress">
          <el-input
            v-model="form.factoryAddress"
            placeholder="工厂地址"
            type="textarea"
            :rows="2"
            clearable
          />
        </el-form-item>
        <el-form-item label="结款时间" prop="settlementTime">
          <el-input
            v-model="form.settlementTime"
            placeholder="如月结30天、季结、货到付款"
            clearable
          />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input
            v-model="form.remark"
            type="textarea"
            :rows="2"
            maxlength="500"
            show-word-limit
            placeholder="备注"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="formDialog.submitting" @click="submitForm">
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="detailDrawer.visible"
      title="供应商详情"
      :size="`${detailDrawerWidth}px`"
      destroy-on-close
      class="supplier-detail-drawer"
    >
      <div class="detail-drawer-resizer" title="拖拽调整宽度" @mousedown="startResizeDetailDrawer" />
      <div v-loading="detailDrawer.loading" class="supplier-detail-wrap">
        <template v-if="detailDrawer.data">
          <div class="supplier-detail-grid">
            <div class="detail-label">供应商名称</div>
            <div class="detail-value">{{ detailDrawer.data.name || '-' }}</div>
            <div class="detail-label">供应商类型</div>
            <div class="detail-value">{{ findSupplierTypeLabelById(detailDrawer.data.supplierTypeId) || '-' }}</div>

            <div class="detail-label">业务范围</div>
            <div class="detail-value">
              <el-tag
                v-for="label in getScopeLabels(detailDrawer.data.businessScopeIds, detailDrawer.data.businessScopeId)"
                :key="label"
                size="small"
                class="scope-tag"
              >
                {{ label }}
              </el-tag>
              <span v-if="!getScopeLabels(detailDrawer.data.businessScopeIds, detailDrawer.data.businessScopeId).length">-</span>
            </div>
            <div class="detail-label">最近活跃时间</div>
            <div class="detail-value">{{ formatDateTime(detailDrawer.data.lastActiveAt) }}</div>

            <div class="detail-label">联系人</div>
            <div class="detail-value">{{ detailDrawer.data.contactPerson || '-' }}</div>
            <div class="detail-label">联系电话</div>
            <div class="detail-value">{{ detailDrawer.data.contactInfo || '-' }}</div>

            <div class="detail-label">工厂地址</div>
            <div class="detail-value">{{ detailDrawer.data.factoryAddress || '-' }}</div>
            <div class="detail-label">结款时间</div>
            <div class="detail-value">{{ detailDrawer.data.settlementTime || '-' }}</div>
            <div class="detail-label">备注</div>
            <div class="detail-value">{{ detailDrawer.data.remark || '-' }}</div>
          </div>

          <div class="recent-records">
            <div class="recent-title">最近合作记录（订单）</div>
            <el-table :data="detailDrawer.recentRecords" border size="small" empty-text="暂无合作记录">
              <el-table-column prop="orderNo" label="订单号" min-width="120" show-overflow-tooltip />
              <el-table-column prop="skuCode" label="SKU" min-width="120" show-overflow-tooltip />
              <el-table-column prop="refName" label="合作内容" min-width="140" show-overflow-tooltip />
              <el-table-column label="引用类型" width="90" align="center">
                <template #default="{ row }">{{ row.refType === 'material' ? '物料' : '工艺' }}</template>
              </el-table-column>
              <el-table-column label="下单时间" width="160" align="center">
                <template #default="{ row }">{{ formatDateTime(row.orderDate) }}</template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import {
  getSupplierList,
  getSupplierOne,
  getSupplierRecentRecords,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type SupplierItem,
  type SupplierRecentRecordItem,
} from '@/api/suppliers'
import { getSystemOptionsList, type SystemOptionItem } from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getTextFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDateTime } from '@/utils/date-format'

interface BusinessScopeTreeNode {
  id: number
  value: number
  label: string
  children?: BusinessScopeTreeNode[]
}

const supplierTypeOptions = ref<{ id: number; label: string }[]>([])
const businessScopeOptions = ref<BusinessScopeTreeNode[]>([])
const allSupplierOptions = ref<SystemOptionItem[]>([])
const businessScopeTreeByTypeId = ref<Record<number, BusinessScopeTreeNode[]>>({})
const businessScopeLabelById = ref<Record<number, string>>({})

const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }
function getFilterSelectAutoWidthStyle(labelText: string, active = false) {
  if (!labelText) return undefined
  const estimated = labelText.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return active
    ? { ...activeSelectStyle, width: `${width}px`, flex: `0 0 ${width}px` }
    : { width: `${width}px`, flex: `0 0 ${width}px` }
}

const filter = reactive<{ name: string; supplierTypeId: number | null }>({ name: '', supplierTypeId: null })
const nameLabelVisible = ref(false)
const list = ref<SupplierItem[]>([])
const selectedIds = ref<number[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const formDialog = reactive<{ visible: boolean; submitting: boolean; isEdit: boolean }>({
  visible: false,
  submitting: false,
  isEdit: false,
})
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<{
  name: string
  supplierTypeId: number | null
  businessScopeIds: number[]
  businessScopeId: number | null
  contactPerson: string
  contactInfo: string
  factoryAddress: string
  settlementTime: string
  remark: string
}>({
  name: '',
  supplierTypeId: null,
  businessScopeIds: [],
  businessScopeId: null,
  contactPerson: '',
  contactInfo: '',
  factoryAddress: '',
  settlementTime: '',
  remark: '',
})
const formRules: FormRules = {
  name: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }],
}

const DETAIL_DRAWER_MIN_WIDTH = 680
const DETAIL_DRAWER_DEFAULT_WIDTH = 860
const DETAIL_DRAWER_MAX_MARGIN = 48
const detailDrawerWidth = ref(DETAIL_DRAWER_DEFAULT_WIDTH)
const detailDrawer = reactive<{
  visible: boolean
  loading: boolean
  data: SupplierItem | null
  recentRecords: SupplierRecentRecordItem[]
}>({
  visible: false,
  loading: false,
  data: null,
  recentRecords: [],
})
const resizeMoveHandler = ref<((evt: MouseEvent) => void) | null>(null)
const resizeUpHandler = ref<(() => void) | null>(null)

function getScopeLabels(ids: number[] | null | undefined, fallbackId?: number | null): string[] {
  const labels = (Array.isArray(ids) ? ids : [])
    .map((id) => findBusinessScopeLabelById(id))
    .filter(Boolean)
  if (labels.length) return labels
  if (fallbackId != null) {
    const one = findBusinessScopeLabelById(fallbackId)
    return one ? [one] : []
  }
  return []
}

function onSelectionChange(rows: SupplierItem[]) {
  selectedIds.value = rows.map((r) => r.id)
}

function getDetailDrawerMaxWidth() {
  return Math.max(DETAIL_DRAWER_MIN_WIDTH, window.innerWidth - DETAIL_DRAWER_MAX_MARGIN)
}

function clampDetailDrawerWidth(width: number) {
  return Math.min(Math.max(width, DETAIL_DRAWER_MIN_WIDTH), getDetailDrawerMaxWidth())
}

function stopResizeDetailDrawer() {
  if (resizeMoveHandler.value) {
    window.removeEventListener('mousemove', resizeMoveHandler.value)
    resizeMoveHandler.value = null
  }
  if (resizeUpHandler.value) {
    window.removeEventListener('mouseup', resizeUpHandler.value)
    resizeUpHandler.value = null
  }
}

function startResizeDetailDrawer(e: MouseEvent) {
  e.preventDefault()
  const startX = e.clientX
  const startWidth = detailDrawerWidth.value
  const onMouseMove = (evt: MouseEvent) => {
    const delta = startX - evt.clientX
    detailDrawerWidth.value = clampDetailDrawerWidth(startWidth + delta)
  }
  const onMouseUp = () => stopResizeDetailDrawer()
  stopResizeDetailDrawer()
  resizeMoveHandler.value = onMouseMove
  resizeUpHandler.value = onMouseUp
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

async function openDetailDrawer(row: SupplierItem) {
  detailDrawer.visible = true
  detailDrawer.loading = true
  detailDrawer.data = null
  detailDrawer.recentRecords = []
  detailDrawerWidth.value = clampDetailDrawerWidth(detailDrawerWidth.value)
  try {
    const [oneRes, recentRes] = await Promise.all([
      getSupplierOne(row.id),
      getSupplierRecentRecords(row.id, 10),
    ])
    detailDrawer.data = oneRes.data ?? row
    detailDrawer.recentRecords = recentRes.data ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    detailDrawer.loading = false
  }
}

async function load() {
  loading.value = true
  try {
    const res = await getSupplierList({
      name: filter.name || undefined,
      supplierTypeId: filter.supplierTypeId ?? undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      selectedIds.value = []
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function onSearch(byUser = false) {
  if (byUser && filter.name && String(filter.name).trim()) nameLabelVisible.value = true
  pagination.page = 1
  load()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    onSearch(false)
  }, 400)
}

function onReset() {
  nameLabelVisible.value = false
  filter.name = ''
  filter.supplierTypeId = null
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

async function openForm(row: SupplierItem | null) {
  formDialog.isEdit = !!row
  editId.value = row ? row.id : null
  if (row) {
    form.name = row.name
    form.supplierTypeId = row.supplierTypeId ?? null
    form.businessScopeIds = Array.isArray(row.businessScopeIds)
      ? row.businessScopeIds
      : (row.businessScopeId != null ? [row.businessScopeId] : [])
    form.businessScopeId = form.businessScopeIds[0] ?? row.businessScopeId ?? null
    form.contactPerson = row.contactPerson ?? ''
    form.contactInfo = row.contactInfo ?? ''
    form.factoryAddress = row.factoryAddress ?? ''
    form.settlementTime = row.settlementTime ?? ''
    form.remark = row.remark ?? ''
  } else {
    form.name = ''
    form.supplierTypeId = null
    form.businessScopeIds = []
    form.businessScopeId = null
    form.contactPerson = ''
    form.contactInfo = ''
    form.factoryAddress = ''
    form.settlementTime = ''
    form.remark = ''
  }
  formDialog.visible = true
  if (form.supplierTypeId != null) await onFormTypeChange()
  else businessScopeOptions.value = []
}

function resetForm() {
  formRef.value?.clearValidate()
}

async function submitForm() {
  await formRef.value?.validate().catch(() => {})
  formDialog.submitting = true
  try {
    const typeTree =
      form.supplierTypeId != null
        ? (businessScopeTreeByTypeId.value[form.supplierTypeId] ?? [])
        : []
    const normalizedScopeIds = expandSelectedScopeIds(form.businessScopeIds, typeTree)
    if (formDialog.isEdit && editId.value != null) {
      await updateSupplier(editId.value, {
        name: form.name,
        supplierTypeId: form.supplierTypeId,
        businessScopeIds: normalizedScopeIds,
        businessScopeId: normalizedScopeIds[0] ?? null,
        contactPerson: form.contactPerson,
        contactInfo: form.contactInfo,
        factoryAddress: form.factoryAddress,
        settlementTime: form.settlementTime,
        remark: form.remark,
      })
      ElMessage.success('保存成功')
    } else {
      await createSupplier({
        name: form.name,
        supplierTypeId: form.supplierTypeId,
        businessScopeIds: normalizedScopeIds,
        businessScopeId: normalizedScopeIds[0] ?? null,
        contactPerson: form.contactPerson,
        contactInfo: form.contactInfo,
        factoryAddress: form.factoryAddress,
        settlementTime: form.settlementTime,
        remark: form.remark,
      })
      ElMessage.success('新建成功')
    }
    formDialog.visible = false
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    formDialog.submitting = false
  }
}

async function onBatchDelete() {
  if (!selectedIds.value.length) return
  try {
    await ElMessageBox.confirm(`确定删除已选 ${selectedIds.value.length} 条供应商记录？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    for (const id of selectedIds.value) {
      await deleteSupplier(id)
    }
    ElMessage.success('批量删除成功')
    load()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

function findSupplierTypeLabelById(id: number | null | undefined): string {
  if (id == null) return ''
  const item = supplierTypeOptions.value.find((o) => o.id === id)
  return item?.label ?? ''
}

function findBusinessScopeLabelById(id: number | null | undefined): string {
  if (id == null) return ''
  return businessScopeLabelById.value[id] ?? ''
}

function formatBusinessScopes(ids: number[] | null | undefined, fallbackId?: number | null): string {
  const selected = Array.isArray(ids) ? ids : []
  const labels = selected
    .map((id) => findBusinessScopeLabelById(id))
    .filter((v) => !!v)
  if (labels.length) return labels.join('、')
  if (fallbackId != null) return findBusinessScopeLabelById(fallbackId) || '-'
  return '-'
}

async function loadSupplierOptions() {
  try {
    const res = await getSystemOptionsList('supplier_types')
    const list = res.data ?? []
    allSupplierOptions.value = list

    const roots = list.filter((o) => o.parentId == null)
    supplierTypeOptions.value = roots.map((r) => ({ id: r.id, label: r.value }))

    const childrenByParent: Record<number, SystemOptionItem[]> = {}
    for (const opt of list) {
      if (opt.parentId == null) continue
      const pid = opt.parentId
      if (!childrenByParent[pid]) childrenByParent[pid] = []
      childrenByParent[pid].push(opt)
    }
    const nextTreeByTypeId: Record<number, BusinessScopeTreeNode[]> = {}
    const nextLabelById: Record<number, string> = {}

    const buildTree = (parentId: number, parentPath = ''): BusinessScopeTreeNode[] => {
      const children = childrenByParent[parentId] ?? []
      return children.map((n) => {
        const path = parentPath ? `${parentPath} / ${n.value}` : n.value
        nextLabelById[n.id] = path
        return {
          id: n.id,
          value: n.id,
          label: n.value,
          children: buildTree(n.id, path),
        }
      })
    }

    for (const root of roots) {
      nextTreeByTypeId[root.id] = buildTree(root.id)
    }
    businessScopeTreeByTypeId.value = nextTreeByTypeId
    businessScopeLabelById.value = nextLabelById
  } catch {
    allSupplierOptions.value = []
    supplierTypeOptions.value = []
    businessScopeTreeByTypeId.value = {}
    businessScopeLabelById.value = {}
  }
}

function onFormTypeChange() {
  if (!form.supplierTypeId) {
    businessScopeOptions.value = []
    form.businessScopeIds = []
    form.businessScopeId = null
    return
  }
  const tree = businessScopeTreeByTypeId.value[form.supplierTypeId] ?? []
  businessScopeOptions.value = tree
  const ids = new Set<number>()
  const stack = [...tree]
  while (stack.length) {
    const n = stack.shift()!
    ids.add(n.id)
    if (n.children?.length) stack.unshift(...n.children)
  }
  form.businessScopeIds = form.businessScopeIds.filter((id) => ids.has(id))
  form.businessScopeId = form.businessScopeIds[0] ?? null
}

function expandSelectedScopeIds(selectedIds: number[], tree: BusinessScopeTreeNode[]): number[] {
  if (!Array.isArray(selectedIds) || !selectedIds.length) return []
  const selected = new Set(selectedIds)
  const expanded = new Set<number>()
  const walk = (node: BusinessScopeTreeNode, inheritedSelected: boolean) => {
    const currentSelected = inheritedSelected || selected.has(node.id)
    if (currentSelected) expanded.add(node.id)
    if (node.children?.length) {
      for (const child of node.children) walk(child, currentSelected)
    }
  }
  for (const root of tree) walk(root, false)
  return [...expanded]
}

onMounted(async () => {
  await loadSupplierOptions()
  await load()
})

onBeforeUnmount(() => {
  stopResizeDetailDrawer()
})
</script>

<style scoped>
.suppliers-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.suppliers-table {
  margin-bottom: var(--space-md);
}

.table-selection-count {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 8px 0;
}

.supplier-detail-wrap {
  padding: 0 12px 12px 12px;
}

.supplier-detail-grid {
  display: grid;
  grid-template-columns: 110px minmax(0, 1fr) 110px minmax(0, 1fr);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
}

.detail-label,
.detail-value {
  padding: 10px;
  border-right: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
}

.detail-label {
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.detail-value {
  color: var(--el-text-color-regular);
  word-break: break-word;
}

.supplier-detail-grid > :nth-child(4n) {
  border-right: none;
}

.scope-tag {
  margin-right: 6px;
  margin-bottom: 6px;
}

.recent-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.detail-drawer-resizer {
  position: absolute;
  left: 0;
  top: 0;
  width: 10px;
  height: 100%;
  z-index: 10;
  cursor: ew-resize;
}

.detail-drawer-resizer:hover {
  background: rgba(64, 158, 255, 0.12);
}
</style>
