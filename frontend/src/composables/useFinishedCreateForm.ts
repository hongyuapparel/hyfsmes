import { computed, reactive, ref } from 'vue'
import { ElMessage, type FormInstance } from 'element-plus'
import { createFinishedStock } from '@/api/inventory'
import { getOrderColorSizeBreakdown } from '@/api/orders'
import { getProducts, type ProductItem } from '@/api/products'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { normalizeSizeHeader, sortSizeHeaders } from '@/utils/sizeHeaders'
import {
  DEFAULT_CREATE_SIZE_HEADERS,
  buildQuickAddSizeMatrix,
  createDefaultSizeRow,
  createFinishedCreateRules,
  filterFinishedCreateSkuProducts,
  formatCreateTotalPrice,
  formatCreateUnitPrice,
  remapCreateQuantities,
  resolveFinishedCreateOrder,
  sumCreateSizeQuantities,
  type FinishedCreateQuickAddSource,
} from '@/composables/finishedCreateFormHelpers'
export type { FinishedCreateQuickAddSource, FinishedCreateSizeRow } from '@/composables/finishedCreateFormHelpers'

let _localRowKey = 0
const nextLocalKey = () => `cr-local-${Date.now()}-${++_localRowKey}`

type SummaryColumns = Array<{ label?: string }>

