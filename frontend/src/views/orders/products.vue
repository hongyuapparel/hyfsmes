<template>
  <div class="page-card">
    <!-- 图片上传用隐藏 input，放在 v-for 外避免 ref 被覆盖 -->
    <input
      ref="imageFileInputRef"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      class="image-file-input-hidden"
      @change="onImageFileChange"
    />
    <div class="products-layout">
      <!-- 左侧：分组目录 -->
      <aside class="products-sidebar" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
        <div class="sidebar-header">
          <span class="sidebar-title">产品分组</span>
          <el-button link type="primary" :icon="sidebarCollapsed ? ArrowRight : ArrowLeft" class="sidebar-toggle" @click="sidebarCollapsed = !sidebarCollapsed" />
        </div>
        <div v-show="!sidebarCollapsed" class="sidebar-body">
          <el-menu
            :default-active="currentGroupPath"
            class="group-menu"
            @select="onMenuSelect"
          >
            <el-menu-item
              v-for="node in flatGroupNodes"
              :key="node.path === '' ? '__all__' : node.path"
              :index="node.path"
              class="group-menu-item"
              :style="{ paddingLeft: 12 + node.depth * 16 + 'px' }"
            >
              <span class="group-menu-label">
                <span
                  v-if="node.hasChildren"
                  class="group-menu-toggle"
                  @click.stop="toggleGroupCollapse(node.path)"
                >
                  <el-icon>
                    <ArrowDown v-if="!node.collapsed" />
                    <ArrowRight v-else />
                  </el-icon>
                </span>
                <span class="group-menu-text">{{ node.label }}</span>
              </span>
              <span v-if="node.count !== undefined" class="group-menu-count">({{ node.count }})</span>
            </el-menu-item>
          </el-menu>
        </div>
      </aside>
      <!-- 右侧：产品详情 -->
      <main ref="productsMainRef" class="products-main">
        <!-- 顶部筛选 -->
        <div ref="filterBarRef" class="filter-bar">
          <el-input
            v-model="filter.companyName"
            placeholder="客户"
            clearable
            size="large"
            class="filter-bar-item"
            :style="getTextFilterStyle('客户：', filter.companyName, companyNameLabelVisible)"
            :input-style="getFilterInputStyle(filter.companyName)"
            @input="debouncedSearch"
            @keyup.enter="onFilterChange(true)"
          >
            <template #prefix>
              <span
                v-if="filter.companyName && companyNameLabelVisible"
                :style="{ color: ACTIVE_FILTER_COLOR }"
              >
                客户：
              </span>
            </template>
          </el-input>
          <el-input
            v-model="filter.skuCode"
            placeholder="SKU编号"
            clearable
            size="large"
            class="filter-bar-item"
            :style="getTextFilterStyle('SKU编号：', filter.skuCode, skuCodeLabelVisible)"
            :input-style="getFilterInputStyle(filter.skuCode)"
            @input="debouncedSearch"
            @keyup.enter="onFilterChange(true)"
          >
            <template #prefix>
              <span
                v-if="filter.skuCode && skuCodeLabelVisible"
                :style="{ color: ACTIVE_FILTER_COLOR }"
              >
                SKU编号：
              </span>
            </template>
          </el-input>
          <el-select
            v-model="filter.salesperson"
            placeholder="业务员"
            clearable
            filterable
            size="large"
            class="filter-bar-item"
            :style="getFilterSelectAutoWidthStyle(filter.salesperson)"
            @change="onFilterChange"
          >
            <template #label="{ label }">
              <span v-if="filter.salesperson">业务员：{{ label }}</span>
              <span v-else>{{ label }}</span>
            </template>
            <el-option v-for="s in salespeople" :key="s" :label="s" :value="s" />
          </el-select>
          <el-button type="primary" size="large" @click="onFilterChange(true)">筛选</el-button>
          <el-button size="large" @click="resetFilter">清空</el-button>

          <div class="filter-actions">
            <el-button size="large" @click="openColumnConfig">列设置</el-button>
            <el-button type="primary" size="large" @click="openCreate">新建SKU</el-button>
            <el-button size="large" :disabled="!selectedIds.length" @click="batchDelete">删除</el-button>
          </div>
        </div>

        <!-- 表格：字段驱动 -->
        <el-table
          ref="tableRef"
          class="products-table"
          :data="list"
          border
          stripe
          :fit="true"
          :height="tableHeight"
          :row-style="() => ({ height: '34px' })"
          :cell-style="getCellStyle"
          :header-cell-style="getHeaderCellStyle"
          @selection-change="onSelectionChange"
          @sort-change="onSortChange"
        >
          <el-table-column type="selection" width="50" />
          <el-table-column
            v-for="f in tableFields"
            :key="f.code"
            :prop="f.code === 'companyName' ? undefined : f.code"
            :label="f.label"
            :min-width="getColumnMinWidth(f)"
            :sortable="f.sortable ? 'custom' : false"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <template v-if="f.type === 'image'">
                <el-popover
                  v-if="row[f.code]"
                  placement="right"
                  trigger="hover"
                  :width="320"
                  popper-class="product-image-popover"
                >
                  <template #reference>
                    <el-image
                      :src="row[f.code]"
                      fit="cover"
                      :preview-src-list="[row[f.code]]"
                      style="width: 40px; height: 40px; border-radius: 4px; cursor: pointer"
                    />
                  </template>
                  <el-image
                    :src="row[f.code]"
                    fit="contain"
                    style="max-width: 300px; max-height: 300px; border-radius: 6px"
                  />
                </el-popover>
                <span v-else>-</span>
              </template>
              <span v-else-if="f.type === 'date'">{{ formatDate(row[f.code]) }}</span>
              <span v-else-if="f.code === 'companyName'">{{ row.customer?.companyName ?? '-' }}</span>
              <span v-else>{{ row[f.code] ?? '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div ref="paginationWrapRef" class="pagination-wrap">
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            @current-change="load"
            @size-change="load"
          />
        </div>
      </main>
    </div>

    <!-- 列设置弹窗 -->
    <el-dialog v-model="columnConfigVisible" title="列设置" width="480" class="column-config-dialog">
      <p class="column-config-hint">可调整列顺序与显示/隐藏，修改后立即生效。</p>
      <div class="column-config-list">
        <div v-for="(f, idx) in columnConfigList" :key="f.id" class="column-config-item">
          <el-checkbox v-model="f.visible" @change="onColumnVisibleChange(f)">{{ f.label }}</el-checkbox>
          <div class="column-config-actions">
            <el-button link size="small" :disabled="idx === 0" @click="moveColumn(f, -1)">上移</el-button>
            <el-button link size="small" :disabled="idx === columnConfigList.length - 1" @click="moveColumn(f, 1)">下移</el-button>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="columnConfigVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 新建/编辑弹窗：字段驱动 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑产品' : '新建SKU'" width="520" class="product-form-dialog" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100">
        <el-form-item
          v-for="f in formFields"
          :key="f.code"
          :label="f.label"
          :prop="f.code"
        >
          <el-input
            v-if="f.type === 'text'"
            v-model="form[f.code]"
            :placeholder="f.placeholder"
            :disabled="f.code === 'skuCode' && isEdit"
            type="text"
            size="default"
          />
          <div v-else-if="f.type === 'image'" class="image-upload-wrap" v-loading="imageUploading" element-loading-text="上传中...">
            <div
              class="image-upload-area"
              :class="{ 'has-image': form[f.code], 'drag-over': imageDragOver }"
              @click="imageUploadAreaClick"
              @paste.prevent="onImagePaste"
              @dragover.prevent="imageDragOver = true"
              @dragleave="imageDragOver = false"
              @drop.prevent="onImageDrop"
            >
              <template v-if="form[f.code]">
                <el-image
                  :src="form[f.code]"
                  fit="cover"
                  class="image-preview"
                  :preview-src-list="[form[f.code]]"
                />
                <el-button type="danger" link size="small" class="image-clear" @click.stop="form[f.code] = ''">移除</el-button>
              </template>
              <template v-else>
                <span class="image-upload-hint">{{ imageDragOver ? '松开上传' : '点击上传、拖拽或粘贴图片' }}</span>
              </template>
            </div>
            <el-input
              v-model="form[f.code]"
              placeholder="或直接输入图片URL"
              size="small"
              class="image-url-input"
            />
          </div>
          <el-tree-select
            v-else-if="f.type === 'select' && f.code === 'productGroup'"
            v-model="form[f.code]"
            :data="productGroupTreeSelectData"
            :placeholder="f.placeholder"
            filterable
            default-expand-all
            :render-after-expand="false"
            node-key="value"
            :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
            size="default"
            style="width: 100%"
          />
          <el-select
            v-else-if="f.code === 'companyName'"
            v-model="form.customerId"
            placeholder="选择客户"
            filterable
            clearable
            size="default"
            style="width: 100%"
          >
            <el-option
              v-for="c in customers"
              :key="c.id"
              :label="c.companyName"
              :value="c.id"
            />
          </el-select>
          <el-select
            v-else-if="f.type === 'select'"
            v-model="form[f.code]"
            :placeholder="f.placeholder"
            filterable
            :allow-create="f.optionsKey !== 'customers'"
            default-first-option
            size="default"
            style="width: 100%"
          >
            <el-option
              v-for="opt in getOptions(f)"
              :key="String(opt.value)"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, computed, nextTick, onBeforeUnmount } from 'vue'
import { ArrowLeft, ArrowRight, ArrowDown } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { PRODUCT_FIELDS_SORTED } from '@/fields'
import {
  getFieldDefinitions,
  updateFieldDefinition,
  batchUpdateFieldOrder,
  type FieldDefinitionItem,
} from '@/api/field-definitions'
import {
  getProducts,
  createProduct,
  updateProduct,
  batchDeleteProducts,
  getProductGroups,
  getProductSalespeople,
  getProductGroupCounts,
  getNextSkuCode,
  type ProductItem,
} from '@/api/products'
import { getCustomers, type CustomerItem } from '@/api/customers'
import { getSystemOptionsTree, type SystemOptionTreeNode } from '@/api/system-options'
import { uploadImage } from '@/api/uploads'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { checkSkuExists } from '@/api/products'

const tableRef = ref<InstanceType<typeof import('element-plus')['ElTable']>>()
const formRef = ref<FormInstance>()
const list = ref<ProductItem[]>([])
const productGroups = ref<string[]>([])
const productGroupsTree = ref<SystemOptionTreeNode[]>([])
const groupCountsMap = ref<Record<string, number>>({})
const sidebarCollapsed = ref(false)
const salespeople = ref<string[]>([])
const customers = ref<{ id: number; companyName: string }[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const submitLoading = ref(false)
const selectedIds = ref<number[]>([])
const fieldDefinitions = ref<FieldDefinitionItem[]>([])
const imageFileInputRef = ref<HTMLInputElement | null>(null)
const imageDragOver = ref(false)
const imageUploading = ref(false)

const productsMainRef = ref<HTMLElement | null>(null)
const filterBarRef = ref<HTMLElement | null>(null)
const paginationWrapRef = ref<HTMLElement | null>(null)
const tableHeight = ref<number | undefined>(undefined)
let tableResizeObserver: ResizeObserver | null = null

const filter = reactive({ companyName: '', skuCode: '', productGroup: '', salesperson: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const sort = reactive({ sortBy: 'id', sortOrder: 'asc' as 'asc' | 'desc' })

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeInputStyle = { color: ACTIVE_FILTER_COLOR }
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }

function getFilterInputStyle(v: unknown) {
  return v ? activeInputStyle : undefined
}

function getFilterSelectStyle(v: unknown) {
  return v ? activeSelectStyle : undefined
}

function getFilterSelectAutoWidthStyle(v: unknown) {
  if (!v) return undefined
  const text = String(v)
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return {
    ...activeSelectStyle,
    width: `${width}px`,
    flex: `0 0 ${width}px`,
  }
}

function getTextFilterStyle(labelPrefix: string, value: unknown, showLabel: boolean) {
  if (!value || !showLabel) return undefined
  const text = `${labelPrefix}${String(value)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}

const companyNameLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)

/** 左侧分组树数据（含每节点产品数量）；根节点为「全部分组」 */
interface GroupTreeNode {
  path: string
  label: string
  count: number
  children?: GroupTreeNode[]
}

interface FlatGroupNode {
  path: string
  label: string
  count: number
  depth: number
  hasChildren: boolean
  collapsed: boolean
}

const collapsedGroupPaths = ref<string[]>([])
const groupTreeWithCounts = computed(() => {
  const map = groupCountsMap.value
  function build(nodes: SystemOptionTreeNode[], parentPath = ''): GroupTreeNode[] {
    return nodes.map((n) => {
      const path = parentPath ? `${parentPath} > ${n.value}` : n.value
      const childNodes = n.children?.length ? build(n.children, path) : []
      const childSum = childNodes.reduce((s, c) => s + c.count, 0)
      const direct = map[path] ?? 0
      const count = direct + childSum
      return { path, label: n.value, count, children: childNodes.length ? childNodes : undefined }
    })
  }
  const children = build(productGroupsTree.value)
  const totalFromMap = Object.values(map).reduce((s, n) => s + n, 0)
  return [{ path: '', label: '全部分组', count: totalFromMap, children: children.length ? children : undefined }]
})

/** 扁平化分组树（含层级深度），供侧边 el-menu 渲染 */
const flatGroupNodes = computed<FlatGroupNode[]>(() => {
  const collapsed = collapsedGroupPaths.value
  function flatten(nodes: GroupTreeNode[], depth = 0): FlatGroupNode[] {
    const result: FlatGroupNode[] = []
    for (const n of nodes) {
      const hasChildren = !!n.children?.length
      const isCollapsed = collapsed.includes(n.path)
      result.push({
        path: n.path,
        label: n.label,
        count: n.count,
        depth,
        hasChildren,
        collapsed: isCollapsed,
      })
      if (hasChildren && !isCollapsed) {
        result.push(...flatten(n.children!, depth + 1))
      }
    }
    return result
  }
  return flatten(groupTreeWithCounts.value)
})

const currentGroupPath = computed(() => filter.productGroup ?? '')

function onMenuSelect(index: string) {
  filter.productGroup = index
  pagination.page = 1
  load()
}

function toggleGroupCollapse(path: string) {
  if (!path && path !== '') return
  const list = collapsedGroupPaths.value
  const i = list.indexOf(path)
  if (i >= 0) list.splice(i, 1)
  else list.push(path)
}

/** 表格字段：优先使用 API 配置，否则用静态配置；仅显示 visible 的列 */
const tableFields = computed(() => {
  const src = fieldDefinitions.value.length ? fieldDefinitions.value : PRODUCT_FIELDS_SORTED
  const list = Array.isArray(src)
    ? (src as { code: string; label: string; type: string; sortable?: boolean; visible?: number }[])
    : []
  return list
    .filter((f) => (f as { visible?: number }).visible !== 0)
    .sort((a, b) => ((a as { order?: number }).order ?? 0) - ((b as { order?: number }).order ?? 0))
    .map((f) => ({
      code: f.code,
      label: f.label,
      type: f.type,
      sortable: (f as { sortable?: number }).sortable ? true : false,
    }))
})

/** 表单字段：排除仅展示字段 */
const formFields = computed(() => {
  const src = fieldDefinitions.value.length ? fieldDefinitions.value : PRODUCT_FIELDS_SORTED
  const list = Array.isArray(src)
    ? (src as { code: string; label: string; type: string; optionsKey?: string }[])
    : []
  return list
    .filter((f) => f.code !== 'createdAt' && f.code !== 'companyName')
    .filter((f) => (f as { visible?: number }).visible !== 0)
    .sort((a, b) => ((a as { order?: number }).order ?? 0) - ((b as { order?: number }).order ?? 0))
})

const form = reactive<Record<string, string | number | null>>({})
const formRules = computed<FormRules>(() => {
  const r: FormRules = {}
  for (const f of formFields.value) {
    if (f.code === 'skuCode') {
      r[f.code] = [
        { required: true, message: `请输入${f.label}`, trigger: 'blur' },
        {
          validator: async (_rule, value) => {
            if (!value || isEdit.value) return
            const res = await checkSkuExists(String(value))
            if (res.data?.exists) throw new Error('SKU 编号已存在，不可重复')
          },
          trigger: 'blur',
        },
      ]
    }
  }
  return r
})

function formatDate(v: string | null | undefined) {
  if (!v) return '-'
  return new Date(v).toLocaleDateString('zh-CN')
}

function imageUploadAreaClick() {
  imageFileInputRef.value?.click()
}

async function doUploadImage(file: File) {
  if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type)) {
    ElMessage.warning('请上传 jpg、png、gif 或 webp 格式的图片')
    return
  }
  imageUploading.value = true
  try {
    const url = await uploadImage(file)
    form.imageUrl = url
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    imageUploading.value = false
  }
}

function onImageFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) doUploadImage(file)
  input.value = ''
}

function onImagePaste(e: ClipboardEvent) {
  const file = Array.from(e.clipboardData?.files ?? []).find((f) => /^image\//.test(f.type))
  if (file) doUploadImage(file)
}

function onImageDrop(e: DragEvent) {
  imageDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && /^image\//.test(file.type)) doUploadImage(file)
}

async function loadFieldDefinitions() {
  try {
    const res = await getFieldDefinitions('products')
    fieldDefinitions.value = res.data ?? []
  } catch {
    fieldDefinitions.value = []
  }
}

const columnConfigVisible = ref(false)
const columnConfigList = ref<{ id: number; code: string; label: string; order: number; visible: boolean }[]>([])

function openColumnConfig() {
  const raw = fieldDefinitions.value.length
    ? fieldDefinitions.value.map((f) => ({
        id: f.id,
        code: f.code,
        label: f.label,
        order: f.order,
        visible: !!f.visible,
      }))
    : PRODUCT_FIELDS_SORTED.map((f, i) => ({
        id: 0,
        code: f.code,
        label: f.label,
        order: f.order ?? i,
        visible: true,
      }))
  columnConfigList.value = raw
  columnConfigVisible.value = true
}

async function onColumnVisibleChange(f: { id: number; visible: boolean }) {
  if (f.id && fieldDefinitions.value.length) {
    try {
      await updateFieldDefinition(f.id, { visible: f.visible })
      await loadFieldDefinitions()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }
}

async function moveColumn(f: { id: number; order: number }, delta: number) {
  const list = [...columnConfigList.value]
  const idx = list.findIndex((x) => x.id === f.id && x.code === f.code)
  if (idx < 0 || (delta < 0 && idx === 0) || (delta > 0 && idx === list.length - 1)) return
  const swapIdx = idx + delta
  ;[list[idx].order, list[swapIdx].order] = [list[swapIdx].order, list[idx].order]
  list.sort((a, b) => a.order - b.order)
  columnConfigList.value = list
  if (fieldDefinitions.value.length && list.some((x) => x.id > 0)) {
    try {
      await batchUpdateFieldOrder(
        'products',
        list.map((x, i) => ({ id: x.id, order: i })).filter((x) => x.id > 0),
      )
      await loadFieldDefinitions()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }
}

function getOptions(f: { optionsKey?: string }) {
  if (f.optionsKey === 'productGroups') return productGroups.value.map((v) => ({ label: v, value: v }))
  if (f.optionsKey === 'salespeople') return salespeople.value.map((v) => ({ label: v, value: v }))
  if (f.optionsKey === 'customers') return customers.value.map((c) => ({ label: c.companyName, value: c.id }))
  return []
}

async function load() {
  try {
    const res = await getProducts({
      companyName: filter.companyName || undefined,
      skuCode: filter.skuCode || undefined,
      productGroup: filter.productGroup || undefined,
      salesperson: filter.salesperson || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    onFilterChange(false)
  }, 400)
}

function onFilterChange(byUser = false) {
  if (byUser) {
    if (filter.companyName && String(filter.companyName).trim()) companyNameLabelVisible.value = true
    if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
  }
  pagination.page = 1
  load()
}

/** 转为树形选择器数据：label 为节点名，value 为完整路径（仅叶节点可选时用于存储） */
function toProductGroupTreeSelect(
  nodes: SystemOptionTreeNode[],
  parentPath = '',
): { label: string; value: string; children?: { label: string; value: string; children?: unknown[] }[]; disabled?: boolean }[] {
  return nodes.map((n) => {
    const path = parentPath ? `${parentPath} > ${n.value}` : n.value
    const children = n.children?.length ? toProductGroupTreeSelect(n.children, path) : []
    const hasChildren = children.length > 0
    return {
      label: n.value,
      value: path,
      children: hasChildren ? children : undefined,
      disabled: hasChildren,
    }
  })
}

const productGroupTreeSelectData = computed(() => toProductGroupTreeSelect(productGroupsTree.value))

async function loadOptions() {
  try {
    const [ct, sp, custRes, treeRes, countsRes] = await Promise.all([
      getProductGroups(),
      getProductSalespeople(),
      getCustomers({ pageSize: 200 }),
      getSystemOptionsTree('product_groups'),
      getProductGroupCounts(),
    ])
    productGroups.value = ct.data ?? []
    productGroupsTree.value = treeRes.data ?? []
    const countList = countsRes.data ?? []
    groupCountsMap.value = countList.reduce<Record<string, number>>((acc, { productGroup, count }) => {
      acc[productGroup] = count
      return acc
    }, {})
    salespeople.value = sp.data ?? []
    const custList = (custRes.data?.list ?? []) as CustomerItem[]
    customers.value = custList.map((c) => ({ id: c.id, companyName: c.companyName }))
  } catch {
    productGroups.value = []
    productGroupsTree.value = []
    groupCountsMap.value = {}
    salespeople.value = []
    customers.value = []
  }
}

function resetFilter() {
  companyNameLabelVisible.value = false
  skuCodeLabelVisible.value = false
  filter.companyName = ''
  filter.skuCode = ''
  filter.productGroup = ''
  filter.salesperson = ''
  pagination.page = 1
  load()
}

function onSelectionChange(rows: ProductItem[]) {
  selectedIds.value = rows.map((r) => r.id)
}

function onSortChange({ prop, order }: { prop?: string; order?: string }) {
  if (prop && order) {
    sort.sortBy = prop
    sort.sortOrder = order === 'ascending' ? 'asc' : 'desc'
  } else {
    sort.sortBy = 'id'
    sort.sortOrder = 'asc'
  }
  load()
}

function getHeaderCellStyle() {
  return {
    whiteSpace: 'nowrap',
  }
}

function getCellStyle() {
  return {
    padding: '4px 10px',
    whiteSpace: 'nowrap',
  }
}

function getColumnMinWidth(f: { code: string; type: string }): number {
  if (f.type === 'image') return 96
  if (f.type === 'date') return 120
  if (f.code === 'productName') return 180
  if (f.code === 'productGroup') return 160
  if (f.code === 'companyName') return 160
  if (f.code === 'skuCode') return 120
  return 110
}

function updateTableHeight() {
  const main = productsMainRef.value
  if (!main) return
  const mainH = main.clientHeight
  const filterH = filterBarRef.value?.offsetHeight ?? 0
  const paginationH = paginationWrapRef.value?.offsetHeight ?? 0

  const cs = window.getComputedStyle(main)
  const gap = parseFloat(cs.rowGap || cs.gap || '0') || 0
  const paddingTop = parseFloat(cs.paddingTop || '0') || 0
  const paddingBottom = parseFloat(cs.paddingBottom || '0') || 0

  // filter + table + pagination 为纵向排列，gap 大约出现两次
  const available = mainH - paddingTop - paddingBottom - filterH - paginationH - gap * 2
  tableHeight.value = Math.max(240, Math.floor(available))
}

async function openCreate() {
  isEdit.value = false
  editId.value = 0
  form.customerId = null
  for (const f of formFields.value) {
    form[f.code] = ''
  }
  try {
    const res = await getNextSkuCode()
    form.skuCode = (res.data ?? '').toString() || ''
  } catch {
    form.skuCode = ''
  }
  dialogVisible.value = true
}

function openEdit(row: ProductItem) {
  isEdit.value = true
  editId.value = row.id
  form.customerId = row.customerId ?? null
  for (const f of formFields.value) {
    if (f.code === 'companyName') continue
    const v = row[f.code as keyof ProductItem]
    form[f.code] = v != null ? (typeof v === 'number' ? v : String(v)) : ''
  }
  dialogVisible.value = true
}

function resetForm() {
  formRef.value?.resetFields()
}

async function submit() {
  await formRef.value?.validate()
  submitLoading.value = true
  try {
    const payload: Record<string, string | number | null> = {}
    for (const f of formFields.value) {
      if (f.code === 'companyName') {
        payload.customerId = form.customerId === '' || form.customerId == null ? null : (form.customerId as number)
        continue
      }
      const v = form[f.code]
      payload[f.code] = v === '' ? null : v
    }
    const body: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(payload)) {
      const snake = k.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
      body[snake] = v
    }
    if (isEdit.value) {
      delete body.sku_code
      await updateProduct(editId.value, body)
      ElMessage.success('保存成功')
    } else {
      await createProduct(body)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    submitLoading.value = false
  }
}

async function batchDelete() {
  if (!selectedIds.value.length) return
  await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 个产品？`, '提示', {
    type: 'warning',
  }).catch(() => {})
  try {
    await batchDeleteProducts(selectedIds.value)
    ElMessage.success('已删除')
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

watch(
  () => filter.companyName,
  (v) => {
    if (!v || !String(v).trim()) companyNameLabelVisible.value = false
  },
)
watch(
  () => filter.skuCode,
  (v) => {
    if (!v || !String(v).trim()) skuCodeLabelVisible.value = false
  },
)

onMounted(async () => {
  loadFieldDefinitions()
  load()
  loadOptions()

  await nextTick()
  updateTableHeight()

  tableResizeObserver = new ResizeObserver(() => updateTableHeight())
  if (productsMainRef.value) tableResizeObserver.observe(productsMainRef.value)
  if (filterBarRef.value) tableResizeObserver.observe(filterBarRef.value)
  if (paginationWrapRef.value) tableResizeObserver.observe(paginationWrapRef.value)

  window.addEventListener('resize', updateTableHeight)
})

onBeforeUnmount(() => {
  tableResizeObserver?.disconnect()
  tableResizeObserver = null
  window.removeEventListener('resize', updateTableHeight)
})
</script>

<style scoped>
.page-card {
  background: var(--color-card);
  padding: var(--space-sm);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  height: 100%;
}

.products-layout {
  display: flex;
  gap: var(--space-sm);
  min-height: 400px;
  flex: 1;
  min-height: 0;
}

.products-sidebar {
  flex-shrink: 0;
  width: 220px;
  border-radius: var(--radius-lg, 10px);
  background: var(--el-fill-color-blank, #fff);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.products-sidebar .sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-md);
  font-weight: 600;
  font-size: 15px;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-blank, #fff);
}

.products-sidebar .sidebar-toggle {
  padding: 4px;
}

.products-sidebar .sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xs) 0;
}

.products-sidebar .group-menu {
  border-right: none;
  background: transparent;
  --el-menu-bg-color: transparent;
  --el-menu-hover-bg-color: var(--el-fill-color-light, #f5f7fa);
  --el-menu-active-color: var(--el-color-primary);
}

.products-sidebar .group-menu-item {
  height: 40px;
  line-height: 40px;
  margin: 2px 8px;
  border-radius: 6px;
}

.products-sidebar .group-menu-item.is-active {
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary);
}

.products-sidebar .group-menu-label {
  display: inline-flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.products-sidebar .group-menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  margin-right: 4px;
  color: var(--el-text-color-secondary, #909399);
}

.products-sidebar .group-menu-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.products-sidebar .group-menu-count {
  margin-left: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.products-sidebar .group-menu-item.is-active .group-menu-count {
  color: var(--el-color-primary);
  opacity: 0.9;
}

.products-sidebar.sidebar-collapsed {
  width: 48px;
}

.products-sidebar.sidebar-collapsed .sidebar-header {
  flex-direction: column;
  padding: var(--space-sm);
}

.products-sidebar.sidebar-collapsed .sidebar-title {
  display: none;
}

.products-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-height: 0;
}
.filter-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}
.pagination-wrap {
  margin-top: var(--space-sm);
  display: flex;
  justify-content: flex-end;
}
.products-table :deep(.el-table__header .cell) {
  white-space: nowrap;
}
.column-config-hint {
  margin: 0 0 var(--space-md);
  font-size: var(--font-size-caption);
  color: var(--color-muted-foreground, #7f8b99);
}
.column-config-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}
.column-config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius);
  background: var(--color-bg-subtle, #f5f6f8);
}
.column-config-actions {
  display: flex;
  gap: var(--space-xs);
}
.image-upload-wrap {
  width: 100%;
  position: relative;
}
.image-url-input {
  margin-top: var(--space-xs);
}
.image-file-input-hidden {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  left: -9999px;
}
.image-upload-area {
  min-height: 120px;
  border: 1px dashed var(--color-border, #dcdfe6);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.image-upload-area:hover,
.image-upload-area.drag-over {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9, #ecf5ff);
}
.image-upload-area.has-image {
  padding: var(--space-xs);
  min-height: 100px;
}
.image-upload-hint {
  font-size: var(--font-size-caption);
  color: var(--color-muted-foreground, #7f8b99);
}
.image-preview {
  width: 100px;
  height: 100px;
  border-radius: var(--radius);
}
.image-clear {
  position: absolute;
  top: var(--space-xs);
  right: var(--space-xs);
}
.image-upload-area.has-image {
  position: relative;
}
</style>
