<template>
  <div v-if="!isMobile" class="row-actions-inline">
    <el-button
      v-for="a in inlineActions"
      :key="a.key"
      link
      :type="a.type ?? 'primary'"
      size="small"
      :disabled="a.disabled"
      @click="a.onClick"
    >
      {{ a.label }}
    </el-button>
    <el-dropdown v-if="overflowActions.length" trigger="click" @command="onCommand">
      <el-button link type="primary" size="small" class="row-actions-more" :aria-label="props.moreLabel">
        {{ props.moreLabel }}
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="a in overflowActions"
            :key="a.key"
            :command="a.key"
            :disabled="a.disabled"
          >
            {{ a.label }}
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
  <el-dropdown v-else trigger="click" @command="onCommand">
    <el-button link type="primary" size="small" class="row-actions-more" :aria-label="'操作'">
      <el-icon><More /></el-icon>
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item
          v-for="a in visibleActions"
          :key="a.key"
          :command="a.key"
          :disabled="a.disabled"
        >
          {{ a.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { More } from '@element-plus/icons-vue'
import { isMobileViewport as isMobile } from '@/composables/useViewport'

type ActionType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

interface RowAction {
  key: string
  label: string
  onClick: () => void
  type?: ActionType
  disabled?: boolean
  show?: boolean
}

const props = withDefaults(defineProps<{ actions: RowAction[]; inlineLimit?: number; moreLabel?: string }>(), {
  moreLabel: '更多',
})

const visibleActions = computed(() => props.actions.filter((a) => a.show !== false))
const inlineActions = computed(() => {
  if (props.inlineLimit === undefined) return visibleActions.value
  return visibleActions.value.slice(0, Math.max(0, props.inlineLimit))
})
const overflowActions = computed(() => {
  if (props.inlineLimit === undefined) return []
  return visibleActions.value.slice(Math.max(0, props.inlineLimit))
})

function onCommand(key: string) {
  const action = visibleActions.value.find((a) => a.key === key)
  if (action?.disabled) return
  action?.onClick()
}
</script>

<style scoped>
.row-actions-inline {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
