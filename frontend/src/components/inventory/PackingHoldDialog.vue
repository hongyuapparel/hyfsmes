<template>
  <AppDialog
    :model-value="state.visible" :title="state.status === 'held' ? '标记滞留待发' : '移回草稿'" width="480px"
    :close-on-press-escape="!state.submitting" :show-close="!state.submitting"
    @update:model-value="state.visible = $event"
  >
    <p>本次处理 {{ state.ids.length }} 个装箱单，只切换分类，不改变数量和库存。</p>
    <el-form v-if="state.status === 'held'" label-position="top" @submit.prevent>
      <el-form-item label="滞留原因（选填）">
        <el-input v-model="state.reason" type="textarea" :rows="4" maxlength="500" show-word-limit
          :disabled="state.submitting" placeholder="例如：等尾款、等客户通知、等拼柜" />
      </el-form-item>
    </el-form>
    <p v-else>移回后仍未发货，需要另行确认发货。</p>
    <template #footer>
      <el-button :disabled="state.submitting" @click="state.visible = false">取消</el-button>
      <el-button type="primary" :loading="state.submitting" @click="emit('submit')">
        {{ state.status === 'held' ? '标记滞留' : '移回草稿' }}
      </el-button>
    </template>
  </AppDialog>
</template>
<script setup lang="ts">
import AppDialog from '@/components/AppDialog.vue'
defineProps<{ state: { visible: boolean; submitting: boolean; status: 'held' | 'draft'; ids: number[]; reason: string } }>()
const emit = defineEmits<{ submit: [] }>()
</script>
