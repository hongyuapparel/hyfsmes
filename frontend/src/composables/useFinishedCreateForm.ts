import { computed, reactive, ref, watch } from 'vue'
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
  type FinishedCreateRowMetaField,
  type FinishedCreateSizeRow,
} from '@/composables/finishedCreateFormHelpers'
export type {
  FinishedCreateQuickAddSource,
  FinishedCreateSizeRow,
  FinishedCreateRowMetaField,
} from '@/composables/finishedCreateFormHelpers'

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
  const createSizeRows = ref<FinishedCreateSizeRow[]>([createDefaultSizeRow()])
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

  /** 同步基础信息→行字段时设置，避免 watch 误判用户主动改动而标记为 override */
  let suppressAutoOverride = false

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
    // 新行直接继承当前基础信息（默认状态，未脱钩）
    createSizeRows.value.push({
      _key: nextLocalKey(),
      colorName: '',
      imageUrl: '',
      quantities: Array(createSizeHeaders.value.length).fill(0),
      department: createForm.department,
      inventoryTypeId: createForm.inventoryTypeId,
      warehouseId: createForm.warehouseId,
      location: createForm.location,
      _overrides: { department: false, inventoryTypeId: false, warehouseId: false, location: false },
    })
  }

  function removeCreateColorRow(index: number) {
    createSizeRows.value.splice(index, 1)
    if (createSizeRows.value.length) return
    createSizeRows.value.push(
      createDefaultSizeRow({
        department: createForm.department,
        inventoryTypeId: createForm.inventoryTypeId,
        warehouseId: createForm.warehouseId,
        location: createForm.location,
      }),
    )
  }

  function removeCreateSizeColumn(index: number) {
    if (createSizeHeaders.value.length <= 1) return
    createSizeHeaders.value.splice(index, 1)
    normalizeCreateSizeRows()
  }

  /**
   * 行级元数据修改：标记该字段为"已脱钩"，后续基础信息变化不再覆盖
   */
  function setRowMetaField<K extends FinishedCreateRowMetaField>(
    rowKey: string,
    field: K,
    value: FinishedCreateSizeRow[K],
  ) {
    const row = createSizeRows.value.find((r) => r._key === rowKey)
    if (!row) return
    ;(row as FinishedCreateSizeRow)[field] = value
    if (!suppressAutoOverride) row._overrides[field] = true
  }

  /**
   * 把基础信息强制应用到所有行（清除所有行的脱钩标记）。
   * 用于"应用基础信息到所有行"按钮。
   */
  function applyBasicInfoToAllRows() {
    suppressAutoOverride = true
    try {
      createSizeRows.value.forEach((row) => {
        row.department = createForm.department
        row.inventoryTypeId = createForm.inventoryTypeId
        row.warehouseId = createForm.warehouseId
        row.location = createForm.location
        row._overrides = { department: false, inventoryTypeId: false, warehouseId: false, location: false }
      })
    } finally {
      suppressAutoOverride = false
    }
    ElMessage.success('已应用到所有行')
  }

  // 基础信息变化 → 同步到所有未脱钩行
  watch(
    () => [createForm.department, createForm.inventoryTypeId, createForm.warehouseId, createForm.location] as const,
    ([dept, invType, wh, loc]) => {
      suppressAutoOverride = true
      try {
        createSizeRows.value.forEach((row) => {
          if (!row._overrides.department) row.department = dept
          if (!row._overrides.inventoryTypeId) row.inventoryTypeId = invType
          if (!row._overrides.warehouseId) row.warehouseId = wh
          if (!row._overrides.location) row.location = loc
        })
      } finally {
        suppressAutoOverride = false
      }
    },
  )

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
    suppressAutoOverride = true
    try {
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
    } finally {
      suppressAutoOverride = false
    }
  }

  function resetCreateForm(source: FinishedCreateQuickAddSource | null = null) {
    suppressAutoOverride = true
    try {
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
    } finally {
      suppressAutoOverride = false
    }
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
      suppressAutoOverride = true
      try {
        createSizeHeaders.value = sortedHeaders
        createSizeRows.value = rows.map((row) => ({
          _key: nextLocalKey(),
          colorName: String(row.colorName ?? '').trim(),
          imageUrl: '',
          quantities: remapCreateQuantities(headers, row.values ?? [], sortedHeaders),
          department: createForm.department,
          inventoryTypeId: createForm.inventoryTypeId,
          warehouseId: createForm.warehouseId,
          location: createForm.location,
          _overrides: { department: false, inventoryTypeId: false, warehouseId: false, location: false },
        }))
        normalizeCreateSizeRows()
      } finally {
        suppressAutoOverride = false
      }
    } catch {
      // 按需自动带出，不阻断用户手工录入
    }
  }

  /** 按 (warehouseId, department, inventoryTypeId, location) 分组提交，每组 1 次 createFinishedStock */
  function buildSubmitGroups() {
    type Group = {
      warehouseId: number | null
      inventoryTypeId: number | null
      department: string
      location: string
      rows: FinishedCreateSizeRow[]
    }
    const groups = new Map<string, Group>()
    for (const row of createSizeRows.value) {
      const total = sumDetailRowQty(row.quantities)
      if (total <= 0) continue
      const key = [
        row.warehouseId ?? 'null',
        String(row.department ?? '').trim(),
        row.inventoryTypeId ?? 'null',
        String(row.location ?? '').trim(),
      ].join('|')
      let g = groups.get(key)
      if (!g) {
        g = {
          warehouseId: row.warehouseId,
          inventoryTypeId: row.inventoryTypeId,
          department: String(row.department ?? '').trim(),
          location: String(row.location ?? '').trim(),
          rows: [],
        }
        groups.set(key, g)
      }
      g.rows.push(row)
    }
    return Array.from(groups.values())
  }

  function validateGroups(groups: ReturnType<typeof buildSubmitGroups>): string {
    for (const g of groups) {
      if (g.warehouseId == null) return '请为所有有数量的行选择仓库'
      if (!g.department) return '请为所有有数量的行选择部门'
      if (!g.location) return '请为所有有数量的行填写存放地址'
    }
    return ''
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
    const groups = buildSubmitGroups()
    const validateError = validateGroups(groups)
    if (validateError) {
      ElMessage.warning(validateError)
      return
    }
    createForm.quantity = totalQty
    createSubmitting.value = true
    try {
      const submittedHeaders = sortSizeHeaders(createSizeHeaders.value)
      let succeeded = 0
      for (const g of groups) {
        const groupQty = g.rows.reduce((sum, r) => sum + sumDetailRowQty(r.quantities), 0)
        await createFinishedStock({
          orderNo: createForm.orderNo?.trim() || undefined,
          skuCode,
          quantity: groupQty,
          unitPrice: createForm.unitPrice?.trim() || undefined,
          warehouseId: g.warehouseId,
          inventoryTypeId: g.inventoryTypeId ?? undefined,
          department: g.department,
          location: g.location,
          imageUrl: createForm.imageUrl || undefined,
          remark: createForm.remark?.trim() || undefined,
          colorSize: {
            headers: submittedHeaders,
            rows: g.rows.map((row) => ({
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
        succeeded += 1
      }
      ElMessage.success(
        succeeded > 1 ? `已按仓库/部门拆分为 ${succeeded} 条库存记录` : '新增库存成功',
      )
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
    setRowMetaField,
    applyBasicInfoToAllRows,
  }
}
