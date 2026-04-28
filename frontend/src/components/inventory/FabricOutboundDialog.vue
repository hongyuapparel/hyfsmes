<template>
  <el-dialog
    v-model="dialogVisible"
    title="面料出库"
    width="500"
    destroy-on-close
    @close="onClose"
  >
    <el-form
      ref="formRef"
      :model="outboundForm"
      :rules="outboundRules"
      label-width="90px"
    >
      <el-form-item label="领取人" prop="pickupUserId">
        <el-select
          v-model="outboundForm.pickupUserId"
          placeholder="请选择领取人"
          filterable
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="opt in fabricPickupUserOptions"
            :key="opt.id"
            :label="opt.displayName?.trim() || opt.username"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="出库数量" prop="quantity">
        <el-input-number
          v-model="outboundForm.quantity"
          :min="0.01"
          :max="outboundMaxQty"
          :precision="2"
          controls-position="right"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="拍照" prop="photoUrl" required>
        <ImageUploadArea v-model="outboundForm.photoUrl" :compact="false" />
      </el-form-item>
      <el-form-item label="备注" prop="remark" required>
        <el-input
          v-model="outboundForm.remark"
          type="textarea"
          :rows="3"
          placeholder="请填写谁领走以及用途"
          clearable
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="
          !outboundForm.pickupUserId ||
          !outboundForm.photoUrl ||
          !outboundForm.remark?.trim()
        "
        @click="emit('confirm')"
      >
        确定出库
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { FabricPickupUserOption } from '@/api/inventory'
import ImageUploadArea from '@/components/ImageUploadArea.vue'

interface OutboundFormModel {
  pickupUserId: number | null
  quantity: number
  photoUrl: string
  remark: string
}

const props = defineProps<{
  visible: boolean
  submitting: boolean
  outboundForm: OutboundFormModel
  outboundRules: FormRules
  outboundMaxQty: number
  fabricPickupUserOptions: FabricPickupUserOption[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'confirm'): void
  (e: 'close'): void
}>()

const formRef = ref<FormInstance>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v),
})

function onClose() {
  formRef.value?.clearValidate()
  emit('close')
}

defineExpose({
  validate: () => formRef.value?.validate(),
  clearValidate: () => formRef.value?.clearValidate(),
})
</script>
