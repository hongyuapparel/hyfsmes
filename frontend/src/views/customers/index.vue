<template>
  <div class="page-card page-card--fill">
    <!-- 顶部筛选 -->
    <div class="filter-bar">
      <el-input
        v-model="filter.companyName"
        placeholder="公司名称或联系人"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getTextFilterStyle('名称/联系人：', filter.companyName, companyNameLabelVisible)"
        :input-style="getFilterInputStyle(filter.companyName)"
        @input="debouncedSearch"
        @keyup.enter="onFilterChange(true)"
      >
        <template #prefix>
          <span
            v-if="filter.companyName && companyNameLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            名称/联系人：
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
      <el-button type="primary" size="large" @click="onFilterChange(true)">搜索</el-button>
      <el-button size="large" @click="resetFilter">清空</el-button>

      <div class="filter-actions">
        <el-button type="primary" size="large" @click="openCreate">新建客户</el-button>
        <el-tooltip v-if="selectedIds.length" content="删除" placement="top">
          <el-button type="danger" size="large" circle @click="batchDelete">
            <el-icon><Delete /></el-icon>
          </el-button>
        </el-tooltip>
        <el-button type="primary" plain size="large" @click="openXiaomanImport">从小满导入</el-button>
      </div>
    </div>

    <div v-if="selectedIds.length" class="table-selection-count">已选 {{ selectedIds.length }} 项</div>

    <!-- 表格：字段驱动 -->
    <div ref="tableShellRef" class="list-page-table-shell">
      <el-table
        ref="tableRef"
        :data="list"
        border
        stripe
        :height="tableHeight"
        @selection-change="onSelectionChange"
        @sort-change="onSortChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column
          v-for="f in CUSTOMER_TABLE_FIELDS"
        :key="f.code"
        :prop="f.code"
        :label="f.label"
        :min-width="f.type === 'date' ? 110 : 100"
        :sortable="f.sortable ? 'custom' : false"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <span v-if="f.type === 'date'">{{ formatDate(row[f.code]) }}</span>
          <span v-else>{{ row[f.code] ?? '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <!-- 分页 -->
    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <!-- 新建/编辑弹窗：字段驱动 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑客户' : '新建客户'" width="520" class="customer-form-dialog" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100">
        <el-form-item
          v-for="f in CUSTOMER_FORM_FIELDS"
          :key="f.code"
          :label="f.label"
          :prop="f.code"
        >
          <el-input
            v-if="f.type === 'text'"
            v-model="form[f.code]"
            :placeholder="f.placeholder"
            :disabled="f.code === 'customerId'"
            type="text"
            size="default"
          />
          <el-date-picker
            v-else-if="f.type === 'date'"
            v-model="form[f.code]"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            size="default"
            style="width: 100%"
          />
          <el-tree-select
            v-else-if="f.type === 'select' && f.optionsKey === 'productGroups'"
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
            v-else-if="f.type === 'select'"
            v-model="form[f.code]"
            :placeholder="f.placeholder"
            filterable
            clearable
            size="default"
            style="width: 100%"
          >
            <el-option
              v-for="opt in (f.optionsKey === 'salespeople' ? salespeople : [])"
              :key="String(opt)"
              :label="opt"
              :value="opt"
            />
          </el-select>
          <div v-else-if="f.type === 'phone'" class="phone-inputs">
            <el-input
              v-model="form.contactCountryCode"
              :placeholder="f.placeholder || '国家代码'"
              type="text"
              size="default"
              class="phone-country-code"
            />
            <el-input
              v-model="form.contactPhone"
              :placeholder="f.placeholderSuffix || '电话号码'"
              type="text"
              size="default"
              class="phone-number"
            />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submit">确定</el-button>
      </template>
    </el-dialog>

    <!-- 从小满导入弹窗 -->
    <el-dialog
      v-model="xiaomanDialogVisible"
      title="从小满导入客户"
      width="720"
      class="xiaoman-import-dialog"
      :close-on-click-modal="false"
      @open="loadXiaomanList"
      @close="resetXiaomanDialog"
    >
      <div v-loading="xiaomanLoading" class="xiaoman-content">
        <div v-if="xiaomanResult" class="xiaoman-result">
          <p>导入完成：成功 {{ xiaomanResult.imported }} 个，跳过 {{ xiaomanResult.skipped }} 个</p>
          <p v-if="xiaomanResult.errors?.length" class="xiaoman-errors">
            失败：{{ xiaomanResult.errors.join('；') }}
          </p>
          <el-button type="primary" @click="closeXiaomanAndRefresh">关闭并刷新</el-button>
        </div>
        <template v-else>
          <div class="xiaoman-search-bar">
            <el-input
              v-model="xiaomanKeyword"
              placeholder="公司名称或客户编号搜索"
              clearable
              class="xiaoman-search-input"
              @keyup.enter="onXiaomanSearch"
              @clear="onXiaomanClear"
            />
            <el-button type="primary" @click="onXiaomanSearch">搜索</el-button>
          </div>
          <div v-if="xiaomanSelectedIds.length" class="table-selection-count">已选 {{ xiaomanSelectedIds.length }} 项</div>
          <el-table
            ref="xiaomanTableRef"
            :data="xiaomanList"
            border
            stripe
            max-height="320"
            @selection-change="onXiaomanSelectionChange"
          >
            <el-table-column type="selection" width="50" />
            <el-table-column prop="serial_id" label="客户编号" min-width="120" show-overflow-tooltip />
            <el-table-column prop="name" label="公司名称" min-width="160" show-overflow-tooltip />
            <el-table-column prop="contactPerson" label="联系人" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.contactPerson || '-' }}
              </template>
            </el-table-column>
          </el-table>
          <div class="xiaoman-pagination">
            <el-pagination
              v-model:current-page="xiaomanPagination.page"
              v-model:page-size="xiaomanPagination.pageSize"
              :total="xiaomanPagination.total"
              :page-sizes="[20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              small
              @current-change="loadXiaomanList"
              @size-change="loadXiaomanList"
            />
          </div>
        </template>
      </div>
      <template v-if="!xiaomanResult" #footer>
        <el-button @click="xiaomanDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="xiaomanImporting"
          :disabled="!xiaomanSelectedIds.length"
          @click="doXiaomanImport"
        >
          导入选中 ({{ xiaomanSelectedIds.length }})
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { CUSTOMER_FIELDS_SORTED } from '@/fields'
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  batchDeleteCustomers,
  getSalespeople,
  getProductGroups,
  getNextCustomerId,
  getXiaomanList,
  importFromXiaoman,
  type CustomerItem,
  type XiaomanCompanyItem,
  type XiaomanImportRes,
} from '@/api/customers'
import { getSystemOptionsTree, type SystemOptionTreeNode } from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { Delete } from '@element-plus/icons-vue'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'