export function useFinishedCreateForm(onCreated: () => void, onClose: () => void) {
  const createSubmitting = ref(false)
  const createFormRef = ref<FormInstance>()
  const createSkuDialogVisible = ref(false)
  const createSkuDialogLoading = ref(false)
  const createSkuKeyword = ref('')
  const createSkuProducts = ref<ProductItem[]>([])
  const createSizeHeaders = ref<string[]>([...DEFAULT_CREATE_SIZE_HEADERS])
  const createSizeRows = ref([createDefaultSizeRow()])
  const quickAddSource = ref<FinishedCreateQuickAddSource | null>(null)

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

  const createRules = createFinishedCreateRules()

  const sizeTotalQuantity = computed(() =>
    createSizeRows.value.reduce((sum, row) => sum + sumDetailRowQty(row.quantities), 0),
  )
  const filteredCreateSkuProducts = computed(() =>
    filterFinishedCreateSkuProducts(createSkuProducts.value, createSkuKeyword.value),
  )

  const sumDetailRowQty = sumCreateSizeQuantities

  function createRowTotalPrice(quantities: unknown[]): string {
    return formatCreateTotalPrice(sumDetailRowQty(quantities), createForm.unitPrice || undefined)
  }

  function getCreateColorSizeSummary({ columns }: { columns: SummaryColumns }) {
    const headersLen = createSizeHeaders.value.length
    const sumQtyColIndex = 2 + headersLen
    const unitPriceColIndex = 3 + headersLen
    const totalPriceColIndex = 4 + headersLen
    const tableTotalPrice = formatCreateTotalPrice(sizeTotalQuantity.value, createForm.unitPrice || undefined)
    return columns.map((_, index) => {
      if (index === 0) return '汇总'
      if (index === sumQtyColIndex) return String(sizeTotalQuantity.value)
      if (index === unitPriceColIndex) return formatCreateUnitPrice(createForm.unitPrice || undefined)
      if (index === totalPriceColIndex) return tableTotalPrice
      return ''
    })
  }

  function normalizeCreateSizeRows() {
    const len = createSizeHeaders.value.length
    createSizeRows.value.forEach((row) => {
      if (row.quantities.length < len)
        row.quantities.push(...Array(len - row.quantities.length).fill(0))
      else if (row.quantities.length > len) row.quantities.splice(len)
    })
  }

  function addCreateSizeColumn() {
    createSizeHeaders.value.push(`尺码${createSizeHeaders.value.length + 1}`)
    normalizeCreateSizeRows()
  }

  function addCreateColorRow() {
    createSizeRows.value.push({
      _key: nextLocalKey(),
      colorName: '',
      imageUrl: '',
      quantities: Array(createSizeHeaders.value.length).fill(0),
    })
  }

  function removeCreateColorRow(index: number) {
    createSizeRows.value.splice(index, 1)
    if (createSizeRows.value.length) return
    createSizeRows.value.push(createDefaultSizeRow())
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
    if (!createSkuProducts.value.length) await loadCreateSkuProducts()
  }

  function onSkuSelected(row: ProductItem) {
    createForm.skuCode = row.skuCode || ''
    if (row.imageUrl && !createForm.imageUrl) createForm.imageUrl = row.imageUrl
    createSkuDialogVisible.value = false
  }

  function applyQuickAddSource(source: FinishedCreateQuickAddSource) {
    createForm.orderNo = String(source.orderNo ?? '')
    createForm.skuCode = String(source.skuCode ?? '')
    createForm.unitPrice = source.unitPrice != null ? String(source.unitPrice) : ''
    createForm.warehouseId = source.warehouseId ?? null
    createForm.inventoryTypeId = source.inventoryTypeId ?? null
    createForm.department = String(source.department ?? '')
    createForm.location = String(source.location ?? '')
    createForm.imageUrl = String(source.imageUrl || source.productImageUrl || '')
    const matrix = buildQuickAddSizeMatrix(source)
    createSizeHeaders.value = matrix.headers
    createSizeRows.value = matrix.rows
    normalizeCreateSizeRows()
  }

  function resetCreateForm(source: FinishedCreateQuickAddSource | null = null) {
    quickAddSource.value = source
    Object.assign(createForm, {
      orderNo: '',
      skuCode: '',
      quantity: 1,
      unitPrice: '',
      warehouseId: null,
      inventoryTypeId: null,
      department: '',
      location: '',
      imageUrl: '',
      remark: '',
    })
    createSizeHeaders.value = [...DEFAULT_CREATE_SIZE_HEADERS]
    createSizeRows.value = [createDefaultSizeRow()]
    if (source) applyQuickAddSource(source)
    createFormRef.value?.clearValidate()
  }

  async function onOrderNoBlur() {
    const value = String(createForm.orderNo ?? '').trim()
    if (!value) return
    try {
      const order = await resolveFinishedCreateOrder(value)
      if (!order) return
      createForm.skuCode = order.skuCode || createForm.skuCode
      createForm.unitPrice =
        order.exFactoryPrice != null ? String(order.exFactoryPrice) : createForm.unitPrice
      if (order.imageUrl && !createForm.imageUrl) createForm.imageUrl = order.imageUrl
      if (createSizeRows.value.some((row) => sumDetailRowQty(row.quantities) > 0)) return
      const res = await getOrderColorSizeBreakdown(order.id)
      const data = res.data
      const headers = (Array.isArray(data?.headers) ? data.headers : [])
        .map(normalizeSizeHeader)
        .filter(Boolean)
      const sortedHeaders = sortSizeHeaders(headers)
      const rows = Array.isArray(data?.rows) ? data.rows : []
      if (!sortedHeaders.length || !rows.length) return
      createSizeHeaders.value = sortedHeaders
      createSizeRows.value = rows.map((row) => ({
        _key: nextLocalKey(),
        colorName: String(row.colorName ?? '').trim(),
        imageUrl: '',
        quantities: remapCreateQuantities(headers, row.values ?? [], sortedHeaders),
      }))
      normalizeCreateSizeRows()
    } catch {
      // 按需自动带出，不阻断用户手工录入
    }
  }

  async function submitCreate() {
    const skuCode = String(createForm.skuCode ?? '').trim()
    if (!skuCode) {
      ElMessage.warning('请选择SKU')
      return
    }
    const valid = await createFormRef.value?.validate().then(() => true).catch(() => false)
    if (!valid) return
    const totalQty = sizeTotalQuantity.value
    if (!totalQty || totalQty <= 0) {
      ElMessage.warning('请填写尺码对应的数量')
      return
    }
    createForm.quantity = totalQty
    createSubmitting.value = true
    try {
      const submittedHeaders = sortSizeHeaders(createSizeHeaders.value)
      await createFinishedStock({
        orderNo: createForm.orderNo?.trim() || undefined,
        skuCode,
        quantity: createForm.quantity,
        unitPrice: createForm.unitPrice?.trim() || undefined,
        warehouseId: createForm.warehouseId,
        inventoryTypeId: createForm.inventoryTypeId ?? undefined,
        department: createForm.department,
        location: createForm.location,
        imageUrl: createForm.imageUrl || undefined,
        remark: createForm.remark?.trim() || undefined,
        colorSize: {
          headers: submittedHeaders,
          rows: createSizeRows.value.map((row) => ({
            colorName: row.colorName,
            imageUrl: row.imageUrl,
            quantities: remapCreateQuantities(
              createSizeHeaders.value,
              row.quantities,
              submittedHeaders,
            ).map((quantity) => Math.max(0, Math.trunc(Number(quantity) || 0))),
          })),
        },
      })
      ElMessage.success('新增库存成功')
      onClose()
      onCreated()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      createSubmitting.value = false
    }
  }

  return {
    createSubmitting,
    createFormRef,
    createSkuDialogVisible,
    createSkuDialogLoading,
    createSkuKeyword,
    quickAddSource,
    createForm,
    createRules,
    createSizeHeaders,
    createSizeRows,
    filteredCreateSkuProducts,
    sumDetailRowQty,
    createRowTotalPrice,
    getCreateColorSizeSummary,
    addCreateSizeColumn,
    addCreateColorRow,
    removeCreateColorRow,
    removeCreateSizeColumn,
    openCreateSkuDialog,
    onSkuSelected,
    resetCreateForm,
    onOrderNoBlur,
    submitCreate,
  }
}
