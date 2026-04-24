import { computed, ref } from 'vue'
import { getCustomers, getSalespeople, getMerchandisers, type CustomerItem } from '@/api/customers'
import { getDictItems, getDictTree } from '@/api/dicts'
import { getOrderStatuses, type OrderStatusItem } from '@/api/order-status-config'
import {
  getSupplierBusinessScopeOptions,
  getSupplierBusinessScopeTreeOptions,
  type SupplierBusinessScopeTreeNode,
} from '@/api/suppliers'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { type SystemOptionItem, type SystemOptionTreeNode } from '@/api/system-options'

const DEFAULT_STATUS_TABS: Array<{ label: string; value: string }> = [
  { label: '全部', value: 'all' },
  { label: '草稿', value: 'draft' },
  { label: '待审单', value: 'pending_review' },
  { label: '待纸样', value: 'pending_pattern' },
  { label: '待采购', value: 'pending_purchase' },
  { label: '待裁床', value: 'pending_cutting' },
  { label: '待车缝', value: 'pending_sewing' },
  { label: '待尾部', value: 'pending_finishing' },
  { label: '订单完成', value: 'completed' },
]

const DEFAULT_STATUS_LABEL_MAP: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审单',
  pending_pattern: '待纸样',
  pending_purchase: '待采购',
  pending_cutting: '待裁床',
  pending_sewing: '待车缝',
  pending_finishing: '待尾部',
  completed: '订单完成',
}

interface ProcessOptionNode {
  label: string
  value: string
  children?: ProcessOptionNode[]
}

interface OrderTypeTreeSelectNode {
  label: string
  value: number
  children?: OrderTypeTreeSelectNode[]
  disabled?: boolean
}

interface DictItemLike {
  id: number
  value: string
}

