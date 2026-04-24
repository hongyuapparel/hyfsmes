<template>
  <AppDrawer
    v-model="formDialog.visible"
    :size="760"
    @closed="resetForm"
  >
    <template #header>
      <div class="drawer-header">
        <span>{{ formDialog.isEdit ? '人员详情' : '新建人员' }}</span>
        <el-button
          v-if="formDialog.isEdit && drawerPreview"
          type="primary"
          link
          @click="drawerPreview = false"
        >
          编辑
        </el-button>
      </div>
    </template>

    <el-descriptions v-if="drawerPreview" :column="2" border class="preview-descriptions">
      <el-descriptions-item label="姓名">{{ form.name || '-' }}</el-descriptions-item>
      <el-descriptions-item label="性别">{{ genderLabel(form.gender) }}</el-descriptions-item>
      <el-descriptions-item label="部门">{{ getDepartmentLabel(form.departmentId) || '-' }}</el-descriptions-item>
      <el-descriptions-item label="岗位">{{ getJobLabel(form.jobTitleId) || '-' }}</el-descriptions-item>
      <el-descriptions-item label="入职日期">{{ formatDate(form.entryDate) }}</el-descriptions-item>
      <el-descriptions-item label="学历">{{ form.education || '-' }}</el-descriptions-item>
      <el-descriptions-item label="宿舍">{{ form.dormitory || '-' }}</el-descriptions-item>
      <el-descriptions-item label="联系电话">{{ form.contactPhone || '-' }}</el-descriptions-item>
      <el-descriptions-item label="身份证号">{{ form.idCardNo || '-' }}</el-descriptions-item>
      <el-descriptions-item label="籍贯">{{ form.nativePlace || '-' }}</el-descriptions-item>
      <el-descriptions-item label="家庭地址">{{ form.homeAddress || '-' }}</el-descriptions-item>
      <el-descriptions-item label="紧急联系人">{{ form.emergencyContact || '-' }}</el-descriptions-item>
      <el-descriptions-item label="紧急电话">{{ form.emergencyPhone || '-' }}</el-descriptions-item>
      <el-descriptions-item label="状态">{{ statusLabel(form.status) }}</el-descriptions-item>
      <el-descriptions-item label="离职日期">
        {{ form.status === 'left' ? formatDate(form.leaveDate) : '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="离职原因">
        {{ form.status === 'left' ? (form.leaveReason || '-') : '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="关联用户">{{ getUserLabel(form.userId) }}</el-descriptions-item>
      <el-descriptions-item label="备注">{{ form.remark || '-' }}</el-descriptions-item>
      <el-descriptions-item label="身份证照片">
        <el-image
          v-if="form.photoUrl"
          :src="form.photoUrl"
          fit="cover"
          style="width: 88px; height: 88px; border-radius: 6px"
        />
        <span v-else>-</span>
      </el-descriptions-item>
    </el-descriptions>

    <el-form
      v-else
      ref="formRef"
      :model="form"
      :rules="formRules"
      label-width="90px"
      class="drawer-form-grid"
    >
      <el-form-item label="序号">
        <el-input-number
          v-model="form.sortIndex"
          :min="1"
          :max="paginationTotal || 1"
          controls-position="right"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="姓名" prop="name">
        <el-input v-model="form.name" placeholder="请输入姓名" clearable />
      </el-form-item>
      <el-form-item label="性别" prop="gender">
        <el-radio-group v-model="form.gender">
          <el-radio value="male">男</el-radio>
          <el-radio value="female">女</el-radio>
          <el-radio value="unknown">未知</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="部门" prop="departmentId">
        <el-tree-select
          v-model="form.departmentId"
          placeholder="选择部门"
          clearable
          filterable
          style="width: 100%"
          :data="departmentTreeOptions"
          node-key="id"
          check-strictly
          :props="{ label: 'label', value: 'id', children: 'children' }"
        />
      </el-form-item>
      <el-form-item label="岗位" prop="jobTitleId">
        <el-select
          v-model="form.jobTitleId"
          placeholder="先选择部门，再选择岗位"
          clearable
          filterable
          style="width: 100%"
          :disabled="!form.departmentId"
        >
          <el-option
            v-for="j in jobOptionsForForm"
            :key="j.id"
            :label="j.label"
            :value="j.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="入职日期" prop="entryDate">
        <el-date-picker
          v-model="form.entryDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择入职日期"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="学历" prop="education">
        <el-input v-model="form.education" placeholder="学历" clearable />
      </el-form-item>
      <el-form-item label="宿舍" prop="dormitory">
        <el-input v-model="form.dormitory" placeholder="宿舍" clearable />
      </el-form-item>
      <el-form-item label="联系电话" prop="contactPhone">
        <el-input v-model="form.contactPhone" placeholder="联系电话" clearable />
      </el-form-item>
      <el-form-item label="身份证号" prop="idCardNo">
        <el-input v-model="form.idCardNo" placeholder="身份证号码" clearable />
      </el-form-item>
      <el-form-item label="籍贯" prop="nativePlace">
        <el-input v-model="form.nativePlace" placeholder="籍贯" clearable />
      </el-form-item>
      <el-form-item label="家庭地址" prop="homeAddress" class="full-row">
        <el-input v-model="form.homeAddress" placeholder="家庭地址" clearable />
      </el-form-item>
      <el-form-item label="紧急联系人" prop="emergencyContact">
        <el-input v-model="form.emergencyContact" placeholder="紧急联系人" clearable />
      </el-form-item>
      <el-form-item label="紧急电话" prop="emergencyPhone">
        <el-input v-model="form.emergencyPhone" placeholder="紧急联系电话" clearable />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-radio-group v-model="form.status">
          <el-radio value="active">在职</el-radio>
          <el-radio value="left">离职</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="form.status === 'left'" label="离职日期" prop="leaveDate">
        <el-date-picker
          v-model="form.leaveDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择离职日期"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item v-if="form.status === 'left'" label="离职原因" prop="leaveReason">
        <el-input v-model="form.leaveReason" placeholder="离职原因" clearable />
      </el-form-item>
      <el-form-item label="关联用户" prop="userId" class="full-row">
        <el-select
          v-model="form.userId"
          placeholder="可选：关联系统登录账号"
          clearable
          filterable
          style="width: 100%"
        >
          <el-option
            v-for="u in userOptions"
            :key="u.id"
            :label="u.displayName ? `${u.displayName}（${u.username}）` : u.username"
            :value="u.id"
          />
        </el-select>
        <div class="form-tip">关联后可在业务中对应到该员工的系统账号</div>
      </el-form-item>
      <el-form-item label="备注" prop="remark" class="full-row">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注" clearable />
      </el-form-item>
      <el-form-item label="身份证照片" class="full-row">
        <ImageUploadArea v-model="form.photoUrl" :compact="false" class="employee-photo-upload" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="formDialog.visible = false">
        {{ drawerPreview ? '关闭' : '取消' }}
      </el-button>
      <el-button
        v-if="!drawerPreview"
        type="primary"
        :loading="formDialog.submitting"
        @click="submitForm"
      >
        确定
      </el-button>
    </template>
  </AppDrawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppDrawer from '@/components/AppDrawer.vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import { formatDate } from '@/utils/date-format'
import { useHrEmployeeForm } from '@/composables/useHrEmployeeForm'
import { genderLabel, statusLabel, type DeptTreeOption, type JobOption } from '@/composables/useHrEmployeeList'
import type { EmployeeItem, HrUserOption } from '@/api/hr'

const props = defineProps<{
  paginationTotal: number
  departmentTreeOptions: DeptTreeOption[]
  allJobs: JobOption[]
  userOptions: HrUserOption[]
  getDepartmentLabel: (id: number | null) => string
  getRowIndex: (id: number) => number
}>()

const emit = defineEmits<{
  (e: 'saved'): void
}>()

const allJobsRef = computed(() => props.allJobs)
const userOptionsRef = computed(() => props.userOptions)
const paginationTotalRef = computed(() => props.paginationTotal)

const {
  formDialog,
  drawerPreview,
  formRef,
  form,
  formRules,
  jobOptionsForForm,
  getJobLabel,
  getUserLabel,
  openForm,
  openPreview,
  resetForm,
  submitForm: _submitForm,
} = useHrEmployeeForm({
  allJobs: allJobsRef,
  userOptions: userOptionsRef,
  paginationTotal: paginationTotalRef,
  getRowIndex: (id) => props.getRowIndex(id),
  onSaved: () => emit('saved'),
})

async function submitForm() {
  await _submitForm()
}

defineExpose({ openForm, openPreview })
</script>

<style scoped>
.drawer-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.preview-descriptions {
  margin-bottom: 8px;
}

.drawer-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

:deep(.drawer-form-grid .el-form-item) {
  margin-bottom: 14px;
}

:deep(.drawer-form-grid .el-form-item.full-row) {
  grid-column: 1 / -1;
}

.form-tip {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  margin-top: 4px;
}

.employee-photo-upload {
  width: 100%;
  min-height: 140px;
}
</style>
