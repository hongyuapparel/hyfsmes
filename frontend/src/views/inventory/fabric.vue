<template>
  <div class="page-card page-card--fill inventory-fabric-page">
    <el-tabs v-model="pageTab" class="inventory-tabs list-page-tabs" @tab-change="onPageTabChange">
      <el-tab-pane label="库存" name="stock">
        <div class="tab-pane-scroll">
        <div class="filter-bar">
          <el-input
            v-model="filter.name"
            placeholder="面料名称"
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
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
            <el-button size="large" @click="onReset">清空</el-button>
            <el-button type="primary" size="large" @click="openForm(null)">新增面料</el-button>
            <el-button
              v-if="selectedRows.length"
              type="warning"
              size="large"
              :disabled="selectedRows.length !== 1"
              @click="openOutboundDialog()"
            >
              出库
            </el-button>
          </div>
        </div>

        <div ref="fabricStockShellRef" class="list-page-table-shell">
        <el-table
          ref="fabricStockTableRef"
          v-loading="loading"
          :data="list"
          border
          stripe
          class="fabric-table"
          :height="fabricStockTableHeight"
          @header-dragend="onFabricStockHeaderDragEnd"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="48" align="center" header-align="center" />
          <el-table-column label="图片" width="90" align="center" header-align="center">
            <template #default="{ row }">
              <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="table" />
              <span v-else class="text-placeholder">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="面料名称" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="数量" width="100" align="center" header-align="center">
            <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }}</template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="70" align="center" header-align="center" />
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="createdAt" label="创建时间" width="160" align="center" header-align="center">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center" header-align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="info" size="small" @click="openDetail(row)">详情</el-button>
              <el-button link type="primary" size="small" @click="openForm(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>
        </div>

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
        </div>
      </el-tab-pane>

      <el-tab-pane label="出库记录" name="outbounds">
        <div class="tab-pane-scroll">
        <div class="filter-bar">
          <el-input v-model="outboundFilter.name" placeholder="面料名称" clearable size="large" class="filter-bar-item" @keyup.enter="onOutboundSearch(true)" />
          <el-select v-model="outboundFilter.customerName" placeholder="客户" filterable clearable size="large" class="filter-bar-item" @change="onOutboundSearch(true)">
            <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
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

        <div ref="fabricOutboundShellRef" class="list-page-table-shell">
        <el-table
          ref="fabricOutboundTableRef"
          v-loading="outboundLoading2"
          :data="outboundList"
          border
          stripe
          class="fabric-table"
          :height="fabricOutboundTableHeight"
          @header-dragend="onFabricOutboundHeaderDragEnd"
        >
          <el-table-column prop="createdAt" label="时间" width="160" align="center" header-align="center" />
          <el-table-column prop="name" label="面料名称" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="出库数量" width="110" align="center" header-align="center">
            <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }} {{ row.unit }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="照片" width="90" align="center" header-align="center">
            <template #default="{ row }">
              <AppImageThumb v-if="row.photoUrl" :raw-url="row.photoUrl" variant="table" />
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
        </div>

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
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="formDialog.visible"
      :title="formDialog.isEdit ? '编辑面料' : '新增面料'"
      width="480"
      destroy-on-close
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="面料名称/编号" clearable />
        </el-form-item>
        <el-form-item label="数量" prop="quantity">
          <el-input-number
            v-model="form.quantity"
            :min="0"
            :precision="2"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="单位" prop="unit">
          <el-input v-model="form.unit" placeholder="如米、公斤" clearable />
        </el-form-item>
        <el-form-item label="客户">
          <el-select
            v-model="form.customerName"
            placeholder="请选择客户（可选）"
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
      title="面料出库"
      width="500"
      destroy-on-close
      @close="resetOutboundForm"
    >
      <el-form
        ref="outboundFormRef"
        :model="outboundForm"
        :rules="outboundRules"
        label-width="90px"
      >
        <el-form-item label="出库数量" prop="quantity">
          <el-input-number
            v-model="outboundForm.quantity"
            :min="0.01"
            :max="outboundMaxQty"
            :precision="2"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="拍照" prop="photoUrl" required>
          <ImageUploadArea v-model="outboundForm.photoUrl" :compact="false" />
        </el-form-item>
        <el-form-item label="备注" prop="remark" required>
          <el-input
            v-model="outboundForm.remark"
            type="textarea"
            :rows="3"
            placeholder="请填写谁领走以及用途"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="outboundDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="outboundDialog.submitting"
          :disabled="!outboundForm.photoUrl || !outboundForm.remark?.trim()"
          @click="submitOutbound"
        >
          确定出库
        </el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="detailDrawer.visible"
      title="面料详情"
      size="560px"
      destroy-on-close
    >
      <div v-if="detailDrawer.row" class="detail-base">
        <div><span class="detail-label">名称：</span>{{ detailDrawer.row.name || '-' }}</div>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { getCustomers, type CustomerItem } from '@/api/customers'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import {
  getFabricList,
  createFabric,
  updateFabric,
  fabricOutbound,
  getFabricOutboundRecords,
  getFabricOperationLogs,
  type FabricItem,
  type FabricOutboundRecord,
  type FabricOperationLog,
} from '@/api/inventory'
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
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'

const filter = reactive({ name: '', customerName: '' })
const nameLabelVisible = ref(false)
const list = ref<FabricItem[]>([])
const fabricStockTableRef = ref()
const fabricOutboundTableRef = ref()
const fabricStockShellRef = ref<HTMLElement | null>(null)
const fabricOutboundShellRef = ref<HTMLElement | null>(null)
const { tableHeight: fabricStockTableHeight } = useFlexShellTableHeight(fabricStockShellRef)
const { tableHeight: fabricOutboundTableHeight } = useFlexShellTableHeight(fabricOutboundShellRef)
const customerOptions = ref<{ label: string; value: string }[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<FabricItem[]>([])
const detailDrawer = reactive<{
  visible: boolean
  row: FabricItem | null
  loading: boolean
  logs: FabricOperationLog[]
}>({ visible: false, row: null, loading: false, logs: [] })

const pageTab = ref<'stock' | 'outbounds'>('stock')
const outboundFilter = reactive<{
  name: string
  customerName: string
  dateRange: [string, string] | []
}>({ name: '', customerName: '', dateRange: [] })
const outboundList = ref<FabricOutboundRecord[]>([])
const outboundLoading2 = ref(false)
const outboundPagination = reactive({ page: 1, pageSize: 20, total: 0 })
const { onHeaderDragEnd: onFabricStockHeaderDragEnd, restoreColumnWidths: restoreFabricStockColumnWidths } =
  useTableColumnWidthPersist('inventory-fabric-stock')
const { onHeaderDragEnd: onFabricOutboundHeaderDragEnd, restoreColumnWidths: restoreFabricOutboundColumnWidths } =
  useTableColumnWidthPersist('inventory-fabric-outbounds')

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
  quantity: 0,
  unit: '米',
  customerName: '',
  imageUrl: '',
  remark: '',
})
const formRules: FormRules = {
  name: [{ required: true, message: '请输入面料名称', trigger: 'blur' }],
}