export function useOrderListOptions() {
  // 订单状态标签：先渲染默认值，接口返回后再覆盖
  const STATUS_TABS = ref<Array<{ label: string; value: string }>>([...DEFAULT_STATUS_TABS])

  // 状态编码 -> 中文名 映射：先用默认值，接口返回后再覆盖
  const STATUS_LABEL_MAP = ref<Record<string, string>>({ ...DEFAULT_STATUS_LABEL_MAP })

  const orderTypeTree = ref<SystemOptionTreeNode[]>([])
  const collaborationItems = ref<Array<{ id: number; value: string }>>([])
  const processOptions = ref<ProcessOptionNode[]>([])
  const factoryOptions = ref<{ label: string; value: string }[]>([])
  const customerOptions = ref<{ label: string; value: string }[]>([])
  const salespersonOptions = ref<string[]>([])
  const merchandiserOptions = ref<string[]>([])

  async function loadStatusTabs() {
    try {
      const res = await getOrderStatuses()
      const all: OrderStatusItem[] = res.data ?? []
      // 为避免「启用」状态配置异常导致订单列表状态栏全部消失，这里暂时忽略 enabled，仅按排序展示所有状态
      const sorted = [...all].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id - b.id)

      STATUS_TABS.value = [
        { label: '全部', value: 'all' },
        ...sorted.map((s) => ({
          label: s.label,
          value: s.code,
        })),
      ]

      const map: Record<string, string> = {}
      for (const s of sorted) {
        map[s.code] = s.label
      }
      STATUS_LABEL_MAP.value = map
    } catch (e: unknown) {
      // 状态配置加载失败时，保留本地默认状态标签，避免页面出现“像没有 tab”的空窗感
      if (!isErrorHandled(e)) {
        console.warn('订单状态配置加载失败：', getErrorMessage(e, '状态加载失败'))
      }
    }
  }

  function toOrderTypeTreeSelect(
    nodes: SystemOptionTreeNode[],
  ): OrderTypeTreeSelectNode[] {
    return nodes.map((n) => {
      const children = n.children?.length ? toOrderTypeTreeSelect(n.children) : []
      return {
        label: n.value,
        value: n.id,
        children: children.length ? children : undefined,
      }
    })
  }

  const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))

  function findOrderTypeLabelById(id: number | null | undefined): string {
    if (!id) return ''
    const stack: SystemOptionTreeNode[] = [...orderTypeTree.value]
    while (stack.length) {
      const node = stack.pop()!
      if (node.id === id) return node.value
      if (node.children?.length) stack.push(...node.children)
    }
    return ''
  }

  function findCollaborationLabelById(id: number | null | undefined): string {
    if (!id) return ''
    const found = collaborationItems.value.find((item) => item.id === id)
    return found?.value ?? ''
  }

  function getProcessItemDisplayLabel(v: string | undefined): string {
    if (!v) return ''
    const parts = v
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean)
    return parts.length ? parts[parts.length - 1] : v
  }

  async function loadOrderTypeTree() {
    const orderTypeRes = await getDictTree('order_types')
    const orderTypeVals = orderTypeRes.data ?? []
    orderTypeTree.value = Array.isArray(orderTypeVals) ? orderTypeVals : []
  }

  async function loadCollaborationItems() {
    const collabRes = await getDictItems('collaboration')
    const collabVals = collabRes.data ?? []
    collaborationItems.value = Array.isArray(collabVals)
      ? collabVals
          .filter((item): item is SystemOptionItem => !!item && typeof item === 'object' && 'id' in item && 'value' in item)
          .map((item) => ({ id: item.id, value: item.value }))
      : []
  }

  async function loadProcessOptions() {
    const processRes = await getSupplierBusinessScopeTreeOptions('工艺供应商')
    const toProcessTreeSelect = (
      nodes: SupplierBusinessScopeTreeNode[],
      parentPath = '',
    ): ProcessOptionNode[] =>
      nodes.map((n) => {
        const path = parentPath ? `${parentPath} / ${n.value}` : n.value
        return {
          label: n.value,
          value: path,
          children: n.children?.length ? toProcessTreeSelect(n.children, path) : undefined,
        }
      })
    processOptions.value = toProcessTreeSelect(processRes.data ?? [])
  }

  async function loadFactoryOptions() {
    const factoryRes = await getSupplierBusinessScopeOptions('加工供应商')
    const factoryVals = [...(factoryRes.data ?? [])]
    const uniqueFactoryVals = Array.from(new Set(factoryVals.map((v) => String(v).trim()).filter(Boolean)))
    factoryOptions.value = uniqueFactoryVals.map((v) => ({ label: v, value: v }))
  }

  async function loadCustomerOptions() {
    const custRes = await getCustomers({ page: 1, pageSize: 200 })
    const custList = (custRes.data?.list ?? []) as CustomerItem[]
    customerOptions.value = custList.map((c) => ({
      label: c.companyName,
      value: c.companyName,
    }))
  }

  async function loadSalespersonOptions() {
    const salesRes = await getSalespeople()
    salespersonOptions.value = salesRes.data ?? []
  }

  async function loadMerchandiserOptions() {
    const merchRes = await getMerchandisers()
    merchandiserOptions.value = merchRes.data ?? []
  }

  async function loadOptions() {
    // 1）基础选项：客户 / 业务员 / 订单类型 / 合作方式 / 工艺项目 / 加工供应商
    try {
      await Promise.all([
        loadCustomerOptions(),
        loadSalespersonOptions(),
        loadOrderTypeTree(),
        loadCollaborationItems(),
        loadProcessOptions(),
        loadFactoryOptions(),
      ])
    } catch (e: unknown) {
      if (!isErrorHandled(e)) {
        console.warn('订单筛选选项加载失败：', getErrorMessage(e, '选项加载失败'))
      }
    }

    // 2）跟单员单独请求，避免影响其他选项
    try {
      await loadMerchandiserOptions()
    } catch (e: unknown) {
      // 跟单员加载失败时，仅保留为空列表，不影响其他筛选
      if (!isErrorHandled(e)) {
        console.warn('跟单员选项加载失败：', getErrorMessage(e, '选项加载失败'))
      }
    }
  }

  return {
    STATUS_TABS,
    STATUS_LABEL_MAP,
    orderTypeTree,
    orderTypeTreeSelectData,
    collaborationItems,
    processOptions,
    factoryOptions,
    customerOptions,
    salespersonOptions,
    merchandiserOptions,
    loadStatusTabs,
    toOrderTypeTreeSelect,
    findOrderTypeLabelById,
    findCollaborationLabelById,
    getProcessItemDisplayLabel,
    loadOrderTypeTree,
    loadCollaborationItems,
    loadProcessOptions,
    loadFactoryOptions,
    loadCustomerOptions,
    loadSalespersonOptions,
    loadMerchandiserOptions,
    loadOptions,
  }
}
