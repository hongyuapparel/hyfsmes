<template>
  <AppDrawer
    v-model="formDialog.visible"
    :size="760"
    @closed="resetForm"
  >
    <template #header>
      <div class="hr-drawer-header">
        <span class="hr-drawer-title">{{ drawerTitle }}</span>
        <el-button
          v-if="formDialog.isEdit && drawerPreview"
          type="primary"
          link
          :icon="Edit"
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
      <el-descriptions-item label="生日">{{ birthDisplay() }}</el-descriptions-item>
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

    <section v-if="drawerPreview" v-loading="loadingExtras" class="preview-section">
      <div class="preview-section-title">入职履历</div>
      <div v-if="historyList.length" class="history-list">
        <div v-for="h in historyList" :key="h.id" class="history-item">
          <span class="history-range">
            {{ formatDate(h.entryDate) || '?' }} ~ {{ h.leaveDate ? formatDate(h.leaveDate) : '在职' }}
          </span>
          <span v-if="h.leaveReason" class="history-reason">{{ h.leaveReason }}</span>
          <span v-if="h.remark" class="history-remark">{{ h.remark }}</span>
        </div>
      </div>
      <div v-else class="preview-section-empty">仅一次入职记录</div>
    </section>

    <section v-if="drawerPreview && yearlyByYear.length" class="preview-section">
      <div class="preview-section-title">年度记录（春节/放假/上班）</div>
      <div class="yearly-list">
        <div v-for="g in yearlyByYear" :key="g.year" class="yearly-group">
          <div class="yearly-year">{{ g.year }}</div>
          <div class="yearly-items">
            <div v-for="r in g.records" :key="r.id" class="yearly-item">
              <span class="yearly-type">{{ yearlyTypeLabel[r.type] || r.type }}：</span>
              <span class="yearly-value">{{ r.value }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <el-form
      v-if="!drawerPreview"
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
import { computed, ref, watch } from 'vue'
import { Edit } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import AppDrawer from '@/components/AppDrawer.vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import { formatDate } from '@/utils/date-format'
import { useHrEmployeeForm } from '@/composables/useHrEmployeeForm'
import { genderLabel, statusLabel, type DeptTreeOption, type JobOption } from '@/composables/useHrEmployeeList'
import {
  getEmployeeHistory,
  getEmployeeYearlyRecords,
  type EmployeeHistoryItem,
  type EmployeeItem,
  type EmployeeYearlyRecordItem,
  type HrUserOption,
} from '@/api/hr'
import { getErrorMessage, isErrorHandled } from '@/api/request'

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
  editId,
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

const historyList = ref<EmployeeHistoryItem[]>([])
const yearlyRecords = ref<EmployeeYearlyRecordItem[]>([])
const loadingExtras = ref(false)

const drawerTitle = computed(() => {
  if (!formDialog.isEdit) return '新建人员'
  return drawerPreview.value ? '人员详情' : '编辑人员'
})

const yearlyByYear = computed(() => {
  const map = new Map<number, EmployeeYearlyRecordItem[]>()
  for (const r of yearlyRecords.value) {
    if (!map.has(r.year)) map.set(r.year, [])
    map.get(r.year)!.push(r)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, records]) => ({ year, records }))
})

const yearlyTypeLabel: Record<string, string> = {
  spring_festival_return: '春节回家',
  vacation_start: '放假时间',
  work_start: '上班时间',
}

function birthDisplay(): string {
  const m = form.birthMonth
  const d = form.birthDay
  if (!m) return '-'
  return d ? `${m}月${d}日` : `${m}月`
}

async function loadExtras(id: number) {
  loadingExtras.value = true
  historyList.value = []
  yearlyRecords.value = []
  try {
    const [h, y] = await Promise.all([getEmployeeHistory(id), getEmployeeYearlyRecords(id)])
    historyList.value = h.data ?? []
    yearlyRecords.value = y.data ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loadingExtras.value = false
  }
}

watch(
  () => [drawerPreview.value, editId.value] as const,
  ([preview, id]) => {
    if (preview && typeof id === 'number') {
      loadExtras(id)
    } else if (!preview) {
      historyList.value = []
      yearlyRecords.value = []
    }
  },
  { immediate: true },
)

async function submitForm() {
  await _submitForm()
}

defineExpose({ openForm, openPreview })
</script>

<style scoped>
.hr-drawer-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hr-drawer-title {
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  color: var(--el-text-color-primary);
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

.preview-section {
  margin-top: 12px;
  padding: 12px;
  background: var(--color-bg-soft, #fafafa);
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--color-border, #e5e7eb);
}

.preview-section-title {
  font-weight: 600;
  font-size: var(--font-size-subtitle);
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
}

.preview-section-empty {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.history-item {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  padding: 6px 8px;
  background: #fff;
  border-radius: 4px;
  border: 1px solid var(--color-border, #e5e7eb);
}

.history-range {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.history-reason,
.history-remark {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}

.yearly-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.yearly-group {
  display: flex;
  gap: 12px;
  padding: 6px 8px;
  background: #fff;
  border-radius: 4px;
  border: 1px solid var(--color-border, #e5e7eb);
}

.yearly-year {
  font-weight: 600;
  color: var(--el-color-primary);
  min-width: 48px;
}

.yearly-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.yearly-item {
  font-size: var(--font-size-body);
}

.yearly-type {
  color: var(--color-text-muted);
}

.yearly-value {
  color: var(--el-text-color-primary);
}
</style>
