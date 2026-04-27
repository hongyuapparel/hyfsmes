<script setup lang="ts">
import { computed } from 'vue'
import { productionTimeRatingTagType } from '@/utils/production-time-rating'

const props = defineProps<{
  /** 后端/业务返回的判定文案；空则显示为 - */
  text?: string | null
}>()

const display = computed(() => {
  const s = (props.text ?? '').trim()
  return s || '-'
})

const tagType = computed(() => productionTimeRatingTagType(display.value))
</script>

<template>
  <el-tag v-if="tagType" :type="tagType" size="small">{{ display }}</el-tag>
  <span v-else>{{ display }}</span>
</template>
