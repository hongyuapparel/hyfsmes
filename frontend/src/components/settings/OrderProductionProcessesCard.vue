<template>
  <div v-show="active">
    <h3 class="section-title">生产工序</h3>
    <p class="section-desc">部门为固定根（裁床、车缝、尾部），在其下维护工种及多级子分组；展开工种可维护具体工序与单价。同一层级不重复展示部门/工种名称。</p>

    <div class="process-actions">
      <el-button type="primary" size="small" @click="openAddDepartment">新增部门</el-button>
    </div>
    <el-table ref="processTreeTableRef" :data="processTreeData" row-key="id" :expand-row-keys="expandedKeys" border size="small" class="process-table process-tree-single" lazy :load="loadProcessTreeNode" :tree-props="{ hasChildren: 'hasChildren', children: 'children' }" @expand-change="onProcessTreeExpandChange">
      <el-table-column label="部门" min-width="100" align="center">
        <template #default="{ row }"><template v-if="row.rowType === 'department'">{{ row.department || '-' }}</template></template>
      </el-table-column>
      <el-table-column label="工种" min-width="120" align="center">
        <template #default="{ row }"><template v-if="row.rowType === 'job_type'">{{ row.displayName || '-' }}</template></template>
      </el-table-column>
      <el-table-column label="工序" min-width="120" align="center">
        <template #default="{ row }"><template v-if="row.rowType === 'process'">{{ row.processName || '-' }}</template></template>
      </el-table-column>
      <el-table-column label="价格(元)" width="100" align="center">
        <template #default="{ row }"><template v-if="row.rowType === 'process'">{{ formatDisplayNumber(row.price) }}</template><template v-else>-</template></template>
      </el-table-column>
      <el-table-column label="操作" min-width="180">
        <template #default="{ row }">
          <template v-if="row.rowType === 'department'"><div class="process-row-actions"><el-button link type="primary" size="small" @click="openAddChildJobType(row)">新建工种</el-button></div></template>
          <template v-else-if="row.rowType === 'job_type'">
            <div class="process-row-actions">
              <el-button link type="primary" size="small" @click="openEditJobType(row)">编辑</el-button>
              <el-button link size="small" :disabled="!canMoveUpJobType(row)" @click="moveJobTypeRow(row, -1)">上移</el-button>
              <el-button link size="small" :disabled="!canMoveDownJobType(row)" @click="moveJobTypeRow(row, 1)">下移</el-button>
              <el-button link type="danger" size="small" @click="removeJobType(row)">删除</el-button>
              <el-button link type="primary" size="small" @click="openProcessDialog(undefined, row)">新增工序</el-button>
            </div>
          </template>
          <template v-else-if="row.rowType === 'process'"><div class="process-row-actions"><el-button link type="primary" size="small" @click="row.processRow && openProcessDialog(row.processRow)">编辑</el-button><el-button link type="danger" size="small" @click="row.processRow && removeProcess(row.processRow)">删除</el-button></div></template>
          <template v-else-if="row.rowType === 'load_more'"><div class="process-row-actions"><el-button link type="primary" size="small" @click="loadMoreProcesses(row)">加载更多（{{ formatDisplayNumber(row.loadedCount ?? 0) }}/{{ formatDisplayNumber(row.totalCount ?? 0) }}）</el-button></div></template>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="jobTypeDialog.visible" :title="jobTypeDialogTitle()" width="440px" @close="onJobTypeDialogClose">
      <el-form :model="jobTypeForm" label-width="80px" size="default">
        <el-form-item v-if="jobTypeDialog.mode === 'edit'" label="部门">
          <el-select v-model="jobTypeForm.parentId" placeholder="选择部门" filterable style="width: 100%">
            <el-option v-for="opt in jobTypeEditDepartmentOptions()" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="名称"><el-input v-model="jobTypeForm.value" placeholder="请输入工种或分组名称" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="jobTypeDialog.visible = false">取消</el-button><el-button type="primary" :loading="jobTypeSubmitLoading" @click="submitJobType">确定</el-button></template>
    </el-dialog>

    <el-dialog v-model="processDialog.visible" :title="processDialog.id ? '编辑工序' : '新增工序'" width="440px" @close="processDialog.id = undefined">
      <el-form :model="processForm" label-width="90px" size="default">
        <el-form-item label="部门">
          <el-select v-model="processForm.department" placeholder="选择部门" clearable style="width: 100%" @change="onProcessDepartmentChange">
            <el-option v-for="d in ['裁床', '车缝', '尾部']" :key="d" :label="d" :value="d" />
          </el-select>
        </el-form-item>
        <el-form-item label="工种"><el-select v-model="processForm.jobType" placeholder="先选部门后选择工种" clearable filterable style="width: 100%" :disabled="!processForm.department"><el-option v-for="j in processJobTypeOptions" :key="j" :label="j" :value="j" /></el-select></el-form-item>
        <el-form-item label="工序名称"><el-input v-model="processForm.name" placeholder="如：开裁、拼缝" /></el-form-item>
        <el-form-item label="单价(元)"><el-input-number v-model="processForm.unitPrice" :min="0" :precision="2" :controls="false" style="width: 100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="processDialog.visible = false">取消</el-button><el-button type="primary" @click="submitProcess">确定</el-button></template>
    </el-dialog>

    <h4 class="subsection-title">服装类型报价模板</h4>
    <p class="section-desc">配置如 T恤、连衣裙等服装类型常用的工序组合，订单成本页可一键导入后再按款式微调。</p>
    <div class="process-actions"><el-button type="primary" size="small" @click="openQuoteTemplateDialog()">新增模板</el-button></div>
    <el-collapse v-model="activeQuoteTemplateIds" class="quote-template-collapse" @change="onQuoteTemplateCollapseChange">
      <el-collapse-item v-for="row in quoteTemplateList" :key="row.id" :name="String(row.id)">
        <template #title>
          <div class="quote-template-title">
            <span class="quote-template-name-wrap"><el-icon class="quote-template-fold-icon" :class="{ expanded: isQuoteTemplateExpanded(row.id) }"><ArrowRight /></el-icon><span class="quote-template-name">{{ row.name }}</span></span>
            <div class="quote-template-actions" @click.stop>
              <el-button link type="primary" size="small" @click.stop="openQuoteTemplateDialog(row)">编辑</el-button>
              <el-button link type="primary" size="small" @click.stop="openQuoteTemplateItemsDialog(row)">编辑工序</el-button>
              <el-button link type="danger" size="small" @click.stop="removeQuoteTemplate(row)">删除</el-button>
            </div>
          </div>
        </template>
        <div class="template-expand-wrap">
          <el-skeleton v-if="quoteTemplateItemsLoadingMap[row.id]" :rows="2" animated />
          <el-table v-else :data="quoteTemplateItemsMap[row.id] ?? []" size="small" border class="process-table template-items-table">
            <el-table-column prop="department" label="部门" min-width="100" align="center" />
            <el-table-column prop="jobType" label="工种" min-width="120" align="center" />
            <el-table-column prop="processName" label="工序" min-width="120" align="center" />
            <el-table-column label="价格(元)" width="100" align="center"><template #default="{ row: item }">{{ formatDisplayNumber(item.unitPrice) }}</template></el-table-column>
          </el-table>
          <p v-if="!quoteTemplateItemsLoadingMap[row.id] && !(quoteTemplateItemsMap[row.id]?.length)" class="empty-hint">该模板暂无工序，可点击右上“编辑工序”维护。</p>
        </div>
      </el-collapse-item>
    </el-collapse>

    <el-dialog v-model="quoteTemplateDialog.visible" :title="quoteTemplateDialog.id ? '编辑模板' : '新增模板'" width="400px" @close="quoteTemplateDialog.id = undefined">
      <el-form :model="quoteTemplateForm" label-width="90px" size="default"><el-form-item label="模板名称"><el-input v-model="quoteTemplateForm.name" placeholder="如：T恤、连衣裙" /></el-form-item></el-form>
      <template #footer><el-button @click="quoteTemplateDialog.visible = false">取消</el-button><el-button type="primary" @click="submitQuoteTemplate">确定</el-button></template>
    </el-dialog>

    <el-dialog v-model="quoteTemplateItemsDialog.visible" :title="`编辑工序：${quoteTemplateItemsDialog.name ?? ''}`" width="560px" @close="quoteTemplateItemsDialog.templateId = undefined">
      <div v-loading="quoteTemplateItemsDialogLoading" class="quote-template-items-body">
      <div class="quote-template-items-actions">
        <el-select
          v-model="quoteTemplateItemToAdd"
          placeholder="输入工序名称关键词搜索后添加"
          remote
          filterable
          clearable
          multiple
          collapse-tags
          collapse-tags-tooltip
          :remote-method="searchProcessOptions"
          :loading="processSearchLoading"
          size="small"
          class="quote-template-process-select"
        >
          <el-option v-for="p in quoteTemplateProcessOptions" :key="p.id" :label="`${p.department} · ${p.jobType} · ${p.name}（${formatDisplayNumber(p.unitPrice)} 元）`" :value="p.id" :disabled="quoteTemplateItemsEdit.some((x) => x.processId === p.id)" />
        </el-select>
        <el-button type="primary" size="small" @click="addQuoteTemplateItem">批量添加工序</el-button>
      </div>
      <el-table :data="quoteTemplateItemsEdit" size="small" border row-key="processId" class="process-table">
        <el-table-column prop="department" label="部门" width="90" />
        <el-table-column prop="jobType" label="工种" min-width="100" />
        <el-table-column prop="processName" label="工序" min-width="100" />
        <el-table-column label="单价(元)" width="90" align="right"><template #default="{ row: item }">{{ formatDisplayNumber(item.unitPrice) }}</template></el-table-column>
        <el-table-column label="操作" width="70" align="center"><template #default="{ row: item }"><el-button link type="danger" size="small" @click="removeQuoteTemplateItem(item)">删除</el-button></template></el-table-column>
      </el-table>
      </div>
      <template #footer><el-button @click="quoteTemplateItemsDialog.visible = false">取消</el-button><el-button type="primary" @click="submitQuoteTemplateItems">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { ArrowRight } from '@element-plus/icons-vue'
