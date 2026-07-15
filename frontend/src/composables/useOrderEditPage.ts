import { onBeforeUnmount, reactive, ref, watch, computed } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessageBox } from 'element-plus'
import type { OrderFormPayload } from '@/api/orders'
import { useAuthStore } from '@/stores/auth'
import { useOrderAttachments } from '@/composables/useOrderAttachments'
import { useOrderColorSizeMatrix } from '@/composables/useOrderColorSizeMatrix'
import { useOrderCustomerSelection } from '@/composables/useOrderCustomerSelection'
import { useOrderDetailHydration } from '@/composables/useOrderDetailHydration'
import { useOrderEditLoad } from '@/composables/useOrderEditLoad'
import { useOrderEditOptions } from '@/composables/useOrderEditOptions'
import { useOrderEditPayload } from '@/composables/useOrderEditPayload'
import { useOrderEditSubmit } from '@/composables/useOrderEditSubmit'
import { useOrderImageUpload } from '@/composables/useOrderImageUpload'
import { useOrderMaterials } from '@/composables/useOrderMaterials'
import { useOrderMaterialNameSearch } from '@/composables/useOrderMaterialNameSearch'
import { useOrderPackaging } from '@/composables/useOrderPackaging'
import { useOrderProcessItems } from '@/composables/useOrderProcessItems'
import { useOrderSizeInfo } from '@/composables/useOrderSizeInfo'
import { useOrderSkuSelection } from '@/composables/useOrderSkuSelection'

