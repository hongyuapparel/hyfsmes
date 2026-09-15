<template>
<el-form ref="formRef" :model="form" :rules="rules" label-width="90px" class="finance-entry-form">
        <el-form-item label="支出日期" prop="occurDate">
          <el-date-picker
            v-model="form.occurDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="支出金额" prop="amount">
          <el-input-number v-model="form.amount" :precision="2" style="width: 100%" />
          <span class="amount-note">付款填正数；退款或扣款冲减填负数，并在备注说明原因。</span>
        </el-form-item>
        <el-form-item label="支出类型" prop="expenseTypeId">
          <el-select v-model="form.expenseTypeId" placeholder="选择支出类型" clearable filterable style="width: 100%">
            <el-option v-for="t in options.expenseTypes" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="支出账户" prop="fundAccountId">
          <el-select v-model="form.fundAccountId" placeholder="选择支出账户" clearable filterable style="width: 100%">
            <el-option v-for="a in options.fundAccounts" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="对象类型">
          <el-select v-model="form.objectType" placeholder="选择对象类型" clearable style="width: 100%">
            <el-option v-for="o in OBJECT_TYPE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款方名称">
          <el-input v-model="form.payeeName" placeholder="如：供应商、员工、平台名称" clearable />
        </el-form-item>
        <el-form-item label="关联订单号">
          <el-input v-model="form.orderNo" placeholder="选填，可输入系统外订单号" clearable />
        </el-form-item>
        <el-form-item label="归属部门">
          <el-select v-model="form.departmentId" placeholder="选择受益部门，暂不明确可留空" clearable filterable style="width: 100%">
            <el-option v-for="d in options.departments" :key="d.id" :label="d.value" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="经办人">
          <el-input v-model="form.operator" placeholder="选填" clearable />
        </el-form-item>
        <FinanceRecordMeta :form="form" :show-duplicate-reason="showDuplicateReason" />
        <el-form-item label="备注" class="entry-wide">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" clearable />
        </el-form-item>
        <el-form-item label="附件凭证" class="entry-wide">
          <FinanceVoucherPicker :attachments="form.attachments" :uploading="uploading" @upload="emit('upload', $event)" @remove="emit('remove', $event)" />
        </el-form-item>
      </el-form>
</template>
<script setup lang="ts">
import FinanceRecordMeta from './FinanceRecordMeta.vue'
import FinanceVoucherPicker from './FinanceVoucherPicker.vue'
import { ref } from 'vue'
import { type FormInstance, type FormRules } from 'element-plus'
import { OBJECT_TYPE_OPTIONS, type FinanceDropdownOptions } from '@/api/finance'
defineProps<{
 showDuplicateReason: boolean
 form: { cashKind: string; bankReference: string; duplicateReason: string; occurDate: string; amount: number; expenseTypeId: number | null; fundAccountId: number | null; departmentId: number | null; objectType: string; payeeName: string; orderNo: string; operator: string; remark: string; attachments: string[] }
 options: Pick<FinanceDropdownOptions, 'expenseTypes' | 'fundAccounts' | 'departments'>
 uploading: boolean
}>()
const emit = defineEmits<{ upload: [file: File]; remove: [index: number] }>()
const formRef = ref<FormInstance>()
const rules: FormRules = {
  fundAccountId: [{ required: true, message: '请选择支出账户', trigger: 'change' }],
  occurDate: [{ required: true, message: '请选择支出日期', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  expenseTypeId: [{ required: true, message: '请选择支出类型', trigger: 'change' }],
}

defineExpose({
 async validate() { return (await formRef.value?.validate()) ?? false },
 resetFields() { formRef.value?.resetFields() },
})
</script>
<style scoped>
.finance-entry-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--space-md); }
.entry-wide { grid-column: 1 / -1; }
.amount-note { color: var(--el-text-color-secondary); line-height: 1.5; }
@media (max-width: 650px) { .finance-entry-form { grid-template-columns: minmax(0, 1fr); } }
</style>
