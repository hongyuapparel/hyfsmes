<template>
  <div class="page-card page-card--fill hr-page">
    <div class="filter-bar">
      <el-input
        v-model="filter.name"
        placeholder="姓名"
        clearable
        size="large"
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
        size="large"
        class="filter-bar-item"
        :data="departmentTreeOptions"
        node-key="id"
        check-strictly
        :props="{ label: 'label', value: 'id', children: 'children' }"
        @change="onSearch(true)"
      >
        <template #label>
          {{ filter.departmentId ? `部门：${getDepartmentLabel(filter.departmentId)}` : '部门' }}
        </template>
      </el-tree-select>
      <el-select
        v-model="filter.status"
        placeholder="状态"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.status ? `状态：${statusLabel(filter.status)}` : '')"
        @change="onSearch"
      >
        <template #label>
          {{ filter.status ? `状态：${statusLabel(filter.status)}` : '状态' }}
        </template>
        <el-option label="在职" value="active" />
        <el-option label="离职" value="left" />
      </el-select>
      <el-date-picker
        v-model="filter.entryDateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        placeholder="入职日期"
        range-separator="—"
        unlink-panels
        size="large"
        class="filter-bar-item"
        :shortcuts="hrDateRangeShortcuts"
        @change="onSearch(true)"
      />
      <el-date-picker
        v-model="filter.leaveDateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        placeholder="离职日期"
        range-separator="—"
        unlink-panels
        size="large"
        class="filter-bar-item"
        :shortcuts="hrDateRangeShortcuts"
        @change="onSearch(true)"
      />
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button size="large" @click="onExport">导出</el-button>
        <el-button v-if="selectedIds.length" type="danger" size="large" circle @click="onBatchDelete">
          <el-icon><Delete /></el-icon>
        </el-button>
        <el-button type="primary" size="large" @click="drawerRef?.openForm(null)">新建人员</el-button>
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
        <el-table-column prop="leaveDate" label="离职日期" width="110" align="center">
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
import { ref, onMounted, onActivated } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { formatDate } from '@/utils/date-format'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getTextFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import {
  useHrEmployeeList,
  getFilterSelectAutoWidthStyle,
  statusLabel,
  genderLabel,
} from '@/composables/useHrEmployeeList'
import HrEmployeeDrawer from '@/components/hr/HrEmployeeDrawer.vue'
import type { EmployeeItem } from '@/api/hr'

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