export function useOrderEditPage() {
  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const orderEditOptionsApi = useOrderEditOptions()
  const attachmentsApi = useOrderAttachments()
  const processItemsApi = useOrderProcessItems()

  const formRef = ref<FormInstance>()
  const hasUnsavedChanges = ref(false)
  const skipDirtyCheck = ref(false)
  const orderId = ref<number | undefined>(undefined)
  const orderStatus = ref<string>('draft')
  const orderNo = ref('')

  const form = reactive<OrderFormPayload>({
    skuCode: '',
    xiaomanOrderNo: '',
    customerId: null,
    customerName: '',
    salesperson: '',
    merchandiser: '',
    merchandiserPhone: '',
    orderTypeId: null,
    collaborationTypeId: null,
    secondaryProcess: '',
    quantity: 0,
    exFactoryPrice: '',
    salePrice: '',
    orderDate: '',
    customerDueDate: '',
    imageUrl: '',
    colorSizeRows: [],
    colorSizeHeaders: [],
    materials: [],
    sizeInfoMetaHeaders: [],
    sizeInfoRows: [],
    processItems: [],
    revisionNotes: '',
    productionRequirement: '',
    packagingHeaders: [],
    packagingCells: [],
    packagingMethod: '',
    attachments: [],
  })

  const orderImageUploadApi = useOrderImageUpload(form)
  const packagingApi = useOrderPackaging()
  const materialsApi = useOrderMaterials()
  const materialNameSearchApi = useOrderMaterialNameSearch({
    getMaterialTypeLabel: materialsApi.getMaterialTypeLabel,
  })

  const rules: FormRules = {
    skuCode: [{ required: true, message: '请选择 SKU', trigger: 'change' }],
    customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
    collaborationTypeId: [{ required: true, message: '请选择合作方式', trigger: 'change' }],
    orderTypeId: [{ required: true, message: '请选择订单类型', trigger: 'change' }],
    customerDueDate: [{ required: true, message: '请选择客户交期', trigger: 'change' }],
    salePrice: [{
      validator: (_rule: unknown, value: unknown, callback: (err?: Error) => void) => {
        const str = String(value ?? '').trim()
        if (!str) return callback(new Error('请填写销售价'))
        const num = Number(str)
        if (!Number.isFinite(num) || num <= 0) return callback(new Error('销售价需大于 0'))
        return callback()
      },
      trigger: 'blur',
    }],
    merchandiser: [{ required: true, message: '请选择跟单员', trigger: 'change' }],
  }

  const customerSelectionApi = useOrderCustomerSelection(form)
  const skuSelectionApi = useOrderSkuSelection(form, customerSelectionApi.selectedCustomer, customerSelectionApi.ensureCustomerById)
  let normalizeSizeInfoRows: (() => void) | undefined
  const colorSizeApi = useOrderColorSizeMatrix({ onSizeHeadersChange: () => normalizeSizeInfoRows?.() })

  function setEditingCellNull() {
    colorSizeApi.editingCell.value = null
  }

  const sizeInfoApi = useOrderSizeInfo({
    sizeHeaders: colorSizeApi.sizeHeaders,
    parseClipboardText: colorSizeApi.parseClipboardText,
  })
  normalizeSizeInfoRows = sizeInfoApi.normalizeSizeInfoRows

  function onMerchandiserChange(val: string) {
    const u = orderEditOptionsApi.merchandiserOptions.value.find((x) => (x.displayName || x.username) === val)
    if (u?.mobile && !form.merchandiserPhone) form.merchandiserPhone = u.mobile
  }

  const revisionNotes = ref('')
  const productionRequirement = ref('')

  const { collectPayload } = useOrderEditPayload({
    form,
    formRef,
    grandTotal: colorSizeApi.grandTotal,
    colorRows: colorSizeApi.colorRows,
    sizeHeaders: colorSizeApi.sizeHeaders,
    materials: materialsApi.materials,
    sizeMetaHeaders: sizeInfoApi.sizeMetaHeaders,
    sizeInfoRows: sizeInfoApi.sizeInfoRows,
    processItems: processItemsApi.processItems,
    revisionNotes,
    productionRequirement,
    packagingHeaders: packagingApi.packagingHeaders,
    packagingCells: packagingApi.packagingCells,
    packagingMethod: packagingApi.packagingMethod,
    attachments: attachmentsApi.attachments,
  })

  const { hydrateOrderDetail } = useOrderDetailHydration({
    form,
    orderNo,
    orderStatus,
    skuProductGroupName: skuSelectionApi.skuProductGroupName,
    skuApplicablePeopleName: skuSelectionApi.skuApplicablePeopleName,
    ensureCustomerById: customerSelectionApi.ensureCustomerById,
    defaultSizeHeaders: colorSizeApi.defaultSizeHeaders,
    sizeHeaders: colorSizeApi.sizeHeaders,
    colorRows: colorSizeApi.colorRows,
    normalizeColorRows: colorSizeApi.normalizeColorRows,
    ensureAtLeastOneColorRow: colorSizeApi.ensureAtLeastOneColorRow,
    materials: materialsApi.materials,
    nextMaterialRowKey: materialsApi.nextMaterialRowKey,
    roundMaterialQty2: materialsApi.roundMaterialQty2,
    recalcPurchaseQuantity: materialsApi.recalcPurchaseQuantity,
    defaultSizeMetaHeaders: sizeInfoApi.defaultSizeMetaHeaders,
    sizeMetaHeaders: sizeInfoApi.sizeMetaHeaders,
    sizeInfoRows: sizeInfoApi.sizeInfoRows,
    nextSizeInfoRowKey: sizeInfoApi.nextSizeInfoRowKey,
    normalizeSizeInfoRows: sizeInfoApi.normalizeSizeInfoRows,
    processItems: processItemsApi.processItems,
    revisionNotes,
    productionRequirement,
    defaultPackagingHeaders: packagingApi.defaultPackagingHeaders,
    packagingHeaders: packagingApi.packagingHeaders,
    packagingCells: packagingApi.packagingCells,
    normalizePackagingCells: packagingApi.normalizePackagingCells,
    packagingMethod: packagingApi.packagingMethod,
    attachments: attachmentsApi.attachments,
  })

  const { pageLoading, loadDetail } = useOrderEditLoad({
    route,
    router,
    orderId,
    form,
    hasUnsavedChanges,
    skipDirtyCheck,
    salespersonOptions: orderEditOptionsApi.salespersonOptions,
    ensureAtLeastOneColorRow: colorSizeApi.ensureAtLeastOneColorRow,
    hydrateOrderDetail,
    loadCollaborationOptions: orderEditOptionsApi.loadCollaborationOptions,
    loadOrderTypeTree: orderEditOptionsApi.loadOrderTypeTree,
    loadSalespersonOptions: orderEditOptionsApi.loadSalespersonOptions,
    loadMerchandiserOptions: orderEditOptionsApi.loadMerchandiserOptions,
    loadMaterialTypes: materialsApi.loadMaterialTypes,
    loadMaterialSources: materialsApi.loadMaterialSources,
    searchProcessSuppliers: materialsApi.searchProcessSuppliers,
    loadProcessOptions: orderEditOptionsApi.loadProcessOptions,
    syncMaterialTypeIdsFromLabel: materialsApi.syncMaterialTypeIdsFromLabel,
    syncMaterialSourceIdsFromLabel: materialsApi.syncMaterialSourceIdsFromLabel,
    initSizeInfoSortable: sizeInfoApi.initSizeInfoSortable,
    initMaterialsSortable: materialsApi.initMaterialsSortable,
  })

  const { saving, submitting, onSaveDraft, onSaveChanges, onSaveAndSubmit } = useOrderEditSubmit({
    route,
    router,
    orderId,
    orderStatus,
    orderNo,
    hasUnsavedChanges,
    collectPayload,
  })

  watch(
    () => [
      form,
      colorSizeApi.colorRows.value,
      colorSizeApi.sizeHeaders.value,
      materialsApi.materials.value,
      sizeInfoApi.sizeMetaHeaders.value,
      sizeInfoApi.sizeInfoRows.value,
      processItemsApi.processItems.value,
      revisionNotes.value,
      productionRequirement.value,
      packagingApi.packagingHeaders.value,
      packagingApi.packagingCells.value,
      packagingApi.packagingMethod.value,
      attachmentsApi.attachments.value,
    ],
    () => { if (!skipDirtyCheck.value) hasUnsavedChanges.value = true },
    { deep: true },
  )

  onBeforeRouteLeave((_to, _from, next) => {
    if (!hasUnsavedChanges.value) return next()
    ElMessageBox.confirm('当前有未保存的内容，离开后将无法恢复，确定要离开吗？', '提示', {
      confirmButtonText: '确定离开',
      cancelButtonText: '取消',
      type: 'warning',
    }).then(() => next()).catch(() => next(false))
  })

  function goBack() {
    router.push({ name: 'OrdersList' })
  }

  const isSuperAdmin = computed(() => {
    const u = authStore.user
    return u?.roleCode === 'admin' || u?.roleCodes?.includes('admin') === true
  })
  const canForceOrderStatus = computed(() => authStore.hasPermission('orders_force_status'))
  const isDraftOrder = computed(() => orderStatus.value === 'draft')
  const canSaveCurrentOrder = computed(() => {
    if (!authStore.hasPermission('orders_edit')) return false
    if (isSuperAdmin.value) return true
    const allowed = authStore.user?.orderPolicies?.edit
    if (!allowed) return true
    const allowedSet = new Set((allowed ?? []).map((s) => (s ?? '').trim()).filter(Boolean))
    if (!allowedSet.size) return false
    return allowedSet.has((orderStatus.value ?? '').trim())
  })
  const forceStatusDialogVisible = ref(false)

  const STATUS_LABEL_FALLBACK: Record<string, string> = {
    draft: '草稿',
    pending_review: '待审单',
    pending_pattern: '待纸样',
    pending_purchase: '待采购',
    pending_craft: '待工艺',
    pending_cutting: '待裁床',
    pending_sewing: '待车缝',
    pending_finishing: '待尾部',
    completed: '订单完成',
  }

  function getStatusLabel(status: string): string {
    return STATUS_LABEL_FALLBACK[status] ?? status
  }

  function openForceStatusDialog() {
    if (!orderId.value) return
    forceStatusDialogVisible.value = true
  }

  watch(() => sizeInfoApi.sizeInfoRows.value.length, () => { sizeInfoApi.initSizeInfoSortable() })
  onBeforeUnmount(() => { sizeInfoApi.destroySizeInfoSortable() })

  watch(() => materialsApi.materials.value.length, () => { materialsApi.initMaterialsSortable() })
  onBeforeUnmount(() => { materialsApi.destroyMaterialsSortable() })

  return {
    ...orderEditOptionsApi,
    ...attachmentsApi,
    ...processItemsApi,
    formRef,
    pageLoading,
    hasUnsavedChanges,
    orderId,
    orderStatus,
    orderNo,
    form,
    ...orderImageUploadApi,
    ...packagingApi,
    ...materialsApi,
    ...materialNameSearchApi,
    rules,
    ...customerSelectionApi,
    ...skuSelectionApi,
    ...colorSizeApi,
    setEditingCellNull,
    ...sizeInfoApi,
    onMerchandiserChange,
    revisionNotes,
    productionRequirement,
    saving,
    submitting,
    onSaveDraft,
    onSaveChanges,
    onSaveAndSubmit,
    isSuperAdmin,
    canForceOrderStatus,
    isDraftOrder,
    canSaveCurrentOrder,
    forceStatusDialogVisible,
    getStatusLabel,
    openForceStatusDialog,
    loadDetail,
    goBack,
  }
}
