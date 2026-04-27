<template>
  <el-dialog
    :model-value="modelValue"
    title="新增库存"
    width="960"
    destroy-on-close
    @update:model-value="onDialogVisibleChange"
    @close="resetCreateForm"
  >
    <el-form
      ref="createFormRef"
      :model="createForm"
      :rules="createRules"
      label-width="90px"
      class="create-form-grid"
    >
      <div class="create-sections">
        <div class="detail-section">
          <div class="detail-section-title">基础信息与产品图</div>
          <div class="detail-basic-main">
            <div class="detail-basic-grid">
              <div class="detail-basic-label">订单号</div>
              <div class="detail-basic-value">
                <el-input
                  v-model="createForm.orderNo"
                  placeholder="选填，不填则不关联订单"
                  clearable
                  size="small"
                  @blur="onOrderNoBlur"
                />
              </div>
              <div class="detail-basic-label">SKU</div>
              <div class="detail-basic-value">
                <el-input v-model="createForm.skuCode" placeholder="选择 SKU" clearable size="small">
                  <template #suffix>
                    <el-button link type="primary" size="small" @click.stop="openCreateSkuDialog">
                      选择
                    </el-button>
                  </template>
                </el-input>
              </div>

              <div class="detail-basic-label">部门</div>
              <div class="detail-basic-value">
                <el-select
                  v-model="createForm.department"
                  placeholder="请选择部门"
                  filterable
                  clearable
                  size="small"
                >
                  <el-option
                    v-for="opt in departmentOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </div>
              <div class="detail-basic-label">库存类型</div>
              <div class="detail-basic-value">
                <el-select
                  v-model="createForm.inventoryTypeId"
                  placeholder="请选择库存类型"
                  filterable
                  clearable
                  size="small"
                >
                  <el-option
                    v-for="opt in inventoryTypeOptions"
                    :key="opt.id"
                    :label="opt.label"
                    :value="opt.id"
                  />
                </el-select>
              </div>
              <div class="detail-basic-label">仓库</div>
              <div class="detail-basic-value">
                <el-select
                  v-model="createForm.warehouseId"
                  placeholder="请选择仓库"
                  filterable
                  clearable
                  size="small"
                >
                  <el-option
                    v-for="opt in warehouseOptions"
                    :key="opt.id"
                    :label="opt.label"
                    :value="opt.id"
                  />
                </el-select>
              </div>

              <div class="detail-basic-label">备注</div>
              <div class="detail-basic-value detail-basic-value-span-3">
                <el-input v-model="createForm.remark" placeholder="选填" clearable size="small" />
              </div>
            </div>
            <div class="detail-product-image-panel">
              <div class="detail-image-label">产品图</div>
              <ImageUploadArea v-model="createForm.imageUrl" compact />
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section-head">
            <div class="detail-section-title">颜色图片与码数明细</div>
            <div class="detail-head-actions">
              <el-button type="primary" link size="small" @click="addCreateColorRow">+ 新增颜色</el-button>
              <el-button type="primary" link size="small" @click="addCreateSizeColumn">+ 新增尺码列</el-button>
            </div>
          </div>
          <div class="create-size-table-wrap">
            <el-table
              :data="createSizeRows"
              border
              size="small"
              class="create-size-table detail-color-size-table"
              show-summary
              :summary-method="getCreateColorSizeSummary"
            >
              <el-table-column label="颜色" width="88" align="center" header-align="center">
                <template #default="{ row }">
                  <el-input v-model="row.colorName" placeholder="颜色" clearable size="small" />
                </template>
              </el-table-column>
              <el-table-column label="颜色图片" width="122" align="center" header-align="center">
                <template #default="{ row }">
                  <ImageUploadArea v-model="row.imageUrl" compact />
                </template>
              </el-table-column>
              <el-table-column
                v-for="(size, idx) in createSizeHeaders"
                :key="`create-size-${idx}`"
                min-width="78"
                align="center"
                header-align="center"
              >
                <template #header>
                  <div class="b-header-cell">
                    <el-input
                      v-model="createSizeHeaders[idx]"
                      size="small"
                      class="b-header-input"
                      :input-style="{ textAlign: 'center' }"
                    />
                    <div class="b-header-actions">
                      <el-button
                        v-if="createSizeHeaders.length > 1"
                        link
                        type="danger"
                        size="small"
                        class="b-header-remove"
                        @click.stop="removeCreateSizeColumn(idx)"
                      >
                        <el-icon><Close /></el-icon>
                      </el-button>
                    </div>
                  </div>
                </template>
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.quantities[idx]"
                    :min="0"
                    :precision="0"
                    :controls="false"
                    size="small"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
              <el-table-column label="合计" width="72" align="center" header-align="center">
                <template #default="{ row }">{{ sumDetailRowQty(row.quantities) }}</template>
              </el-table-column>
              <el-table-column label="出厂价" width="88" align="center" header-align="center">
                <template #default>
                  <el-input
                    v-model="createForm.unitPrice"
                    placeholder="请输入"
                    clearable
                    size="small"
                  />
                </template>
              </el-table-column>
              <el-table-column label="总价" width="120" align="center" header-align="center">
                <template #default="{ row }">{{ createRowTotalPrice(row.quantities) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="48" align="center" header-align="center">
                <template #default="{ $index }">
                  <el-button
                    v-if="createSizeRows.length > 1"
                    type="danger"
                    link
                    size="small"
                    class="create-row-remove-btn"
                    @click="removeCreateColorRow($index)"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
              <el-table-column label="存放地址" width="150" align="center" header-align="center">
                <template #default>
                  <el-input
                    v-model="createForm.location"
                    placeholder="请输入具体存放地址"
                    clearable
                    size="small"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="createSubmitting" @click="submitCreate">确定</el-button>
    </template>
  </el-dialog>

  <el-dialog
    v-model="createSkuDialogVisible"
    title="选择 SKU"
    width="760px"
    destroy-on-close
  >
    <el-input
      v-model="createSkuKeyword"
      placeholder="输入 SKU 或客户搜索"
      clearable
      style="max-width: 320px; margin-bottom: 10px"
    />
    <el-table
      v-loading="createSkuDialogLoading"
      :data="filteredCreateSkuProducts"
      border
      stripe
      height="420"
    >
      <el-table-column label="图片" width="90" align="center">
        <template #default="{ row }">
          <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="table" />
          <span v-else class="text-placeholder">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="skuCode" label="SKU 编号" min-width="160" />
      <el-table-column label="客户" min-width="180">
        <template #default="{ row }">
          {{ row.customer?.companyName || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="productGroup" label="产品分组" min-width="180" show-overflow-tooltip />
      <el-table-column label="操作" width="90" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="onSkuSelected(row)">选择</el-button>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="createSkuDialogVisible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { Close, Delete } from '@element-plus/icons-vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import { createFinishedStock } from '@/api/inventory'
import { getProducts, type ProductItem } from '@/api/products'
import { getOrderColorSizeBreakdown } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { formatDisplayNumber } from '@/utils/display-number'

const props = defineProps<{
  modelValue: boolean
  warehouseOptions: Array<{ id: number; label: string }>
  inventoryTypeOptions: Array<{ id: number; label: string }>
  departmentOptions: Array<{ value: string; label: string }>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'created'): void
}>()

const DEFAULT_CREATE_SIZE_HEADERS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL'] as const

const createSubmitting = ref(false)
const createFormRef = ref<FormInstance>()
const createSkuDialogVisible = ref(false)
const createSkuDialogLoading = ref(false)
const createSkuKeyword = ref('')
const createSkuProducts = ref<ProductItem[]>([])
const createSizeHeaders = ref<string[]>([...DEFAULT_CREATE_SIZE_HEADERS])
const createSizeRows = ref<Array<{ colorName: string; imageUrl: string; quantities: Array<number | null> }>>([
  { colorName: '默认', imageUrl: '', quantities: Array(DEFAULT_CREATE_SIZE_HEADERS.length).fill(0) },
])

const createForm = reactive({
  orderNo: '',
  skuCode: '',
  quantity: 1,
  unitPrice: '',
  warehouseId: null as number | null,
  inventoryTypeId: null as number | null,
  department: '',
  location: '',
  imageUrl: '',
  remark: '',
})

const createRules: FormRules = {
  skuCode: [{ required: true, message: '请选择SKU', trigger: 'change' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  department: [{ required: true, message: '请选择部门', trigger: 'change' }],
  location: [{ required: true, message: '请输入存放地址', trigger: 'blur' }],
}

const sizeTotalQuantity = computed(() =>
  createSizeRows.value.reduce((sum, row) => {
    const rowSum = row.quantities.reduce((s, qty) => {
      const q = Number(qty)
      return Number.isFinite(q) && q > 0 ? s + q : s
    }, 0)
    return sum + rowSum
  }, 0),
)

const filteredCreateSkuProducts = computed(() => {
  const kw = createSkuKeyword.value.trim().toLowerCase()
  if (!kw) return createSkuProducts.value
  return createSkuProducts.value.filter((item) => {
    const sku = String(item.skuCode ?? '').toLowerCase()
    const customer = String(item.customer?.companyName ?? '').toLowerCase()
    return sku.includes(kw) || customer.includes(kw)
  })
})

function onDialogVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

function sumDetailRowQty(quantities: unknown[]): number {
  return quantities.reduce<number>((sum, q) => sum + Math.max(0, Math.trunc(Number(q) || 0)), 0)
}

function formatPrice(unitPrice: string | undefined): string {
  if (unitPrice == null || unitPrice === '') return '￥0'
  const n = Number(unitPrice)
  return Number.isFinite(n) ? `￥${formatDisplayNumber(n)}` : '￥0'
}

function formatTotalPrice(quantity: number, unitPrice: string | undefined): string {
  const n = Number(unitPrice)
  if (!Number.isFinite(n) || !Number.isFinite(quantity)) return '￥0'
  return `￥${formatDisplayNumber(quantity * n)}`
}

function createRowTotalPrice(quantities: unknown[]): string {
  return formatTotalPrice(sumDetailRowQty(quantities), createForm.unitPrice || undefined)
}

function getCreateColorSizeSummary({ columns }: { columns: Array<{ label?: string }> }) {
  const headersLen = createSizeHeaders.value.length
  const sumQtyColIndex = 2 + headersLen
  const unitPriceColIndex = 3 + headersLen
  const totalPriceColIndex = 4 + headersLen
  const tableTotalPrice = formatTotalPrice(sizeTotalQuantity.value, createForm.unitPrice || undefined)
  return columns.map((_, index) => {
    if (index === 0) return '汇总'
    if (index === sumQtyColIndex) return String(sizeTotalQuantity.value)
    if (index === unitPriceColIndex) return formatPrice(createForm.unitPrice || undefined)
    if (index === totalPriceColIndex) return tableTotalPrice
    return ''
  })
}

function normalizeCreateSizeRows() {
  const len = createSizeHeaders.value.length
  createSizeRows.value.forEach((row) => {
    if (!Array.isArray(row.quantities)) row.quantities = []
    if (row.quantities.length < len) row.quantities.push(...Array(len - row.quantities.length).fill(0))
    else if (row.quantities.length > len) row.quantities.splice(len)
  })
}

function addCreateSizeColumn() {
  createSizeHeaders.value.push(`尺码${createSizeHeaders.value.length + 1}`)
  normalizeCreateSizeRows()
}

function addCreateColorRow() {
  createSizeRows.value.push({
    colorName: '',
    imageUrl: '',
    quantities: Array(createSizeHeaders.value.length).fill(0),
  })
}

function removeCreateColorRow(index: number) {
  createSizeRows.value.splice(index, 1)
  if (!createSizeRows.value.length) {
    createSizeRows.value.push({
      colorName: '默认',
      imageUrl: '',
      quantities: Array(createSizeHeaders.value.length).fill(0),
    })
  }
}

function removeCreateSizeColumn(index: number) {
  if (createSizeHeaders.value.length <= 1) return
  createSizeHeaders.value.splice(index, 1)
  normalizeCreateSizeRows()
}

async function loadCreateSkuProducts() {
  createSkuDialogLoading.value = true
  try {
    const res = await getProducts({ page: 1, pageSize: 300 })
    createSkuProducts.value = res.data?.list ?? []
  } catch {
    createSkuProducts.value = []
  } finally {
    createSkuDialogLoading.value = false
  }
}

async function openCreateSkuDialog() {
  createSkuDialogVisible.value = true
  if (!createSkuProducts.value.length) {
    await loadCreateSkuProducts()
  }
}

function onSkuSelected(row: ProductItem) {
  createForm.skuCode = row.skuCode || ''
  if (row.imageUrl && !createForm.imageUrl) {
    createForm.imageUrl = row.imageUrl
  }
  createSkuDialogVisible.value = false
}

function resetCreateForm() {
  createForm.orderNo = ''
  createForm.skuCode = ''
  createForm.quantity = 1
  createForm.unitPrice = ''
  createForm.warehouseId = null
  createForm.inventoryTypeId = null
  createForm.department = ''
  createForm.location = ''
  createForm.imageUrl = ''
  createForm.remark = ''
  createSizeHeaders.value = [...DEFAULT_CREATE_SIZE_HEADERS]
  createSizeRows.value = [
    { colorName: '默认', imageUrl: '', quantities: Array(DEFAULT_CREATE_SIZE_HEADERS.length).fill(0) },
  ]
  createFormRef.value?.clearValidate()
}

async function onOrderNoBlur() {
  const value = String(createForm.orderNo ?? '').trim()
  if (!value || createSizeRows.value.some((row) => sumDetailRowQty(row.quantities) > 0)) return
  const orderId = Number(value)
  if (!Number.isInteger(orderId) || orderId <= 0) return
  try {
    const res = await getOrderColorSizeBreakdown(orderId)
    const data = res.data
    const headers = (Array.isArray(data?.headers) ? data.headers : [])
      .map((item) => String(item ?? '').trim())
      .filter((item) => item && item !== '合计')
    const rows = Array.isArray(data?.rows) ? data.rows : []
    if (!headers.length || !rows.length) return
    createSizeHeaders.value = headers
    createSizeRows.value = rows.map((row) => ({
      colorName: String(row.colorName ?? '').trim(),
      imageUrl: '',
      quantities: headers.map(() => null),
    }))
    normalizeCreateSizeRows()
  } catch {
    // 按需自动带出，不阻断用户手工录入
  }
}

async function submitCreate() {
  const valid = await createFormRef.value?.validate().then(() => true).catch(() => false)
  if (!valid) return
  const totalQty = sizeTotalQuantity.value
  if (!totalQty || totalQty <= 0) {
    ElMessage.warning('请填写尺寸对应的数量')
    return
  }
  createForm.quantity = totalQty
  createSubmitting.value = true
  try {
    await createFinishedStock({
      orderNo: createForm.orderNo?.trim() || undefined,
      skuCode: createForm.skuCode,
      quantity: createForm.quantity,
      unitPrice: createForm.unitPrice?.trim() || undefined,
      warehouseId: createForm.warehouseId,
      inventoryTypeId: createForm.inventoryTypeId ?? undefined,
      department: createForm.department,
      location: createForm.location,
      imageUrl: createForm.imageUrl || undefined,
      remark: createForm.remark?.trim() || undefined,
      colorSize: {
        headers: createSizeHeaders.value.map((h) => String(h ?? '').trim()),
        rows: createSizeRows.value.map((r) => ({
          colorName: r.colorName,
          imageUrl: r.imageUrl,
          quantities: r.quantities.map((quantity) => Math.max(0, Math.trunc(Number(quantity) || 0))),
        })),
      },
    })
    ElMessage.success('新增库存成功')
    emit('update:modelValue', false)
    emit('created')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    createSubmitting.value = false
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    resetCreateForm()
  },
)
</script>

<style scoped>
.create-form-grid .el-form-item { margin-bottom: var(--space-sm); }
.create-sections { display: flex; flex-direction: column; gap: 10px; }
.create-size-table-wrap { width: 100%; border: 1px solid var(--el-border-color); border-radius: var(--el-border-radius-base); overflow: hidden; }
.create-size-table { margin: 0; }
.create-size-table .el-table__inner-wrapper::before { display: none; }
.b-header-cell { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box; }
.b-header-input { width: 100%; flex: 1; min-width: 0; text-align: center; }
.b-header-input :deep(.el-input__wrapper) { padding-left: 6px; padding-right: 6px; }
.b-header-input :deep(.el-input__inner) { text-align: center; }
.b-header-actions { position: absolute; top: 50%; right: -2px; transform: translateY(-50%); display: flex; align-items: center; gap: 1px; opacity: 0; transition: opacity 0.15s; }
.b-header-remove { width: 14px; height: 14px; padding: 0; min-height: 14px; min-width: 14px; display: flex; align-items: center; justify-content: center; font-size: 10px; }
.b-header-remove :deep(.el-icon) { font-size: 8px; line-height: 8px; }
.b-header-cell:hover .b-header-actions { opacity: 1; }
.create-row-remove-btn { padding: 0; }
.create-size-footer { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--color-bg-subtle, #f5f6f8); border-top: 1px solid var(--el-border-color-lighter); }
.create-size-total { font-size: var(--font-size-caption); color: var(--color-text-muted); }
.detail-section { min-width: 0; flex: 1; padding: 10px 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: #fff; }
.detail-section-title { font-weight: 600; margin-bottom: 6px; font-size: 13px; color: var(--el-text-color-primary); }
.detail-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.detail-head-actions { display: flex; align-items: center; gap: 6px; }
.detail-basic-main { display: grid; grid-template-columns: minmax(0, 1fr) 170px; gap: 12px; align-items: stretch; }
.detail-basic-grid { display: grid; grid-template-columns: 96px minmax(0, 1fr) 96px minmax(0, 1fr); border: 1px solid var(--el-border-color-lighter); font-size: 12px; }
.detail-basic-label, .detail-basic-value { min-width: 0; padding: 7px 10px; border-right: 1px solid var(--el-border-color-lighter); border-bottom: 1px solid var(--el-border-color-lighter); display: flex; align-items: center; box-sizing: border-box; }
.detail-basic-label { font-weight: 600; color: var(--el-text-color-primary); background: var(--el-fill-color-lighter); }
.detail-basic-value { color: var(--el-text-color-regular); overflow: hidden; }
.detail-basic-value-span-3 { grid-column: 2 / 5; }
.detail-basic-grid > :nth-child(4n) { border-right: none; }
.detail-basic-grid > :nth-last-child(-n + 2) { border-bottom: none; }
.detail-product-image-panel { display: flex; flex-direction: column; gap: 6px; width: 170px; min-width: 170px; }
.detail-image-label, .detail-muted { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
