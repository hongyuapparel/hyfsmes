<template>
  <el-dialog v-model="dialogVisible" title="辅料出库" width="480" destroy-on-close @close="onClose">
    <el-form ref="formRef" :model="form" :rules="outboundRules" label-width="90px">
      <el-form-item label="辅料" prop="accessoryName">
        <el-input v-model="form.accessoryName" disabled />
      </el-form-item>
      <el-form-item label="领取人" prop="pickupUserId">
        <el-select v-model="form.pickupUserId" placeholder="请选择领取人" filterable clearable style="width: 100%">
          <el-option
            v-for="u in outboundUserOptions"
            :key="u.id"
            :label="u.displayName || u.username"
            :value="u.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="出库数量" prop="quantity">
        <el-input-number
          v-model="form.quantity"
          :min="1"
          :max="form.maxQuantity"
          :precision="0"
          controls-position="right"
          style="width: 100%"
        />
        <div class="outbound-qty-tip">当前库存：{{ form.maxQuantity }}</div>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注（可选）" clearable />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="emit('confirm')">确定出库</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { AccessoryOutboundUserOption } from '@/api/inventory'

interface AccessoriesOutboundFormModel {
  accessoryId: number | null
  accessoryName: string
  pickupUserId: number | null
  quantity: number
  maxQuantity: number
  remark: string
}

const props = defineProps<{
  visible: boolean
  submitting: boolean
  form: AccessoriesOutboundFormModel
  outboundRules: FormRules
  outboundUserOptions: AccessoryOutboundUserOption[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'close'): void
}>()

const formRef = ref<FormInstance>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

function onClose() {
  emit('close')
}

defineExpose({
  validate: () => formRef.value?.validate(),
  clearValidate: () => formRef.value?.clearValidate(),
})
</script>

<style scoped>
.outbound-qty-tip {
  margin-top: 6px;
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  line-height: 1.2;
}
</style>