const tableRef = ref<InstanceType<typeof import('element-plus')['ElTable']>>()
const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const formRef = ref<FormInstance>()
const list = ref<CustomerItem[]>([])
const salespeople = ref<string[]>([])
const productGroupOptions = ref<{ id: number; path: string }[]>([])
const productGroupsTree = ref<SystemOptionTreeNode[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const submitLoading = ref(false)
const selectedIds = ref<number[]>([])

const CUSTOMER_TABLE_FIELDS = computed(() =>
  CUSTOMER_FIELDS_SORTED.filter((f) => !['cooperationDate', 'contactInfo', 'productGroup'].includes(f.code)),
)
const CUSTOMER_FORM_FIELDS = computed(() =>
  CUSTOMER_FIELDS_SORTED.filter((f) => !['cooperationDate', 'createdAt', 'lastOrderReferencedAt'].includes(f.code)),
)

function toProductGroupTreeSelect(
  nodes: SystemOptionTreeNode[],
): { label: string; value: number; children?: ReturnType<typeof toProductGroupTreeSelect>; disabled?: boolean }[] {
  return nodes.map((n) => {
    const children = n.children?.length ? toProductGroupTreeSelect(n.children) : []
    const hasChildren = children.length > 0
    return {
      label: n.value,
      value: n.id,
      children: hasChildren ? children : undefined,
      disabled: hasChildren,
    }
  })
}

const productGroupTreeSelectData = computed(() => toProductGroupTreeSelect(productGroupsTree.value))

const filter = reactive({ companyName: '', salesperson: '' })
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const sort = reactive({ sortBy: 'createdAt', sortOrder: 'desc' as 'asc' | 'desc' })

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

const form = reactive<Record<string, string | number | null>>({})
const formRules = computed<FormRules>(() => {
  const r: FormRules = {}
  for (const f of CUSTOMER_FORM_FIELDS.value) {
    if (f.code === 'companyName') r[f.code] = [{ required: true, message: `请输入${f.label}`, trigger: 'blur' }]
  }
  return r
})

function formatDate(v: string | null | undefined) {
  if (!v) return '-'
  return new Date(v).toLocaleDateString('zh-CN')
}

async function load() {
  try {
    const res = await getCustomers({
      companyName: filter.companyName || undefined,
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
  if (byUser && filter.companyName && String(filter.companyName).trim()) {
    companyNameLabelVisible.value = true
  }
  pagination.page = 1
  load()
}

async function loadOptions() {
  try {
    const [s, p, treeRes] = await Promise.all([getSalespeople(), getProductGroups(), getSystemOptionsTree('product_groups')])
    salespeople.value = s.data ?? []
    productGroupOptions.value = p.data ?? []
    productGroupsTree.value = treeRes.data ?? []
  } catch {
    salespeople.value = []
    productGroupOptions.value = []
    productGroupsTree.value = []
  }
}

function resetFilter() {
  companyNameLabelVisible.value = false
  filter.companyName = ''
  filter.salesperson = ''
  pagination.page = 1
  load()
}

function onSelectionChange(rows: CustomerItem[]) {
  selectedIds.value = rows.map((r) => r.id)
}

function onSortChange({ prop, order }: { prop?: string; order?: string }) {
  if (prop && order) {
    sort.sortBy = prop
    sort.sortOrder = order === 'ascending' ? 'asc' : 'desc'
  } else {
    sort.sortBy = 'createdAt'
    sort.sortOrder = 'desc'
  }
  load()
}

async function openCreate() {
  isEdit.value = false
  editId.value = 0
  for (const f of CUSTOMER_FORM_FIELDS.value) {
    form[f.code] = f.type === 'date' ? null : ''
  }
  form.contactCountryCode = ''
  form.contactPhone = ''
  try {
    const res = await getNextCustomerId()
    form.customerId = (res.data ?? '').toString() || ''
  } catch {
    form.customerId = ''
  }
  dialogVisible.value = true
}

function openEdit(row: CustomerItem) {
  isEdit.value = true
  editId.value = row.id
  for (const f of CUSTOMER_FORM_FIELDS.value) {
    if (f.code === 'productGroup') {
      form.productGroup = row.productGroupId != null ? row.productGroupId : ''
      continue
    }
    const v = row[f.code as keyof CustomerItem]
    form[f.code] = v != null ? String(v) : ''
  }
  const contact = (row.contactInfo ?? '').trim()
  const sep = contact.includes('|') ? '|' : contact.includes(' ') ? ' ' : null
  if (sep) {
    const [a, b] = contact.split(sep, 2)
    form.contactCountryCode = (a ?? '').trim()
    form.contactPhone = (b ?? '').trim()
  } else {
    form.contactCountryCode = ''
    form.contactPhone = contact
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
    for (const f of CUSTOMER_FORM_FIELDS.value) {
      if (f.code === 'contactInfo') {
        const parts = [form.contactCountryCode, form.contactPhone]
          .map((s) => String(s ?? '').trim())
          .filter(Boolean)
        payload.contactInfo = parts.length ? parts.join(' ') : ''
      } else if (f.code === 'productGroup') {
        const v = form.productGroup
        payload.product_group_id = (v === '' || v === null) ? null : (typeof v === 'number' ? v : parseInt(String(v), 10))
      } else {
        const v = form[f.code]
        // 空发 '' 不发 null，避免 Column 'country' cannot be null
        payload[f.code] = (v === '' || v === null) ? '' : v
      }
    }
    if (isEdit.value) {
      delete payload.customerId
      await updateCustomer(editId.value, payload)
      ElMessage.success('保存成功')
    } else {
      await createCustomer(payload)
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
  await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 个客户？`, '提示', {
    type: 'warning',
  }).catch(() => {})
  try {
    await batchDeleteCustomers(selectedIds.value)
    ElMessage.success('已删除')
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

const xiaomanDialogVisible = ref(false)
const xiaomanKeyword = ref('')
const xiaomanList = ref<XiaomanCompanyItem[]>([])
const xiaomanLoading = ref(false)
const xiaomanImporting = ref(false)
const xiaomanSelectedIds = ref<number[]>([])
const xiaomanResult = ref<XiaomanImportRes | null>(null)
const xiaomanPagination = reactive({ page: 1, pageSize: 20, total: 0 })
const xiaomanTableRef = ref<InstanceType<typeof import('element-plus')['ElTable']>>()

function openXiaomanImport() {
  xiaomanDialogVisible.value = true
}

async function loadXiaomanList() {
  xiaomanLoading.value = true
  try {
    const res = await getXiaomanList({
      page: xiaomanPagination.page,
      pageSize: xiaomanPagination.pageSize,
      keyword: xiaomanKeyword.value || undefined,
    })
    const data = res.data
    if (data) {
      xiaomanList.value = data.list ?? []
      xiaomanPagination.total = data.total ?? 0
    } else {
      xiaomanList.value = []
      xiaomanPagination.total = 0
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    xiaomanLoading.value = false
  }
}

function onXiaomanSearch() {
  xiaomanPagination.page = 1
  loadXiaomanList()
}

function onXiaomanClear() {
  xiaomanPagination.page = 1
  loadXiaomanList()
}

function onXiaomanSelectionChange(rows: XiaomanCompanyItem[]) {
  xiaomanSelectedIds.value = rows.map((r) => r.company_id)
}

async function doXiaomanImport() {
  if (!xiaomanSelectedIds.value.length) return
  xiaomanImporting.value = true
  try {
    const res = await importFromXiaoman(xiaomanSelectedIds.value)
    const data = res.data
    if (data) {
      xiaomanResult.value = data
      ElMessage.success(`导入完成：成功 ${data.imported} 个，跳过 ${data.skipped} 个`)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    xiaomanImporting.value = false
  }
}

function resetXiaomanDialog() {
  xiaomanResult.value = null
  xiaomanSelectedIds.value = []
  xiaomanKeyword.value = ''
  xiaomanPagination.page = 1
}

function closeXiaomanAndRefresh() {
  xiaomanDialogVisible.value = false
  load()
}

watch(
  () => filter.companyName,
  (v) => {
    if (!v || !String(v).trim()) companyNameLabelVisible.value = false
  },
)

watch(
  () => xiaomanKeyword.value,
  (v, oldV) => {
    if (oldV && !v) {
      xiaomanPagination.page = 1
      loadXiaomanList()
    }
  },
)

onMounted(() => {
  load()
  loadOptions()
})
</script>

<style scoped>
.page-card {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}
.filter-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.xiaoman-content {
  min-height: 200px;
}
.xiaoman-search-bar {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}
.xiaoman-search-input {
  flex: 1;
  max-width: 280px;
}
.xiaoman-result {
  padding: var(--space-md);
  text-align: center;
}
.xiaoman-result p {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-body);
}
.xiaoman-errors {
  color: var(--color-error, #f56c6c);
  font-size: var(--font-size-caption);
}
.xiaoman-pagination {
  margin-top: var(--space-sm);
  display: flex;
  justify-content: flex-end;
}
.pagination-wrap {
  margin-top: var(--space-sm);
  display: flex;
  justify-content: flex-end;
}

/* 新建/编辑表单：通过 size="default" 使用 Element Plus 官方 API 控制单行高度，无需 CSS 覆盖 */

/* 联系方式：国家代码 + 电话号码 并排 */
.phone-inputs {
  display: flex;
  gap: var(--space-sm);
  width: 100%;
}
.phone-inputs .phone-country-code {
  width: 100px;
  flex-shrink: 0;
}
.phone-inputs .phone-number {
  flex: 1;
}
</style>
