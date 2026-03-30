<template>
  <div class="page-card inventory-accessories-page">
    <el-tabs v-model="pageTab" class="inventory-tabs" @tab-change="onPageTabChange">
      <el-tab-pane label="库存" name="stock">
        <div class="filter-bar">
          <el-input
            v-model="filter.name"
            placeholder="名称"
            clearable
            size="large"
            class="filter-bar-item"
            :style="getTextFilterStyle('名称：', filter.name, nameLabelVisible)"
            :input-style="getFilterInputStyle(filter.name)"
            @input="debouncedSearch"
            @keyup.enter="onSearch(true)"
          >
            <template #prefix>
              <span
                v-if="filter.name && nameLabelVisible"
                :style="{ color: ACTIVE_FILTER_COLOR }"
              >
                名称：
              </span>
            </template>
          </el-input>
          <el-select
            v-model="filter.category"
            placeholder="类别"
            filterable
            clearable
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option
              v-for="opt in categoryOptions"
              :key="opt"
              :label="opt"
              :value="opt"
            />
          </el-select>
          <el-select
            v-model="filter.customerName"
            placeholder="客户"
            filterable
            clearable
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option
              v-for="opt in customerOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <el-select
            v-model="filter.salesperson"
            placeholder="业务员"
            filterable
            clearable
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option
              v-for="s in salespersonOptions"
              :key="s"
              :label="s"
              :value="s"
            />
          </el-select>
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
            <el-button size="large" @click="onReset">清空</el-button>
            <el-button type="primary" size="large" @click="openForm(null)">新增辅料</el-button>
            <el-button
              v-if="selectedRows.length"
              type="warning"
              size="large"
              :disabled="selectedRows.length !== 1"
              @click="openOutboundDialog"
            >
              出库
            </el-button>
          </div>
        </div>

        <div v-if="selectedRows.length" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

        <el-table
          ref="accessoriesStockTableRef"
          v-loading="loading"
          :data="list"
          border
          stripe
          class="accessories-table"
          @header-dragend="onAccessoriesStockHeaderDragEnd"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="46" fixed />
          <el-table-column label="图片" width="90" align="center">
            <template #default="{ row }">
              <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="table" />
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="category" label="类别" width="100" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="数量" width="90" align="center" header-align="center">
            <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }}</template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="70" align="center" header-align="center" />
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="createdAt" label="创建时间" width="160" align="center" header-align="center">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="info" size="small" @click="openDetail(row)">详情</el-button>
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
      </el-tab-pane>

      <el-tab-pane label="出库记录" name="outbounds">
        <div class="filter-bar">
          <el-input
            v-model="outboundFilter.orderNo"
            placeholder="订单号（自动出库）"
            clearable
            size="large"
            class="filter-bar-item"
            @keyup.enter="onOutboundSearch(true)"
          />
          <el-select
            v-model="outboundFilter.outboundType"
            placeholder="出库类型"
            clearable
            size="large"
            class="filter-bar-item"
            @change="onOutboundSearch(true)"
          >
            <el-option label="订单自动出库" value="order_auto" />
            <el-option label="手动出库" value="manual" />
          </el-select>
          <el-date-picker
            v-model="outboundFilter.dateRange"
            type="daterange"
            start-placeholder="出库时间"
            end-placeholder=""
            range-separator=""
            unlink-panels
            value-format="YYYY-MM-DD"
            :shortcuts="rangeShortcuts"
            size="large"
            :class="['filter-bar-item', { 'range-single': !(outboundFilter.dateRange && outboundFilter.dateRange.length === 2) }]"
            :style="getInventoryOutboundRangeStyle(outboundFilter.dateRange)"
            @change="onOutboundSearch(true)"
          />
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onOutboundSearch(true)">搜索</el-button>
            <el-button size="large" @click="onOutboundReset">清空</el-button>
          </div>
        </div>

        <el-table
          ref="accessoriesOutboundTableRef"
          v-loading="outboundLoading2"
          :data="outboundList"
          border
          stripe
          class="accessories-table"
          @header-dragend="onAccessoriesOutboundHeaderDragEnd"
        >
          <el-table-column prop="createdAt" label="时间" width="160" align="center">
            <template #default="{ row }">
              {{ row.createdAt }}
            </template>
          </el-table-column>
          <el-table-column prop="orderNo" label="订单号" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="图片" width="90" align="center">
            <template #default="{ row }">
              <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="table" />
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="customerName" label="客户" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="category" label="类别" width="100" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="出库类型" width="110" align="center" header-align="center">
            <template #default="{ row }">
              {{ row.outboundType === 'order_auto' ? '订单自动出库' : '手动出库' }}
            </template>
          </el-table-column>
          <el-table-column label="出库数量" width="100" align="center" header-align="center">
            <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }}</template>
          </el-table-column>
          <el-table-column prop="beforeQuantity" label="出库前库存" width="110" align="center" header-align="center" />
          <el-table-column prop="afterQuantity" label="出库后库存" width="110" align="center" header-align="center" />
          <el-table-column prop="operatorUsername" label="操作人" width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip align="center" header-align="center" />
        </el-table>

        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="outboundPagination.page"
            v-model:page-size="outboundPagination.pageSize"
            :total="outboundPagination.total"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @current-change="loadOutbounds"
            @size-change="onOutboundPageSizeChange"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="formDialog.visible"
      :title="formDialog.isEdit ? '编辑辅料' : '新增辅料'"
      width="480"
      destroy-on-close
      @close="resetForm"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="80px"
      >
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入名称" clearable />
        </el-form-item>
        <el-form-item label="类别" prop="category">
          <el-select
            v-model="form.category"
            placeholder="请选择类别（来自供应商设置）"
            filterable
            clearable
            style="width: 100%"
            :disabled="categoryOptions.length === 0"
          >
            <el-option
              v-for="opt in categoryOptions"
              :key="opt"
              :label="opt"
              :value="opt"
            />
          </el-select>
          <div v-if="categoryOptions.length === 0" class="category-empty-tip">
            暂无可选类别，请先在「系统设置 → 供应商设置 → 辅料供应商」中配置经营范围
          </div>
        </el-form-item>
        <el-form-item label="客户" prop="customerName">
          <el-select
            v-model="form.customerName"
            placeholder="请选择客户"
            filterable
            clearable
          >
            <el-option
              v-for="opt in customerOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="业务员" prop="salesperson" required>
          <el-select
            v-model="form.salesperson"
            placeholder="请选择业务员"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="s in salespersonOptions"
              :key="s"
              :label="s"
              :value="s"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <div class="qty-unit-row">
            <el-input-number
              v-model="form.quantity"
              :min="0"
              :precision="0"
              controls-position="right"
              class="qty-input"
            />
            <el-input
              v-model="form.unit"
              placeholder="单位（如个、卷）"
              clearable
              class="unit-input"
            />
          </div>
        </el-form-item>
        <el-form-item label="图片" prop="imageUrl">
          <ImageUploadArea v-model="form.imageUrl" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="formDialog.submitting" @click="submitForm">
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="outboundDialog.visible"
      title="辅料出库"
      width="480"
      destroy-on-close
      @close="resetOutboundDialog"
    >
      <el-form :model="outboundForm" :rules="outboundRules" ref="outboundFormRef" label-width="90px">
        <el-form-item label="辅料" prop="accessoryName">
          <el-input v-model="outboundForm.accessoryName" disabled />
        </el-form-item>
        <el-form-item label="领取人" prop="receiverUserId">
          <el-select
            v-model="outboundForm.receiverUserId"
            placeholder="请选择领取人"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="u in outboundUserOptions"
              :key="u.id"
              :label="u.displayName || u.username"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="出库数量" prop="quantity">
          <el-input-number
            v-model="outboundForm.quantity"
            :min="1"
            :max="outboundForm.maxQuantity"
            :precision="0"
            controls-position="right"
            style="width: 100%"
          />
          <div class="outbound-qty-tip">当前库存：{{ outboundForm.maxQuantity }}</div>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="outboundForm.remark" type="textarea" :rows="2" placeholder="备注（可选）" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="outboundDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="outboundDialog.submitting" @click="submitOutbound">
          确定出库
        </el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="detailDrawer.visible"
      title="辅料详情"
      size="560px"
      destroy-on-close
    >
      <div v-if="detailDrawer.row" class="detail-base">
        <div><span class="detail-label">名称：</span>{{ detailDrawer.row.name || '-' }}</div>
        <div><span class="detail-label">类别：</span>{{ detailDrawer.row.category || '-' }}</div>
        <div><span class="detail-label">客户：</span>{{ detailDrawer.row.customerName || '-' }}</div>
        <div><span class="detail-label">当前库存：</span>{{ formatDisplayNumber(detailDrawer.row.quantity) }} {{ detailDrawer.row.unit || '' }}</div>
        <div><span class="detail-label">备注：</span>{{ detailDrawer.row.remark || '-' }}</div>
      </div>
      <div class="detail-log-title">操作记录</div>
      <el-timeline v-loading="detailDrawer.loading">
        <el-timeline-item
          v-for="log in detailDrawer.logs"
          :key="log.id"
          :timestamp="formatDate(log.createdAt)"
          placement="top"
        >
          {{ formatLogAction(log.action) }}｜操作人：{{ log.operatorUsername || '-' }}{{ log.remark ? `｜备注：${log.remark}` : '' }}
        </el-timeline-item>
      </el-timeline>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { getCustomers, getSalespeople, type CustomerItem } from '@/api/customers'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import {
  getAccessoriesList,
  createAccessory,
  updateAccessory,
  getAccessoryOutboundUserOptions,
  manualAccessoryOutbound,
  getAccessoryOutboundRecords,
  getAccessoryOperationLogs,
  type AccessoryOutboundUserOption,
  type AccessoryOutboundRecord,
  type AccessoryOperationLog,
  type AccessoryItem,
} from '@/api/inventory'
import { getSystemOptionsTree, type SystemOptionTreeNode } from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getTextFilterStyle,
  getFilterRangeStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDateTime as formatDate } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'

