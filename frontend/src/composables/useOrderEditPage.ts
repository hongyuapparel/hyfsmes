import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { createOrderDraft, getOrderDetail, submitOrder, updateOrderDraft, type OrderFormPayload } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useAuthStore } from '@/stores/auth'
import { useOrderAttachments } from '@/composables/useOrderAttachments'
import { useOrderColorSizeMatrix } from '@/composables/useOrderColorSizeMatrix'
import { useOrderCustomerSelection } from '@/composables/useOrderCustomerSelection'
import { useOrderDetailHydration } from '@/composables/useOrderDetailHydration'
import { useOrderEditOptions } from '@/composables/useOrderEditOptions'
import { useOrderEditPayload } from '@/composables/useOrderEditPayload'
import { useOrderImageUpload } from '@/composables/useOrderImageUpload'
import { useOrderMaterials } from '@/composables/useOrderMaterials'
import { useOrderPackaging } from '@/composables/useOrderPackaging'
import { useOrderProcessItems } from '@/composables/useOrderProcessItems'
import { useOrderSizeInfo } from '@/composables/useOrderSizeInfo'
import { useOrderSkuSelection } from '@/composables/useOrderSkuSelection'

export function useOrderEditPage() {
  const route = useRoute()
  const router = useRouter()

  const {
    processOptions,
    salespersonOptions,
    merchandiserOptions,
    collaborationItems,
    collaborationOptions,
    orderTypeTree,
    orderTypeTreeSelectData,
    orderTypeTreeSelectProps,
    factoryOptions,
    customerOptions,
    userLoading,
    loadProcessOptions,
    loadSalespersonOptions,
    loadMerchandiserOptions,
    loadCollaborationOptions,
    loadOrderTypeTree,
    loadFactoryOptions,
    loadCustomerOptions,
    findOrderTypeLabelById,
    findCollaborationLabelById,
    toOrderTypeTreeSelect,
  } = useOrderEditOptions()

  const {
    attachments,
    attachmentFileInputRef,
    draggingAttachmentIndex,
    dragOverAttachmentIndex,
    triggerAttachmentUpload,
    onAttachmentFileChange,
    removeAttachment,
    moveAttachment,
    onAttachmentDragStart,
    onAttachmentDragOver,
    onAttachmentDrop,
    onAttachmentDragEnd,
  } = useOrderAttachments()

  const { processItems, addProcessRow, removeProcessRow } = useOrderProcessItems()

  const ORDERS_LAST_EDIT_ID = 'orders_last_edit_id'
  const formRef = ref<FormInstance>()
  const pageLoading = ref(false)
  const hasUnsavedChanges = ref(false)
  let skipDirtyCheck = false

  const orderId = ref<number | undefined>(undefined)
  const orderStatus = ref<string>('draft')
  const initialRouteId = route.params.id
  if (initialRouteId) {
    const n = Number(initialRouteId)
    orderId.value = Number.isNaN(n) ? undefined : n
  }
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
    productionRequirement: '',
    packagingHeaders: [],
    packagingCells: [],
    packagingMethod: '',
    attachments: [],
  })

  const { orderImageFileInputRef, triggerOrderImageUpload, onOrderImageFileChange } = useOrderImageUpload(form)

  const {
    defaultPackagingHeaders,
    packagingHeaders,
    packagingCells,
    packagingMethod,
    packagingFileInputRef,
    accessoryDialogVisible,
    accessoryDialogLoading,
    accessoryItems,
    normalizePackagingCells,
    addPackagingHeader,
    removePackagingHeader,
    triggerPackagingUpload,
    onPackagingFileChange,
    openAccessoryDialog,
    onSelectAccessory,
  } = useOrderPackaging()

  const {
    materials,
    materialSourceOptions,
    materialTypeOptions,
    supplierOptions,
    supplierLoading,
    setMaterialCellRef,
    onMaterialCellKeydown,
    addMaterialRow,
    removeMaterialRow,
    loadMaterialTypes,
    loadMaterialSources,
    syncMaterialTypeIdsFromLabel,
    syncMaterialSourceIdsFromLabel,
    roundMaterialQty2,
    recalcPurchaseQuantity,
    onSupplierChange,
    searchProcessSuppliers,
    onMaterialTypeChange,
    onMaterialSupplierVisibleChange,
    searchMaterialSuppliers,
  } = useOrderMaterials()

  const rules: FormRules = {
    skuCode: [{ required: true, message: '请选择 SKU', trigger: 'change' }],
    customerId: [{ required: true, message: '请选择客户', trigger: 'change' }],
    collaborationTypeId: [{ required: true, message: '请选择合作方式', trigger: 'change' }],
    orderTypeId: [{ required: true, message: '请选择订单类型', trigger: 'change' }],
    customerDueDate: [{ required: true, message: '请选择客户交期', trigger: 'change' }],
    salePrice: [{
      validator: (_rule: any, value: any, callback: (err?: Error) => void) => {
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

  const {
    customerLoading,
    customerDialogVisible,
    customerDialogLoading,
    customerDialogList,
    selectedCustomer,
    customerTotal,
    customerPage,
    customerPageSize,
    customerDisplayText,
    openCustomerDialog,
    onSelectCustomer,
    clearSelectedCustomer,
    ensureCustomerById,
    onCustomerPageChange,
    onCustomerPageSizeChange,
    onCustomerKeywordChange,
  } = useOrderCustomerSelection(form)

  const {
    skuDialogVisible,
    skuDialogLoading,
    skuProducts,
    skuTotal,
    skuPage,
    skuPageSize,
    skuProductGroupName,
    skuApplicablePeopleName,
    selectedSkuMeta,
    openSkuDialog,
    onSkuPageChange,
    onSkuPageSizeChange,
    onSelectSku,
    onSkuKeywordChange,
  } = useOrderSkuSelection(form, selectedCustomer, ensureCustomerById)

  const {
    defaultSizeHeaders,
    sizeHeaders,
    colorRows,
    editingCell,
    bTableRef,
    colorNameInputRef,
    remarkInputRef,
    setColorCellRef,
    setActiveColorCell,
    startEditBCell,
    onBCellBlur,
    onColorCellKeydown,
    parseClipboardText,
    onColorCellPaste,
    normalizeColorRows,
    ensureAtLeastOneColorRow,
    addColorRow,
    removeColorRow,
    addSizeColumn,
    insertSizeColumnBefore,
    removeSizeColumn,
    grandTotal,
    calcRowTotal,
    bSummaryMethod,
  } = useOrderColorSizeMatrix({ onSizeHeadersChange: () => normalizeSizeInfoRows() })

  function setEditingCellNull() {
    editingCell.value = null
  }

  const {
    defaultSizeMetaHeaders,
    sizeMetaHeaders,
    sizeInfoRows,
    sizeInfoTableRef,
    setSizeGridCellRef,
    onSizeGridKeydown,
    onSizeGridPaste,
    normalizeSizeInfoRows,
    addSizeInfoRow,
    removeSizeInfoRow,
    initSizeInfoSortable,
    destroySizeInfoSortable,
    addSizeMetaColumn,
    removeSizeMetaColumn,
    copySizeInfoToClipboard,
    nextSizeInfoRowKey,
  } = useOrderSizeInfo({ sizeHeaders, parseClipboardText })

  function onMerchandiserChange(val: string) {
    const u = merchandiserOptions.value.find((x) => (x.displayName || x.username) === val)
    if (u?.mobile && !form.merchandiserPhone) form.merchandiserPhone = u.mobile
  }

  const productionRequirement = ref('')

  const { collectPayload } = useOrderEditPayload({
    form,
    formRef,
    grandTotal,
    colorRows,
    sizeHeaders,
    materials,
    sizeMetaHeaders,
    sizeInfoRows,
    processItems,
    productionRequirement,
    packagingHeaders,
    packagingCells,
    packagingMethod,
    attachments,
  })

  const { hydrateOrderDetail } = useOrderDetailHydration({
    form,
    orderNo,
    orderStatus,
    skuProductGroupName,
    skuApplicablePeopleName,
    ensureCustomerById,
    defaultSizeHeaders,
    sizeHeaders,
    colorRows,
    normalizeColorRows,
    ensureAtLeastOneColorRow,
    materials,
    roundMaterialQty2,
    recalcPurchaseQuantity,
    defaultSizeMetaHeaders,
    sizeMetaHeaders,
    sizeInfoRows,
    nextSizeInfoRowKey,
    normalizeSizeInfoRows,
    processItems,
    productionRequirement,
    defaultPackagingHeaders,
    packagingHeaders,
    packagingCells,
    normalizePackagingCells,
    packagingMethod,
    attachments,
  })

  watch(
    () => [form, colorRows.value, sizeHeaders.value, materials.value, sizeMetaHeaders.value, sizeInfoRows.value, processItems.value, productionRequirement.value, packagingHeaders.value, packagingCells.value, packagingMethod.value, attachments.value],
    () => { if (!skipDirtyCheck) hasUnsavedChanges.value = true },
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

  const saving = ref(false)
  const submitting = ref(false)

  async function onSaveDraft() {
    const payload = await collectPayload().catch(() => undefined)
    if (!payload) return
    saving.value = true
    try {
      if (orderId.value) {
        const res = await updateOrderDraft(orderId.value, payload)
        ElMessage.success('草稿已保存')
        orderStatus.value = (res.data as any)?.status ?? orderStatus.value
        orderNo.value = res.data?.orderNo ?? orderNo.value
        hasUnsavedChanges.value = false
        sessionStorage.setItem(ORDERS_LAST_EDIT_ID, String(orderId.value))
      } else {
        const res = await createOrderDraft(payload)
        ElMessage.success('草稿已创建')
        const id = res.data?.id
        orderStatus.value = (res.data as any)?.status ?? 'draft'
        orderNo.value = res.data?.orderNo ?? ''
        if (id) {
          orderId.value = id
          sessionStorage.setItem(ORDERS_LAST_EDIT_ID, String(id))
          const tabKey = typeof route.query?.tabKey === 'string' ? route.query.tabKey : undefined
          const title = `订单编辑 ${orderNo.value || id}`
          router.replace({ name: 'OrdersEdit', params: { id: String(id) }, query: { tabKey, tabTitle: title } })
        }
        hasUnsavedChanges.value = false
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      saving.value = false
    }
  }

  async function onSaveAndSubmit() {
    const payload = await collectPayload().catch(() => undefined)
    if (!payload) return
    submitting.value = true
    try {
      if (orderId.value) {
        await updateOrderDraft(orderId.value, payload)
        const res = await submitOrder(orderId.value)
        ElMessage.success('提交成功')
        orderNo.value = res.data?.orderNo ?? orderNo.value
        orderStatus.value = (res.data as any)?.status ?? orderStatus.value
        hasUnsavedChanges.value = false
        sessionStorage.setItem(ORDERS_LAST_EDIT_ID, String(orderId.value))
      } else {
        const draftRes = await createOrderDraft(payload)
        const id = draftRes.data?.id
        if (id) {
          orderId.value = id
          sessionStorage.setItem(ORDERS_LAST_EDIT_ID, String(id))
          const tabKey = typeof route.query?.tabKey === 'string' ? route.query.tabKey : undefined
          const title = `订单编辑 ${draftRes.data?.orderNo || id}`
          router.replace({ name: 'OrdersEdit', params: { id: String(id) }, query: { tabKey, tabTitle: title } })
          const res = await submitOrder(id)
          orderNo.value = res.data?.orderNo ?? draftRes.data?.orderNo ?? ''
          ElMessage.success('提交成功')
          orderStatus.value = (res.data as any)?.status ?? orderStatus.value
          hasUnsavedChanges.value = false
        }
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      submitting.value = false
    }
  }

  async function loadDetail() {
    if (!orderId.value) {
      form.orderDate = new Date().toISOString().slice(0, 10)
      ensureAtLeastOneColorRow()
      return
    }
    try {
      skipDirtyCheck = true
      const res = await getOrderDetail(orderId.value)
      const d = res.data
      if (!d) return
      await hydrateOrderDetail(d)
      sessionStorage.setItem(ORDERS_LAST_EDIT_ID, String(orderId.value))
      nextTick(() => {
        hasUnsavedChanges.value = false
        skipDirtyCheck = false
      })
    } catch (e: unknown) {
      skipDirtyCheck = false
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  function goBack() {
    router.push({ name: 'OrdersList' })
  }

  onMounted(async () => {
    if (route.query.new === '1') sessionStorage.removeItem(ORDERS_LAST_EDIT_ID)
    if (!route.params.id && route.query.new !== '1') {
      const lastId = sessionStorage.getItem(ORDERS_LAST_EDIT_ID)
      if (lastId) {
        const n = Number(lastId)
        if (!Number.isNaN(n) && n > 0) {
          const tabKey = typeof route.query?.tabKey === 'string' ? route.query.tabKey : undefined
          const title = typeof route.query?.tabTitle === 'string' ? route.query.tabTitle : undefined
          router.replace({ name: 'OrdersEdit', params: { id: lastId }, query: { tabKey, tabTitle: title } })
          orderId.value = n
        }
      }
    }

    if (orderId.value) pageLoading.value = true
    try {
      await Promise.all([
        (async () => {
          await Promise.all([loadCollaborationOptions(), loadOrderTypeTree(), loadSalespersonOptions(), loadMerchandiserOptions()])
          await loadMaterialTypes()
          await loadMaterialSources()
          await searchProcessSuppliers('')
          await loadProcessOptions()
        })(),
        loadDetail(),
      ])
      syncMaterialTypeIdsFromLabel()
      syncMaterialSourceIdsFromLabel()
      if (!orderId.value) {
        const authStore = useAuthStore()
        if (authStore.user) {
          const label = authStore.user.displayName || authStore.user.username
          if (!form.salesperson) form.salesperson = label
          const exists = salespersonOptions.value.some((u) => (u.displayName || u.username) === label)
          if (!exists) {
            salespersonOptions.value.unshift({
              id: authStore.user.id,
              username: authStore.user.username,
              displayName: authStore.user.displayName ?? '',
            })
          }
        }
      }
    } finally {
      pageLoading.value = false
      initSizeInfoSortable()
      nextTick(() => {
        hasUnsavedChanges.value = false
        skipDirtyCheck = false
      })
    }
  })

  watch(() => sizeInfoRows.value.length, () => { initSizeInfoSortable() })
  onBeforeUnmount(() => { destroySizeInfoSortable() })

  return {
    processOptions,
    salespersonOptions,
    merchandiserOptions,
    collaborationItems,
    collaborationOptions,
    orderTypeTree,
    orderTypeTreeSelectData,
    orderTypeTreeSelectProps,
    factoryOptions,
    customerOptions,
    userLoading,
    loadProcessOptions,
    loadSalespersonOptions,
    loadMerchandiserOptions,
    loadCollaborationOptions,
    loadOrderTypeTree,
    loadFactoryOptions,
    loadCustomerOptions,
    findOrderTypeLabelById,
    findCollaborationLabelById,
    toOrderTypeTreeSelect,
    attachments,
    attachmentFileInputRef,
    draggingAttachmentIndex,
    dragOverAttachmentIndex,
    triggerAttachmentUpload,
    onAttachmentFileChange,
    removeAttachment,
    moveAttachment,
    onAttachmentDragStart,
    onAttachmentDragOver,
    onAttachmentDrop,
    onAttachmentDragEnd,
    processItems,
    addProcessRow,
    removeProcessRow,
    formRef,
    pageLoading,
    hasUnsavedChanges,
    orderId,
    orderStatus,
    orderNo,
    form,
    orderImageFileInputRef,
    triggerOrderImageUpload,
    onOrderImageFileChange,
    defaultPackagingHeaders,
    packagingHeaders,
    packagingCells,
    packagingMethod,
    packagingFileInputRef,
    accessoryDialogVisible,
    accessoryDialogLoading,
    accessoryItems,
    normalizePackagingCells,
    addPackagingHeader,
    removePackagingHeader,
    triggerPackagingUpload,
    onPackagingFileChange,
    openAccessoryDialog,
    onSelectAccessory,
    materials,
    materialSourceOptions,
    materialTypeOptions,
    supplierOptions,
    supplierLoading,
    setMaterialCellRef,
    onMaterialCellKeydown,
    addMaterialRow,
    removeMaterialRow,
    loadMaterialTypes,
    loadMaterialSources,
    syncMaterialTypeIdsFromLabel,
    syncMaterialSourceIdsFromLabel,
    roundMaterialQty2,
    recalcPurchaseQuantity,
    onSupplierChange,
    searchProcessSuppliers,
    onMaterialTypeChange,
    onMaterialSupplierVisibleChange,
    searchMaterialSuppliers,
    rules,
    customerLoading,
    customerDialogVisible,
    customerDialogLoading,
    customerDialogList,
    selectedCustomer,
    customerTotal,
    customerPage,
    customerPageSize,
    customerDisplayText,
    openCustomerDialog,
    onSelectCustomer,
    clearSelectedCustomer,
    ensureCustomerById,
    onCustomerPageChange,
    onCustomerPageSizeChange,
    onCustomerKeywordChange,
    skuDialogVisible,
    skuDialogLoading,
    skuProducts,
    skuTotal,
    skuPage,
    skuPageSize,
    skuProductGroupName,
    skuApplicablePeopleName,
    selectedSkuMeta,
    openSkuDialog,
    onSkuPageChange,
    onSkuPageSizeChange,
    onSelectSku,
    onSkuKeywordChange,
    defaultSizeHeaders,
    sizeHeaders,
    colorRows,
    editingCell,
    bTableRef,
    colorNameInputRef,
    remarkInputRef,
    setColorCellRef,
    setActiveColorCell,
    startEditBCell,
    onBCellBlur,
    onColorCellKeydown,
    parseClipboardText,
    onColorCellPaste,
    normalizeColorRows,
    ensureAtLeastOneColorRow,
    addColorRow,
    removeColorRow,
    addSizeColumn,
    insertSizeColumnBefore,
    removeSizeColumn,
    grandTotal,
    calcRowTotal,
    bSummaryMethod,
    setEditingCellNull,
    defaultSizeMetaHeaders,
    sizeMetaHeaders,
    sizeInfoRows,
    sizeInfoTableRef,
    setSizeGridCellRef,
    onSizeGridKeydown,
    onSizeGridPaste,
    normalizeSizeInfoRows,
    addSizeInfoRow,
    removeSizeInfoRow,
    initSizeInfoSortable,
    destroySizeInfoSortable,
    addSizeMetaColumn,
    removeSizeMetaColumn,
    copySizeInfoToClipboard,
    nextSizeInfoRowKey,
    onMerchandiserChange,
    productionRequirement,
    saving,
    submitting,
    onSaveDraft,
    onSaveAndSubmit,
    loadDetail,
    goBack,
  }
}
