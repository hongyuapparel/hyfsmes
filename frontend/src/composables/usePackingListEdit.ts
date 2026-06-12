import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import {
  createPackingList,
  getPackingListDetail,
  updatePackingList,
  type PackingListDetail,
  type PickableLine,
  type SavePackingListPayload,
} from '@/api/packing-lists'
import { getAllCustomerCompanyOptions, type CustomerItem } from '@/api/customers'
import { getUsers, type UserItem } from '@/api/users'
import {
  allocationKey,
  createEmptyPackingItem,
  packingItemTotal,
  type PackingItemDraft,
  usePackingGridRows,
} from './usePackingGridRows'

function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function isEmptyManualRow(item: PackingItemDraft): boolean {
  return (
    item.sourceType === 'manual' &&
    !item.styleNo &&
    !item.colorName &&
    !item.imageUrl &&
    packingItemTotal(item) === 0
  )
}

export function usePackingListEdit(grid: ReturnType<typeof usePackingGridRows>) {
  const route = useRoute()
  const router = useRouter()

  const listId = ref<number | null>(null)
  const detail = ref<PackingListDetail | null>(null)
  const form = reactive({
    customerId: null as number | null,
    customerName: '',
    serviceManager: '',
    poNo: '',
    packDate: today() as string | null,
    remark: '',
    showCompany: true,
  })
  const loading = ref(false)
  const saving = ref(false)
  const customerOptions = ref<CustomerItem[]>([])
  const userOptions = ref<UserItem[]>([])
  /** 本次会话选过的货（用于剩余可发与前端超发校验；按 source+color 去重，后选覆盖先选） */
  const pickedLines = ref<PickableLine[]>([])

  const isReadonly = computed(() => detail.value?.status === 'shipped')
  const code = computed(() => detail.value?.code ?? '')

  async function loadOptions() {
    try {
      const [customers, users] = await Promise.all([getAllCustomerCompanyOptions(), getUsers()])
      customerOptions.value = customers
      userOptions.value = users.data
    } catch (e) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载选项失败'))
    }
  }

  function applyDetail(data: PackingListDetail) {
    detail.value = data
    listId.value = data.id
    form.customerId = data.customerId
    form.customerName = data.customerName
    form.serviceManager = data.serviceManager
    form.poNo = data.poNo
    form.packDate = data.packDate
    form.remark = data.remark
    form.showCompany = data.showCompany
    grid.sizeHeaders.value = [...data.sizeHeaders]
    grid.boxes.value = data.boxes.map((box, index) => ({
      key: `loaded-${data.id}-${box.id || index}`,
      weightKg: box.weightKg,
      cartonSize: box.cartonSize,
      remark: box.remark,
      items: box.items.length
        ? box.items.map((item) => ({
            styleNo: item.styleNo,
            styleName: item.styleName,
            colorName: item.colorName,
            imageUrl: item.imageUrl,
            sizeQuantities: { ...item.sizeQuantities },
            totalQty: item.totalQty,
            sourceType: item.sourceType === 'pending' || item.sourceType === 'finished' ? item.sourceType : 'manual',
            sourceId: item.sourceId,
          }))
        : [createEmptyPackingItem()],
    }))
  }

  async function load() {
    const rawId = route.params.id
    const id = rawId ? Number(rawId) : null
    if (!id) {
      listId.value = null
      detail.value = null
      grid.sizeHeaders.value = []
      grid.boxes.value = []
      grid.addBox()
      form.packDate = today()
      return
    }
    loading.value = true
    try {
      const res = await getPackingListDetail(id)
      applyDetail(res.data)
    } catch (e) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载装箱单失败'))
    } finally {
      loading.value = false
    }
  }

  function buildPayload(): SavePackingListPayload {
    return {
      customerId: form.customerId,
      customerName: form.customerName.trim(),
      serviceManager: form.serviceManager.trim(),
      poNo: form.poNo.trim(),
      packDate: form.packDate || null,
      remark: form.remark.trim(),
      showCompany: form.showCompany,
      sizeHeaders: [...grid.sizeHeaders.value],
      boxes: grid.boxes.value.map((box) => ({
        weightKg: box.weightKg,
        cartonSize: box.cartonSize,
        remark: box.remark,
        items: box.items
          .filter((item) => !isEmptyManualRow(item))
          .map((item) => ({
            styleNo: item.styleNo,
            styleName: item.styleName,
            colorName: item.colorName,
            imageUrl: item.imageUrl,
            sizeQuantities: item.sizeQuantities,
            totalQty: packingItemTotal(item),
            sourceType: item.sourceType,
            sourceId: item.sourceId,
          })),
      })),
    }
  }

  /** 保存草稿。silent 时不弹成功提示（发货前置保存用）。返回是否成功 */
  async function save(silent = false): Promise<boolean> {
    if (!form.customerName.trim()) {
      ElMessage.warning('请先填写客户')
      return false
    }
    saving.value = true
    try {
      if (listId.value) {
        await updatePackingList(listId.value, buildPayload())
        if (!silent) ElMessage.success('已保存')
        const res = await getPackingListDetail(listId.value)
        applyDetail(res.data)
      } else {
        const res = await createPackingList(buildPayload())
        listId.value = res.data.id
        if (!silent) ElMessage.success(`已保存（单号 ${res.data.code}）`)
        await router.replace(`/inventory/packing/edit/${res.data.id}`)
        const detailRes = await getPackingListDetail(res.data.id)
        applyDetail(detailRes.data)
      }
      return true
    } catch (e) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '保存失败'))
      return false
    } finally {
      saving.value = false
    }
  }

  /** 客户切换：已有来源行时提醒并清空（来源行客户必须一致） */
  async function onCustomerChange() {
    const matched = customerOptions.value.find((c) => c.companyName === form.customerName)
    form.customerId = matched?.id ?? null
    if (matched?.salesperson && !form.serviceManager) form.serviceManager = matched.salesperson
    const hasSourceRows = grid.boxes.value.some((box) => box.items.some((item) => item.sourceType !== 'manual'))
    if (!hasSourceRows) return
    try {
      await ElMessageBox.confirm('切换客户后，已选的待仓/成品来源行将被清空，是否继续？', '切换客户', { type: 'warning' })
    } catch {
      return
    }
    for (const box of grid.boxes.value) {
      box.items = box.items.filter((item) => item.sourceType === 'manual')
      if (!box.items.length) box.items.push(createEmptyPackingItem())
    }
    pickedLines.value = []
  }

  /** 选货进箱：默认填充剩余可发（picked 值减已分配），并补齐缺失的码列 */
  function addPickedLines(boxIndex: number, lines: PickableLine[]) {
    const allocation = grid.allocationBySource.value
    for (const line of lines) {
      const key = allocationKey(line.sourceType, line.sourceId, line.colorName)
      const allocated = allocation.get(key)
      const remaining: Record<string, number> = {}
      for (const [size, qty] of Object.entries(line.sizeQuantities)) {
        const left = qty - (allocated?.sizeQuantities[size] ?? 0)
        if (left > 0) remaining[size] = left
      }
      const remainingTotal = line.hasSnapshot
        ? Object.values(remaining).reduce((sum, n) => sum + n, 0)
        : Math.max(0, line.totalQty - (allocated?.totalQty ?? 0))
      if (remainingTotal <= 0) continue
      for (const size of Object.keys(remaining)) grid.insertSizeHeader(size)
      const item: PackingItemDraft = {
        styleNo: line.styleNo,
        styleName: '',
        colorName: line.colorName,
        imageUrl: line.imageUrl,
        sizeQuantities: remaining,
        totalQty: line.hasSnapshot ? 0 : remainingTotal,
        sourceType: line.sourceType,
        sourceId: line.sourceId,
      }
      const box = grid.boxes.value[boxIndex]
      if (!box) continue
      const emptyIndex = box.items.findIndex(isEmptyManualRow)
      if (emptyIndex >= 0) box.items.splice(emptyIndex, 1, item)
      else box.items.push(item)
      pickedLines.value = [...pickedLines.value.filter((p) => allocationKey(p.sourceType, p.sourceId, p.colorName) !== key), line]
    }
    if (!form.customerName.trim() && lines[0]?.customerName) {
      form.customerName = lines[0].customerName
      onCustomerChange()
    }
  }

  return {
    listId,
    detail,
    form,
    loading,
    saving,
    isReadonly,
    code,
    customerOptions,
    userOptions,
    pickedLines,
    loadOptions,
    load,
    save,
    applyDetail,
    onCustomerChange,
    addPickedLines,
  }
}
