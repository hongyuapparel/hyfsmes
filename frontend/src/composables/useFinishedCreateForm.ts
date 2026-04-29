import { computed, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { createFinishedStock } from '@/api/inventory'
import { getOrderColorSizeBreakdown } from '@/api/orders'
import { getProducts, type ProductItem } from '@/api/products'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { formatDisplayNumber } from '@/utils/display-number'

const DEFAULT_CREATE_SIZE_HEADERS = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL'] as const
export type FinishedCreateSizeRow = { colorName: string; imageUrl: string; quantities: Array<number | null> }
type SummaryColumns = Array<{ label?: string }>
const createDefaultSizeRow = (): FinishedCreateSizeRow => ({
  colorName: '默认',
  imageUrl: '',
  quantities: Array(DEFAULT_CREATE_SIZE_HEADERS.length).fill(0),
})

export function useFinishedCreateForm(onCreated: () => void, onClose: () => void) {
  const createSubmitting = ref(false)
  const createFormRef = ref<FormInstance>()
  const createSkuDialogVisible = ref(false)
  const createSkuDialogLoading = ref(false)
  const createSkuKeyword = ref('')
  const createSkuProducts = ref<ProductItem[]>([])
  const createSizeHeaders = ref<string[]>([...DEFAULT_CREATE_SIZE_HEADERS])
  const createSizeRows = ref<FinishedCreateSizeRow[]>([createDefaultSizeRow()])

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

  const sizeTotalQuantity = computed(() => createSizeRows.value.reduce((sum, row) => sum + sumDetailRowQty(row.quantities), 0))
  const filteredCreateSkuProducts = computed(() => {
    const kw = createSkuKeyword.value.trim().toLowerCase()
    if (!kw) return createSkuProducts.value
    return createSkuProducts.value.filter((item) => {
      const sku = String(item.skuCode ?? '').toLowerCase()
      const customer = String(item.customer?.companyName ?? '').toLowerCase()
      return sku.includes(kw) || customer.includes(kw)
    })
  })

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

  function getCreateColorSizeSummary({ columns }: { columns: SummaryColumns }) {
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
      if (row.quantities.length < len) row.quantities.push(...Array(len - row.quantities.length).fill(0))
      else if (row.quantities.length > len) row.quantities.splice(len)
    })
  }

  function addCreateSizeColumn() {
    createSizeHeaders.value.push(`尺码${createSizeHeaders.value.length + 1}`)
    normalizeCreateSizeRows()
  }

  const createEmptySizeRow = () => ({ colorName: '', imageUrl: '', quantities: Array(createSizeHeaders.value.length).fill(0) })
  function addCreateColorRow() { createSizeRows.value.push(createEmptySizeRow()) }

  function removeCreateColorRow(index: number) {
    createSizeRows.value.splice(index, 1)
    if (createSizeRows.value.length) return
    createSizeRows.value.push({ colorName: '默认', imageUrl: '', quantities: Array(createSizeHeaders.value.length).fill(0) })
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

  function resetCreateForm() {
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
      const headers = (Array.isArray(data?.headers) ? data.headers : []).map((item) => String(item ?? '').trim()).filter((item) => item && item !== '合计')
      const rows = Array.isArray(data?.rows) ? data.rows : []
      if (!headers.length || !rows.length) return
      createSizeHeaders.value = headers
      createSizeRows.value = rows.map((row) => ({ colorName: String(row.colorName ?? '').trim(), imageUrl: '', quantities: headers.map(() => null) }))
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
      ElMessage.warning('请填写尺寸对应的数量')
      return
    }
    createForm.quantity = totalQty
    createSubmitting.value = true
    try {
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
          headers: createSizeHeaders.value.map((header) => String(header ?? '').trim()),
          rows: createSizeRows.value.map((row) => ({
            colorName: row.colorName,
            imageUrl: row.imageUrl,
            quantities: row.quantities.map((quantity) => Math.max(0, Math.trunc(Number(quantity) || 0))),
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
