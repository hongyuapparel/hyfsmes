<template>
  <div class="page-card page-card--fill">
    <div class="filter-bar">
      <el-input
        v-model="filter.keyword"
        placeholder="按显示名/登录账号搜索"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getTextFilterStyle('关键字：', filter.keyword, keywordLabelVisible)"
        :input-style="getFilterInputStyle(filter.keyword)"
        @keyup.enter="onSearch"
        @clear="onSearch"
      >
        <template #prefix>
          <span v-if="filter.keyword && keywordLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">关键字：</span>
        </template>
      </el-input>
      <el-select
        v-model="filter.role"
        placeholder="角色"
        clearable
        filterable
        size="large"
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(filter.role ? `角色：${roles.find(r => r.code === filter.role)?.name ?? ''}` : '', '角色')"
        @change="onSearch"
        @clear="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.role">角色：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.code" />
      </el-select>
      <el-button type="primary" size="large" @click="onSearch">搜索</el-button>
      <el-button size="large" @click="onReset">清空</el-button>
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="openCreate">新增用户</el-button>
      </div>
    </div>

    <div ref="tableShellRef" class="list-page-table-shell">
      <el-table ref="tableRef" :data="list" border stripe row-key="id" :height="tableHeight" @header-dragend="onHeaderDragEnd">
        <el-table-column label="序号" width="88" column-key="user-sort-index">
          <template #default="{ row }">
            <span>{{ getRowIndex(row.id) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="登录账号" width="140" />
        <el-table-column prop="displayName" label="显示名" width="120" />
        <el-table-column label="角色" min-width="220" column-key="user-roles" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="role-text">{{ getRoleNames(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
              {{ row.status === 'active' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastActiveAt" label="最近活跃" width="160">
          <template #default="{ row }">{{ row.lastActiveAt ? formatDate(row.lastActiveAt) : (row.lastLoginAt ? formatDate(row.lastLoginAt) : '-') }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="170">
          <template #default="{ row }">
            <div class="op-cell">
              <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button link type="primary" size="small" @click="openResetPwd(row)">重置密码</el-button>
              <el-button
                link
                :type="row.status === 'active' ? 'warning' : 'success'"
                size="small"
                @click="toggleStatus(row, tableRef as TableRef)"
              >
                {{ row.status === 'active' ? '禁用' : '启用' }}
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <AppDialog v-model="dialogVisible" :title="isEdit ? '编辑用户' : '新增用户'" width="400" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80">
        <el-form-item label="登录账号" prop="username">
          <el-input v-model="form.username" placeholder="登录账号（建议手机号）" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="初始密码" show-password />
        </el-form-item>
        <el-form-item label="显示名" prop="displayName">
          <el-input v-model="form.displayName" placeholder="显示名称" />
        </el-form-item>
        <el-form-item v-if="isEdit" label="序号">
          <el-input-number v-model="form.sortIndex" :min="1" :max="list.length || 1" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="角色" prop="roleIds">
          <el-select v-model="form.roleIds" placeholder="选择角色" filterable multiple collapse-tags collapse-tags-tooltip style="width: 100%">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitUser(tableRef as TableRef)">确定</el-button>
      </template>
    </AppDialog>

    <AppDialog v-model="pwdDialogVisible" title="重置密码" width="360" @close="pwdForm.password = ''">
      <el-form :model="pwdForm" :rules="pwdRules" label-width="80">
        <el-form-item label="新密码" prop="password">
          <el-input v-model="pwdForm.password" type="password" placeholder="请输入新密码" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdLoading" @click="submitResetPwd">确定</el-button>
      </template>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { formatDateTime as formatDate } from '@/utils/date-format'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { ACTIVE_FILTER_COLOR, getFilterInputStyle, getAdaptiveSelectStyle, getTextFilterStyle } from '@/composables/useFilterBarHelpers'
import { useUsersSettings, type TableRef } from '@/composables/useUsersSettings'

const tableShellRef = ref<HTMLElement | null>(null)
const tableRef = ref<TableRef>()
const { tableHeight } = useFlexShellTableHeight(tableShellRef)

const {
  list, roles, filter, keywordLabelVisible,
  dialogVisible, isEdit, formRef, submitLoading, form, rules,
  pwdDialogVisible, pwdLoading, pwdForm, pwdRules,
  onHeaderDragEnd,
  getRowIndex, getRoleNames,
  load, onSearch, onReset,
  openCreate, openEdit, resetForm, submitUser,
  openResetPwd, submitResetPwd, toggleStatus,
} = useUsersSettings()

onMounted(() => load(tableRef.value as TableRef))
</script>

<style scoped>
.page-card {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  min-height: 0;
}
.op-cell {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
.role-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.el-table .el-table__cell) {
  padding-top: 10px;
  padding-bottom: 10px;
}

:deep(.el-table .cell) {
  line-height: 22px;
}
</style>