import { formatDisplayNumber } from '@/utils/display-number'
import { useOrderSettingsProductionProcesses } from '@/composables/useOrderSettingsProductionProcesses'
import { useOrderSettingsQuoteTemplates } from '@/composables/useOrderSettingsQuoteTemplates'

const props = defineProps<{ active: boolean }>()

const {
  processTreeTableRef, processTreeData, expandedKeys, processDialog, processForm, processJobTypeOptions,
  jobTypeDialog, jobTypeForm, jobTypeSubmitLoading, loadProcessTreeRoots, loadProcessTreeNode, loadMoreProcesses,
  openProcessDialog, onProcessDepartmentChange, submitProcess, removeProcess, onProcessTreeExpandChange,
  ensureProcessJobTypeRoots, refreshProcessJobTypeList, openAddDepartment, openAddChildJobType,
  openEditJobType, submitJobType, removeJobType, moveJobTypeRow, canMoveUpJobType, canMoveDownJobType,
  jobTypeDialogTitle, jobTypeEditDepartmentOptions, onJobTypeDialogClose,
} = useOrderSettingsProductionProcesses()

const {
  quoteTemplateList, quoteTemplateDialog, quoteTemplateForm, quoteTemplateItemsDialog, quoteTemplateItemsEdit,
  quoteTemplateProcessOptions, quoteTemplateItemToAdd, activeQuoteTemplateIds, quoteTemplateItemsMap,
  quoteTemplateItemsLoadingMap, loadQuoteTemplates, onQuoteTemplateCollapseChange, isQuoteTemplateExpanded,
  openQuoteTemplateDialog, submitQuoteTemplate, removeQuoteTemplate, openQuoteTemplateItemsDialog,
  quoteTemplateItemsDialogLoading, searchProcessOptions, processSearchLoading,
  addQuoteTemplateItem, removeQuoteTemplateItem, submitQuoteTemplateItems,
} = useOrderSettingsQuoteTemplates()

