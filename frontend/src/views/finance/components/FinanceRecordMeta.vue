<template>
  <el-form-item label="收支性质"><el-select v-model="form.cashKind" style="width:100%"><el-option v-for="item in CASH_KIND_OPTIONS" :key="item.value" :label="item.label" :value="item.value" /></el-select></el-form-item>
  <el-form-item label="银行流水号"><el-input v-model="form.bankReference" maxlength="100" placeholder="选填；同账户流水号防重复" /></el-form-item>
  <el-form-item v-if="showDuplicateReason" label="重复核实说明" class="entry-wide"><el-input v-model="form.duplicateReason" maxlength="500" type="textarea" placeholder="确认是不同付款后填写依据；此说明会留痕" /></el-form-item>
</template>
<script setup lang="ts">
import { CASH_KIND_OPTIONS } from '@/api/finance-control'
defineProps<{ form: { cashKind: string; bankReference: string; duplicateReason: string }; showDuplicateReason: boolean }>()
</script>
