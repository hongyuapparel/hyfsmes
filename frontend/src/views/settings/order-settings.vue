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
                {{ row.limitHours }}
              </template>
            </el-table-column>
            <el-table-column label="启用" width="80">
              <template #default="{ row }">
                <el-tag v-if="row.enabled" type="success" size="small">是</el-tag>
                <el-tag v-else type="info" size="small">否</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="140" fixed="right">
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
            border
            size="small"
            class="process-table process-tree-single"
            lazy
            :load="loadProcessTreeNode"
            :tree-props="{ hasChildren: 'hasChildren', children: 'children' }"
          >
            <el-table-column label="部门" min-width="100">
              <template #default="{ row }">
                <template v-if="row.rowType === 'department'">{{ row.department || '-' }}</template>
                <template v-else></template>
              </template>
            </el-table-column>
            <el-table-column label="工种" min-width="120">
              <template #default="{ row }">
                <template v-if="row.rowType === 'job_type'">{{ row.displayName || '-' }}</template>
                <template v-else></template>
              </template>
            </el-table-column>
            <el-table-column label="工序" min-width="120">
              <template #default="{ row }">
                <template v-if="row.rowType === 'process'">{{ row.processName || '-' }}</template>
                <template v-else></template>
              </template>
            </el-table-column>
            <el-table-column label="价格(元)" width="100" align="right">
              <template #default="{ row }">
                <template v-if="row.rowType === 'process'">{{ row.price }}</template>
                <template v-else>-</template>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="320" fixed="right">
              <template #default="{ row }">
                <template v-if="row.rowType === 'department'">
                  <el-button link type="primary" size="small" @click="openAddChildJobType(row)">新建工种</el-button>
                </template>
                <template v-else-if="row.rowType === 'job_type'">
                  <el-button link type="primary" size="small" @click="openEditJobType(row)">编辑</el-button>
                  <el-button link size="small" :disabled="!canMoveUpJobType(row)" @click="moveJobTypeRow(row, -1)">上移</el-button>
                  <el-button link size="small" :disabled="!canMoveDownJobType(row)" @click="moveJobTypeRow(row, 1)">下移</el-button>
                  <el-button link type="danger" size="small" @click="removeJobType(row)">删除</el-button>
                  <el-button link type="primary" size="small" @click="openProcessDialog(undefined, row)">新增工序</el-button>
                </template>
                <template v-else-if="row.rowType === 'process'">
                  <el-button link type="primary" size="small" @click="openProcessDialog(row.processRow)">编辑</el-button>
                  <el-button link type="danger" size="small" @click="removeProcess(row.processRow!)">删除</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
          <el-dialog
            v-model="jobTypeDialog.visible"
            :title="jobTypeDialogTitle"
            width="400px"
            @close="jobTypeDialog.nodeId = undefined; jobTypeDialog.parentId = undefined"
          >
            <el-form :model="jobTypeForm" label-width="80px" size="default">
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
          <el-table :data="quoteTemplateList" size="small" border row-key="id" class="process-table">
            <el-table-column prop="name" label="模板名称" min-width="140" />
            <el-table-column label="操作" width="220" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openQuoteTemplateDialog(row)">编辑</el-button>
                <el-button link type="primary" size="small" @click="openQuoteTemplateItemsDialog(row)">编辑工序</el-button>
                <el-button link type="danger" size="small" @click="removeQuoteTemplate(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
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
                  :label="`${p.department} · ${p.jobType} · ${p.name}（${p.unitPrice} 元）`"
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
              <el-table-column prop="unitPrice" label="单价(元)" width="90" align="right" />
              <el-table-column label="操作" width="70" fixed="right" align="center">
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
                <el-table-column prop="groupKey" label="分组标记" width="120" />
                <el-table-column prop="isFinal" label="终态" width="80">
                  <template #default="{ row }">
                    <el-tag v-if="row.isFinal" type="success" size="small">是</el-tag>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
                <!-- 启用开关暂时下线，避免保存异常导致订单列表状态全部消失 -->
                <el-table-column label="操作" width="120" fixed="right">
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
                <el-table-column label="操作" width="200" fixed="right">
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
                <el-table-column label="操作" width="120" fixed="right">
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
              <el-form-item label="分组标记">
                <el-input v-model="statusForm.groupKey" placeholder="可不填，如 before_production / in_production / completed" />
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
            <p class="section-desc">按顺序配置每一步：从哪个状态、通过什么动作、到哪个状态。若某步「到状态」是待工艺，可填「无工艺时到」：有工艺订单走待工艺，无工艺订单直接到该状态，一条链路即可。</p>
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
                    <el-select
                      v-if="normalizeStatusCode(step.toStatusCode) === 'pending_craft'"
                      v-model="step.elseToStatusCode"
                      clearable
                      placeholder="无工艺时到…"
                      size="small"
                      style="width: 110px"
                      title="选填。有工艺走待工艺，无工艺订单直接到此处"
                    >
                      <el-option
                        v-for="s in statusList"
                        :key="s.id"
                        :label="s.label"
                        :value="s.code"
                      />
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
  createSystemOption,
  updateSystemOption,
  deleteSystemOption,
  batchUpdateSystemOptionOrder,
  type SystemOptionTreeNode,
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

