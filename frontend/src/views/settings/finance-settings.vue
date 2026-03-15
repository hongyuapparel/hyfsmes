<template>
  <div class="page-card">
    <p class="settings-hint">
      配置财务相关下拉选项：支出类型（如采购、外发加工、人工、运费、办公等）和银行账号（如公司主账户、一般户等）。
      收入流水、支出流水登记时会使用此处配置，改名后历史记录展示会自动同步新名称。
    </p>

    <div class="settings-body">
      <el-tabs v-model="activeTab" tab-position="left" class="settings-tabs">
        <el-tab-pane label="支出类型" name="expenseTypes" />
        <el-tab-pane label="银行账号" name="bankAccounts" />
      </el-tabs>

      <div class="settings-content">
        <template v-if="activeTab === 'expenseTypes'">
          <h3 class="section-title">支出类型</h3>
          <p class="section-desc">
            登记支出时选择类型，便于按类型汇总统计。例如：采购、外发加工、人工、运费、办公、其他。
          </p>
          <div class="option-toolbar">
            <el-button type="primary" size="small" @click="openDialog('expense_types', null)">新增</el-button>
          </div>
          <el-table :data="expenseTypes" row-key="id" border class="option-table">
            <el-table-column prop="value" label="名称" min-width="160" />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openDialog('expense_types', row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="removeOption('expense_types', row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <template v-else>
          <h3 class="section-title">银行账号</h3>
          <p class="section-desc">
            登记收入时选择入账银行/账号，便于按账号与部门对账。
          </p>
          <div class="option-toolbar">
            <el-button type="primary" size="small" @click="openDialog('bank_accounts', null)">新增</el-button>
          </div>
          <el-table :data="bankAccounts" row-key="id" border class="option-table">
            <el-table-column prop="value" label="名称" min-width="160" />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openDialog('bank_accounts', row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="removeOption('bank_accounts', row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </div>
    </div>

    <el-dialog
      v-model="dialog.visible"
      :title="dialog.isEdit ? '编辑' : '新增'"
      width="400"
      @close="dialog.value = ''"
    >
      <el-form label-width="80px">
        <el-form-item label="名称">
          <el-input v-model="dialog.value" placeholder="请输入名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="submitOption">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getSystemOptionsList,
  createSystemOption,
  updateSystemOption,
  deleteSystemOption,
  type SystemOptionItem,
} from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'

type TabName = 'expenseTypes' | 'bankAccounts'
const activeTab = ref<TabName>('expenseTypes')

const expenseTypes = ref<SystemOptionItem[]>([])
const bankAccounts = ref<SystemOptionItem[]>([])

const dialog = reactive({
  visible: false,
  isEdit: false,
  type: '' as string,
  editId: 0 as number,
  value: '',
  submitting: false,
})

async function loadExpenseTypes() {
  try {
    const res = await getSystemOptionsList('expense_types')
    const list = res.data ?? []
    expenseTypes.value = list.filter((o) => o.parentId == null)
  } catch {
    expenseTypes.value = []
  }
}

async function loadBankAccounts() {
  try {
    const res = await getSystemOptionsList('bank_accounts')
    const list = res.data ?? []
    bankAccounts.value = list.filter((o) => o.parentId == null)
  } catch {
    bankAccounts.value = []
  }
}

function load() {
  loadExpenseTypes()
  loadBankAccounts()
}

function openDialog(type: string, row: SystemOptionItem | null) {
  dialog.type = type
  dialog.isEdit = !!row
  dialog.editId = row ? row.id : 0
  dialog.value = row ? row.value : ''
  dialog.visible = true
}

async function submitOption() {
  const value = dialog.value?.trim()
  if (!value) {
    ElMessage.warning('请输入名称')
    return
  }
  dialog.submitting = true
  try {
    if (dialog.isEdit) {
      await updateSystemOption(dialog.editId, { value })
      ElMessage.success('已保存')
    } else {
      await createSystemOption({ type: dialog.type, value, sort_order: 0, parent_id: null })
      ElMessage.success('已添加')
    }
    dialog.visible = false
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    dialog.submitting = false
  }
}

async function removeOption(type: string, row: SystemOptionItem) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.value}」？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteSystemOption(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onMounted(load)
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
  gap: var(--space-lg);
}

.settings-tabs {
  min-width: 140px;
}

.settings-content {
  flex: 1;
}

.section-title {
  font-size: var(--font-size-subtitle);
  margin-bottom: var(--space-xs);
}

.section-desc {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  margin-bottom: var(--space-sm);
}

.option-toolbar {
  margin-bottom: var(--space-sm);
}

.option-table {
  margin-top: 0;
}
</style>