const pageTab = ref<'stock' | 'outbounds'>('stock')
const filter = reactive({ name: '', category: '', customerName: '', salesperson: '' })
const nameLabelVisible = ref(false)
const list = ref<AccessoryItem[]>([])
const accessoriesStockTableRef = ref()
const accessoriesOutboundTableRef = ref()
const customerOptions = ref<{ label: string; value: string }[]>([])
const salespersonOptions = ref<string[]>([])
const categoryOptions = ref<string[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const selectedRows = ref<AccessoryItem[]>([])
const detailDrawer = reactive<{
  visible: boolean
  row: AccessoryItem | null
  loading: boolean
  logs: AccessoryOperationLog[]
}>({ visible: false, row: null, loading: false, logs: [] })

const outboundFilter = reactive<{
  orderNo: string
  outboundType: string
  dateRange: [string, string] | []
}>({ orderNo: '', outboundType: '', dateRange: [] })
const outboundList = ref<AccessoryOutboundRecord[]>([])
const outboundLoading2 = ref(false)
const outboundPagination = reactive({ page: 1, pageSize: 20, total: 0 })
const {
  onHeaderDragEnd: onAccessoriesStockHeaderDragEnd,
  restoreColumnWidths: restoreAccessoriesStockColumnWidths,
} = useTableColumnWidthPersist('inventory-accessories-stock')
const {
  onHeaderDragEnd: onAccessoriesOutboundHeaderDragEnd,
  restoreColumnWidths: restoreAccessoriesOutboundColumnWidths,
} = useTableColumnWidthPersist('inventory-accessories-outbounds')

function getInventoryOutboundRangeStyle(v: [string, string] | []) {
  const hasValue = Array.isArray(v) && v.length === 2
  if (!hasValue) return { ...getFilterRangeStyle(v), width: '160px', flex: '0 0 160px' }
  return { ...getFilterRangeStyle(v), width: '240px', flex: '0 0 240px' }
}

const formDialog = reactive<{ visible: boolean; submitting: boolean; isEdit: boolean }>({
  visible: false,
  submitting: false,
  isEdit: false,
})
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  name: '',
  category: '',
  quantity: 0,
  unit: '个',
  customerName: '',
  salesperson: '',
  imageUrl: '',
  remark: '',
})
const formRules: FormRules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  salesperson: [{ required: true, message: '请选择业务员', trigger: 'change' }],
}

