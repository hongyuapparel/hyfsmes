<template>
  <div class="page-card">
    <p class="settings-hint">
      配置订单相关下拉选项，如订单类型、合作方式、产品分组、物料类型等，这些选项会在订单相关页面中统一复用，保证含义和取值一致。生产工序用于订单成本页勾选并汇总工序单价。
    </p>

    <div class="settings-body">
      <el-tabs v-model="activeTab" tab-position="left" class="settings-tabs">
        <el-tab-pane label="订单类型" name="orderTypes" />
        <el-tab-pane label="合作方式" name="collaboration" />
        <el-tab-pane label="产品分组" name="productGroups" />
        <el-tab-pane label="适用人群" name="applicablePeople" />
        <el-tab-pane label="物料类型" name="materialTypes" />
        <el-tab-pane label="物料来源" name="materialSources" />
        <el-tab-pane label="生产工序" name="productionProcesses" />
        <el-tab-pane label="订单时效配置" name="orderSla" />
        <el-tab-pane label="订单流转规则" name="orderStatusConfig" />
      </el-tabs>

      <div class="settings-content">
        <template v-if="activeTab === 'orderTypes'">
          <h3 class="section-title">订单类型</h3>
          <OptionList type="order_types" label="订单类型" />
        </template>

        <template v-else-if="activeTab === 'collaboration'">
          <h3 class="section-title">合作方式</h3>
          <OptionList type="collaboration" label="合作方式" />
        </template>

        <template v-else-if="activeTab === 'productGroups'">
          <h3 class="section-title">产品分组</h3>
          <OptionList type="product_groups" label="产品分组" />
        </template>

        <template v-else-if="activeTab === 'applicablePeople'">
          <h3 class="section-title">适用人群</h3>
          <OptionList type="applicable_people" label="适用人群" />
        </template>

        <template v-else-if="activeTab === 'materialTypes'">
          <h3 class="section-title">物料类型</h3>
          <OptionList type="material_types" label="物料类型" />
        </template>
        <template v-else-if="activeTab === 'materialSources'">
          <h3 class="section-title">物料来源</h3>
          <OptionList type="material_sources" label="物料来源" />
        </template>
        <template v-else-if="activeTab === 'orderSla'">
          <h3 class="section-title">订单时效配置</h3>
          <p class="section-desc">
            为每个订单状态设置合理停留时长（小时），超过即视为超期，用于财务管理中的「订单流转时效报表」统计与绩效考核。
          </p>
          <div class="sla-actions">
            <el-button type="primary" size="small" @click="openSlaDialog()">新增配置</el-button>
      </div>
          <el-table :data="slaList" size="small" border row-key="id">
            <el-table-column label="状态" width="140">
              <template #default="{ row }">
                {{ row.orderStatus?.label ?? '-' }}
              </template>
            </el-table-column>
            <el-table-column label="合理时长（小时）" width="140" align="right">
              <template #default="{ row }">
                {{ formatDisplayNumber(row.limitHours) }}
              </template>
            </el-table-column>
            <el-table-column label="启用" width="80">
              <template #default="{ row }">
                <el-tag v-if="row.enabled" type="success" size="small">是</el-tag>
                <el-tag v-else type="info" size="small">否</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openSlaDialog(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="removeSla(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-dialog
            v-model="slaDialog.visible"
            :title="slaDialog.id ? '编辑时效配置' : '新增时效配置'"
            width="400px"
            @close="slaDialog.id = undefined"
          >
            <el-form :model="slaForm" label-width="120px" size="default">
              <el-form-item label="订单状态">
                <el-select
                  v-model="slaForm.orderStatusId"
                  placeholder="选择状态"
                  style="width: 100%"
                  :disabled="!!slaDialog.id"
                >
                  <el-option
                    v-for="s in slaStatusOptions"
                    :key="s.id"
                    :label="s.label"
                    :value="s.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="合理时长（小时）">
                <el-input-number
                  v-model="slaForm.limitHours"
                  :min="0"
                  :precision="2"
                  :controls="false"
                  style="width: 100%"
                  placeholder="如 4、48"
                />
              </el-form-item>
              <el-form-item label="启用">
                <el-switch v-model="slaForm.enabled" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="slaDialog.visible = false">取消</el-button>
              <el-button type="primary" @click="submitSla">确定</el-button>
            </template>
          </el-dialog>
        </template>

        <template v-else-if="activeTab === 'productionProcesses'">
          <h3 class="section-title">生产工序</h3>
          <p class="section-desc">部门为固定根（裁床、车缝、尾部），在其下维护工种及多级子分组；展开工种可维护具体工序与单价。同一层级不重复展示部门/工种名称。</p>

          <div class="process-actions">
            <el-button type="primary" size="small" @click="openAddDepartment()">新增部门</el-button>
    </div>
          <el-table
            ref="processTreeTableRef"
            :data="processTreeData"
            row-key="id"
            :expand-row-keys="expandedKeys"
            border
            size="small"
            class="process-table process-tree-single"
            lazy
            :load="loadProcessTreeNode"
            :tree-props="{ hasChildren: 'hasChildren', children: 'children' }"
            @expand-change="onProcessTreeExpandChange"
          >
            <el-table-column label="部门" min-width="100" align="center">
              <template #default="{ row }">
                <template v-if="row.rowType === 'department'">{{ row.department || '-' }}</template>
                <template v-else></template>
              </template>
            </el-table-column>
            <el-table-column label="工种" min-width="120" align="center">
              <template #default="{ row }">
                <template v-if="row.rowType === 'job_type'">{{ row.displayName || '-' }}</template>
                <template v-else></template>
              </template>
            </el-table-column>
            <el-table-column label="工序" min-width="120" align="center">
              <template #default="{ row }">
                <template v-if="row.rowType === 'process'">{{ row.processName || '-' }}</template>
                <template v-else></template>
              </template>
            </el-table-column>
            <el-table-column label="价格(元)" width="100" align="center">
              <template #default="{ row }">
                <template v-if="row.rowType === 'process'">{{ formatDisplayNumber(row.price) }}</template>
                <template v-else>-</template>
              </template>
            </el-table-column>
            <el-table-column label="操作" min-width="180">
              <template #default="{ row }">
                <template v-if="row.rowType === 'department'">
                  <div class="process-row-actions">
                    <el-button link type="primary" size="small" @click="openAddChildJobType(row)">新建工种</el-button>
                  </div>
                </template>
                <template v-else-if="row.rowType === 'job_type'">
                  <div class="process-row-actions">
                    <el-button link type="primary" size="small" @click="openEditJobType(row)">编辑</el-button>
                    <el-button link size="small" :disabled="!canMoveUpJobType(row)" @click="moveJobTypeRow(row, -1)">上移</el-button>
                    <el-button link size="small" :disabled="!canMoveDownJobType(row)" @click="moveJobTypeRow(row, 1)">下移</el-button>
                    <el-button link type="danger" size="small" @click="removeJobType(row)">删除</el-button>
                    <el-button link type="primary" size="small" @click="openProcessDialog(undefined, row)">新增工序</el-button>
                  </div>
                </template>
                <template v-else-if="row.rowType === 'process'">
                  <div class="process-row-actions">
                    <el-button link type="primary" size="small" @click="openProcessDialog(row.processRow)">编辑</el-button>
                    <el-button link type="danger" size="small" @click="removeProcess(row.processRow!)">删除</el-button>
                  </div>
                </template>
                <template v-else-if="row.rowType === 'load_more'">
                  <div class="process-row-actions">
                    <el-button link type="primary" size="small" @click="loadMoreProcesses(row)">
                      加载更多（{{ formatDisplayNumber(row.loadedCount ?? 0) }}/{{
                        formatDisplayNumber(row.totalCount ?? 0)
                      }}）
                    </el-button>
                  </div>
                </template>
              </template>
            </el-table-column>
          </el-table>
          <el-dialog
            v-model="jobTypeDialog.visible"
            :title="jobTypeDialogTitle"
            width="440px"
            @close="onJobTypeDialogClose"
          >
            <el-form :model="jobTypeForm" label-width="80px" size="default">
              <el-form-item v-if="jobTypeDialog.mode === 'edit'" label="部门">
                <el-select
                  v-model="jobTypeForm.parentId"
                  placeholder="选择部门"
                  filterable
                  style="width: 100%"
                >
                  <el-option
                    v-for="opt in jobTypeEditDepartmentOptions"
                    :key="opt.value"
                    :label="opt.label"
                    :value="opt.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="名称">
                <el-input v-model="jobTypeForm.value" placeholder="请输入工种或分组名称" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="jobTypeDialog.visible = false">取消</el-button>
              <el-button type="primary" :loading="jobTypeSubmitLoading" @click="submitJobType">确定</el-button>
            </template>
          </el-dialog>
          <el-dialog
            v-model="processDialog.visible"
            :title="processDialog.id ? '编辑工序' : '新增工序'"
            width="440px"
            @close="processDialog.id = undefined"
          >
            <el-form :model="processForm" label-width="90px" size="default">
              <el-form-item label="部门">
                <el-select v-model="processForm.department" placeholder="选择部门" clearable style="width: 100%" @change="onProcessDepartmentChange">
                  <el-option v-for="d in processDepartments" :key="d" :label="d" :value="d" />
                </el-select>
              </el-form-item>
              <el-form-item label="工种">
                <el-select v-model="processForm.jobType" placeholder="先选部门后选择工种" clearable filterable style="width: 100%" :disabled="!processForm.department">
                  <el-option v-for="j in processJobTypeOptions" :key="j" :label="j" :value="j" />
                </el-select>
              </el-form-item>
              <el-form-item label="工序名称">
                <el-input v-model="processForm.name" placeholder="如：开裁、拼缝" />
              </el-form-item>
              <el-form-item label="单价(元)">
                <el-input-number v-model="processForm.unitPrice" :min="0" :precision="2" :controls="false" style="width: 100%" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="processDialog.visible = false">取消</el-button>
              <el-button type="primary" @click="submitProcess">确定</el-button>
            </template>
          </el-dialog>

          <h4 class="subsection-title">服装类型报价模板</h4>
          <p class="section-desc">配置如 T恤、连衣裙等服装类型常用的工序组合，订单成本页可一键导入后再按款式微调。</p>
          <div class="process-actions">
            <el-button type="primary" size="small" @click="openQuoteTemplateDialog()">新增模板</el-button>
          </div>
          <el-collapse v-model="activeQuoteTemplateIds" class="quote-template-collapse" @change="onQuoteTemplateCollapseChange">
            <el-collapse-item v-for="row in quoteTemplateList" :key="row.id" :name="String(row.id)">
              <template #title>
                <div class="quote-template-title">
                  <span class="quote-template-name-wrap">
                    <el-icon
                      class="quote-template-fold-icon"
                      :class="{ expanded: isQuoteTemplateExpanded(row.id) }"
                    >
                      <ArrowRight />
                    </el-icon>
                    <span class="quote-template-name">{{ row.name }}</span>
                  </span>
                  <div class="quote-template-actions" @click.stop>
                    <el-button link type="primary" size="small" @click.stop="openQuoteTemplateDialog(row)">编辑</el-button>
                    <el-button link type="primary" size="small" @click.stop="openQuoteTemplateItemsDialog(row)">编辑工序</el-button>
                    <el-button link type="danger" size="small" @click.stop="removeQuoteTemplate(row)">删除</el-button>
                  </div>
                </div>
              </template>
              <div class="template-expand-wrap">
                <el-skeleton v-if="quoteTemplateItemsLoadingMap[row.id]" :rows="2" animated />
                <el-table
                  v-else
                  :data="quoteTemplateItemsMap[row.id] ?? []"
                  size="small"
                  border
                  class="process-table template-items-table"
                >
                  <el-table-column prop="department" label="部门" min-width="100" align="center" />
                  <el-table-column prop="jobType" label="工种" min-width="120" align="center" />
                  <el-table-column prop="processName" label="工序" min-width="120" align="center" />
                  <el-table-column label="价格(元)" width="100" align="center">
                    <template #default="{ row }">{{ formatDisplayNumber(row.unitPrice) }}</template>
                  </el-table-column>
                </el-table>
                <p v-if="!quoteTemplateItemsLoadingMap[row.id] && !(quoteTemplateItemsMap[row.id]?.length)" class="empty-hint">
                  该模板暂无工序，可点击右上“编辑工序”维护。
                </p>
              </div>
            </el-collapse-item>
          </el-collapse>
          <el-dialog
            v-model="quoteTemplateDialog.visible"
            :title="quoteTemplateDialog.id ? '编辑模板' : '新增模板'"
            width="400px"
            @close="quoteTemplateDialog.id = undefined"
          >
            <el-form :model="quoteTemplateForm" label-width="90px" size="default">
              <el-form-item label="模板名称">
                <el-input v-model="quoteTemplateForm.name" placeholder="如：T恤、连衣裙" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="quoteTemplateDialog.visible = false">取消</el-button>
              <el-button type="primary" @click="submitQuoteTemplate">确定</el-button>
            </template>
          </el-dialog>
          <el-dialog
            v-model="quoteTemplateItemsDialog.visible"
            :title="`编辑工序：${quoteTemplateItemsDialog.name ?? ''}`"
            width="560px"
            @close="quoteTemplateItemsDialog.templateId = undefined"
          >
            <div class="quote-template-items-actions">
              <el-select
                v-model="quoteTemplateItemToAdd"
                placeholder="可多选工序后批量添加入模板"
                filterable
                clearable
                multiple
                collapse-tags
                collapse-tags-tooltip
                size="small"
                class="quote-template-process-select"
              >
                <el-option
                  v-for="p in quoteTemplateProcessOptions"
                  :key="p.id"
                    :label="`${p.department} · ${p.jobType} · ${p.name}（${formatDisplayNumber(p.unitPrice)} 元）`"
                  :value="p.id"
                  :disabled="quoteTemplateItemsEdit.some((x) => x.processId === p.id)"
                />
              </el-select>
              <el-button type="primary" size="small" @click="addQuoteTemplateItem">批量添加工序</el-button>
            </div>
            <el-table :data="quoteTemplateItemsEdit" size="small" border row-key="processId" class="process-table">
              <el-table-column prop="department" label="部门" width="90" />
              <el-table-column prop="jobType" label="工种" min-width="100" />
              <el-table-column prop="processName" label="工序" min-width="100" />
              <el-table-column label="单价(元)" width="90" align="right">
                <template #default="{ row }">{{ formatDisplayNumber(row.unitPrice) }}</template>
              </el-table-column>
              <el-table-column label="操作" width="70" align="center">
                <template #default="{ row }">
                  <el-button link type="danger" size="small" @click="removeQuoteTemplateItem(row)">删除</el-button>
                </template>
              </el-table-column>
            </el-table>
            <template #footer>
              <el-button @click="quoteTemplateItemsDialog.visible = false">取消</el-button>
              <el-button type="primary" @click="submitQuoteTemplateItems">保存</el-button>
            </template>
          </el-dialog>
        </template>

        <template v-else>
          <h3 class="section-title">订单流转规则</h3>
          <p class="section-desc">
            在这里维护销售订单从草稿到完成的各个状态，以及在不同状态下通过按钮或自动事件流转到下一状态的规则。仅影响配置，不会自动修改历史订单。
          </p>

          <div class="status-layout">
            <div class="status-list">
              <div class="status-list-header">
                <span>订单状态</span>
                <el-button type="primary" size="small" @click="openCreateStatus">新增状态</el-button>
              </div>
              <el-table
                :data="statusList"
                size="small"
                border
                highlight-current-row
                @current-change="onCurrentStatusChange"
                row-key="id"
              >
                <el-table-column prop="label" label="名称" width="160" />
                <el-table-column prop="sortOrder" label="排序" width="80" />
                <el-table-column prop="isFinal" label="终态" width="80">
                  <template #default="{ row }">
                    <el-tag v-if="row.isFinal" type="success" size="small">是</el-tag>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <!-- 启用开关暂时下线，避免保存异常导致订单列表状态全部消失 -->
                <el-table-column label="操作" width="120">
                  <template #default="{ row }">
                    <el-button link type="primary" size="small" @click="openEditStatus(row)">编辑</el-button>
                    <el-button link type="danger" size="small" @click="removeStatus(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <div class="transition-list">
              <div class="transition-header">
                <div class="transition-title">
                  <span>流程链路</span>
                  <span class="transition-subtitle">（按整条链路管理与编辑）</span>
                </div>
                <div class="transition-actions">
                  <el-button type="primary" plain size="small" @click="openChainDialog">新增流程链路</el-button>
                </div>
              </div>
              <el-table ref="chainTableRef" :data="chainList" size="small" border row-key="chain.id">
                <el-table-column label="" width="44" align="center">
                  <template #default>
                    <span class="chain-drag-handle" title="拖拽调整顺序">≡</span>
                  </template>
                </el-table-column>
                <el-table-column label="名称" width="180" show-overflow-tooltip>
                  <template #default="{ row }">{{ row.chain.name }}</template>
                </el-table-column>
                <el-table-column label="链路内容" min-width="360" show-overflow-tooltip>
                  <template #default="{ row }">{{ buildChainSummary(row.steps) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="200">
                  <template #default="{ row }">
                    <el-button link type="primary" size="small" @click="openEditChain(row)">编辑链路</el-button>
                    <el-button link type="primary" size="small" @click="duplicateChain(row)">复制链路</el-button>
                    <el-button link type="danger" size="small" @click="removeChain(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>

            <!-- 流转规则（高级/调试用）：按用户要求，默认不展示 -->
            <div class="transition-list" v-if="false">
              <div class="transition-header">
                <div class="transition-title">
                  <span>流转规则</span>
                  <span class="transition-subtitle">（当前状态：{{ currentStatusLabel || '未选择' }}）</span>
                </div>
                <div class="transition-actions">
                  <el-button type="primary" size="small" :disabled="!currentStatusCode" @click="openCreateTransition">
                    新增规则
                  </el-button>
                </div>
              </div>
              <el-table :data="transitionList" size="small" border row-key="id">
                <el-table-column label="触发方式" width="100">
                  <template #default="{ row }">
                    {{ getTriggerTypeLabel(row.triggerType) }}
                  </template>
                </el-table-column>
                <el-table-column label="触发动作" width="140" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ getTriggerActionLabel(row.triggerCode) }}
                  </template>
                </el-table-column>
                <el-table-column label="目标状态" width="140" show-overflow-tooltip>
                  <template #default="{ row }">
                    {{ getStatusLabel(row.toStatus) }}
                  </template>
                </el-table-column>
                <el-table-column prop="nextDepartment" label="归属部门" width="120" />
                <el-table-column prop="allowRoles" label="允许角色" min-width="160" show-overflow-tooltip />
                <el-table-column prop="enabled" label="启用" width="80">
                  <template #default="{ row }">
                    <el-switch v-model="row.enabled" size="small" @change="onToggleTransitionEnabled(row)" />
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="120">
                  <template #default="{ row }">
                    <el-button link type="primary" size="small" @click="openEditTransition(row)">编辑</el-button>
                    <el-button link type="danger" size="small" @click="removeTransition(row)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </div>

          <el-dialog v-model="statusDialog.visible" :title="statusDialog.isEdit ? '编辑状态' : '新增状态'" width="420px">
            <el-form :model="statusForm" label-width="100px" size="default">
              <el-form-item label="名称">
                <el-input v-model="statusForm.label" placeholder="如 草稿、待审单" />
              </el-form-item>
              <el-form-item label="排序">
                <el-input-number v-model="statusForm.sortOrder" :min="0" :controls="false" style="width: 100%" />
              </el-form-item>
              <el-form-item label="是否终态">
                <el-switch v-model="statusForm.isFinal" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="statusDialog.visible = false">取消</el-button>
              <el-button type="primary" @click="submitStatus">确定</el-button>
            </template>
          </el-dialog>

          <el-dialog v-if="false"
            v-model="transitionDialog.visible"
            :title="transitionDialog.isEdit ? '编辑流转规则' : '新增流转规则'"
            width="520px"
          >
            <el-form :model="transitionForm" label-width="120px" size="default">
              <el-form-item label="当前订单状态">
                <el-input :model-value="getStatusLabel(transitionForm.fromStatus)" disabled />
              </el-form-item>
              <el-form-item label="流转到哪个状态">
                <el-select v-model="transitionForm.toStatus" placeholder="选择目标状态" style="width: 100%">
                  <el-option v-for="s in statusList" :key="s.id" :label="s.label" :value="s.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="触发方式">
                <el-select v-model="transitionForm.triggerType" style="width: 100%">
                  <el-option label="按钮操作" value="button" />
                  <el-option label="自动事件" value="auto_event" />
                </el-select>
              </el-form-item>
              <el-form-item label="触发动作名称">
                <el-select v-model="transitionForm.triggerCode" placeholder="选择触发动作" style="width: 100%">
                  <el-option v-for="opt in TRIGGER_ACTION_OPTIONS" :key="opt.code" :label="opt.label" :value="opt.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="归属部门（可选）">
                <el-input v-model="transitionForm.nextDepartment" placeholder="如 采购 / 纸样 / 裁床 / 车缝 / 尾部" />
              </el-form-item>
              <el-form-item label="允许操作的角色（可选）">
                <el-input v-model="transitionForm.allowRoles" placeholder="多个用逗号分隔，如 admin,merchandiser" />
              </el-form-item>
              <el-form-item label="启用">
                <el-switch v-model="transitionForm.enabled" />
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="transitionDialog.visible = false">取消</el-button>
              <el-button type="primary" @click="submitTransition">确定</el-button>
            </template>
          </el-dialog>

          <!-- 新增流程链路：一次配置从开始到结束的多步 -->
          <el-dialog
            v-model="chainDialog.visible"
            :title="chainEdit.id ? '编辑流程链路' : '新增流程链路'"
            width="900px"
            destroy-on-close
          >
            <p class="section-desc">按顺序配置每一步：从哪个状态、通过什么动作、到哪个状态。</p>
            <el-form label-width="120px" size="default">
              <el-form-item label="链路名称">
                <el-input v-model="chainForm.name" placeholder="如：默认主流程" />
              </el-form-item>
              <el-form-item label="适用订单类型">
                <el-select
                  v-model="chainForm.orderTypeIds"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  clearable
                  filterable
                  placeholder="不选表示全部订单类型"
                  style="width: 100%"
                >
                  <el-option
                    v-for="opt in chainOrderTypeOptions"
                    :key="opt.id"
                    :label="opt.label"
                    :value="opt.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="适用合作方式">
                <el-select
                  v-model="chainForm.collaborationTypeIds"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  clearable
                  filterable
                  placeholder="不选表示全部合作方式"
                  style="width: 100%"
                >
                  <el-option
                    v-for="opt in chainCollaborationOptions"
                    :key="opt.id"
                    :label="opt.label"
                    :value="opt.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="适用工艺">
                <el-select
                  v-model="chainForm.hasProcessItem"
                  clearable
                  placeholder="不选表示全部"
                  style="width: 100%"
                >
                  <el-option label="全部" value="" />
                  <el-option label="仅有工艺项目" value="has" />
                  <el-option label="仅无工艺项目" value="none" />
                </el-select>
              </el-form-item>
              <el-form-item label="流程步骤">
                <div class="chain-steps">
                  <div
                    v-for="(step, index) in chainForm.steps"
                    :key="index"
                    class="chain-step-row"
                  >
                    <span class="step-num">第 {{ index + 1 }} 步</span>
                    <el-select
                      v-model="step.fromStatusCode"
                      placeholder="从状态"
                      size="small"
                      style="width: 120px"
                    >
                      <el-option
                        v-for="s in statusList"
                        :key="s.id"
                        :label="s.label"
                        :value="s.code"
                      />
                    </el-select>
                    <span class="step-arrow">→</span>
                    <el-select
                      v-model="step.toStatusCode"
                      placeholder="到状态"
                      size="small"
                      style="width: 120px"
                    >
                      <el-option
                        v-for="s in statusList"
                        :key="s.id"
                        :label="s.label"
                        :value="s.code"
                      />
                    </el-select>
                    <el-select
                      v-model="step.triggerType"
                      placeholder="触发方式"
                      size="small"
                      style="width: 100px"
                    >
                      <el-option label="按钮操作" value="button" />
                      <el-option label="自动事件" value="auto_event" />
                    </el-select>
                    <el-select
                      v-model="step.triggerCode"
                      placeholder="触发动作"
                      size="small"
                      style="width: 140px"
                    >
                      <el-option
                        v-for="opt in TRIGGER_ACTION_OPTIONS"
                        :key="opt.code"
                        :label="opt.label"
                        :value="opt.code"
                      />
                    </el-select>
                    <el-select
                      v-model="step.allowRoles"
                      multiple
                      collapse-tags
                      collapse-tags-tooltip
                      filterable
                      clearable
                      placeholder="允许角色（可选）"
                      size="small"
                      style="width: 240px"
                    >
                      <el-option v-for="r in roleOptions" :key="r.code" :label="r.name" :value="r.code" />
                    </el-select>
                    <el-button
                      type="danger"
                      link
                      size="small"
                      :disabled="chainForm.steps.length <= 1"
                      @click="removeChainStep(index)"
                    >
                      删除
                    </el-button>
                  </div>
                </div>
                <el-button type="primary" plain size="small" @click="addChainStep">添加一步</el-button>
              </el-form-item>
            </el-form>
            <template #footer>
              <el-button @click="chainDialog.visible = false">取消</el-button>
              <el-button type="primary" @click="submitChain">确定（保存整条链路）</el-button>
            </template>
          </el-dialog>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import Sortable from 'sortablejs'