/** 树表行：部门 / 工种 / 工序（懒加载用）；displayName 为单列树展示用，不重复父级 */
interface ProcessTreeRow {
  id: string | number
  rowType: 'department' | 'job_type' | 'process'
  displayName: string
  department: string
  jobType: string
  processName: string
  price: string
  hasChildren: boolean
  nodeId?: number
  jobTypePath?: string
  processRow?: ProductionProcessItem
}

const processDepartments = ['裁床', '车缝', '尾部'] as const

const activeTab = ref<
  'orderTypes' | 'collaboration' | 'productGroups' | 'applicablePeople' | 'materialTypes' | 'productionProcesses' | 'orderSla' | 'orderStatusConfig'
>('orderStatusConfig')
const processTreeTableRef = ref<InstanceType<typeof import('element-plus')['ElTable']>>()
const processTreeData = ref<ProcessTreeRow[]>([])
const processJobTypeTreeRef = ref<SystemOptionTreeNode[]>([])
const processJobTypeNodeMap = ref<Map<number, SystemOptionTreeNode>>(new Map())

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
const jobTypeForm = ref({ value: '' })
const jobTypeSubmitLoading = ref(false)

const jobTypeDialogTitle = computed(() => {
  if (jobTypeDialog.value.mode === 'edit') return '编辑工种'
  return jobTypeDialog.value.isTopLevel ? '新增部门' : '新建工种'
})

// 服装类型报价模板
const quoteTemplateList = ref<QuoteTemplateType[]>([])
const quoteTemplateDialog = ref<{ visible: boolean; id?: number }>({ visible: false })
const quoteTemplateForm = ref({ name: '' })
const quoteTemplateItemsDialog = ref<{ visible: boolean; templateId?: number; name?: string }>({ visible: false })
const quoteTemplateItemsEdit = ref<{ processId: number; department: string; jobType: string; processName: string; unitPrice: string }[]>([])
const quoteTemplateProcessOptions = ref<ProductionProcessItem[]>([])
const quoteTemplateItemToAdd = ref<number[]>([])

function buildNodeMap(nodes: SystemOptionTreeNode[], map: Map<number, SystemOptionTreeNode>) {
  for (const n of nodes) {
    map.set(n.id, n)
    if (n.children?.length) buildNodeMap(n.children, map)
  }
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
  groupKey: '',
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
  /** 选填。有工艺→本步 to 状态，无工艺→直接到此处；不填则本步不区分工艺 */
  elseToStatusCode: string
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
  steps: [{ fromStatusCode: '', toStatusCode: '', triggerType: 'button', triggerCode: '', allowRoles: [], elseToStatusCode: '' }],
})

