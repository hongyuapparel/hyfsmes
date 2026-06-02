<template>
  <div class="page-card page-card--fill hr-page">
    <div class="filter-bar">
      <el-input
        v-model="filter.name"
        placeholder="姓名"
        clearable
        class="filter-bar-item"
        :style="getTextFilterStyle('姓名：', filter.name, nameLabelVisible)"
        :input-style="getFilterInputStyle(filter.name)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span v-if="filter.name && nameLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">
            姓名：
          </span>
        </template>
      </el-input>
      <el-tree-select
        v-model="filter.departmentId"
        placeholder="部门"
        clearable
        filterable
        class="filter-bar-item"
        popper-class="hr-department-tree-popper"
        :data="departmentTreeOptions"
        node-key="id"
        check-strictly
        :props="{ label: 'label', value: 'id', children: 'children' }"
        :style="getAdaptiveSelectStyle(filter.departmentId ? `部门：${getDepartmentLabel(filter.departmentId)}` : '', '部门')"
        @change="onSearch(true)"
        @visible-change="onDeptDropdownVisibleChange"
      >
        <template #prefix>
          <span v-if="filter.departmentId" :style="{ color: ACTIVE_FILTER_COLOR }">部门：</span>
        </template>
      </el-tree-select>
      <el-select
        v-model="filter.jobTitleId"
        placeholder="岗位"
        filterable
        clearable
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(filter.jobTitleId ? `岗位：${getJobTitleLabel(filter.jobTitleId)}` : '', '岗位')"
        @change="onSearch(true)"
      >
        <template #label="{ label }">
          <span v-if="filter.jobTitleId">岗位：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="job in allJobs"
          :key="job.id"
          :label="job.label"
          :value="job.id"
        />
      </el-select>
      <el-select
        v-model="filter.status"
        placeholder="状态"
        clearable
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(filter.status ? `状态：${statusLabel(filter.status)}` : '', '状态')"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.status">状态：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option label="在职" value="active" />
        <el-option label="离职" value="left" />
      </el-select>
      <el-select
        v-model="filter.birthMonths"
        placeholder="生日月份"
        multiple
        clearable
        class="filter-bar-item filter-birth-months"
        :style="birthMonthsStyle"
        @change="onSearch(true)"
      >
        <template #prefix>
          <span v-if="filter.birthMonths.length" :style="{ color: ACTIVE_FILTER_COLOR }">生日：</span>
        </template>
        <el-option label="本月生日" :value="currentMonth" />
        <el-option v-for="m in 12" :key="m" :label="`${m}月`" :value="m" />
      </el-select>
      <div
        class="filter-bar-item filter-date-box"
        :class="{ 'is-active': filter.entryDateRange }"
        :style="getFilterRangeStyle(filter.entryDateRange, '入职日期')"
      >
        <span v-if="filter.entryDateRange" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">入职日期：</span>
        <el-date-picker
          v-model="filter.entryDateRange"
          type="daterange"
          :name="['employeeEntryDateStart', 'employeeEntryDateEnd']"
          value-format="YYYY-MM-DD"
          :range-separator="filter.entryDateRange ? '~' : ''"
          start-placeholder="入职日期"
          end-placeholder=""
          unlink-panels
          clearable
          :shortcuts="hrDateRangeShortcuts"
          :class="['filter-range', { 'range-single': !filter.entryDateRange }]"
          @change="onSearch(true)"
        />
      </div>
      <div
        class="filter-bar-item filter-date-box"
        :class="{ 'is-active': filter.leaveDateRange }"
        :style="getFilterRangeStyle(filter.leaveDateRange, '离职日期')"
      >
        <span v-if="filter.leaveDateRange" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">离职日期：</span>
        <el-date-picker
          v-model="filter.leaveDateRange"
          type="daterange"
          :name="['employeeLeaveDateStart', 'employeeLeaveDateEnd']"
          value-format="YYYY-MM-DD"
          :range-separator="filter.leaveDateRange ? '~' : ''"
          start-placeholder="离职日期"
          end-placeholder=""
          unlink-panels
          clearable
          :shortcuts="hrDateRangeShortcuts"
          :class="['filter-range', { 'range-single': !filter.leaveDateRange }]"
          @change="onSearch(true)"
        />
      </div>
      <div class="filter-bar-actions">
        <el-button type="primary" @click="onSearch(true)">搜索</el-button>
        <el-button @click="onReset">清空</el-button>
        <el-button @click="onExport">导出</el-button>
        <el-button
          v-if="selectedIds.length"
          type="danger"
          circle
          aria-label="Delete selected employees"
          @click="onBatchDelete"
        >
          <el-icon><Delete /></el-icon>
        </el-button>
        <el-button type="primary" @click="drawerRef?.openForm(null)">新建人员</el-button>
      </div>
    </div>

    <div v-if="selectedIds.length" class="table-selection-count">已选 {{ selectedIds.length }} 项</div>

    <div ref="tableShellRef" class="list-page-table-shell">
      <el-table
        v-loading="loading"
        :data="list"
        border
        stripe
        row-key="id"
        class="hr-table"
        :height="tableHeight"
        scrollbar-always-on
        @selection-change="onSelectionChange"
        @row-click="onRowClick"
        @sort-change="onSortChange"
      >
        <el-table-column type="selection" width="48" align="center" />
        <el-table-column label="序号" width="88" align="center" prop="sortOrder" sortable="custom">
          <template #default="{ row }">
            <span>{{ getRowIndex(row.id) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="姓名" width="100" show-overflow-tooltip sortable="custom" />
        <el-table-column label="性别" width="80" align="center">
          <template #default="{ row }">{{ genderLabel(row.gender) }}</template>
        </el-table-column>
        <el-table-column prop="departmentName" label="部门" width="120" show-overflow-tooltip />
        <el-table-column prop="jobTitleName" label="岗位" width="120" show-overflow-tooltip />
        <el-table-column prop="entryDate" label="入职日期" width="110" align="center" sortable="custom">
          <template #default="{ row }">{{ formatDate(row.entryDate) }}</template>
        </el-table-column>
        <el-table-column prop="education" label="学历" width="100" show-overflow-tooltip />
        <el-table-column prop="dormitory" label="宿舍" width="100" show-overflow-tooltip />
        <el-table-column prop="contactPhone" label="联系电话" width="120" show-overflow-tooltip />
        <el-table-column prop="idCardNo" label="身份证号码" width="180" show-overflow-tooltip />
        <el-table-column prop="nativePlace" label="籍贯" width="120" show-overflow-tooltip />
        <el-table-column prop="homeAddress" label="家庭地址" min-width="180" show-overflow-tooltip />
        <el-table-column prop="emergencyContact" label="紧急联系人" width="110" show-overflow-tooltip />
        <el-table-column prop="emergencyPhone" label="紧急联系电话" width="130" show-overflow-tooltip />
        <el-table-column prop="leaveDate" label="离职日期" width="110" align="center" sortable="custom">
          <template #default="{ row }">{{ formatDate(row.leaveDate) }}</template>
        </el-table-column>
        <el-table-column prop="leaveReason" label="离职原因" width="140" show-overflow-tooltip />
        <el-table-column label="状态" width="80" align="center" prop="status" sortable="custom">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="关联用户" width="110" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.user ? (row.user.displayName || row.user.username) : '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="100" show-overflow-tooltip />
        <el-table-column label="操作" width="80" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click.stop="drawerRef?.openForm(row)">编辑</el-button>
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

    <HrEmployeeDrawer
      ref="drawerRef"
      :pagination-total="pagination.total"
      :department-tree-options="departmentTreeOptions"
      :all-jobs="allJobs"
      :user-options="userOptions"
      :get-department-label="getDepartmentLabel"
      :get-row-index="getRowIndex"
      @saved="load"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { formatDate } from '@/utils/date-format'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getTextFilterStyle,
  getAdaptiveSelectStyle,
  getFilterRangeStyle,
} from '@/composables/useFilterBarHelpers'
import { useTreeSelectAdjust } from '@/composables/useTreeSelectAdjust'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import {
  useHrEmployeeList,
  statusLabel,
  genderLabel,
} from '@/composables/useHrEmployeeList'
import HrEmployeeDrawer from '@/components/hr/HrEmployeeDrawer.vue'
import type { EmployeeItem } from '@/api/hr'
import { invalidateSharedGetCache } from '@/api/shared-request-cache'

const currentMonth = computed(() => new Date().getMonth() + 1)

const { adjustTreePopperWidth } = useTreeSelectAdjust()

const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const drawerRef = ref<InstanceType<typeof HrEmployeeDrawer>>()

const {
  filter,
  nameLabelVisible,
  hrDateRangeShortcuts,
  list,
  selectedIds,
  loading,
  pagination,
  departmentTreeOptions,
  allJobs,
  userOptions,
  load,
  loadDepartments,
  loadJobs,
  loadUsers,
  getDepartmentLabel,
  getJobTitleLabel,
  getRowIndex,
  onSearch,
  debouncedSearch,
  onReset,
  onSortChange,
  onPageSizeChange,
  onSelectionChange,
  onBatchDelete,
  onExport,
} = useHrEmployeeList()

/**
 * 部门下拉 popper 宽度兜底：visible-change 触发太早时 el-tree 节点还没渲染，
 * 第一次调用 adjustTreePopperWidth 找不到 .el-tree-node__content 会直接 return。
 * 加 100ms / 300ms 两次兜底重试，保证字典渲染完后宽度能被正确算出。
 */
function onDeptDropdownVisibleChange(v: boolean) {
  if (!v) return
  adjustTreePopperWidth('hr-department-tree-popper')
  setTimeout(() => adjustTreePopperWidth('hr-department-tree-popper'), 100)
  setTimeout(() => adjustTreePopperWidth('hr-department-tree-popper'), 300)
}

const birthMonthsStyle = computed(() => {
  const count = filter.birthMonths?.length ?? 0
  if (!count) return getAdaptiveSelectStyle('', '生日月份')
  // 前缀"生日："约 50px + 每个 tag (含 ×) 约 50px + 内边距
  const width = Math.min(360, 90 + count * 50)
  return { width: `${width}px`, minWidth: 'unset', flex: `0 0 ${width}px`, '--el-text-color-regular': 'var(--el-color-primary)' }
})

function onRowClick(row: EmployeeItem, column: { type?: string }, event: Event) {
  if (column?.type === 'selection') return
  const target = event.target as HTMLElement | null
  if (!target) return
  if (target.closest('.el-button, .el-checkbox')) return
  drawerRef.value?.openPreview(row)
}

onMounted(() => {
  loadUsers()
  loadDepartments()
  loadJobs()
  load()
})

onActivated(() => {
  // 强制丢弃部门/岗位字典的 30s 共享缓存，
  // 避免用户在「组织与人事」改完字典回到本页时下拉显示旧数据
  invalidateSharedGetCache('/dicts/tree')
  invalidateSharedGetCache('/dicts/list')
  loadDepartments()
  loadJobs()
})
</script>

<style scoped>
.hr-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.hr-table {
  flex: 1;
  min-height: 0;
}

.table-selection-count {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 8px 0;
}
</style>

<style>
.hr-department-tree-popper.el-popper {
  max-width: 440px;
}
</style>