import OptionList from './product-option-list.vue'
import {
  getProductionProcesses,
  getProductionProcessesPage,
  createProductionProcess,
  updateProductionProcess,
  deleteProductionProcess,
  type ProductionProcessItem,
} from '@/api/production-processes'
import {
  getProcessQuoteTemplates,
  getProcessQuoteTemplateItems,
  createProcessQuoteTemplate,
  updateProcessQuoteTemplate,
  deleteProcessQuoteTemplate,
  setProcessQuoteTemplateItems,
  type ProcessQuoteTemplate as QuoteTemplateType,
  type ProcessQuoteTemplateItem as QuoteTemplateItemType,
} from '@/api/process-quote-templates'
import {
  getSystemOptionsTree,
  getSystemOptionsList,
  getSystemOptionsRoots,
  getSystemOptionsChildren,
  createSystemOption,
  updateSystemOption,
  deleteSystemOption,
  batchUpdateSystemOptionOrder,
  type SystemOptionTreeNode,
  type SystemOptionItem,
  type SystemOptionLazyNode,
} from '@/api/system-options'
import { getRoles, type RoleItem } from '@/api/roles'
import {
  getOrderStatuses,
  createOrderStatus,
  updateOrderStatus,
  deleteOrderStatus,
  getOrderStatusTransitions,
  createOrderStatusTransition,
  updateOrderStatusTransition,
  deleteOrderStatusTransition,
  createOrderStatusTransitionsBatch,
  getOrderWorkflowChains,
  reorderOrderWorkflowChains,
  updateOrderWorkflowChain,
  deleteOrderWorkflowChain,
  getOrderStatusSlaList,
  createOrderStatusSla,
  updateOrderStatusSla,
  deleteOrderStatusSla,
  type OrderStatusItem,
  type OrderStatusTransitionItem,
  type OrderWorkflowChainWithSteps,
  type OrderStatusSlaItem,
} from '@/api/order-status-config'
import { ArrowRight } from '@element-plus/icons-vue'
import { formatDisplayNumber } from '@/utils/display-number'

