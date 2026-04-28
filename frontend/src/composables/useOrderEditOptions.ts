import { computed, ref } from 'vue'
import request, { getErrorMessage, isErrorHandled } from '@/api/request'
import { getDictItems, getDictTree } from '@/api/dicts'
import type { SystemOptionItem, SystemOptionTreeNode } from '@/api/system-options'
import {
  getSupplierBusinessScopeOptions,
  getSupplierBusinessScopeTreeOptions,
  type SupplierBusinessScopeTreeNode,
} from '@/api/suppliers'
import {
  getCustomers,
  getMerchandisers,
  getSalespeople,
  type CustomerItem,
} from '@/api/customers'

interface SimpleUser {
  id: number
  username: string
  displayName: string
  mobile?: string
}

interface ProcessOptionNode {
  label: string
  value: string
  children?: ProcessOptionNode[]
}

const salespersonOptions = ref<SimpleUser[]>([])
const merchandiserOptions = ref<SimpleUser[]>([])
const userLoadingCount = ref(0)
const userLoading = computed(() => userLoadingCount.value > 0)

const collaborationItems = ref<Array<{ id: number; value: string }>>([])
const collaborationOptions = computed(() =>
  collaborationItems.value.map((item) => ({
    id: item.id,
    label: item.value,
  })),
)

const orderTypeTree = ref<SystemOptionTreeNode[]>([])
const processOptions = ref<ProcessOptionNode[]>([])
const factoryOptions = ref<{ label: string; value: string }[]>([])
const customerOptions = ref<{ label: string; value: string }[]>([])

function toOrderTypeTreeSelect(
  nodes: SystemOptionTreeNode[],
): { label: string; value: number; children?: Array<{ label: string; value: number; children?: unknown[]; disabled?: boolean }>; disabled?: boolean }[] {
  return nodes.map((n) => {
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children) : []
    const hasChildren = children.length > 0
    return {
      label: n.value,
      value: n.id,
      children: hasChildren ? children : undefined,
      disabled: hasChildren,
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

function normalizeUserNames(names: string[] | null | undefined): SimpleUser[] {
  return (names ?? [])
    .map((name, index) => {
      const value = String(name ?? '').trim()
      if (!value) return null
      return {
        id: index + 1,
        username: value,
        displayName: value,
      }
    })
    .filter((item): item is SimpleUser => !!item)
}

async function loadSalespersonOptions() {
  userLoadingCount.value += 1
  try {
    const res = await getSalespeople()
    salespersonOptions.value = normalizeUserNames(res.data)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('Failed to load salesperson options', getErrorMessage(e))
  } finally {
    userLoadingCount.value = Math.max(0, userLoadingCount.value - 1)
  }
}

async function loadMerchandiserOptions() {
  userLoadingCount.value += 1
  try {
    const res = await getMerchandisers()
    merchandiserOptions.value = normalizeUserNames(res.data)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('Failed to load merchandiser options', getErrorMessage(e))
  } finally {
    userLoadingCount.value = Math.max(0, userLoadingCount.value - 1)
  }
}

async function loadCollaborationOptions() {
  try {
    const res = await getDictItems('collaboration')
    const items = res.data ?? []
    collaborationItems.value = Array.isArray(items)
      ? items
          .filter((item): item is SystemOptionItem => !!item && typeof item === 'object' && 'id' in item && 'value' in item)
          .map((item) => ({ id: item.id, value: item.value }))
      : []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('Failed to load collaboration options', getErrorMessage(e))
  }
}

async function loadOrderTypeTree() {
  try {
    const res = await getDictTree('order_types')
    const tree = res.data ?? []
    orderTypeTree.value = Array.isArray(tree) ? tree : []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('Failed to load order type tree', getErrorMessage(e))
  }
}

async function loadProcessOptions() {
  try {
    const res = await getSupplierBusinessScopeTreeOptions('\u5DE5\u827A\u4F9B\u5E94\u5546')
    const toTreeSelect = (
      nodes: SupplierBusinessScopeTreeNode[],
      parentPath = '',
    ): ProcessOptionNode[] =>
      nodes.map((n) => {
        const path = parentPath ? `${parentPath} / ${n.value}` : n.value
        return {
          label: n.value,
          value: path,
          children: n.children?.length ? toTreeSelect(n.children, path) : undefined,
        }
      })
    processOptions.value = toTreeSelect(res.data ?? [])
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('Failed to load process options', getErrorMessage(e))
  }
}

async function loadFactoryOptions() {
  try {
    const res = await getSupplierBusinessScopeOptions('\u52A0\u5DE5\u4F9B\u5E94\u5546')
    const factoryVals = [...(res.data ?? [])]
    const uniqueFactoryVals = Array.from(new Set(factoryVals.map((v) => String(v).trim()).filter(Boolean)))
    factoryOptions.value = uniqueFactoryVals.map((v) => ({ label: v, value: v }))
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('Failed to load factory options', getErrorMessage(e))
  }
}

async function loadCustomerOptions() {
  try {
    const res = await getCustomers({ page: 1, pageSize: 200 })
    const custList = (res.data?.list ?? []) as CustomerItem[]
    customerOptions.value = custList.map((c) => ({
      label: c.companyName,
      value: c.companyName,
    }))
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('Failed to load customer options', getErrorMessage(e))
  }
}

const orderTypeTreeSelectProps = {
  label: 'label',
  value: 'value',
  children: 'children',
  disabled: 'disabled',
}

export function useOrderEditOptions() {
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
  }
}
