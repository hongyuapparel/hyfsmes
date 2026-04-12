<template>
  <div class="page-card page-card--fill pattern-page">
    <!-- Tab：全部 / 待分单 / 打样中 / 订单完成 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in PATTERN_TABS"
            :key="tab.value"
            :value="tab.value"
          >
            {{ getTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 筛选区：与订单列表同一设计 -->
    <div class="filter-bar">
      <el-input
        v-model="filter.orderNo"
        placeholder="订单号"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getOrderNoFilterStyle(filter.orderNo, orderNoLabelVisible)"
        :input-style="getFilterInputStyle(filter.orderNo)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.orderNo && orderNoLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            订单号：
          </span>
        </template>
      </el-input>
      <el-input
        v-model="filter.skuCode"
        placeholder="SKU"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getSkuCodeFilterStyle(filter.skuCode, skuCodeLabelVisible)"
        :input-style="getFilterInputStyle(filter.skuCode)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.skuCode && skuCodeLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            SKU：
          </span>
        </template>
      </el-input>
      <el-tree-select
        v-model="filter.orderTypeId"
        :data="orderTypeTreeSelectData"
        placeholder="订单类型"
        filterable
        clearable
        default-expand-all
        :render-after-expand="false"
        node-key="value"
        :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.orderTypeId && `订单类型：${findOrderTypeLabelById(filter.orderTypeId)}`,
          )
        "
        @change="onSearch"
      >
        <template #prefix>
          <span v-if="filter.orderTypeId" :style="{ color: ACTIVE_FILTER_COLOR }">订单类型：</span>
        </template>
      </el-tree-select>
      <el-select
        v-model="filter.collaborationTypeId"
        placeholder="合作方式"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.collaborationTypeId && `合作方式：${findCollaborationLabelById(filter.collaborationTypeId)}`,
          )
        "
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.collaborationTypeId">合作方式：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in collaborationOptions"
          :key="opt.id"
          :label="opt.label"
          :value="opt.id"
        />
      </el-select>
      <el-select
        v-model="filter.purchaseStatus"
        placeholder="采购状态"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.purchaseStatus ? `采购状态：${purchaseStatusLabel(filter.purchaseStatus)}` : undefined)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.purchaseStatus">采购状态：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option label="全部" value="" />
        <el-option label="已完成" value="completed" />
        <el-option label="未完成" value="pending" />
      </el-select>
      <el-date-picker
        v-model="orderDateRange"
        type="daterange"
        range-separator=""
        start-placeholder="下单时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        size="large"
        class="filter-bar-item"
        :style="getFilterRangeStyle(orderDateRange)"
        @change="onSearch"
      />
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button size="large" :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button
          v-if="hasSelection"
          type="primary"
          size="large"
          @click="openAssignDialog"
        >
          分配纸样师和车版师
        </el-button>
        <el-button
          v-if="hasSelection && canCompleteSelection"
          type="primary"
          size="large"
          @click="openCompleteDialog"
        >
          确认完成
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <!-- 待纸样订单列表 -->
    <div ref="tableShellRef" class="list-page-table-shell">
    <el-table
      ref="patternTableRef"
      v-loading="loading"
      :data="list"
      border
      stripe
      class="pattern-table"
      :height="tableHeight"
      @header-dragend="onHeaderDragEnd"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column prop="orderNo" label="订单号" min-width="100" />
      <el-table-column prop="skuCode" label="SKU" min-width="100" />
      <el-table-column label="图片" width="72" align="center">
        <template #default="{ row }">
          <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="compact" />
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="customerName" label="客户" min-width="90" show-overflow-tooltip />
      <el-table-column prop="merchandiser" label="跟单" width="80" show-overflow-tooltip />
      <el-table-column label="订单数量" width="88" align="right">
        <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }}</template>
      </el-table-column>
      <el-table-column label="客户交期" width="110" align="center">
        <template #default="{ row }">{{ formatDate(row.customerDueDate) }}</template>
      </el-table-column>
      <el-table-column label="下单日期" width="110" align="center">
        <template #default="{ row }">{{ formatDate(row.orderDate) }}</template>
      </el-table-column>
      <el-table-column prop="arrivedAtPattern" label="到纸样时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.arrivedAtPattern) }}</template>
      </el-table-column>
      <el-table-column prop="completedAt" label="完成时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.completedAt) }}</template>
      </el-table-column>
      <el-table-column label="时效判定" width="96" align="center">
        <template #default="{ row }">
          <SlaJudgeTag :text="row.timeRating" />
        </template>
      </el-table-column>
      <el-table-column label="订单属性" min-width="108">
        <template #default="{ row }">
          <div>{{ findOrderTypeLabelById(row.orderTypeId) }}</div>
          <div class="text-muted pattern-sub-attr">{{ findCollaborationLabelById(row.collaborationTypeId) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="采购" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.purchaseStatus === 'completed' ? 'success' : 'info'" size="small">
            {{ purchaseStatusLabel(row.purchaseStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="patternMaster" label="纸样师" width="90" />
      <el-table-column prop="sampleMaker" label="车版师" width="90" />
      <el-table-column label="详情" width="84" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click.stop="openPatternDetailDrawer(row)">
            查看
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="onPageSizeChange"
      />
    </div>

    <ProductionDetailDrawerShell
      v-model="detailDrawer.visible"
      title="纸样详情"
      size="760px"
      @closed="onDetailDrawerClosed"
    >
      <template v-if="detailDrawer.row">
        <ProductionDetailSection>
          <ProductionOrderBriefPanel :brief="patternBriefFromRow(detailDrawer.row)" />
        </ProductionDetailSection>
        <ProductionDetailSection title="业务扩展信息">
          <el-descriptions :column="1" border size="small" class="pattern-brief-extra">
            <el-descriptions-item label="纸样师">
              {{ (detailDrawer.row.patternMaster ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="车版师">
              {{ (detailDrawer.row.sampleMaker ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="纸样状态">
              {{ detailDrawer.row.patternStatus }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="时效与节点">
          <el-descriptions :column="1" border size="small" class="pattern-brief-extra">
            <el-descriptions-item label="到纸样时间">
              {{ formatDateTime(detailDrawer.row.arrivedAtPattern) }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{ formatDateTime(detailDrawer.row.completedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="时效判定">
              <SlaJudgeTag :text="detailDrawer.row.timeRating" />
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="纸样物料/裁片清单">
          <div class="materials-brief">
            <div>订单号：{{ detailDrawer.row.orderNo }}</div>
            <div>SKU：{{ detailDrawer.row.skuCode }}</div>
          </div>

          <div class="materials-actions">
            <el-button
              link
              type="primary"
              size="small"
              :disabled="detailDrawer.loading || !canEditPatternMaterials"
              @click="addMaterialRow"
            >
              新增
            </el-button>
          </div>

          <el-table
            v-loading="detailDrawer.loading"
            :data="materialsForm.materials"
            border
            size="small"
            class="materials-table"
          >
            <el-table-column label="物料类型" min-width="110" align="center">
              <template #default="{ row }">
                <el-select
                  v-model="row.materialTypeId"
                  placeholder="选择"
                  filterable
                  clearable
                  size="small"
                  style="width: 100%"
                  :disabled="!canEditPatternMaterials"
                >
                  <el-option
                    v-for="opt in materialTypeOptions"
                    :key="opt.id"
                    :label="opt.label"
                    :value="opt.id"
                  />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="物料名称" min-width="180" align="center">
              <template #default="{ row }">
                <el-input v-model="row.materialName" size="small" :disabled="!canEditPatternMaterials" />
              </template>
            </el-table-column>
            <el-table-column label="幅宽(cm)" width="120" align="center">
              <template #default="{ row }">
                <el-input v-model="row.fabricWidth" size="small" placeholder="如 183cm" :disabled="!canEditPatternMaterials" />
              </template>
            </el-table-column>
            <el-table-column label="单件用量(米)" width="110" align="center">
              <template #default="{ row }">
                <el-input-number v-model="row.usagePerPiece" :min="0" :controls="false" size="small" :disabled="!canEditPatternMaterials" />
              </template>
            </el-table-column>
            <el-table-column label="裁片数量" width="110" align="center">
              <template #default="{ row }">
                <el-input-number v-model="row.cuttingQuantity" :min="0" :controls="false" size="small" :disabled="!canEditPatternMaterials" />
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="200" align="center">
              <template #default="{ row }">
                <el-input v-model="row.remark" size="small" :disabled="!canEditPatternMaterials" />
              </template>
            </el-table-column>
            <el-table-column v-if="canEditPatternMaterials" label="操作" width="70" fixed="right" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" size="small" @click="removeMaterialRow($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="materials-remark">
            <div class="materials-remark-label">总体备注</div>
            <el-input v-model="materialsForm.remark" type="textarea" :rows="3" placeholder="可选" :disabled="!canEditPatternMaterials" />
          </div>

          <div class="detail-drawer-footer">
            <el-button v-if="canEditPatternMaterials" type="primary" :loading="detailDrawer.saving" :disabled="detailDrawer.loading" @click="submitMaterials">
              保存
            </el-button>
          </div>
        </ProductionDetailSection>
      </template>
    </ProductionDetailDrawerShell>

    <!-- 分配纸样师和车版师弹窗 -->
    <el-dialog
      v-model="assignDialog.visible"
      title="分配纸样师和车版师"
      width="420"
      destroy-on-close
      @close="resetAssignForm"
    >
      <el-form
        ref="assignFormRef"
        :model="assignForm"
        :rules="assignRules"
        label-width="100px"
      >
        <el-form-item label="纸样师" prop="patternMaster">
          <el-select
            v-model="assignForm.patternMaster"
            placeholder="请选择纸样师"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="e in patternMasterOptions"
              :key="e.id"
              :label="e.name"
              :value="e.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="车版师" prop="sampleMaker">
          <el-select
            v-model="assignForm.sampleMaker"
            placeholder="请选择车版师"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="e in sampleMakerOptions"
              :key="e.id"
              :label="e.name"
              :value="e.name"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="assignDialog.submitting" @click="submitAssign">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 确认完成（样品图片可选）弹窗 -->
    <el-dialog
      v-model="completeDialog.visible"
      title="确认完成"
      width="480"
      destroy-on-close
      @close="resetCompleteForm"
    >
      <div v-if="completeDialog.row" class="complete-brief">
        <div>订单号：{{ completeDialog.row.orderNo }}</div>
        <div>SKU：{{ completeDialog.row.skuCode }}</div>
      </div>
      <div class="complete-hint">样品图片可选：不上传也可以完成纸样</div>
      <el-form ref="completeFormRef" :model="completeForm" :rules="completeRules" label-width="100px">
        <el-form-item label="样品图片" prop="sampleImageUrl">
          <div
            class="sample-image-upload"
            @click="triggerSampleImageUpload"
          >
            <div v-if="completeForm.sampleImageUrl" class="image-preview-wrap">
              <el-image :src="completeForm.sampleImageUrl" fit="contain" :preview-teleported="true" :preview-src-list="[completeForm.sampleImageUrl]" />
              <el-button text type="danger" size="small" class="image-remove" @click.stop="clearSampleImage">移除</el-button>
            </div>
            <div v-else class="image-placeholder">
              <span>点击上传样品图片</span>
            </div>
          </div>
          <input
            ref="sampleImageFileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="hidden-file-input"
            @change="onSampleImageFileChange"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="completeDialog.submitting" @click="submitComplete">
          完成纸样
        </el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import {
  getPatternItems,
  assignPattern,
  completePattern,
  exportPatternItems,
  getPatternMaterials,
  savePatternMaterials,
  type PatternListItem,
  type PatternListQuery,
  type PatternMaterialRow,
} from '@/api/production-pattern'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getDictTree, getDictItems } from '@/api/dicts'
import { uploadImage } from '@/api/uploads'
import type { SystemOptionTreeNode } from '@/api/system-options'
import { getEmployeeList, type EmployeeItem } from '@/api/hr'
import { useAuthStore } from '@/stores/auth'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
  getFilterRangeStyle,
  normalizeTextFilter,
} from '@/composables/useFilterBarHelpers'
import { formatDate, formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import ProductionOrderBriefPanel, {
  type ProductionOrderBriefModel,
} from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'

const PATTERN_TABS = [
  { label: '全部', value: 'all' },
  { label: '待分单', value: 'pending_assign' },
  { label: '打样中', value: 'in_progress' },
  { label: '样品完成', value: 'completed' },
] as const

type PatternTabConfig = (typeof PATTERN_TABS)[number]

const orderTypeTree = ref<SystemOptionTreeNode[]>([])
const collaborationOptions = ref<{ id: number; label: string }[]>([])

function toOrderTypeTreeSelect(
  nodes: SystemOptionTreeNode[],
): { label: string; value: number; children?: unknown[]; disabled?: boolean }[] {
  return nodes.map((n) => {
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children) : []
    const hasChildren = children.length > 0
    return { label: n.value, value: n.id, children: hasChildren ? children : undefined, disabled: hasChildren }
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
  const found = collaborationOptions.value.find((opt) => opt.id === id)
  return found?.label ?? ''
}

const detailDrawer = reactive<{ visible: boolean; loading: boolean; saving: boolean; row: PatternListItem | null }>({
  visible: false,
  loading: false,
  saving: false,
  row: null,
})

function onDetailDrawerClosed() {
  resetMaterialsForm()
  detailDrawer.row = null
}

async function openPatternDetailDrawer(row: PatternListItem) {
  detailDrawer.row = row
  detailDrawer.visible = true
  detailDrawer.loading = true
  try {
    const res = await getPatternMaterials(row.orderId)
    const data = res.data
    materialsForm.materials = (data?.materials ?? []).map(normalizePatternMaterialRow)
    materialsForm.remark = data?.remark ?? ''
    if (!materialsForm.materials.length && canEditPatternMaterials.value) addMaterialRow()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载失败'))
    if (!materialsForm.materials.length && canEditPatternMaterials.value) addMaterialRow()
  } finally {
    detailDrawer.loading = false
  }
}

function patternBriefFromRow(row: PatternListItem): ProductionOrderBriefModel {
  return {
    orderNo: row.orderNo,
    skuCode: row.skuCode,
    imageUrl: row.imageUrl,
    customerName: row.customerName,
    merchandiser: row.merchandiser,
    customerDueDate: row.customerDueDate,
    orderQuantity: row.quantity,
    orderDate: row.orderDate,
    orderTypeLabel: findOrderTypeLabelById(row.orderTypeId),
    collaborationLabel: findCollaborationLabelById(row.collaborationTypeId),
  }
}

function purchaseStatusLabel(v: string): string {
  return v === 'completed' ? '已完成' : v === 'pending' ? '未完成' : v
}

const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR as string }
function getFilterSelectAutoWidthStyle(v: unknown) {
  if (!v) return undefined
  const text = String(v)
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { ...activeSelectStyle, width: `${width}px`, flex: `0 0 ${width}px` }
}

const filter = reactive({
  orderNo: '',
  skuCode: '',
  orderTypeId: null as number | null,
  collaborationTypeId: null as number | null,
  purchaseStatus: '',
})
const orderDateRange = ref<[string, string] | null>(null)
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)

const currentTab = ref<string>('all')
const tabCounts = ref<Record<string, number>>({})
const tabTotal = ref(0)
const list = ref<PatternListItem[]>([])
const patternTableRef = ref()
const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const loading = ref(false)
const exporting = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<PatternListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
const canCompleteSelection = computed(() =>
  selectedRows.value.length > 0 && selectedRows.value.every((r) => r.patternStatus !== 'completed'),
)
const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('production-pattern-main')

function getTabLabel(tab: PatternTabConfig): string {
  const counts = tabCounts.value
  const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
  return `${tab.label}(${count})`
}

const assignDialog = reactive<{ visible: boolean; submitting: boolean }>({ visible: false, submitting: false })
const assignFormRef = ref<FormInstance>()
const assignForm = reactive({ patternMaster: '', sampleMaker: '' })
const assignRules: FormRules = {
  patternMaster: [{ required: true, message: '请选择纸样师', trigger: 'change' }],
  sampleMaker: [{ required: true, message: '请选择车版师', trigger: 'change' }],
}

const patternMasterOptions = ref<EmployeeItem[]>([])
const sampleMakerOptions = ref<EmployeeItem[]>([])

const materialTypeOptions = ref<{ id: number; label: string }[]>([])

const authStore = useAuthStore()
const canEditPatternMaterials = computed(() => {
  const roleName = (authStore.user?.roleName ?? '').trim()
  if (!roleName) return false
  // 约定：纸样相关角色允许编辑；管理员可协助维护
  if (roleName === '超级管理员' || roleName === '管理员') return true
  return roleName.includes('纸样')
})

const completeDialog = reactive<{ visible: boolean; submitting: boolean; row: PatternListItem | null }>({
  visible: false,
  submitting: false,
  row: null,
})
const completeFormRef = ref<FormInstance>()
const completeForm = reactive({ sampleImageUrl: '' })
const completeRules: FormRules = {}
const sampleImageFileInputRef = ref<HTMLInputElement | null>(null)
const sampleImageUploading = ref(false)

const materialsForm = reactive<{ materials: PatternMaterialRow[]; remark: string }>({ materials: [], remark: '' })

function buildQuery(): PatternListQuery {
  const q: PatternListQuery = {
    tab: currentTab.value,
    orderNo: normalizeTextFilter(filter.orderNo),
    skuCode: normalizeTextFilter(filter.skuCode),
    orderTypeId: filter.orderTypeId ?? undefined,
    collaborationTypeId: filter.collaborationTypeId ?? undefined,
    purchaseStatus: filter.purchaseStatus || undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
  if (orderDateRange.value && orderDateRange.value.length === 2) {
    q.orderDateStart = orderDateRange.value[0]
    q.orderDateEnd = orderDateRange.value[1]
  }
  return q
}

let tabCountsReqId = 0

async function loadTabCounts() {
  tabCountsReqId++
  const reqId = tabCountsReqId
  const base = buildQuery()
  base.page = 1
  base.pageSize = 1
  const counts: Record<string, number> = {}
  await Promise.all(
    PATTERN_TABS.map(async (tab) => {
      try {
        const res = await getPatternItems({ ...base, tab: tab.value })
        const data = res.data
        counts[tab.value] = data?.total ?? 0
      } catch {
        counts[tab.value] = 0
      }
    }),
  )
  if (reqId !== tabCountsReqId) return
  tabCounts.value = counts
  tabTotal.value = counts.all ?? 0
}

/** 避免「进入页无筛选的首次请求」晚于「带订单号/SKU 的请求」返回而覆盖表格（与订单列表 Abort 策略一致） */
let listAbortController: AbortController | null = null
let patternListReqId = 0

function isRequestCanceled(err: unknown): boolean {
  const e = err as { code?: string; name?: string }
  return e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError'
}

async function load() {
  patternListReqId++
  const reqId = patternListReqId
  listAbortController?.abort()
  listAbortController = new AbortController()
  const signal = listAbortController.signal
  loading.value = true
  try {
    const res = await getPatternItems(buildQuery(), { signal })
    if (reqId !== patternListReqId) return
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      restoreColumnWidths(patternTableRef.value)
    }
  } catch (e: unknown) {
    if (isRequestCanceled(e)) return
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    if (reqId === patternListReqId) loading.value = false
  }
}

async function onExport() {
  const query = buildQuery()
  const { page, pageSize, ...rest } = query
  exporting.value = true
  try {
    const res = await exportPatternItems(rest)
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `纸样管理_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '导出失败'))
  } finally {
    exporting.value = false
  }
}

function onSearch(byUser = false) {
  if (byUser) {
    if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
    if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
  }
  pagination.page = 1
  load()
  void loadTabCounts()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { searchTimer = null; onSearch(false) }, 400)
}

function onReset() {
  orderNoLabelVisible.value = false
  skuCodeLabelVisible.value = false
  filter.orderNo = ''
  filter.skuCode = ''
  filter.orderTypeId = null
  filter.collaborationTypeId = null
  filter.purchaseStatus = ''
  orderDateRange.value = null
  currentTab.value = 'all'
  pagination.page = 1
  selectedRows.value = []
  load()
  void loadTabCounts()
}

function onTabChange() {
  pagination.page = 1
  selectedRows.value = []
  load()
  void loadTabCounts()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function onSelectionChange(rows: PatternListItem[]) {
  selectedRows.value = rows
}

function openAssignDialog() {
  if (selectedRows.value.length === 0) return
  assignForm.patternMaster = selectedRows.value[0].patternMaster ?? ''
  assignForm.sampleMaker = selectedRows.value[0].sampleMaker ?? ''
  assignDialog.visible = true
}

function resetAssignForm() {
  assignForm.patternMaster = ''
  assignForm.sampleMaker = ''
  assignFormRef.value?.clearValidate()
}

async function submitAssign() {
  await assignFormRef.value?.validate().catch(() => {})
  if (selectedRows.value.length === 0) return
  assignDialog.submitting = true
  try {
    for (const row of selectedRows.value) {
      await assignPattern({
        orderId: row.orderId,
        patternMaster: assignForm.patternMaster,
        sampleMaker: assignForm.sampleMaker,
      })
    }
    ElMessage.success('分配成功')
    assignDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '分配失败'))
  } finally {
    assignDialog.submitting = false
  }
}

function openCompleteDialog() {
  if (selectedRows.value.length === 0) return
  completeDialog.row = selectedRows.value[0]
  completeForm.sampleImageUrl = ''
  completeDialog.visible = true
}

function resetCompleteForm() {
  completeDialog.row = null
  completeForm.sampleImageUrl = ''
  completeFormRef.value?.clearValidate()
  if (sampleImageFileInputRef.value) sampleImageFileInputRef.value.value = ''
}

function triggerSampleImageUpload() {
  sampleImageFileInputRef.value?.click()
}

function clearSampleImage() {
  completeForm.sampleImageUrl = ''
  if (sampleImageFileInputRef.value) sampleImageFileInputRef.value.value = ''
}

async function onSampleImageFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  sampleImageUploading.value = true
  try {
    const url = await uploadImage(file)
    completeForm.sampleImageUrl = url
    completeFormRef.value?.validateField('sampleImageUrl').catch(() => {})
  } catch (err) {
    if (!isErrorHandled(err)) ElMessage.error(getErrorMessage(err, '上传失败'))
  } finally {
    sampleImageUploading.value = false
    target.value = ''
  }
}

async function submitComplete() {
  if (!completeDialog.row) return
  completeDialog.submitting = true
  try {
    await completePattern({
      orderId: completeDialog.row.orderId,
      sampleImageUrl: (completeForm.sampleImageUrl ?? '').trim(),
    })
    ElMessage.success('纸样已完成，订单已进入样品完成')
    completeDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
  } finally {
    completeDialog.submitting = false
  }
}

function resetMaterialsForm() {
  materialsForm.materials = []
  materialsForm.remark = ''
}

function normalizePatternMaterialRow(r: PatternMaterialRow): PatternMaterialRow {
  return {
    materialTypeId: r.materialTypeId ?? null,
    materialName: (r.materialName ?? '').toString(),
    fabricWidth: (r.fabricWidth ?? '').toString(),
    usagePerPiece: r.usagePerPiece ?? null,
    cuttingQuantity: r.cuttingQuantity ?? null,
    remark: (r.remark ?? '').toString(),
  }
}

function addMaterialRow() {
  materialsForm.materials.push({
    materialTypeId: null,
    materialName: '',
    fabricWidth: '',
    usagePerPiece: null,
    cuttingQuantity: null,
    remark: '',
  })
}

function removeMaterialRow(index: number) {
  materialsForm.materials.splice(index, 1)
}

async function submitMaterials() {
  if (!detailDrawer.row) return
  const payloadMaterials = (materialsForm.materials ?? [])
    .map(normalizePatternMaterialRow)
    .filter((r) => {
      const hasType = r.materialTypeId != null
      const hasName = (r.materialName ?? '').trim().length > 0
      return hasType || hasName
    })
  detailDrawer.saving = true
  try {
    await savePatternMaterials(detailDrawer.row.orderId, { materials: payloadMaterials, remark: materialsForm.remark ?? '' })
    ElMessage.success('已保存')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '保存失败'))
  } finally {
    detailDrawer.saving = false
  }
}

async function loadOptions() {
  try {
    const [orderTypeRes, collabRes] = await Promise.all([
      getDictTree('order_types'),
      getDictItems('collaboration'),
    ])
    orderTypeTree.value = Array.isArray(orderTypeRes.data) ? orderTypeRes.data : []
    const items = collabRes.data ?? []
    collaborationOptions.value = (Array.isArray(items) ? items : []).map((item: any) => ({
      id: item.id,
      label: item.value,
    }))
  } catch {
    orderTypeTree.value = []
    collaborationOptions.value = []
  }
}

async function loadMaterialTypes() {
  try {
    const res = await getDictItems('material_types')
    const list = res.data ?? []
    materialTypeOptions.value = (Array.isArray(list) ? list : []).map((item: any) => ({
      id: item.id,
      label: item.value,
    }))
  } catch {
    materialTypeOptions.value = []
  }
}

function orderTypeDisplay(row: PatternListItem): string {
  if (typeof row.orderTypeId === 'number') {
    const label = findOrderTypeLabelById(row.orderTypeId)
    if (label && label.trim()) return label.trim()
  }
  return ''
}

function collaborationDisplay(row: PatternListItem): string {
  if (typeof row.collaborationTypeId === 'number') {
    const label = findCollaborationLabelById(row.collaborationTypeId)
    if (label && label.trim()) return label.trim()
  }
  return ''
}

async function loadPatternStaffOptions() {
  try {
    const res = await getEmployeeList({ status: 'active', page: 1, pageSize: 200 })
    const data = res.data
    const employees = data?.list ?? []
    patternMasterOptions.value = employees.filter((e) => e.jobTitleName === '纸样师')
    sampleMakerOptions.value = employees.filter((e) => e.jobTitleName === '车版师')
  } catch {
    patternMasterOptions.value = []
    sampleMakerOptions.value = []
  }
}

onMounted(() => {
  loadOptions()
  void loadMaterialTypes()
  load()
  void loadTabCounts()
  void loadPatternStaffOptions()
})
</script>

<style scoped>
.pattern-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.status-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.status-tabs-left {
  flex-shrink: 0;
}

.pattern-table {
  flex: 1;
  min-height: 0;
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.table-thumb {
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  display: block;
}

.text-muted {
  color: var(--el-text-color-secondary);
}

.complete-brief {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  font-size: var(--font-size-caption, 12px);
}

.complete-brief > div + div {
  margin-top: 4px;
}

.complete-hint {
  margin-bottom: var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption, 12px);
}

.sample-image-upload {
  border: 1px dashed var(--el-border-color);
  border-radius: var(--radius);
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: var(--el-fill-color-lighter);
}

.sample-image-upload:hover {
  border-color: var(--el-color-primary);
}

.image-preview-wrap {
  position: relative;
  width: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.image-preview-wrap :deep(.el-image) {
  max-width: 200px;
  max-height: 200px;
  border-radius: var(--radius);
}

.image-remove {
  position: absolute;
  top: 8px;
  right: 8px;
}

.image-placeholder {
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption, 12px);
}

.hidden-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.materials-brief {
  margin-bottom: var(--space-sm);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  font-size: var(--el-font-size-base);
}

.materials-brief > div + div {
  margin-top: 4px;
}

.materials-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  justify-content: flex-end;
  margin-bottom: var(--space-sm);
  font-size: var(--el-font-size-base);
}

.materials-table :deep(.el-input-number) {
  width: 100%;
}

.materials-table :deep(.el-table__cell) {
  text-align: center;
  font-size: var(--el-font-size-base);
}

.materials-table :deep(.el-input__inner),
.materials-table :deep(.el-textarea__inner),
.materials-table :deep(.el-select__selected-item),
.materials-table :deep(.el-select__placeholder) {
  text-align: center;
  font-size: var(--el-font-size-base);
}

.materials-table :deep(.el-input-number .el-input__inner) {
  text-align: center;
}

.materials-remark {
  margin-top: var(--space-sm);
}

.materials-remark-label {
  margin-bottom: 6px;
  color: var(--el-text-color-secondary);
  font-size: var(--el-font-size-base);
}

.materials-remark :deep(.el-textarea__inner) {
  font-size: var(--el-font-size-base);
}

.detail-drawer-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--space-sm);
}

.pattern-sub-attr {
  font-size: 12px;
  margin-top: 2px;
}

.pattern-brief-extra {
  margin-top: 12px;
}
</style>