/** 树表行：部门 / 工种 / 工序（懒加载用）；displayName 为单列树展示用，不重复父级 */
interface ProcessTreeRow {
  id: string | number
  rowType: 'department' | 'job_type' | 'process' | 'load_more'
  displayName: string
  department: string
  jobType: string
  processName: string
  price: string
  hasChildren: boolean
  nodeId?: number
  parentId?: number | null
  jobTypePath?: string
  processRow?: ProductionProcessItem
  loadedCount?: number
  totalCount?: number
}

const processDepartments = ['裁床', '车缝', '尾部'] as const

const activeTab = ref<
  'orderTypes' | 'collaboration' | 'productGroups' | 'applicablePeople' | 'materialTypes' | 'materialSources' | 'productionProcesses' | 'orderSla' | 'orderStatusConfig'
>('orderStatusConfig')
const processTreeTableRef = ref<InstanceType<typeof import('element-plus')['ElTable']>>()
const processTreeData = ref<ProcessTreeRow[]>([])
const processJobTypeListRef = ref<SystemOptionItem[]>([])
const processJobTypeChildrenMapRef = ref<Map<number, SystemOptionItem[]>>(new Map())
const processRowsCacheRef = ref<Map<string, ProductionProcessItem[]>>(new Map())
const expandedKeys = ref<Array<string | number>>([])
const visibleCountMap = ref<Record<string, number>>({})
const scrollTop = ref(0)
const processJobMetaByNodeIdRef = ref<Map<number, { department: string; jobTypePath: string }>>(new Map())

const processDialog = ref<{ visible: boolean; id?: number }>({ visible: false })
const processForm = ref({
  department: '',
  jobType: '',
  name: '',
  unitPrice: 0,
  sortOrder: 0,
})
const processJobTypeOptions = ref<string[]>([])

const jobTypeDialog = ref<{
  visible: boolean
  mode: 'edit' | 'add'
  nodeId?: number
  parentId?: number | null
  isTopLevel?: boolean
}>({ visible: false, mode: 'add' })
const jobTypeForm = ref<{ value: string; parentId: number | null }>({ value: '', parentId: null })
const jobTypeSubmitLoading = ref(false)

const jobTypeDialogTitle = computed(() => {
  if (jobTypeDialog.value.mode === 'edit') return '编辑工种'
  return jobTypeDialog.value.isTopLevel ? '新增部门' : '新建工种'
})

