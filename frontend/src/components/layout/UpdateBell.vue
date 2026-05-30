<template>
  <el-popover
    v-model:visible="visible"
    placement="bottom-end"
    :width="380"
    trigger="click"
    popper-class="update-bell-popover"
    :hide-after="0"
  >
    <template #reference>
      <el-badge
        :value="unreadCount"
        :hidden="unreadCount === 0"
        :max="99"
        class="update-bell-badge"
      >
        <el-button
          text
          class="update-bell-button"
          aria-label="系统更新"
          title="系统更新"
        >
          <el-icon :size="18"><Bell /></el-icon>
        </el-button>
      </el-badge>
    </template>

    <div class="update-bell-panel">
      <div class="panel-header">
        <span class="panel-title">最近更新</span>
        <span class="panel-subtitle">最近 7 天</span>
      </div>
      <div v-if="recentUpdates.length === 0" class="panel-empty">暂无更新</div>
      <ul v-else class="panel-list">
        <li
          v-for="item in recentUpdates"
          :key="item.id"
          class="panel-item"
          :class="{ 'is-unread': isUnread(item.id) }"
        >
          <div class="item-meta">
            <span class="item-date">{{ item.date }}</span>
            <el-tag size="small" type="info" effect="plain" class="item-module">{{ item.module }}</el-tag>
            <span v-if="isUnread(item.id)" class="item-dot" aria-label="未读" />
          </div>
          <div class="item-title">{{ item.title }}</div>
          <div v-if="item.description" class="item-desc">{{ item.description }}</div>
          <div v-if="item.link" class="item-actions">
            <el-button type="primary" link size="small" @click="handleGo(item.link)">去看看</el-button>
          </div>
        </li>
      </ul>
      <div class="panel-footer">
        <el-button
          v-if="unreadCount > 0"
          type="primary"
          size="small"
          @click="handleMarkAllRead"
        >全部标为已读</el-button>
        <el-button size="small" @click="visible = false">关闭</el-button>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Bell } from '@element-plus/icons-vue'
import { useSystemUpdates } from '@/composables/useSystemUpdates'

const router = useRouter()
const { recentUpdates, unreadCount, isUnread, markAllRead, consumeAutoOpenFlag } = useSystemUpdates()
const visible = ref(false)

onMounted(() => {
  void nextTick(() => {
    if (consumeAutoOpenFlag() && unreadCount.value > 0) {
      visible.value = true
    }
  })
})

function handleMarkAllRead(): void {
  markAllRead()
  visible.value = false
}

function handleGo(link: string): void {
  visible.value = false
  void router.push(link)
}
</script>

<style scoped>
.update-bell-badge {
  line-height: 1;
}

.update-bell-button {
  padding: 4px 6px;
  height: 32px;
  color: var(--color-text);
}

.update-bell-panel {
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 4px 8px;
  border-bottom: 1px solid var(--color-border);
}

.panel-title {
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  color: var(--color-text);
}

.panel-subtitle {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}

.panel-empty {
  padding: 24px 0;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-body);
}

.panel-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 420px;
  overflow-y: auto;
}

.panel-item {
  padding: 10px 4px;
  border-bottom: 1px solid var(--color-border);
}

.panel-item:last-child {
  border-bottom: none;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.item-date {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}

.item-module {
  height: 18px;
  line-height: 16px;
  padding: 0 6px;
  font-size: var(--font-size-caption);
}

.item-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-danger);
}

.item-title {
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 2px;
}

.item-desc {
  font-size: var(--font-size-body);
  color: var(--color-text);
  white-space: pre-wrap;
  line-height: 1.5;
}

.item-actions {
  margin-top: 4px;
}

.panel-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}
</style>