async function load() {
  loading.value = true
  try {
    const res = await getAccessoriesList({
      name: filter.name || undefined,
      category: filter.category || undefined,
      customerName: filter.customerName || undefined,
      salesperson: filter.salesperson || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      restoreAccessoriesStockColumnWidths(accessoriesStockTableRef.value)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function onPageTabChange() {
  if (pageTab.value === 'outbounds') {
    outboundPagination.page = 1
    loadOutbounds()
  }
}

async function loadCustomerOptions() {
  try {
    const res = await getCustomers({ page: 1, pageSize: 200, sortBy: 'companyName', sortOrder: 'asc' })
    const list = (res.data?.list ?? []) as CustomerItem[]
    customerOptions.value = list.map((c) => ({
      label: c.companyName,
      value: c.companyName,
    }))
  } catch (e: unknown) {
    console.warn('客户选项加载失败')
  }
}

async function loadSalespersonOptions() {
  try {
    const res = await getSalespeople()
    salespersonOptions.value = (res.data ?? []).filter((v) => !!String(v ?? '').trim())
  } catch {
    salespersonOptions.value = []
  }
}

function onSearch(byUser = false) {
  if (byUser) {
    if (filter.name && String(filter.name).trim()) nameLabelVisible.value = true
  }
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
  filter.category = ''
  filter.customerName = ''
  filter.salesperson = ''
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function findNodeByValue(nodes: SystemOptionTreeNode[], value: string): SystemOptionTreeNode | null {
  for (const n of nodes) {
    if (n.value === value) return n
    if (n.children?.length) {
      const found = findNodeByValue(n.children, value)
      if (found) return found
    }
  }
  return null
}

async function loadCategoryOptions() {
  try {
    const res = await getSystemOptionsTree('supplier_types')
    const tree = res.data ?? []
    const accessoryRoot = findNodeByValue(tree, '辅料供应商')
    const scopes = (accessoryRoot?.children ?? []).map((c) => c.value).filter(Boolean)
    categoryOptions.value = scopes
  } catch (e: unknown) {
    categoryOptions.value = []
  }
}

function openForm(row: AccessoryItem | null) {
  formDialog.isEdit = !!row
  editId.value = row ? row.id : null
  if (row) {
    form.name = row.name
    form.category = row.category ?? ''
    form.quantity = row.quantity ?? 0
    form.unit = row.unit ?? '个'
    form.customerName = row.customerName ?? ''
    form.salesperson = row.salesperson ?? ''
    form.imageUrl = row.imageUrl ?? ''
    form.remark = row.remark ?? ''
  } else {
    form.name = ''
    form.category = ''
    form.quantity = 0
    form.unit = '个'
    form.customerName = ''
    form.salesperson = ''
    form.imageUrl = ''
    form.remark = ''
  }
  formDialog.visible = true
}

function resetForm() {
  formRef.value?.clearValidate()
}

async function submitForm() {
  await formRef.value?.validate().catch(() => {})
  formDialog.submitting = true
  try {
    if (formDialog.isEdit && editId.value != null) {
      await updateAccessory(editId.value, {
        name: form.name,
        category: form.category,
        quantity: form.quantity,
        unit: form.unit,
        customerName: form.customerName || undefined,
        salesperson: form.salesperson,
        imageUrl: form.imageUrl || undefined,
        remark: form.remark,
      })
      ElMessage.success('保存成功')
    } else {
      await createAccessory({
        name: form.name,
        category: form.category,
        quantity: form.quantity,
        unit: form.unit,
        customerName: form.customerName || undefined,
        salesperson: form.salesperson,
        imageUrl: form.imageUrl || undefined,
        remark: form.remark,
      })
      ElMessage.success('新增成功')
    }
    formDialog.visible = false
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    formDialog.submitting = false
  }
}

function onSelectionChange(rows: AccessoryItem[]) {
  selectedRows.value = rows ?? []
}

function formatLogAction(action: string) {
  if (action === 'create') return '新建'
  if (action === 'update') return '编辑'
  if (action === 'outbound') return '出库'
  if (action === 'delete') return '删除'
  return action || '操作'
}

async function openDetail(row: AccessoryItem) {
  detailDrawer.row = row
  detailDrawer.visible = true
  detailDrawer.loading = true
  try {
    const res = await getAccessoryOperationLogs(row.id)
    detailDrawer.logs = res.data ?? []
  } catch (e: unknown) {
    detailDrawer.logs = []
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    detailDrawer.loading = false
  }
}

const outboundDialog = reactive<{ visible: boolean; submitting: boolean }>({
  visible: false,
  submitting: false,
})
const outboundUserOptions = ref<AccessoryOutboundUserOption[]>([])
const outboundFormRef = ref<FormInstance>()
const outboundForm = reactive<{
  accessoryId: number | null
  accessoryName: string
  receiverUserId: number | null
  quantity: number
  maxQuantity: number
  remark: string
}>({
  accessoryId: null,
  accessoryName: '',
  receiverUserId: null,
  quantity: 1,
  maxQuantity: 0,
  remark: '',
})

const outboundRules: FormRules = {
  receiverUserId: [{ required: true, message: '请选择领取人', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入出库数量', trigger: 'blur' }],
}

async function ensureOutboundUserOptionsLoaded() {
  if (outboundUserOptions.value.length) return
  try {
    const res = await getAccessoryOutboundUserOptions()
    outboundUserOptions.value = res.data ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

async function openOutboundDialog() {
  if (selectedRows.value.length !== 1) {
    ElMessage.warning('请先选中 1 条辅料记录')
    return
  }
  const row = selectedRows.value[0]
  outboundForm.accessoryId = row.id
  outboundForm.accessoryName = row.name
  outboundForm.maxQuantity = Number(row.quantity) || 0
  outboundForm.quantity = outboundForm.maxQuantity > 0 ? 1 : 0
  outboundForm.receiverUserId = null
  outboundForm.remark = ''
  await ensureOutboundUserOptionsLoaded()
  outboundDialog.visible = true
}

function resetOutboundDialog() {
  outboundFormRef.value?.clearValidate()
}

async function submitOutbound() {
  if (!outboundForm.accessoryId) return
  await outboundFormRef.value?.validate().catch(() => {})
  if (!outboundForm.receiverUserId) return
  const receiver = outboundUserOptions.value.find((u) => u.id === outboundForm.receiverUserId)
  const receiverLabel = receiver ? (receiver.displayName || receiver.username) : ''
  if (!receiverLabel) {
    ElMessage.warning('领用人无效，请重新选择')
    return
  }
  const qty = Number(outboundForm.quantity) || 0
  if (qty <= 0) {
    ElMessage.warning('出库数量不合法')
    return
  }
  if (qty > (Number(outboundForm.maxQuantity) || 0)) {
    ElMessage.warning('出库数量不能大于当前库存')
    return
  }
  outboundDialog.submitting = true
  try {
    const remark = [`领取人：${receiverLabel}`, (outboundForm.remark ?? '').trim()].filter(Boolean).join('；')
    await manualAccessoryOutbound({
      accessoryId: outboundForm.accessoryId,
      quantity: qty,
      remark,
    })
    ElMessage.success('出库成功')
    outboundDialog.visible = false
    selectedRows.value = []
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    outboundDialog.submitting = false
  }
}

onMounted(() => {
  loadCustomerOptions()
  loadSalespersonOptions()
  loadCategoryOptions()
  load()
})

async function loadOutbounds() {
  outboundLoading2.value = true
  try {
    const res = await getAccessoryOutboundRecords({
      orderNo: outboundFilter.orderNo || undefined,
      outboundType: outboundFilter.outboundType || undefined,
      page: outboundPagination.page,
      pageSize: outboundPagination.pageSize,
    })
    const data = res.data
    outboundList.value = data?.list ?? []
    outboundPagination.total = data?.total ?? 0
    restoreAccessoriesOutboundColumnWidths(accessoriesOutboundTableRef.value)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    outboundLoading2.value = false
  }
}

function onOutboundSearch(_byUser = false) {
  outboundPagination.page = 1
  loadOutbounds()
}

function onOutboundReset() {
  outboundFilter.orderNo = ''
  outboundFilter.outboundType = ''
  outboundFilter.dateRange = []
  outboundPagination.page = 1
  loadOutbounds()
}

function onOutboundPageSizeChange() {
  outboundPagination.page = 1
  loadOutbounds()
}
</script>

<style scoped>
.inventory-accessories-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.category-empty-tip {
  margin-top: 6px;
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  line-height: 1.4;
}

.qty-unit-row {
  display: flex;
  gap: var(--space-sm);
  width: 100%;
}

.qty-input {
  flex: 1.2;
}

.unit-input {
  flex: 1;
}

.outbound-qty-tip {
  margin-top: 6px;
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  line-height: 1.2;
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.detail-base {
  display: grid;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-label {
  color: var(--color-text-muted);
}

.detail-log-title {
  margin: 8px 0 12px;
  font-weight: 600;
}

</style>