/** 编辑工种时仅可选部门（process_job_types 根节点，parentId 为空） */
const jobTypeEditDepartmentOptions = computed(() => {
  if (jobTypeDialog.value.mode !== 'edit') return []
  const list = processJobTypeListRef.value
  return list
    .filter((x) => x.parentId == null)
    .map((x) => ({ value: x.id, label: x.value }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
})

/** 从工种节点沿 parent 链找到所属部门根节点 id */
function getJobTypeRootDepartmentId(nodeId: number): number | null {
  const list = processJobTypeListRef.value
  let cur = list.find((x) => x.id === nodeId) ?? null
  while (cur && cur.parentId != null) {
    cur = list.find((x) => x.id === cur.parentId) ?? null
  }
  return cur?.id ?? null
}

function onJobTypeDialogClose() {
  jobTypeDialog.value.nodeId = undefined
  jobTypeDialog.value.parentId = undefined
  jobTypeForm.value = { value: '', parentId: null }
}

// 服装类型报价模板
const quoteTemplateList = ref<QuoteTemplateType[]>([])
const quoteTemplateDialog = ref<{ visible: boolean; id?: number }>({ visible: false })
const quoteTemplateForm = ref({ name: '' })
const quoteTemplateItemsDialog = ref<{ visible: boolean; templateId?: number; name?: string }>({ visible: false })
const quoteTemplateItemsEdit = ref<{ processId: number; department: string; jobType: string; processName: string; unitPrice: string }[]>([])
const quoteTemplateProcessOptions = ref<ProductionProcessItem[]>([])
const quoteTemplateItemToAdd = ref<number[]>([])
const activeQuoteTemplateIds = ref<string[]>([])
const quoteTemplateItemsMap = ref<Record<number, QuoteTemplateItemType[]>>({})
const quoteTemplateItemsLoadingMap = ref<Record<number, boolean>>({})

async function refreshProcessJobTypeList() {
  try {
    const res = await getSystemOptionsList('process_job_types')
    const list = (res.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    processJobTypeListRef.value = list
    const childrenMap = new Map<number, SystemOptionItem[]>()
    for (const item of list) {
      if (item.parentId == null) continue
      const bucket = childrenMap.get(item.parentId) ?? []
      bucket.push(item)
      childrenMap.set(item.parentId, bucket)
    }
    processJobTypeChildrenMapRef.value = childrenMap
  } catch {
    processJobTypeListRef.value = []
    processJobTypeChildrenMapRef.value = new Map()
  }
}

function getChildrenFromLocalCache(parentId: number): SystemOptionLazyNode[] | null {
  const children = processJobTypeChildrenMapRef.value.get(parentId)
  if (!children) return null
  return children.map((child) => ({
    id: child.id,
    value: child.value,
    sortOrder: child.sortOrder,
    hasChildren: processJobTypeChildrenMapRef.value.has(child.id),
  }))
}

function mapJobTypeRowsFromChildren(
  children: SystemOptionLazyNode[],
  parentRow: ProcessTreeRow,
): ProcessTreeRow[] {
  const parentPath = parentRow.rowType === 'department'
    ? parentRow.department
    : (parentRow.jobTypePath ?? parentRow.jobType)
  return children.map((c) => {
    const jobTypePath = `${parentPath} > ${c.value}`
    processJobMetaByNodeIdRef.value.set(c.id, {
      department: parentRow.department,
      jobTypePath,
    })
    return {
    id: `job-${c.id}`,
    rowType: 'job_type' as const,
    displayName: c.value,
    department: parentRow.department,
    jobType: jobTypePath,
    processName: '',
    price: '',
    // 工种行需要可展开，展开后再决定展示“子工种”还是“工序”
    hasChildren: true,
    nodeId: c.id,
    parentId: parentRow.nodeId ?? null,
    jobTypePath,
  }})
}

function saveExpandedRowKey(row: ProcessTreeRow) {
  if (row.rowType !== 'department' && row.rowType !== 'job_type') return
  if (expandedKeys.value.includes(row.id)) return
  expandedKeys.value = [...expandedKeys.value, row.id]
}

async function reloadProcessTreeKeepExpanded() {
  const snapshotExpanded = [...expandedKeys.value]
  const snapshotVisibleCount = { ...visibleCountMap.value }
  captureScrollTop()
  await loadProcessTreeRoots()
  expandedKeys.value = snapshotExpanded
  visibleCountMap.value = snapshotVisibleCount
  await nextTick()
  restoreScrollTop()
}

/** 工种配置变更后：在已恢复快照的前提下，重挂已展开节点的懒加载子行（避免仅重载根行导致界面仍显示旧工种/工序名） */
function processJobTypeNodeDepth(nodeId: number): number {
  const list = processJobTypeListRef.value
  let depth = 0
  let cur = list.find((x) => x.id === nodeId)
  while (cur?.parentId != null) {
    depth += 1
    cur = list.find((x) => x.id === cur.parentId)
  }
  return depth
}

async function resyncLazyChildrenForExpandedRows() {
  const table = processTreeTableRef.value as unknown as {
    updateKeyChildren?: (key: string | number, rows: ProcessTreeRow[]) => void
  }
  if (!table?.updateKeyChildren) return

  async function childrenLazyNodesForParent(parentId: number): Promise<SystemOptionLazyNode[]> {
    let raw = processJobTypeChildrenMapRef.value.get(parentId)
    if (raw === undefined) {
      try {
        const res = await getSystemOptionsChildren('process_job_types', parentId)
        raw = (res.data ?? []) as unknown as SystemOptionItem[]
      } catch {
        raw = []
      }
    }
    return raw.map((child) => ({
      id: child.id,
      value: child.value,
      sortOrder: child.sortOrder,
      hasChildren: processJobTypeChildrenMapRef.value.has(child.id),
    }))
  }

  const keys = expandedKeys.value.filter((k): k is string => typeof k === 'string')
  const deptKeys = keys.filter((k) => k.startsWith('dept-'))
  const jobKeys = keys
    .filter((k) => k.startsWith('job-'))
    .sort((a, b) => {
      const na = Number(a.replace('job-', ''))
      const nb = Number(b.replace('job-', ''))
      if (Number.isNaN(na) || Number.isNaN(nb)) return 0
      return processJobTypeNodeDepth(na) - processJobTypeNodeDepth(nb)
    })

  for (const key of deptKeys) {
    const rootId = Number(key.replace('dept-', ''))
    if (Number.isNaN(rootId)) continue
    const parentRow = processTreeData.value.find((r) => r.id === key)
    if (!parentRow || parentRow.rowType !== 'department') continue
    const nodes = await childrenLazyNodesForParent(rootId)
    const rows = mapJobTypeRowsFromChildren(nodes, parentRow)
    table.updateKeyChildren(key, rows)
  }

  for (const key of jobKeys) {
    const nodeId = Number(key.replace('job-', ''))
    if (Number.isNaN(nodeId)) continue
    const jobRow = findProcessTreeRowByNodeId(nodeId)
    if (!jobRow || jobRow.rowType !== 'job_type' || !jobRow.jobTypePath) continue

    const nodes = await childrenLazyNodesForParent(nodeId)
    if (nodes.length > 0) {
      const rows = mapJobTypeRowsFromChildren(nodes, jobRow)
      table.updateKeyChildren(key, rows)
      continue
    }

    const meta = processJobMetaByNodeIdRef.value.get(nodeId)
    if (meta) {
      await refreshJobTypeChildrenByMeta(nodeId, meta.department, meta.jobTypePath)
    }
  }
}

function onProcessTreeExpandChange(row: ProcessTreeRow, expanded: boolean | ProcessTreeRow[]) {
  if (row.rowType !== 'department' && row.rowType !== 'job_type') return
  const isExpanded = Array.isArray(expanded)
    ? expanded.some((r) => r.id === row.id)
    : !!expanded
  if (isExpanded) {
    saveExpandedRowKey(row)
    return
  }
  expandedKeys.value = expandedKeys.value.filter((k) => k !== row.id)
}

function captureScrollTop() {
  scrollTop.value = window.scrollY || document.documentElement.scrollTop || 0
}

function restoreScrollTop() {
  window.scrollTo({ top: scrollTop.value })
}

function setVisibleCount(parentId: number, next: number) {
  visibleCountMap.value[String(parentId)] = next
}

function getVisibleCount(parentId: number): number {
  return visibleCountMap.value[String(parentId)] ?? 50
}

function buildProcessRowsWithLoadMore(
  parentId: number,
  department: string,
  jobTypePath: string,
  list: ProductionProcessItem[],
  total: number,
): ProcessTreeRow[] {
  const visibleCount = getVisibleCount(parentId)
  const visibleList = list.slice(0, visibleCount)
  const rows: ProcessTreeRow[] = visibleList.map((p) => ({
    id: p.id,
    rowType: 'process' as const,
    displayName: p.name,
    department: p.department,
    jobType: p.jobType,
    processName: p.name,
    price: p.unitPrice,
    hasChildren: false,
    processRow: p,
  }))
  if (total > visibleList.length) {
    rows.push({
      id: `more-${parentId}`,
      rowType: 'load_more',
      displayName: '',
      department,
      jobType: jobTypePath,
      processName: '',
      price: '',
      hasChildren: false,
      parentId,
      jobTypePath,
      loadedCount: visibleList.length,
      totalCount: total,
    })
  }
  return rows
}

async function refreshJobTypeChildrenByMeta(parentId: number, department: string, jobTypePath: string) {
  const pageSize = Math.max(getVisibleCount(parentId), 50)
  const cacheKey = `${department}__${jobTypePath}__${pageSize}`
  const cached = processRowsCacheRef.value.get(cacheKey)
  const pageRes = cached
    ? { items: cached, total: cached.length }
    : (await getProductionProcessesPage({
        department,
        jobType: jobTypePath,
        page: 1,
        pageSize,
      })).data
  const list = pageRes?.items ?? []
  if (!cached) processRowsCacheRef.value.set(cacheKey, list)
  const rows = buildProcessRowsWithLoadMore(parentId, department, jobTypePath, list, pageRes?.total ?? list.length)
  ;(processTreeTableRef.value as unknown as { updateKeyChildren?: (key: string | number, rows: ProcessTreeRow[]) => void })?.updateKeyChildren?.(`job-${parentId}`, rows)
}

function buildJobTypePathsFromList(list: SystemOptionItem[], rootId: number, rootValue: string): string[] {
  const childrenByParent = new Map<number, SystemOptionItem[]>()
  for (const item of list) {
    if (item.parentId == null) continue
    const bucket = childrenByParent.get(item.parentId) ?? []
    bucket.push(item)
    childrenByParent.set(item.parentId, bucket)
  }
  for (const bucket of childrenByParent.values()) {
    bucket.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  }

  const result: string[] = []
  const stack = (childrenByParent.get(rootId) ?? []).map((child) => ({
    id: child.id,
    path: `${rootValue} > ${child.value}`,
  }))
  while (stack.length) {
    const current = stack.shift()!
    result.push(current.path)
    const next = childrenByParent.get(current.id) ?? []
    for (const n of next) {
      stack.push({ id: n.id, path: `${current.path} > ${n.value}` })
    }
  }
  return result
}

// ---------------- 订单状态 & 流转规则配置 ----------------

/** 触发动作：中文展示，提交时用 code 存库 */
const TRIGGER_ACTION_OPTIONS = [
  { label: '提交', code: 'submit' },
  { label: '审单通过', code: 'review_approve' },
  { label: '退回草稿', code: 'review_reject' },
  { label: '采购完成', code: 'purchase_all_completed' },
  { label: '纸样完成', code: 'pattern_completed' },
  { label: '工艺完成', code: 'craft_completed' },
  { label: '裁床完成', code: 'cutting_completed' },
  { label: '车缝完成', code: 'sewing_completed' },
  { label: '尾部发货完成', code: 'tailing_shipped' },
  { label: '入库完成', code: 'tailing_inbound_completed' },
]

const statusList = ref<OrderStatusItem[]>([])
const transitionList = ref<OrderStatusTransitionItem[]>([])
const currentStatusCode = ref<string>('')
const currentStatusLabel = ref<string>('')

const statusDialog = ref<{ visible: boolean; isEdit: boolean; id?: number }>({ visible: false, isEdit: false })
const statusForm = ref({
  label: '',
  sortOrder: 0,
  isFinal: false,
})

const transitionDialog = ref<{ visible: boolean; isEdit: boolean; id?: number }>({
  visible: false,
  isEdit: false,
})
const transitionForm = ref({
  fromStatus: '',
  toStatus: '',
  triggerType: 'button',
  triggerCode: '',
  nextDepartment: '',
  allowRoles: '',
  enabled: true,
})

function getStatusLabel(codeOrLabel: string): string {
  const v = (codeOrLabel ?? '').trim()
  if (!v) return '-'
  const byCode = statusList.value.find((s) => s.code === v)
  if (byCode) return byCode.label
  const byLabel = statusList.value.find((s) => s.label === v)
  return byLabel?.label ?? v
}

function normalizeStatusCode(codeOrLabel: string): string {
  const v = (codeOrLabel ?? '').trim()
  if (!v) return ''
  const byCode = statusList.value.find((s) => s.code === v)
  if (byCode) return byCode.code
  const byLabel = statusList.value.find((s) => s.label === v)
  return byLabel?.code ?? v
}

function getTriggerTypeLabel(triggerType: string): string {
  return triggerType === 'auto_event' ? '自动事件' : '按钮操作'
}

function getTriggerActionLabel(codeOrLabel: string): string {
  const v = (codeOrLabel ?? '').trim()
  if (!v) return '-'
  const hit = TRIGGER_ACTION_OPTIONS.find((o) => o.code === v)
  if (hit) return hit.label
  const byLabel = TRIGGER_ACTION_OPTIONS.find((o) => o.label === v)
  return byLabel?.label ?? v
}

function normalizeTriggerCode(codeOrLabel: string): string {
  const v = (codeOrLabel ?? '').trim()
  if (!v) return ''
  const hit = TRIGGER_ACTION_OPTIONS.find((o) => o.code === v)
  if (hit) return hit.code
  const byLabel = TRIGGER_ACTION_OPTIONS.find((o) => o.label === v)
  return byLabel?.code ?? v
}

const chainDialog = ref({ visible: false })
const chainEdit = ref<{ id: number | null }>({ id: null })
const roleOptions = ref<RoleItem[]>([])
const chainOrderTypeOptions = ref<Array<{ id: number; label: string }>>([])
const chainCollaborationOptions = ref<Array<{ id: number; label: string }>>([])

async function loadRolesForSelect() {
  try {
    const res = await getRoles()
    roleOptions.value = (res.data ?? []).filter((r) => (r.status ?? '').toLowerCase() === 'active')
  } catch {
    roleOptions.value = []
  }
}

async function loadOrderTypesForChain() {
  try {
    const res = await getSystemOptionsTree('order_types')
    const tree = (res.data ?? []) as SystemOptionTreeNode[]
    const flat: Array<{ id: number; label: string }> = []
    const walk = (nodes: SystemOptionTreeNode[], parentLabel = '') => {
      for (const n of nodes) {
        const label = parentLabel ? `${parentLabel} / ${n.value}` : n.value
        flat.push({ id: n.id, label })
        if (n.children?.length) walk(n.children, label)
      }
    }
    walk(tree)
    chainOrderTypeOptions.value = flat
  } catch {
    chainOrderTypeOptions.value = []
  }
}

async function loadCollaborationOptionsForChain() {
  try {
    const res = await getSystemOptionsTree('collaboration')
    const tree = (res.data ?? []) as SystemOptionTreeNode[]
    const flat: Array<{ id: number; label: string }> = []
    const walk = (nodes: SystemOptionTreeNode[], parentLabel = '') => {
      for (const n of nodes) {
        const label = parentLabel ? `${parentLabel} / ${n.value}` : n.value
        flat.push({ id: n.id, label })
        if (n.children?.length) walk(n.children, label)
      }
    }
    walk(tree)
    chainCollaborationOptions.value = flat
  } catch {
    chainCollaborationOptions.value = []
  }
}
interface ChainStepRow {
  fromStatusCode: string
  toStatusCode: string
  triggerType: string
  triggerCode: string
  allowRoles: string[]
}
const chainForm = ref<{
  name: string
  orderTypeIds: number[]
  collaborationTypeIds: number[]
  /** ''=全部，has=仅有工艺项目，none=仅无工艺项目 */
  hasProcessItem: '' | 'has' | 'none'
  steps: ChainStepRow[]
}>({
  name: '',
  orderTypeIds: [],
  collaborationTypeIds: [],
  hasProcessItem: '',
  steps: [{ fromStatusCode: '', toStatusCode: '', triggerType: 'button', triggerCode: '', allowRoles: [] }],
})

function openChainDialog() {
  chainForm.value = {
    name: '',
    orderTypeIds: [],
    collaborationTypeIds: [],
    hasProcessItem: '',
    steps: [{ fromStatusCode: '', toStatusCode: '', triggerType: 'button', triggerCode: '', allowRoles: [] }],
  }
  chainEdit.value.id = null
  chainDialog.value.visible = true
}

function addChainStep() {
  const prev = chainForm.value.steps[chainForm.value.steps.length - 1]
  chainForm.value.steps.push({
    fromStatusCode: prev?.toStatusCode ?? '',
    toStatusCode: '',
    triggerType: 'button',
    triggerCode: '',
    allowRoles: [],
  })
}

function removeChainStep(index: number) {
  chainForm.value.steps.splice(index, 1)
}

async function submitChain() {
  const steps = chainForm.value.steps
  const valid = steps.every(
    (s) => s.fromStatusCode && s.toStatusCode && s.triggerCode,
  )
  if (!valid) {
    ElMessage.warning('请把每一步的「从状态」「到状态」「触发动作」都选好')
    return
  }
  const chainConditions: { orderTypeIds?: number[]; collaborationTypeIds?: number[]; hasProcessItem?: boolean } = {}
  if (Array.isArray(chainForm.value.orderTypeIds) && chainForm.value.orderTypeIds.length > 0) {
    chainConditions.orderTypeIds = [...chainForm.value.orderTypeIds]
  }
  if (Array.isArray(chainForm.value.collaborationTypeIds) && chainForm.value.collaborationTypeIds.length > 0) {
    chainConditions.collaborationTypeIds = [...chainForm.value.collaborationTypeIds]
  }
  if (chainForm.value.hasProcessItem === 'has') chainConditions.hasProcessItem = true
  if (chainForm.value.hasProcessItem === 'none') chainConditions.hasProcessItem = false

  function stepConditions(hasProcessItem?: boolean): Record<string, unknown> | undefined {
    const base = { ...chainConditions }
    if (hasProcessItem !== undefined) base.hasProcessItem = hasProcessItem
    return Object.keys(base).length ? base : undefined
  }

  const payload = {
    name: chainForm.value.name?.trim() || undefined,
    conditionsJson: Object.keys(chainConditions).length ? chainConditions : undefined,
    steps: steps.map((s) => ({
      fromStatus: s.fromStatusCode,
      toStatus: s.toStatusCode,
      triggerType: s.triggerType,
      triggerCode: s.triggerCode,
      allowRoles: (s.allowRoles ?? []).filter(Boolean).join(',') || undefined,
      enabled: true,
      conditionsJson: stepConditions(),
    })),
  }
  try {
    if (chainEdit.value.id) {
      await updateOrderWorkflowChain(chainEdit.value.id, {
        name: payload.name,
        conditionsJson: payload.conditionsJson,
        steps: payload.steps,
      })
      ElMessage.success('链路已更新，共 ' + steps.length + ' 步')
    } else {
      await createOrderStatusTransitionsBatch(payload)
      ElMessage.success('已保存整条链路，共 ' + steps.length + ' 步')
    }
    chainDialog.value.visible = false
    await loadChains()
    if (currentStatusCode.value) await loadTransitions()
  } catch (err) {
    if (!(err as { errorHandled?: boolean }).errorHandled) {
      ElMessage.error('保存失败')
    }
  }
}

const chainList = ref<OrderWorkflowChainWithSteps[]>([])
const chainTableRef = ref()
let chainSortable: Sortable | null = null

// --- 订单时效配置（SLA）---
const slaList = ref<OrderStatusSlaItem[]>([])
const slaDialog = ref<{ visible: boolean; id?: number }>({ visible: false })
const slaForm = ref({ orderStatusId: 0, limitHours: 0, enabled: true })
const slaStatusOptions = ref<OrderStatusItem[]>([])

async function loadSlaList() {
  try {
    const res = await getOrderStatusSlaList()
    slaList.value = res.data ?? []
  } catch {
    slaList.value = []
  }
}

function openSlaDialog(row?: OrderStatusSlaItem) {
  if (row) {
    slaDialog.value = { visible: true, id: row.id }
    slaForm.value = {
      orderStatusId: row.orderStatusId,
      limitHours: parseFloat(row.limitHours) || 0,
      enabled: row.enabled,
    }
    const s = statusList.value.find((x) => x.id === row!.orderStatusId)
    slaStatusOptions.value = s ? [s] : []
  } else {
    slaDialog.value = { visible: true }
    const usedIds = new Set(slaList.value.map((s) => s.orderStatusId))
    slaStatusOptions.value = (statusList.value ?? []).filter((s) => !usedIds.has(s.id))
    slaForm.value = { orderStatusId: slaStatusOptions.value[0]?.id ?? 0, limitHours: 0, enabled: true }
  }
}

async function submitSla() {
  const id = slaForm.value.orderStatusId
  const hours = slaForm.value.limitHours
  if (!id) {
    ElMessage.warning('请选择订单状态')
    return
  }
  if (hours < 0) {
    ElMessage.warning('合理时长不能为负数')
    return
  }
  try {
    if (slaDialog.value.id) {
      await updateOrderStatusSla(slaDialog.value.id, {
        limitHours: hours,
        enabled: slaForm.value.enabled,
      })
      ElMessage.success('已更新')
    } else {
      await createOrderStatusSla({ orderStatusId: id, limitHours: hours, enabled: slaForm.value.enabled })
      ElMessage.success('已新增')
    }
    slaDialog.value.visible = false
    await loadSlaList()
  } catch (err) {
    if (!(err as { errorHandled?: boolean }).errorHandled) ElMessage.error('保存失败')
  }
}

async function removeSla(row: OrderStatusSlaItem) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.orderStatus?.label ?? row.orderStatusId}」的时效配置？`, '删除确认', {
      type: 'warning',
    })
    await deleteOrderStatusSla(row.id)
    ElMessage.success('已删除')
    await loadSlaList()
  } catch (e) {
    if ((e as string) !== 'cancel') ElMessage.error('删除失败')
  }
}

async function loadChains() {
  try {
    const res = await getOrderWorkflowChains()
    chainList.value = res.data ?? []
    await nextTick()
    initChainDragSort()
  } catch {
    chainList.value = []
  }
}

function initChainDragSort() {
  const tableEl = (chainTableRef.value as { $el?: HTMLElement } | undefined)?.$el as HTMLElement | undefined
  if (!tableEl) return
  const tbody = tableEl.querySelector('.el-table__body-wrapper tbody') as HTMLElement | null
  if (!tbody) return

  if (chainSortable) {
    chainSortable.destroy()
    chainSortable = null
  }

  chainSortable = Sortable.create(tbody, {
    handle: '.chain-drag-handle',
    animation: 150,
    ghostClass: 'chain-drag-ghost',
    onEnd(evt) {
      if (evt.oldIndex == null || evt.newIndex == null) return
      if (evt.oldIndex === evt.newIndex) return
      const list = chainList.value.slice()
      const [moved] = list.splice(evt.oldIndex, 1)
      if (!moved) return
      list.splice(evt.newIndex, 0, moved)
      chainList.value = list
      void persistChainOrder()
    },
  })
}

async function persistChainOrder() {
  try {
    const orderedIds = chainList.value.map((x) => x.chain.id)
    await reorderOrderWorkflowChains({ orderedIds })
    ElMessage.success('已保存链路顺序')
  } catch {
    ElMessage.error('保存顺序失败')
    await loadChains()
  }
}

onBeforeUnmount(() => {
  if (chainSortable) {
    chainSortable.destroy()
    chainSortable = null
  }
})

function buildChainSummary(steps: OrderStatusTransitionItem[]): string {
  if (!steps?.length) return '-'
  return steps
    .slice()
    .sort((a, b) => (Number(a.stepOrder ?? 0) - Number(b.stepOrder ?? 0)) || (a.id - b.id))
    .map((s) => `${getStatusLabel(s.fromStatus)}(${getTriggerActionLabel(s.triggerCode)})→${getStatusLabel(s.toStatus)}`)
    .join('；')
}

function openEditChain(row: OrderWorkflowChainWithSteps) {
  const conditions = (row.chain.conditionsJson ?? {}) as {
    orderTypeIds?: number[]
    collaborationTypeIds?: number[]
    hasProcessItem?: boolean
  }
  chainForm.value = {
    name: row.chain.name ?? '',
    orderTypeIds: Array.isArray(conditions.orderTypeIds) ? conditions.orderTypeIds : [],
    collaborationTypeIds: Array.isArray(conditions.collaborationTypeIds) ? conditions.collaborationTypeIds : [],
    hasProcessItem: conditions.hasProcessItem === true ? 'has' : conditions.hasProcessItem === false ? 'none' : '',
    steps: (row.steps ?? [])
      .slice()
      .sort((a, b) => (Number(a.stepOrder ?? 0) - Number(b.stepOrder ?? 0)) || (a.id - b.id))
      .map((s) => ({
        fromStatusCode: normalizeStatusCode(s.fromStatus),
        toStatusCode: normalizeStatusCode(s.toStatus),
        triggerType: s.triggerType,
        triggerCode: normalizeTriggerCode(s.triggerCode),
        allowRoles: (s.allowRoles ?? '').split(',').map((x) => x.trim()).filter(Boolean),
      })),
  }
  chainEdit.value.id = row.chain.id
  chainDialog.value.visible = true
}

function duplicateChain(row: OrderWorkflowChainWithSteps) {
  // 先复用编辑逻辑填充表单，然后清空 id，作为新链路保存
  openEditChain(row)
  const baseName = chainForm.value.name || row.chain.name || ''
  chainForm.value.name = `${baseName}（复制）`
  chainEdit.value.id = null
}

async function removeChain(row: OrderWorkflowChainWithSteps) {
  await ElMessageBox.confirm(`确定删除流程链路「${row.chain.name}」吗？`, '提示', { type: 'warning' })
  try {
    await deleteOrderWorkflowChain(row.chain.id)
    ElMessage.success('已删除')
    await loadChains()
  } catch (err) {
    if (!(err as { errorHandled?: boolean }).errorHandled) {
      ElMessage.error('删除失败')
    }
  }
}

async function loadStatuses() {
  try {
    const res = await getOrderStatuses()
    statusList.value = res.data ?? []
    if (!currentStatusCode.value && statusList.value.length) {
      const first = statusList.value[0]
      currentStatusCode.value = first.code
      currentStatusLabel.value = first.label
      await loadTransitions()
    }
  } catch {
    statusList.value = []
  }
}

async function loadTransitions() {
  if (!currentStatusCode.value) {
    transitionList.value = []
    return
  }
  try {
    const res = await getOrderStatusTransitions(currentStatusCode.value)
    transitionList.value = res.data ?? []
  } catch {
    transitionList.value = []
  }
}

function onCurrentStatusChange(row: OrderStatusItem | undefined) {
  if (!row) return
  currentStatusCode.value = row.code
  currentStatusLabel.value = row.label
  loadTransitions()
}

function openCreateStatus() {
  statusDialog.value = { visible: true, isEdit: false }
  statusForm.value = {
    label: '',
    sortOrder: statusList.value.length,
    isFinal: false,
  }
}

function openEditStatus(row: OrderStatusItem) {
  statusDialog.value = { visible: true, isEdit: true, id: row.id }
  statusForm.value = {
    label: row.label,
    sortOrder: row.sortOrder,
    isFinal: row.isFinal,
  }
}

async function submitStatus() {
  const payload = {
    label: statusForm.value.label.trim(),
    sortOrder: statusForm.value.sortOrder,
    isFinal: statusForm.value.isFinal,
  }
  if (!payload.label) {
    ElMessage.warning('请填写状态名称')
    return
  }
  try {
    if (statusDialog.value.isEdit && statusDialog.value.id != null) {
      await updateOrderStatus(statusDialog.value.id, {
        label: payload.label,
        sortOrder: payload.sortOrder,
        isFinal: payload.isFinal,
      })
      ElMessage.success('状态已更新')
    } else {
      await createOrderStatus(payload)
      ElMessage.success('状态已创建')
    }
    statusDialog.value.visible = false
    await loadStatuses()
  } catch (err) {
    if (!(err as { errorHandled?: boolean }).errorHandled) {
      ElMessage.error('保存失败')
    }
  }
}

async function removeStatus(row: OrderStatusItem) {
  await ElMessageBox.confirm(`确定删除状态「${row.label}」吗？`, '提示', { type: 'warning' })
  try {
    await deleteOrderStatus(row.id)
    ElMessage.success('已删除')
    await loadStatuses()
  } catch (err) {
    if (!(err as { errorHandled?: boolean }).errorHandled) {
      ElMessage.error('删除失败')
    }
  }
}

async function onToggleStatusEnabled(row: OrderStatusItem) {
  try {
    await updateOrderStatus(row.id, { enabled: row.enabled })
    // 以服务端为准刷新一次，保证列表状态与后端一致
    await loadStatuses()
  } catch (err) {
    if (!(err as { errorHandled?: boolean }).errorHandled) {
      ElMessage.error('更新失败')
    }
    row.enabled = !row.enabled
  }
}

function openCreateTransition() {
  if (!currentStatusCode.value) return
  transitionDialog.value = { visible: true, isEdit: false }
  transitionForm.value = {
    fromStatus: currentStatusCode.value,
    toStatus: '',
    triggerType: 'button',
    triggerCode: '',
    nextDepartment: '',
    allowRoles: '',
    enabled: true,
  }
}

function openEditTransition(row: OrderStatusTransitionItem) {
  transitionDialog.value = { visible: true, isEdit: true, id: row.id }
  transitionForm.value = {
    fromStatus: row.fromStatus,
    toStatus: normalizeStatusCode(row.toStatus),
    triggerType: row.triggerType,
    triggerCode: normalizeTriggerCode(row.triggerCode),
    nextDepartment: row.nextDepartment ?? '',
    allowRoles: row.allowRoles ?? '',
    enabled: row.enabled,
  }
}

async function submitTransition() {
  const payload = {
    fromStatus: transitionForm.value.fromStatus,
    toStatus: normalizeStatusCode(transitionForm.value.toStatus),
    triggerType: transitionForm.value.triggerType,
    triggerCode: normalizeTriggerCode(transitionForm.value.triggerCode),
    nextDepartment: transitionForm.value.nextDepartment.trim() || undefined,
    allowRoles: transitionForm.value.allowRoles.trim() || undefined,
    enabled: transitionForm.value.enabled,
  }
  if (!payload.toStatus || !payload.triggerCode) {
    ElMessage.warning('请填写目标状态和触发动作')
    return
  }
  try {
    if (transitionDialog.value.isEdit && transitionDialog.value.id != null) {
      await updateOrderStatusTransition(transitionDialog.value.id, {
        toStatus: payload.toStatus,
        triggerType: payload.triggerType,
        triggerCode: payload.triggerCode,
        nextDepartment: payload.nextDepartment ?? null,
        allowRoles: payload.allowRoles ?? null,
        enabled: payload.enabled,
      })
      ElMessage.success('规则已更新')
    } else {
      await createOrderStatusTransition(payload)
      ElMessage.success('规则已创建')
    }
    transitionDialog.value.visible = false
    await loadTransitions()
  } catch (err) {
    if (!(err as { errorHandled?: boolean }).errorHandled) {
      ElMessage.error('保存失败')
    }
  }
}

async function removeTransition(row: OrderStatusTransitionItem) {
  await ElMessageBox.confirm(`确定删除规则「${row.triggerCode}」吗？`, '提示', { type: 'warning' })
  try {
    await deleteOrderStatusTransition(row.id)
    ElMessage.success('已删除')
    await loadTransitions()
  } catch (err) {
    if (!(err as { errorHandled?: boolean }).errorHandled) {
      ElMessage.error('删除失败')
    }
  }
}

async function onToggleTransitionEnabled(row: OrderStatusTransitionItem) {
  try {
    await updateOrderStatusTransition(row.id, { enabled: row.enabled })
  } catch (err) {
    if (!(err as { errorHandled?: boolean }).errorHandled) {
      ElMessage.error('更新失败')
    }
    row.enabled = !row.enabled
  }
}

onMounted(() => {
  if (activeTab.value === 'productionProcesses') {
    loadProcessTreeRoots()
    loadQuoteTemplates()
  } else if (activeTab.value === 'orderStatusConfig') {
    loadStatuses()
    loadChains()
    loadRolesForSelect()
    loadOrderTypesForChain()
    loadCollaborationOptionsForChain()
  }
})

watch(
  () => activeTab.value,
  (val) => {
    if (val === 'productionProcesses') {
      loadProcessTreeRoots()
    }
    if (val === 'orderStatusConfig') {
      loadStatuses()
      loadChains()
      loadRolesForSelect()
      loadOrderTypesForChain()
      loadCollaborationOptionsForChain()
    }
  },
)

/** 树表根节点：部门（来自 process_job_types 根） */
async function loadProcessTreeRoots() {
  try {
    const res = await getSystemOptionsRoots('process_job_types')
    const roots = res.data ?? []
    processTreeData.value = roots.map((n) => ({
      id: `dept-${n.id}`,
      rowType: 'department' as const,
      displayName: n.value,
      department: n.value,
      jobType: '',
      processName: '',
      price: '',
      // 懒加载树需要可展开才能触发 load；部门行统一允许展开
      hasChildren: true,
      nodeId: n.id,
      parentId: null,
    }))
  } catch {
    processTreeData.value = []
  }
}

/** 树表懒加载：展开部门加载工种，展开工种加载工序 */
async function loadProcessTreeNode(
  row: ProcessTreeRow,
  treeNode: { level: number; expanded: boolean },
  resolve: (rows: ProcessTreeRow[]) => void,
) {
  if (row.rowType === 'department' && row.nodeId != null) {
    saveExpandedRowKey(row)
    const localChildren = getChildrenFromLocalCache(row.nodeId)
    if (localChildren) {
      resolve(mapJobTypeRowsFromChildren(localChildren, row))
      return
    }
    try {
      const res = await getSystemOptionsChildren('process_job_types', row.nodeId)
      const children = res.data ?? []
      resolve(mapJobTypeRowsFromChildren(children, row))
    } catch {
      resolve([])
    }
    return
  }
  if (row.rowType === 'job_type' && row.nodeId != null && row.jobTypePath != null) {
    saveExpandedRowKey(row)
    const localChildren = getChildrenFromLocalCache(row.nodeId)
    if (localChildren && localChildren.length > 0) {
      resolve(mapJobTypeRowsFromChildren(localChildren, row))
      return
    }
    try {
      const childrenRes = await getSystemOptionsChildren('process_job_types', row.nodeId)
      const children = childrenRes.data ?? []
      if (children.length > 0) {
        resolve(mapJobTypeRowsFromChildren(children, row))
        return
      }

      const pageSize = Math.max(getVisibleCount(row.nodeId), 50)
      const cacheKey = `${row.department}__${row.jobTypePath}__${pageSize}`
      const cached = processRowsCacheRef.value.get(cacheKey)
      const pageRes = cached
        ? { items: cached, total: cached.length }
        : (await getProductionProcessesPage({
            department: row.department,
            jobType: row.jobTypePath,
            page: 1,
            pageSize,
          })).data
      const list = pageRes?.items ?? []
      if (!cached) processRowsCacheRef.value.set(cacheKey, list)
      const rows = buildProcessRowsWithLoadMore(
        row.nodeId,
        row.department,
        row.jobTypePath,
        list,
        pageRes?.total ?? list.length,
      )
      resolve(rows)
    } catch {
      resolve([])
    }
  }
}

async function loadMoreProcesses(row: ProcessTreeRow) {
  if (row.rowType !== 'load_more' || !row.jobTypePath) return
  captureScrollTop()
  if (row.parentId == null) return
  setVisibleCount(row.parentId, getVisibleCount(row.parentId) + 50)
  // 仅更新当前父节点，不重建整棵树
  for (const key of processRowsCacheRef.value.keys()) {
    if (key.includes(`__${row.jobTypePath}__`)) {
      processRowsCacheRef.value.delete(key)
    }
  }
  await refreshJobTypeChildrenByMeta(row.parentId, row.department, row.jobTypePath)
  await nextTick()
  restoreScrollTop()
}

function findProcessTreeRowByNodeId(nodeId: number): ProcessTreeRow | null {
  const stack: ProcessTreeRow[] = [...processTreeData.value]
  while (stack.length) {
    const cur = stack.shift()!
    if (cur.nodeId === nodeId) return cur
    const children = ((cur as unknown as { children?: ProcessTreeRow[] }).children ?? [])
    if (children.length) stack.unshift(...children)
  }
  return null
}

async function refreshProcessChildrenForJobType(jobRow: ProcessTreeRow) {
  if (jobRow.rowType !== 'job_type' || !jobRow.jobTypePath || !jobRow.nodeId) return
  await refreshJobTypeChildrenByMeta(jobRow.nodeId, jobRow.department, jobRow.jobTypePath)
}

/** 同一父级下的兄弟节点（懒加载接口），用于工种上移/下移 */
async function getSiblingsForProcessJobType(
  row: ProcessTreeRow,
): Promise<Array<SystemOptionLazyNode & { parentId: number | null }>> {
  const parentId = row.parentId ?? null
  if (parentId == null) {
    const res = await getSystemOptionsRoots('process_job_types')
    return (res.data ?? []).map((x) => ({ ...x, parentId: null }))
  }
  const res = await getSystemOptionsChildren('process_job_types', parentId)
  return (res.data ?? []).map((x) => ({ ...x, parentId }))
}

function canMoveUpJobType(row: ProcessTreeRow): boolean {
  if (row.rowType !== 'job_type' || row.nodeId == null) return false
  const siblings = processJobTypeListRef.value
    .filter((x) => (x.parentId ?? null) === (row.parentId ?? null))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  const idx = siblings.findIndex((s) => s.id === row.nodeId)
  return idx > 0
}

function canMoveDownJobType(row: ProcessTreeRow): boolean {
  if (row.rowType !== 'job_type' || row.nodeId == null) return false
  const siblings = processJobTypeListRef.value
    .filter((x) => (x.parentId ?? null) === (row.parentId ?? null))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  const idx = siblings.findIndex((s) => s.id === row.nodeId)
  return idx >= 0 && idx < siblings.length - 1
}

function openEditJobType(row: ProcessTreeRow) {
  if (row.rowType !== 'job_type' || row.nodeId == null) return
  jobTypeDialog.value = { visible: true, mode: 'edit', nodeId: row.nodeId }
  jobTypeForm.value = {
    value: row.displayName,
    parentId: getJobTypeRootDepartmentId(row.nodeId),
  }
}

function openAddDepartment() {
  jobTypeDialog.value = { visible: true, mode: 'add', parentId: null, isTopLevel: true }
  jobTypeForm.value = { value: '', parentId: null }
}

function openAddChildJobType(row: ProcessTreeRow) {
  const parentId = row.rowType === 'department' ? row.nodeId ?? null : row.rowType === 'job_type' ? row.nodeId ?? null : null
  if (parentId == null) return
  jobTypeDialog.value = { visible: true, mode: 'add', parentId, isTopLevel: false }
  jobTypeForm.value = { value: '', parentId: null }
}

async function submitJobType() {
  const val = jobTypeForm.value.value?.trim()
  if (!val) {
    ElMessage.warning('请输入名称')
    return
  }
  jobTypeSubmitLoading.value = true
  try {
    if (jobTypeDialog.value.mode === 'edit' && jobTypeDialog.value.nodeId != null) {
      const nodeId = jobTypeDialog.value.nodeId
      const newParentId = jobTypeForm.value.parentId
      if (newParentId == null) {
        ElMessage.warning('请选择部门')
        return
      }
      const currentItem = processJobTypeListRef.value.find((x) => x.id === nodeId)
      const oldParentId = currentItem?.parentId ?? null
      const payload: { value: string; parent_id?: number | null; sort_order?: number } = { value: val }
      if (oldParentId !== newParentId) {
        const list = processJobTypeListRef.value
        const siblings = list.filter((x) => (x.parentId ?? null) === newParentId && x.id !== nodeId)
        const sortOrder = siblings.length
          ? Math.max(...siblings.map((s) => s.sortOrder)) + 1
          : 0
        payload.parent_id = newParentId
        payload.sort_order = sortOrder
      }
      await updateSystemOption(nodeId, payload)
      ElMessage.success('已更新')
    } else if (jobTypeDialog.value.mode === 'add') {
      const pid = jobTypeDialog.value.parentId ?? null
      const siblings = pid == null
        ? (await getSystemOptionsRoots('process_job_types')).data ?? []
        : (await getSystemOptionsChildren('process_job_types', pid)).data ?? []
      const sortOrder = siblings.length
      await createSystemOption({
        type: 'process_job_types',
        value: val,
        sort_order: sortOrder,
        parent_id: pid,
      })
      ElMessage.success('已添加')
    }
    jobTypeDialog.value.visible = false
    await refreshProcessJobTypeList()
    await reloadProcessTreeKeepExpanded()
    await resyncLazyChildrenForExpandedRows()
    await nextTick()
    restoreScrollTop()
  } catch (e: unknown) {
    ElMessage.error((e as { message?: string })?.message ?? '操作失败')
  } finally {
    jobTypeSubmitLoading.value = false
  }
}

async function removeJobType(row: ProcessTreeRow) {
  if (row.rowType !== 'job_type' || row.nodeId == null) return
  let hasChildGroups = false
  try {
    const res = await getSystemOptionsChildren('process_job_types', row.nodeId)
    hasChildGroups = (res.data ?? []).length > 0
  } catch {
    hasChildGroups = false
  }
  try {
    await ElMessageBox.confirm(
      hasChildGroups ? `确定删除「${row.displayName}」及其下级分组？` : `确定删除「${row.displayName}」？`,
      '提示',
      { type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await deleteSystemOption(row.nodeId)
    ElMessage.success('已删除')
    await refreshProcessJobTypeList()
    await reloadProcessTreeKeepExpanded()
    await resyncLazyChildrenForExpandedRows()
    await nextTick()
    restoreScrollTop()
  } catch (e: unknown) {
    ElMessage.error((e as { message?: string })?.message ?? '删除失败')
  }
}

async function moveJobTypeRow(row: ProcessTreeRow, delta: number) {
  if (row.rowType !== 'job_type' || row.nodeId == null) return
  const siblings = await getSiblingsForProcessJobType(row)
  const idx = siblings.findIndex((s) => s.id === row.nodeId)
  if (idx < 0) return
  const newIdx = idx + delta
  if (newIdx < 0 || newIdx >= siblings.length) return
  const arr = [...siblings]
  ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
  const items = arr.map((n, i) => ({ id: n.id, sort_order: i }))
  try {
    await batchUpdateSystemOptionOrder('process_job_types', row.parentId ?? null, items)
    ElMessage.success('已移动')
    await refreshProcessJobTypeList()
    await reloadProcessTreeKeepExpanded()
    await resyncLazyChildrenForExpandedRows()
    await nextTick()
    restoreScrollTop()
  } catch (e: unknown) {
    ElMessage.error((e as { message?: string })?.message ?? '移动失败')
  }
}

async function loadProcessJobTypeOptions(department: string) {
  if (!department) {
    processJobTypeOptions.value = []
    return
  }
  try {
    if (!processJobTypeListRef.value.length) await refreshProcessJobTypeList()
    const all = processJobTypeListRef.value
    const root = all.find((n) => n.parentId == null && n.value === department)
    if (!root) {
      processJobTypeOptions.value = []
      return
    }
    processJobTypeOptions.value = buildJobTypePathsFromList(all, root.id, department)
  } catch {
    processJobTypeOptions.value = []
  }
}

function onProcessDepartmentChange() {
  processForm.value.jobType = ''
  loadProcessJobTypeOptions(processForm.value.department)
}

/** 确保 process_job_types 下存在三个根节点：裁床、车缝、尾部 */
async function ensureProcessJobTypeRoots() {
  try {
    const res = await getSystemOptionsRoots('process_job_types')
    const roots = res.data ?? []
    const values = new Set(roots.map((n) => n.value))
    const toAdd = processDepartments.filter((d) => !values.has(d))
    for (let i = 0; i < toAdd.length; i++) {
      await createSystemOption({
        type: 'process_job_types',
        value: toAdd[i],
        sort_order: roots.length + i,
        parent_id: null,
      })
    }
    await refreshProcessJobTypeList()
  } catch {
    // ignore
  }
}

watch(activeTab, async (tab) => {
  if (tab === 'productionProcesses') {
    await ensureProcessJobTypeRoots()
    loadProcessTreeRoots()
    loadQuoteTemplates()
  }
  if (tab === 'orderSla') {
    if (!statusList.value?.length) await loadStatuses()
    await loadSlaList()
  }
})

async function openProcessDialog(row?: ProductionProcessItem, treeRow?: ProcessTreeRow) {
  if (row) {
    processDialog.value = { visible: true, id: row.id }
    processForm.value = {
      department: row.department ?? '',
      jobType: row.jobType ?? '',
      name: row.name ?? '',
      unitPrice: Number(row.unitPrice) || 0,
      sortOrder: row.sortOrder ?? 0,
    }
    await loadProcessJobTypeOptions(processForm.value.department)
  } else {
    processDialog.value = { visible: true }
    const dept = treeRow?.department ?? ''
    const job = treeRow?.jobTypePath ?? treeRow?.jobType ?? ''
    processForm.value = {
      department: dept,
      jobType: job,
      name: '',
      unitPrice: 0,
      sortOrder: 0,
    }
    if (dept) await loadProcessJobTypeOptions(dept)
    else processJobTypeOptions.value = []
  }
}

async function submitProcess() {
  const name = processForm.value.name?.trim()
  if (!name) {
    ElMessage.warning('请填写工序名称')
    return
  }
  try {
    captureScrollTop()
    let savedItem: ProductionProcessItem | null = null
    if (processDialog.value.id) {
      const res = await updateProductionProcess(processDialog.value.id, {
        department: processForm.value.department,
        jobType: processForm.value.jobType,
        name: processForm.value.name,
        unitPrice: String(processForm.value.unitPrice),
      })
      savedItem = res.data ?? null
      ElMessage.success('已更新')
    } else {
      const res = await createProductionProcess({
        department: processForm.value.department,
        jobType: processForm.value.jobType,
        name: processForm.value.name,
        unitPrice: String(processForm.value.unitPrice),
      })
      savedItem = res.data ?? null
      ElMessage.success('已新增')
    }
    processDialog.value.visible = false
    processRowsCacheRef.value.clear()
    if (savedItem) patchProcessRowLocal(savedItem)
    await refreshExpandedJobTypeRows()
    await nextTick()
    restoreScrollTop()
  } catch (e: unknown) {
    ElMessage.error((e as { message?: string })?.message ?? '操作失败')
  }
}

async function removeProcess(row: ProductionProcessItem) {
  try {
    await ElMessageBox.confirm(`确定删除工序「${row.name}」？`, '删除确认', {
      type: 'warning',
    })
    await deleteProductionProcess(row.id)
    ElMessage.success('已删除')
    captureScrollTop()
    processRowsCacheRef.value.clear()
    removeProcessRowLocal(row.id)
    await refreshExpandedJobTypeRows()
    await nextTick()
    restoreScrollTop()
  } catch (e) {
    if ((e as string) !== 'cancel') ElMessage.error('删除失败')
  }
}

function patchProcessRowLocal(item: ProductionProcessItem) {
  const stack: ProcessTreeRow[] = [...processTreeData.value]
  let patched = false
  // 先 patch 分页缓存（响应式安全：用 splice 替换数组项）
  for (const [key, list] of processRowsCacheRef.value.entries()) {
    const idx = list.findIndex((x) => x.id === item.id)
    if (idx < 0) continue
    const next = [...list]
    next.splice(idx, 1, { ...next[idx], ...item })
    processRowsCacheRef.value.set(key, next)
    patched = true
  }
  while (stack.length) {
    const cur = stack.shift()!
    const children = ((cur as unknown as { children?: ProcessTreeRow[] }).children ?? [])
    for (const child of children) {
      if (child.rowType === 'process' && child.processRow?.id === item.id) {
        const idx = children.findIndex((x) => x.id === child.id)
        if (idx >= 0) {
          const nextChildren = [...children]
          nextChildren.splice(idx, 1, {
            ...child,
            displayName: item.name,
            department: item.department,
            jobType: item.jobType,
            processName: item.name,
            price: item.unitPrice,
            processRow: item,
          })
          ;(cur as unknown as { children?: ProcessTreeRow[] }).children = nextChildren
          patched = true
        }
        break
      }
    }
    if (children.length) stack.unshift(...children)
  }
  // 当前正展开的父节点，立即更新其 children（不等待重拉）
  for (const [nodeId, meta] of processJobMetaByNodeIdRef.value.entries()) {
    const cacheKey = `${meta.department}__${meta.jobTypePath}__${Math.max(getVisibleCount(nodeId), 50)}`
    const list = processRowsCacheRef.value.get(cacheKey)
    if (!list) continue
    if (!list.some((x) => x.id === item.id)) continue
    const rows = buildProcessRowsWithLoadMore(
      nodeId,
      meta.department,
      meta.jobTypePath,
      list,
      list.length,
    )
    ;(processTreeTableRef.value as unknown as { updateKeyChildren?: (key: string | number, rows: ProcessTreeRow[]) => void })?.updateKeyChildren?.(`job-${nodeId}`, rows)
    patched = true
  }
  return patched
}

function removeProcessRowLocal(processId: number) {
  const stack: ProcessTreeRow[] = [...processTreeData.value]
  while (stack.length) {
    const cur = stack.shift()!
    const holder = (cur as unknown as { children?: ProcessTreeRow[] })
    if (holder.children?.length) {
      holder.children = holder.children.filter((x) => !(x.rowType === 'process' && x.processRow?.id === processId))
      stack.unshift(...holder.children)
    }
  }
}

async function refreshExpandedJobTypeRows() {
  const keys = [...expandedKeys.value]
  for (const key of keys) {
    if (typeof key !== 'string' || !key.startsWith('job-')) continue
    const nodeId = Number(key.replace('job-', ''))
    if (Number.isNaN(nodeId)) continue
    const meta = processJobMetaByNodeIdRef.value.get(nodeId)
    if (!meta) continue
    await refreshJobTypeChildrenByMeta(nodeId, meta.department, meta.jobTypePath)
  }
}

async function loadQuoteTemplates() {
  try {
    const res = await getProcessQuoteTemplates()
    quoteTemplateList.value = res.data ?? []
    activeQuoteTemplateIds.value = []
    quoteTemplateItemsMap.value = {}
    quoteTemplateItemsLoadingMap.value = {}
  } catch {
    quoteTemplateList.value = []
    activeQuoteTemplateIds.value = []
    quoteTemplateItemsMap.value = {}
    quoteTemplateItemsLoadingMap.value = {}
  }
}

async function ensureQuoteTemplateItemsLoaded(templateId: number) {
  if (quoteTemplateItemsMap.value[templateId]) return
  quoteTemplateItemsLoadingMap.value[templateId] = true
  try {
    const res = await getProcessQuoteTemplateItems(templateId)
    quoteTemplateItemsMap.value[templateId] = (res.data ?? []) as QuoteTemplateItemType[]
  } catch {
    quoteTemplateItemsMap.value[templateId] = []
  } finally {
    quoteTemplateItemsLoadingMap.value[templateId] = false
  }
}

function onQuoteTemplateCollapseChange(names: string[] | string) {
  const values = Array.isArray(names) ? names : [names]
  values.forEach((name) => {
    const id = Number(name)
    if (!Number.isNaN(id) && id > 0) {
      void ensureQuoteTemplateItemsLoaded(id)
    }
  })
}

function isQuoteTemplateExpanded(templateId: number): boolean {
  return activeQuoteTemplateIds.value.includes(String(templateId))
}

function openQuoteTemplateDialog(row?: QuoteTemplateType) {
  if (row) {
    quoteTemplateDialog.value = { visible: true, id: row.id }
    quoteTemplateForm.value = { name: row.name }
  } else {
    quoteTemplateDialog.value = { visible: true }
    quoteTemplateForm.value = { name: '' }
  }
}

async function submitQuoteTemplate() {
  const name = quoteTemplateForm.value.name?.trim()
  if (!name) {
    ElMessage.warning('请填写模板名称')
    return
  }
  try {
    if (quoteTemplateDialog.value.id) {
      await updateProcessQuoteTemplate(quoteTemplateDialog.value.id, { name })
      ElMessage.success('已更新')
    } else {
      await createProcessQuoteTemplate({ name })
      ElMessage.success('已新增')
    }
    quoteTemplateDialog.value.visible = false
    loadQuoteTemplates()
  } catch (e: unknown) {
    ElMessage.error((e as { message?: string })?.message ?? '操作失败')
  }
}

async function removeQuoteTemplate(row: QuoteTemplateType) {
  try {
    await ElMessageBox.confirm(`确定删除模板「${row.name}」？`, '删除确认', { type: 'warning' })
    await deleteProcessQuoteTemplate(row.id)
    ElMessage.success('已删除')
    loadQuoteTemplates()
  } catch (e) {
    if ((e as string) !== 'cancel') ElMessage.error('删除失败')
  }
}

async function openQuoteTemplateItemsDialog(row: QuoteTemplateType) {
  quoteTemplateItemsDialog.value = { visible: true, templateId: row.id, name: row.name }
  quoteTemplateItemToAdd.value = []
  try {
    const [itemsRes, processesRes] = await Promise.all([
      getProcessQuoteTemplateItems(row.id),
      getProductionProcesses(),
    ])
    const items = (itemsRes.data ?? []) as QuoteTemplateItemType[]
    quoteTemplateItemsEdit.value = items.map((i) => ({
      processId: i.processId,
      department: i.department,
      jobType: i.jobType,
      processName: i.processName,
      unitPrice: i.unitPrice,
    }))
    quoteTemplateProcessOptions.value = processesRes.data ?? []
  } catch {
    quoteTemplateItemsEdit.value = []
    quoteTemplateProcessOptions.value = []
  }
}

function addQuoteTemplateItem() {
  const ids = quoteTemplateItemToAdd.value
  if (!ids?.length) return
  const existingIds = new Set(quoteTemplateItemsEdit.value.map((x) => x.processId))
  let added = 0
  for (const id of ids) {
    if (existingIds.has(id)) continue
    const p = quoteTemplateProcessOptions.value.find((x) => x.id === id)
    if (!p) continue
    quoteTemplateItemsEdit.value.push({
      processId: p.id,
      department: p.department ?? '',
      jobType: p.jobType ?? '',
      processName: p.name ?? '',
      unitPrice: p.unitPrice ?? '0.00',
    })
    existingIds.add(p.id)
    added += 1
  }
  quoteTemplateItemToAdd.value = []
  if (added > 0) ElMessage.success(`已添加 ${added} 条工序`)
}

function removeQuoteTemplateItem(row: { processId: number }) {
  quoteTemplateItemsEdit.value = quoteTemplateItemsEdit.value.filter((x) => x.processId !== row.processId)
}

async function submitQuoteTemplateItems() {
  const templateId = quoteTemplateItemsDialog.value.templateId
  if (templateId == null) return
  try {
    await setProcessQuoteTemplateItems(
      templateId,
      quoteTemplateItemsEdit.value.map((x) => x.processId),
    )
    // 立即同步折叠区缓存，避免“保存成功但列表不刷新”
    quoteTemplateItemsMap.value[templateId] = quoteTemplateItemsEdit.value.map((x) => ({
      id: x.processId,
      templateId,
      processId: x.processId,
      sortOrder: 0,
      department: x.department,
      jobType: x.jobType,
      processName: x.processName,
      unitPrice: x.unitPrice,
    }))
    ElMessage.success('已保存')
    quoteTemplateItemsDialog.value.visible = false
  } catch (e: unknown) {
    ElMessage.error((e as { message?: string })?.message ?? '操作失败')
  }
}
</script>

<style scoped>
.settings-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-caption);
  margin-bottom: var(--space-md);
  line-height: 1.6;
}

.settings-body {
  display: flex;
  align-items: flex-start;
}

.settings-tabs {
  width: 160px;
  margin-right: var(--space-lg);
}

.settings-content {
  flex: 1;
  min-width: 0;
}

.section-title {
  margin: 0 0 var(--space-sm);
  font-size: var(--font-size-body);
  font-weight: 600;
}

.section-desc {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
  margin: 0 0 var(--space-sm);
}

.subsection-title {
  font-size: var(--font-size-caption);
  font-weight: 600;
  margin: var(--space-md) 0 var(--space-xs);
}

.process-actions,
.sla-actions {
  margin-bottom: var(--space-sm);
}

.quote-template-items-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.quote-template-process-select {
  flex: 1;
  min-width: 280px;
}

.template-expand-wrap {
  padding: 8px 0;
}

.template-items-table {
  margin-bottom: 6px;
}

.quote-template-collapse {
  border-top: 1px solid var(--el-border-color);
  border-bottom: 1px solid var(--el-border-color);
}

.quote-template-title {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: 0 var(--space-sm);
}

.quote-template-name {
  font-weight: 500;
}

.quote-template-name-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.quote-template-fold-icon {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  transition: transform 0.2s ease;
}

.quote-template-fold-icon.expanded {
  transform: rotate(90deg);
}

.quote-template-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.quote-template-collapse :deep(.el-collapse-item__arrow) {
  display: none;
}

.quote-template-collapse :deep(.el-collapse-item__header) {
  height: 32px;
  line-height: 32px;
  min-height: 32px;
  padding: 0 4px;
}

.quote-template-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 8px;
}

.process-table {
  font-size: var(--font-size-body);
}

.process-tree-single .el-table__row .el-table__cell:first-child {
  font-weight: inherit;
}

.process-row-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.status-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: var(--space-md);
}

.status-list,
.transition-list {
  min-width: 0;
}

.status-list-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: var(--space-xs);
  gap: var(--space-sm);
}

.transition-header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: var(--space-xs);
  gap: 12px;
}

.transition-title {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.transition-subtitle {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
}

.transition-actions {
  display: flex;
  gap: 8px;
}

.chain-steps {
  margin-bottom: var(--space-sm);
  max-width: 100%;
  overflow-x: auto;
  padding-bottom: 4px;
}

.chain-step-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: nowrap;
}

.chain-step-row .step-num {
  width: 52px;
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
}

.chain-step-row .step-arrow {
  color: var(--el-text-color-secondary);
}

.chain-drag-handle {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 24px;
  text-align: center;
  cursor: grab;
  user-select: none;
  color: var(--el-text-color-secondary);
}
.chain-drag-handle:active {
  cursor: grabbing;
}
.chain-drag-ghost {
  opacity: 0.6;
}

@media (max-width: 1100px) {
  .chain-step-row {
    flex-wrap: wrap;
  }
}
</style>

