<template>
  <div class="page-card">
    <p class="settings-hint">
      配置财务相关下拉选项：资金账户（公账/私账/微信/支付宝等）、收入类型、支出类型。
      修改名称后，历史流水展示将自动同步为新名称。
    </p>

    <div class="settings-body">
      <el-tabs v-model="activeTab" tab-position="left" class="settings-tabs">
        <el-tab-pane label="资金账户" name="fundAccounts" />
        <el-tab-pane label="收入类型" name="incomeTypes" />
        <el-tab-pane label="支出类型" name="expenseTypes" />
      </el-tabs>

      <div class="settings-content">
        <!-- ── 资金账户 ── -->
        <template v-if="activeTab === 'fundAccounts'">
          <h3 class="section-title">资金账户设置</h3>
          <p class="section-desc">配置收款/付款使用的账户，在收入流水、支出流水中作为下拉选项。</p>
          <div class="option-toolbar">
            <el-button type="primary" size="small" @click="openAccountDialog(null)">新增账户</el-button>
          </div>
          <el-table :data="fundAccounts" border class="option-table">
            <el-table-column prop="name" label="账户名称" min-width="130" />
            <el-table-column label="账户类型" width="90">
              <template #default="{ row }">{{ ACCOUNT_TYPE_LABELS[row.accountType] ?? row.accountType }}</template>
            </el-table-column>
            <el-table-column prop="owner" label="归属人" width="100" />
            <el-table-column label="是否启用" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">{{ row.isEnabled ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="sortOrder" label="排序" width="70" align="center" />
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openAccountDialog(row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="removeAccount(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <!-- ── 收入类型 ── -->
        <template v-else-if="activeTab === 'incomeTypes'">
          <h3 class="section-title">收入类型设置</h3>
          <p class="section-desc">配置收入流水中"收入类型"下拉选项，内置7种常用类型，可自行添加。</p>
          <div class="option-toolbar">
            <el-button type="primary" size="small" @click="openTypeDialog('income', null)">新增类型</el-button>
          </div>
          <el-table :data="incomeTypes" border class="option-table">
            <el-table-column prop="name" label="类型名称" min-width="160" />
            <el-table-column label="是否启用" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">{{ row.isEnabled ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="sortOrder" label="排序" width="70" align="center" />
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openTypeDialog('income', row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="removeType('income', row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <!-- ── 支出类型 ── -->
        <template v-else>
          <h3 class="section-title">支出类型设置</h3>
          <p class="section-desc">配置支出流水中"支出类型"下拉选项，内置14种常用类型，可自行添加。</p>
          <div class="option-toolbar">
            <el-button type="primary" size="small" @click="openTypeDialog('expense', null)">新增类型</el-button>
          </div>
          <el-table :data="expenseTypes" border class="option-table">
            <el-table-column prop="name" label="类型名称" min-width="160" />
            <el-table-column label="是否启用" width="90" align="center">
              <template #default="{ row }">
                <el-tag :type="row.isEnabled ? 'success' : 'info'" size="small">{{ row.isEnabled ? '启用' : '停用' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="sortOrder" label="排序" width="70" align="center" />
            <el-table-column label="操作" width="140">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="openTypeDialog('expense', row)">编辑</el-button>
                <el-button link type="danger" size="small" @click="removeType('expense', row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </div>
    </div>

    <!-- 资金账户弹窗 -->
    <el-dialog v-model="accountDialog.visible" :title="accountDialog.isEdit ? '编辑账户' : '新增账户'" width="440" destroy-on-close>
      <el-form :model="accountForm" label-width="90px">
        <el-form-item label="账户名称" required>
          <el-input v-model="accountForm.name" placeholder="如：公司主账户" clearable />
        </el-form-item>
        <el-form-item label="账户类型">
          <el-select v-model="accountForm.accountType" style="width:100%">
            <el-option v-for="(label, val) in ACCOUNT_TYPE_LABELS" :key="val" :label="label" :value="val" />
          </el-select>
        </el-form-item>
        <el-form-item label="归属人">
          <el-input v-model="accountForm.owner" placeholder="如：张三" clearable />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="accountForm.isEnabled" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="accountForm.sortOrder" :min="0" :max="999" style="width:120px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="accountDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="accountDialog.submitting" @click="submitAccount">确定</el-button>
      </template>
    </el-dialog>

    <!-- 类型弹窗（收入/支出通用） -->
    <el-dialog v-model="typeDialog.visible" :title="typeDialog.isEdit ? '编辑类型' : '新增类型'" width="380" destroy-on-close>
      <el-form :model="typeForm" label-width="80px">
        <el-form-item label="类型名称" required>
          <el-input v-model="typeForm.name" placeholder="请输入类型名称" clearable />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="typeForm.isEnabled" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="typeForm.sortOrder" :min="0" :max="999" style="width:120px" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="typeDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="typeDialog.submitting" @click="submitType">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getFundAccounts, createFundAccount, updateFundAccount, deleteFundAccount,
  getIncomeTypes, createIncomeType, updateIncomeType, deleteIncomeType,
  getExpenseTypes, createExpenseType, updateExpenseType, deleteExpenseType,
  type FinanceFundAccount, type FinanceIncomeType, type FinanceExpenseType,
} from '@/api/finance'
import { getErrorMessage, isErrorHandled } from '@/api/request'

type TabName = 'fundAccounts' | 'incomeTypes' | 'expenseTypes'
const activeTab = ref<TabName>('fundAccounts')

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  public: '公账', private: '私账', wechat: '微信', alipay: '支付宝', other: '其他',
}

const fundAccounts = ref<FinanceFundAccount[]>([])
const incomeTypes = ref<FinanceIncomeType[]>([])
const expenseTypes = ref<FinanceExpenseType[]>([])

async function loadFundAccounts() {
  try { fundAccounts.value = (await getFundAccounts()).data ?? [] } catch { fundAccounts.value = [] }
}
async function loadIncomeTypes() {
  try { incomeTypes.value = (await getIncomeTypes()).data ?? [] } catch { incomeTypes.value = [] }
}
async function loadExpenseTypes() {
  try { expenseTypes.value = (await getExpenseTypes()).data ?? [] } catch { expenseTypes.value = [] }
}

watch(activeTab, (tab) => {
  if (tab === 'fundAccounts') loadFundAccounts()
  else if (tab === 'incomeTypes') loadIncomeTypes()
  else loadExpenseTypes()
})

// ── 资金账户 ──────────────────────────────────────────────────────────────────
const accountDialog = reactive({ visible: false, isEdit: false, editId: 0, submitting: false })
const accountForm = reactive<Omit<FinanceFundAccount, 'id'>>({
  name: '', accountType: 'public', owner: '', isEnabled: true, sortOrder: 0,
})

function openAccountDialog(row: FinanceFundAccount | null) {
  accountDialog.isEdit = !!row
  accountDialog.editId = row?.id ?? 0
  if (row) {
    accountForm.name = row.name; accountForm.accountType = row.accountType
    accountForm.owner = row.owner; accountForm.isEnabled = row.isEnabled; accountForm.sortOrder = row.sortOrder
  } else {
    accountForm.name = ''; accountForm.accountType = 'public'
    accountForm.owner = ''; accountForm.isEnabled = true; accountForm.sortOrder = 0
  }
  accountDialog.visible = true
}

async function submitAccount() {
  if (!accountForm.name?.trim()) { ElMessage.warning('请输入账户名称'); return }
  accountDialog.submitting = true
  try {
    if (accountDialog.isEdit) {
      await updateFundAccount(accountDialog.editId, { ...accountForm })
      ElMessage.success('已保存')
    } else {
      await createFundAccount({ ...accountForm })
      ElMessage.success('已添加')
    }
    accountDialog.visible = false
    loadFundAccounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    accountDialog.submitting = false
  }
}

async function removeAccount(row: FinanceFundAccount) {
  try {
    await ElMessageBox.confirm(`确定删除账户「${row.name}」？`, '提示', { type: 'warning' })
    await deleteFundAccount(row.id)
    ElMessage.success('已删除')
    loadFundAccounts()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

// ── 收入/支出类型（通用弹窗） ─────────────────────────────────────────────────
const typeDialog = reactive({ visible: false, isEdit: false, editId: 0, category: '' as 'income' | 'expense', submitting: false })
const typeForm = reactive({ name: '', isEnabled: true, sortOrder: 0 })

function openTypeDialog(category: 'income' | 'expense', row: FinanceIncomeType | FinanceExpenseType | null) {
  typeDialog.category = category; typeDialog.isEdit = !!row; typeDialog.editId = row?.id ?? 0
  if (row) { typeForm.name = row.name; typeForm.isEnabled = row.isEnabled; typeForm.sortOrder = row.sortOrder }
  else { typeForm.name = ''; typeForm.isEnabled = true; typeForm.sortOrder = 0 }
  typeDialog.visible = true
}

async function submitType() {
  if (!typeForm.name?.trim()) { ElMessage.warning('请输入类型名称'); return }
  typeDialog.submitting = true
  try {
    const dto = { name: typeForm.name.trim(), isEnabled: typeForm.isEnabled, sortOrder: typeForm.sortOrder }
    if (typeDialog.isEdit) {
      typeDialog.category === 'income'
        ? await updateIncomeType(typeDialog.editId, dto)
        : await updateExpenseType(typeDialog.editId, dto)
      ElMessage.success('已保存')
    } else {
      typeDialog.category === 'income' ? await createIncomeType(dto) : await createExpenseType(dto)
      ElMessage.success('已添加')
    }
    typeDialog.visible = false
    typeDialog.category === 'income' ? loadIncomeTypes() : loadExpenseTypes()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    typeDialog.submitting = false
  }
}

async function removeType(category: 'income' | 'expense', row: FinanceIncomeType | FinanceExpenseType) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.name}」？删除后该类型将不再出现在下拉选项中（历史记录不受影响）`, '提示', { type: 'warning' })
    category === 'income' ? await deleteIncomeType(row.id) : await deleteExpenseType(row.id)
    ElMessage.success('已删除')
    category === 'income' ? loadIncomeTypes() : loadExpenseTypes()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onMounted(loadFundAccounts)
</script>

<style scoped>
.settings-hint { color: var(--color-text-muted); font-size: var(--font-size-caption); margin-bottom: var(--space-md); line-height: 1.6; }
.settings-body { display: flex; align-items: flex-start; gap: var(--space-lg); }
.settings-tabs { min-width: 120px; }
.settings-content { flex: 1; }
.section-title { font-size: var(--font-size-subtitle); margin-bottom: var(--space-xs); }
.section-desc { font-size: var(--font-size-caption); color: var(--color-text-muted); margin-bottom: var(--space-sm); }
.option-toolbar { margin-bottom: var(--space-sm); }
.option-table { margin-top: 0; }
</style>