function openChainDialog() {
  chainForm.value = {
    name: '',
    orderTypeIds: [],
    collaborationTypeIds: [],
    hasProcessItem: '',
    steps: [{ fromStatusCode: '', toStatusCode: '', triggerType: 'button', triggerCode: '', allowRoles: [], elseToStatusCode: '' }],
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
    elseToStatusCode: '',
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

  const payloadSteps: Array<{
    fromStatus: string
    toStatus: string
    triggerType: string
    triggerCode: string
    allowRoles?: string
    enabled: boolean
    conditionsJson?: Record<string, unknown>
  }> = []
  for (const s of steps) {
    const base = {
      fromStatus: s.fromStatusCode,
      triggerType: s.triggerType,
      triggerCode: s.triggerCode,
      allowRoles: (s.allowRoles ?? []).filter(Boolean).join(',') || undefined,
      enabled: true,
    }
    if (normalizeStatusCode(s.toStatusCode) === 'pending_craft' && s.elseToStatusCode?.trim()) {
      payloadSteps.push({ ...base, toStatus: s.toStatusCode, conditionsJson: stepConditions(true) })
      payloadSteps.push({ ...base, toStatus: s.elseToStatusCode.trim(), conditionsJson: stepConditions(false) })
    } else {
      payloadSteps.push({ ...base, toStatus: s.toStatusCode, conditionsJson: stepConditions() })
    }
  }

  const payload = {
    name: chainForm.value.name?.trim() || undefined,
    conditionsJson: Object.keys(chainConditions).length ? chainConditions : undefined,
    steps: payloadSteps,
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
    steps: (() => {
      const sorted = (row.steps ?? [])
        .slice()
        .sort((a, b) => (Number(a.stepOrder ?? 0) - Number(b.stepOrder ?? 0)) || (a.id - b.id))
      const rows: ChainStepRow[] = []
      for (let i = 0; i < sorted.length; i++) {
        const s = sorted[i]
        const cond = (s.conditionsJson ?? {}) as { hasProcessItem?: boolean }
        const next = sorted[i + 1]
        const nextCond = (next?.conditionsJson ?? {}) as { hasProcessItem?: boolean }
        const sameFromTrigger =
          next &&
          s.fromStatus === next.fromStatus &&
          s.triggerCode === next.triggerCode
        const isCraftPair =
          sameFromTrigger &&
          cond.hasProcessItem === true &&
          nextCond.hasProcessItem === false &&
          normalizeStatusCode(s.toStatus) === 'pending_craft'
        if (isCraftPair) {
          rows.push({
            fromStatusCode: normalizeStatusCode(s.fromStatus),
            toStatusCode: normalizeStatusCode(s.toStatus),
            triggerType: s.triggerType,
            triggerCode: normalizeTriggerCode(s.triggerCode),
            allowRoles: (s.allowRoles ?? '').split(',').map((x) => x.trim()).filter(Boolean),
            elseToStatusCode: normalizeStatusCode(next.toStatus),
          })
          i++
        } else {
          rows.push({
            fromStatusCode: normalizeStatusCode(s.fromStatus),
            toStatusCode: normalizeStatusCode(s.toStatus),
            triggerType: s.triggerType,
            triggerCode: normalizeTriggerCode(s.triggerCode),
            allowRoles: (s.allowRoles ?? '').split(',').map((x) => x.trim()).filter(Boolean),
            elseToStatusCode: '',
          })
        }
      }
      return rows
    })(),
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
    groupKey: '',
    isFinal: false,
  }
}

function openEditStatus(row: OrderStatusItem) {
  statusDialog.value = { visible: true, isEdit: true, id: row.id }
  statusForm.value = {
    label: row.label,
    sortOrder: row.sortOrder,
    groupKey: row.groupKey ?? '',
    isFinal: row.isFinal,
  }
}

async function submitStatus() {
  const payload = {
    label: statusForm.value.label.trim(),
    sortOrder: statusForm.value.sortOrder,
    groupKey: statusForm.value.groupKey.trim() || undefined,
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
        groupKey: payload.groupKey ?? null,
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
    const res = await getSystemOptionsTree('process_job_types')
    const tree = res.data ?? []
    processJobTypeTreeRef.value = tree
    const map = new Map<number, SystemOptionTreeNode>()
    buildNodeMap(tree, map)
    processJobTypeNodeMap.value = map
    processTreeData.value = tree.map((n) => ({
      id: `dept-${n.id}`,
      rowType: 'department' as const,
      displayName: n.value,
      department: n.value,
      jobType: '',
      processName: '',
      price: '',
      hasChildren: true,
      nodeId: n.id,
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
    const node = processJobTypeNodeMap.value.get(row.nodeId)
    const children = node?.children ?? []
    const rows: ProcessTreeRow[] = children.map((c) => ({
      id: `job-${c.id}`,
      rowType: 'job_type' as const,
      displayName: c.value,
      department: row.department,
      jobType: `${row.department} > ${c.value}`,
      processName: '',
      price: '',
      hasChildren: true,
      nodeId: c.id,
      jobTypePath: `${row.department} > ${c.value}`,
    }))
    resolve(rows)
    return
  }
  if (row.rowType === 'job_type' && row.nodeId != null && row.jobTypePath != null) {
    const node = processJobTypeNodeMap.value.get(row.nodeId)
    if (node?.children?.length) {
      const rows: ProcessTreeRow[] = node.children.map((c) => ({
        id: `job-${c.id}`,
        rowType: 'job_type' as const,
        displayName: c.value,
        department: row.department,
        jobType: `${row.jobTypePath} > ${c.value}`,
        processName: '',
        price: '',
        hasChildren: true,
        nodeId: c.id,
        jobTypePath: `${row.jobTypePath} > ${c.value}`,
      }))
      resolve(rows)
      return
    }
    const res = await getProductionProcesses({ department: row.department, jobType: row.jobTypePath })
    const list = res.data ?? []
    const rows: ProcessTreeRow[] = list.map((p) => ({
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
    resolve(rows)
  }
}

/** 同一父级下的兄弟节点（process_job_types 树），用于工种上移/下移 */
function getSiblingsForProcessJobType(nodeId: number): SystemOptionTreeNode[] {
  const tree = processJobTypeTreeRef.value
  const node = processJobTypeNodeMap.value.get(nodeId)
  if (!node) return []
  const pid = node.parentId ?? null
  if (pid === null) return [...tree].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  function collect(list: SystemOptionTreeNode[]): SystemOptionTreeNode[] {
    let out: SystemOptionTreeNode[] = []
    for (const n of list) {
      if ((n.parentId ?? null) === pid) out.push(n)
      if (n.children?.length) out = out.concat(collect(n.children))
    }
    return out
  }
  return collect(tree).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
}

function canMoveUpJobType(row: ProcessTreeRow): boolean {
  if (row.rowType !== 'job_type' || row.nodeId == null) return false
  const siblings = getSiblingsForProcessJobType(row.nodeId)
  const idx = siblings.findIndex((s) => s.id === row.nodeId)
  return idx > 0
}

function canMoveDownJobType(row: ProcessTreeRow): boolean {
  if (row.rowType !== 'job_type' || row.nodeId == null) return false
  const siblings = getSiblingsForProcessJobType(row.nodeId)
  const idx = siblings.findIndex((s) => s.id === row.nodeId)
  return idx >= 0 && idx < siblings.length - 1
}

function openEditJobType(row: ProcessTreeRow) {
  if (row.rowType !== 'job_type' || row.nodeId == null) return
  jobTypeDialog.value = { visible: true, mode: 'edit', nodeId: row.nodeId }
  jobTypeForm.value = { value: row.displayName }
}

function openAddDepartment() {
  jobTypeDialog.value = { visible: true, mode: 'add', parentId: null, isTopLevel: true }
  jobTypeForm.value = { value: '' }
}

function openAddChildJobType(row: ProcessTreeRow) {
  const parentId = row.rowType === 'department' ? row.nodeId ?? null : row.rowType === 'job_type' ? row.nodeId ?? null : null
  if (parentId == null) return
  jobTypeDialog.value = { visible: true, mode: 'add', parentId, isTopLevel: false }
  jobTypeForm.value = { value: '' }
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
      await updateSystemOption(jobTypeDialog.value.nodeId, { value: val })
      ElMessage.success('已更新')
    } else if (jobTypeDialog.value.mode === 'add' && jobTypeDialog.value.parentId != null) {
      const tree = processJobTypeTreeRef.value
      const pid = jobTypeDialog.value.parentId
      const siblings = pid === null ? tree : (processJobTypeNodeMap.value.get(pid)?.children ?? [])
      const sortOrder = siblings.length
      await createSystemOption({
        type: 'process_job_types',
        value: val,
        sort_order: sortOrder,
        parent_id: pid ?? undefined,
      })
      ElMessage.success('已添加')
    }
    jobTypeDialog.value.visible = false
    await loadProcessTreeRoots()
  } catch (e: unknown) {
    ElMessage.error((e as { message?: string })?.message ?? '操作失败')
  } finally {
    jobTypeSubmitLoading.value = false
  }
}

async function removeJobType(row: ProcessTreeRow) {
  if (row.rowType !== 'job_type' || row.nodeId == null) return
  const node = processJobTypeNodeMap.value.get(row.nodeId)
  if (!node) return
  try {
    await ElMessageBox.confirm(
      node.children?.length ? `确定删除「${row.displayName}」及其下级分组？` : `确定删除「${row.displayName}」？`,
      '提示',
      { type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await deleteSystemOption(row.nodeId)
    ElMessage.success('已删除')
    await loadProcessTreeRoots()
  } catch (e: unknown) {
    ElMessage.error((e as { message?: string })?.message ?? '删除失败')
  }
}

async function moveJobTypeRow(row: ProcessTreeRow, delta: number) {
  if (row.rowType !== 'job_type' || row.nodeId == null) return
  const siblings = getSiblingsForProcessJobType(row.nodeId)
  const idx = siblings.findIndex((s) => s.id === row.nodeId)
  if (idx < 0) return
  const newIdx = idx + delta
  if (newIdx < 0 || newIdx >= siblings.length) return
  const arr = [...siblings]
  ;[arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]]
  const items = arr.map((n, i) => ({ id: n.id, sort_order: i }))
  try {
    const parentId = processJobTypeNodeMap.value.get(row.nodeId)?.parentId ?? null
    await batchUpdateSystemOptionOrder('process_job_types', parentId, items)
    ElMessage.success('已移动')
    await loadProcessTreeRoots()
  } catch (e: unknown) {
    ElMessage.error((e as { message?: string })?.message ?? '移动失败')
  }
}

/** 从部门根节点递归收集所有后代路径，如 裁床 > 裁工、裁床 > 裁工 > 细分 */
function collectJobTypePaths(nodes: SystemOptionTreeNode[], parentPath = ''): string[] {
  const list: string[] = []
  for (const n of nodes) {
    const path = parentPath ? `${parentPath} > ${n.value}` : n.value
    list.push(path)
    if (n.children?.length) list.push(...collectJobTypePaths(n.children, path))
  }
  return list
}

async function loadProcessJobTypeOptions(department: string) {
  if (!department) {
    processJobTypeOptions.value = []
    return
  }
  try {
    const res = await getSystemOptionsTree('process_job_types')
    const tree = res.data ?? []
    const root = tree.find((n) => n.value === department)
    if (!root) {
      processJobTypeOptions.value = []
      return
    }
    // 只取该部门下的后代路径（不含部门名本身），用于下拉选项
    const paths = root.children?.length
      ? collectJobTypePaths(root.children, department)
      : []
    processJobTypeOptions.value = paths
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
    const res = await getSystemOptionsTree('process_job_types')
    const tree = res.data ?? []
    const values = new Set(tree.map((n) => n.value))
    const toAdd = processDepartments.filter((d) => !values.has(d))
    for (let i = 0; i < toAdd.length; i++) {
      await createSystemOption({
        type: 'process_job_types',
        value: toAdd[i],
        sort_order: tree.length + i,
        parent_id: null,
      })
    }
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
    if (processDialog.value.id) {
      await updateProductionProcess(processDialog.value.id, {
        department: processForm.value.department,
        jobType: processForm.value.jobType,
        name: processForm.value.name,
        unitPrice: String(processForm.value.unitPrice),
      })
      ElMessage.success('已更新')
    } else {
      await createProductionProcess({
        department: processForm.value.department,
        jobType: processForm.value.jobType,
        name: processForm.value.name,
        unitPrice: String(processForm.value.unitPrice),
      })
      ElMessage.success('已新增')
    }
    processDialog.value.visible = false
    loadProcessTreeRoots()
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
    loadProcessTreeRoots()
  } catch (e) {
    if ((e as string) !== 'cancel') ElMessage.error('删除失败')
  }
}

async function loadQuoteTemplates() {
  try {
    const res = await getProcessQuoteTemplates()
    quoteTemplateList.value = res.data ?? []
  } catch {
    quoteTemplateList.value = []
  }
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

.process-table {
  font-size: var(--font-size-body);
}

.process-tree-single .el-table__row .el-table__cell:first-child {
  font-weight: inherit;
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

