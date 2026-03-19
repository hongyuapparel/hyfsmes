<template>
  <div class="page-card inventory-fabric-page">
    <el-tabs v-model="pageTab" class="inventory-tabs" @tab-change="onPageTabChange">
      <el-tab-pane label="库存" name="stock">
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
          </div>
        </div>

        <el-table v-loading="loading" :data="list" border stripe class="fabric-table">
          <el-table-column prop="name" label="面料名称" min-width="120" show-overflow-tooltip />
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip />
          <el-table-column prop="quantity" label="数量" width="100" align="right" />
          <el-table-column prop="unit" label="单位" width="70" align="center" />
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
          <el-table-column label="图片" width="90" align="center">
            <template #default="{ row }">
              <el-image
                v-if="row.imageUrl"
                :src="row.imageUrl"
                fit="cover"
                style="width: 56px; height: 56px; border-radius: 6px"
                :preview-src-list="[row.imageUrl]"
                preview-teleported
              />
              <span v-else class="text-placeholder">-</span>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="160" align="center">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="160" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openForm(row)">编辑</el-button>
              <el-button link type="warning" size="small" @click="openOutboundDialog(row)">出库</el-button>
              <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
            </template>
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
      </el-tab-pane>

      <el-tab-pane label="出库记录" name="outbounds">
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
            :style="getFilterRangeStyle(outboundFilter.dateRange)"
            @change="onOutboundSearch(true)"
          />
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onOutboundSearch(true)">搜索</el-button>
            <el-button size="large" @click="onOutboundReset">清空</el-button>
          </div>
        </div>

        <el-table v-loading="outboundLoading2" :data="outboundList" border stripe class="fabric-table">
          <el-table-column prop="createdAt" label="时间" width="160" align="center" />
          <el-table-column prop="name" label="面料名称" min-width="140" show-overflow-tooltip />
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip />
          <el-table-column label="出库数量" width="110" align="right">
            <template #default="{ row }">{{ row.quantity }} {{ row.unit }}</template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
          <el-table-column label="照片" width="90" align="center">
            <template #default="{ row }">
              <el-image
                v-if="row.photoUrl"
                :src="row.photoUrl"
                fit="cover"
                style="width: 56px; height: 56px; border-radius: 6px"
                :preview-src-list="[row.photoUrl]"
                preview-teleported
              />
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="outboundPagination.page"
            v-model:page-size="outboundPagination.pageSize"
            :total="outboundPagination.total"
            :page-sizes="[20, 40, 60]"
            layout="total, sizes, prev, pager, next"
            @current-change="loadOutbounds"
            @size-change="onOutboundPageSizeChange"
          />
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
          <div class="outbound-photo-wrap">
            <input
              ref="outboundPhotoInputRef"
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              class="hidden-file-input"
              @change="onOutboundPhotoChange"
            />
            <div
              v-if="!outboundForm.photoUrl"
              class="outbound-photo-area"
              @click="outboundPhotoInputRef?.click()"
            >
              <span v-if="outboundPhotoUploading">上传中...</span>
              <span v-else>点击上传出库照片</span>
            </div>
            <div v-else class="outbound-photo-preview">
              <el-image :src="outboundForm.photoUrl" fit="contain" style="height: 120px" />
              <el-button type="primary" link size="small" @click="outboundPhotoInputRef?.click()">
                重新上传
              </el-button>
            </div>
          </div>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { getCustomers, type CustomerItem } from '@/api/customers'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import {
  getFabricList,
  createFabric,
  updateFabric,
  deleteFabric,
  fabricOutbound,
  getFabricOutboundRecords,
  type FabricItem,
  type FabricOutboundRecord,
} from '@/api/inventory'
import { uploadOutboundImage } from '@/api/uploads'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const DATE_RANGE_WIDTH_EMPTY = '140px'
const DATE_RANGE_WIDTH_FILLED = '220px'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }

function getFilterInputStyle(v: unknown) {
  return v ? { color: ACTIVE_FILTER_COLOR } : undefined
}
function getTextFilterStyle(prefix: string, val: unknown, showLabel: boolean) {
  if (!val || !showLabel) return undefined
  const text = prefix + String(val)
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}
function getFilterRangeStyle(v: [string, string] | []) {
  const hasValue = Array.isArray(v) && v.length === 2
  const width = hasValue ? DATE_RANGE_WIDTH_FILLED : DATE_RANGE_WIDTH_EMPTY
  const base = { width, flex: `0 0 ${width}` }
  return hasValue ? { ...base, ...activeSelectStyle } : base
}

const filter = reactive({ name: '', customerName: '' })
const nameLabelVisible = ref(false)
const list = ref<FabricItem[]>([])
const customerOptions = ref<{ label: string; value: string }[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const pageTab = ref<'stock' | 'outbounds'>('stock')
const outboundFilter = reactive<{
  name: string
  customerName: string
  dateRange: [string, string] | []
}>({ name: '', customerName: '', dateRange: [] })
const outboundList = ref<FabricOutboundRecord[]>([])
const outboundLoading2 = ref(false)
const outboundPagination = reactive({ page: 1, pageSize: 20, total: 0 })

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
const outboundPhotoInputRef = ref<HTMLInputElement | null>(null)
const outboundPhotoUploading = ref(false)

function formatDate(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN')
}

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

function openForm(row: FabricItem | null) {
  formDialog.isEdit = !!row
  editId.value = row ? row.id : null
  if (row) {
    form.name = row.name
    form.quantity = parseFloat(String(row.quantity)) || 0
    form.unit = row.unit ?? '米'
    form.imageUrl = row.imageUrl ?? ''
    form.remark = row.remark ?? ''
  } else {
    form.name = ''
    form.quantity = 0
    form.unit = '米'
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
        imageUrl: form.imageUrl || undefined,
        remark: form.remark,
      })
      ElMessage.success('保存成功')
    } else {
      await createFabric({
        name: form.name,
        quantity: form.quantity,
        unit: form.unit,
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

async function onDelete(row: FabricItem) {
  try {
    await ElMessageBox.confirm('确定删除该面料记录？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteFabric(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

function openOutboundDialog(row: FabricItem) {
  outboundDialog.row = row
  const q = parseFloat(String(row.quantity))
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

async function onOutboundPhotoChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  outboundPhotoUploading.value = true
  try {
    const url = await uploadOutboundImage(file)
    outboundForm.photoUrl = url
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '上传失败'))
  } finally {
    outboundPhotoUploading.value = false
    input.value = ''
  }
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
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    outboundDialog.submitting = false
  }
}

onMounted(() => load())

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
.inventory-fabric-page .fabric-table {
  margin-bottom: var(--space-md);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
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

.range-single.el-date-editor--daterange :deep(.el-range-separator) {
  width: 0;
}
.range-single.el-date-editor--daterange :deep(.el-range-input:last-child) {
  display: none;
}
.range-single.el-date-editor--daterange :deep(.el-range-input:first-child) {
  width: 100%;
}
.range-single.el-date-editor--daterange :deep(.el-range__close-icon) {
  display: none;
}

.hidden-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.outbound-photo-wrap {
  width: 100%;
}

.outbound-photo-area {
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-md);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  cursor: pointer;
}

.outbound-photo-area:hover {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}

.outbound-photo-preview {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
}
</style>