const outboundDialog = reactive<{
  visible: boolean
  submitting: boolean
  row: FabricItem | null
}>({ visible: false, submitting: false, row: null })
const outboundFormRef = ref<FormInstance>()
const outboundForm = reactive({ quantity: 0, photoUrl: '', remark: '' })
const outboundRules: FormRules = {
  quantity: [{ required: true, message: '请输入出库数量', trigger: 'blur' }],
  remark: [{ required: true, message: '请填写谁领走及用途', trigger: 'blur' }],
}
const outboundMaxQty = computed(() => {
  const row = outboundDialog.row
  if (!row) return 0
  const q = parseFloat(String(row.quantity))
  return Number.isFinite(q) ? q : 0
})

async function load() {
  loading.value = true
  try {
    const res = await getFabricList({
      name: filter.name || undefined,
      customerName: filter.customerName || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      restoreFabricStockColumnWidths(fabricStockTableRef.value)
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
  filter.customerName = ''
  pagination.page = 1
  load()
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

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function onSelectionChange(rows: FabricItem[]) {
  selectedRows.value = rows ?? []
}

function openForm(row: FabricItem | null) {
  formDialog.isEdit = !!row
  editId.value = row ? row.id : null
  if (row) {
    form.name = row.name
    form.quantity = parseFloat(String(row.quantity)) || 0
    form.unit = row.unit ?? '米'
    form.customerName = row.customerName ?? ''
    form.imageUrl = row.imageUrl ?? ''
    form.remark = row.remark ?? ''
  } else {
    form.name = ''
    form.quantity = 0
    form.unit = '米'
    form.customerName = ''
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
      await updateFabric(editId.value, {
        name: form.name,
        quantity: form.quantity,
        unit: form.unit,
        customerName: form.customerName || undefined,
        imageUrl: form.imageUrl || undefined,
        remark: form.remark,
      })
      ElMessage.success('保存成功')
    } else {
      await createFabric({
        name: form.name,
        quantity: form.quantity,
        unit: form.unit,
        customerName: form.customerName || undefined,
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

function formatLogAction(action: string) {
  if (action === 'create') return '新建'
  if (action === 'update') return '编辑'
  if (action === 'outbound') return '出库'
  if (action === 'delete') return '删除'
  return action || '操作'
}

async function openDetail(row: FabricItem) {
  detailDrawer.row = row
  detailDrawer.visible = true
  detailDrawer.loading = true
  try {
    const res = await getFabricOperationLogs(row.id)
    detailDrawer.logs = res.data ?? []
  } catch (e: unknown) {
    detailDrawer.logs = []
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    detailDrawer.loading = false
  }
}

function openOutboundDialog(row?: FabricItem) {
  const target = row ?? selectedRows.value[0]
  if (!target) {
    ElMessage.warning('请先选中 1 条面料记录')
    return
  }
  outboundDialog.row = target
  const q = parseFloat(String(target.quantity))
  outboundForm.quantity = Number.isFinite(q) && q > 0 ? Math.min(1, q) : 0
  outboundForm.photoUrl = ''
  outboundForm.remark = ''
  outboundDialog.visible = true
}

function resetOutboundForm() {
  outboundDialog.row = null
  outboundForm.quantity = 0
  outboundForm.photoUrl = ''
  outboundForm.remark = ''
  outboundFormRef.value?.clearValidate()
}

async function submitOutbound() {
  if (!outboundDialog.row) return
  if (!outboundForm.photoUrl || !outboundForm.remark?.trim()) {
    ElMessage.warning('请上传出库照片并填写备注（谁领走、用途）')
    return
  }
  await outboundFormRef.value?.validate().catch(() => {})
  outboundDialog.submitting = true
  try {
    await fabricOutbound({
      id: outboundDialog.row.id,
      quantity: outboundForm.quantity,
      photoUrl: outboundForm.photoUrl,
      remark: outboundForm.remark,
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
  load()
})

async function loadOutbounds() {
  outboundLoading2.value = true
  try {
    const [startDate, endDate] = Array.isArray(outboundFilter.dateRange) && outboundFilter.dateRange.length === 2 ? outboundFilter.dateRange : ['', '']
    const res = await getFabricOutboundRecords({
      name: outboundFilter.name || undefined,
      customerName: outboundFilter.customerName || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: outboundPagination.page,
      pageSize: outboundPagination.pageSize,
    })
    const data = res.data
    outboundList.value = data?.list ?? []
    outboundPagination.total = data?.total ?? 0
    restoreFabricOutboundColumnWidths(fabricOutboundTableRef.value)
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
  outboundFilter.name = ''
  outboundFilter.customerName = ''
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
.inventory-fabric-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.inventory-fabric-page .fabric-table {
  flex: 1;
  min-height: 0;
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