watch(
  () => props.active,
  async (active) => {
    if (!active) return
    await refreshProcessJobTypeList()
    await ensureProcessJobTypeRoots()
    await loadProcessTreeRoots()
    await loadQuoteTemplates()
  },
  { immediate: true },
)
</script>

<style scoped>
.section-title { margin: 0 0 var(--space-sm); font-size: var(--font-size-body); font-weight: 600; }
.section-desc { font-size: var(--font-size-caption); color: var(--el-text-color-secondary); margin: 0 0 var(--space-sm); }
.subsection-title { font-size: var(--font-size-caption); font-weight: 600; margin: var(--space-md) 0 var(--space-xs); }
.process-actions { margin-bottom: var(--space-sm); }
.process-table { font-size: var(--font-size-body); }
.process-tree-single .el-table__row .el-table__cell:first-child { font-weight: inherit; }
.process-row-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.quote-template-items-body { min-height: 120px; }
.quote-template-items-actions { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm); }
.quote-template-process-select { flex: 1; min-width: 280px; }
.template-expand-wrap { padding: 8px 0; }
.template-items-table { margin-bottom: 6px; }
.quote-template-collapse { border-top: 1px solid var(--el-border-color); border-bottom: 1px solid var(--el-border-color); }
.quote-template-title { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); padding: 0 var(--space-sm); }
.quote-template-name { font-weight: 500; }
.quote-template-name-wrap { display: inline-flex; align-items: center; gap: 8px; min-width: 0; flex: 1; }
.quote-template-fold-icon { font-size: 12px; color: var(--el-text-color-secondary); transition: transform 0.2s ease; }
.quote-template-fold-icon.expanded { transform: rotate(90deg); }
.quote-template-actions { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
.quote-template-collapse :deep(.el-collapse-item__arrow) { display: none; }
.quote-template-collapse :deep(.el-collapse-item__header) { height: 32px; line-height: 32px; min-height: 32px; padding: 0 4px; }
.quote-template-collapse :deep(.el-collapse-item__content) { padding-bottom: 8px; }
</style>
