<template>
  <div class="app-tabs">
    <el-tabs
      v-model="activeKey"
      type="card"
      class="app-tabs-inner"
      @tab-click="onTabClick"
      @tab-remove="onTabRemove"
    >
      <el-tab-pane
        v-for="tab in tabs"
        :key="tab.fullPath"
        :label="tab.title"
        :name="tab.fullPath"
        closable
      />
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'

interface TabItem {
  fullPath: string
  path: string
  title: string
}

const route = useRoute()
const router = useRouter()

const tabs = ref<TabItem[]>([])
const activeKey = ref(route.fullPath)

function getTitle(r: RouteLocationNormalizedLoaded) {
  const metaTitle = r.meta?.title as string | undefined
  if (metaTitle) return metaTitle
  if (typeof r.name === 'string') return r.name
  return r.path || '页面'
}

function addTab(r: RouteLocationNormalizedLoaded) {
  if (r.meta?.hideInTabs) return

  const exists = tabs.value.find((t) => t.fullPath === r.fullPath)
  if (!exists) {
    tabs.value.push({
      fullPath: r.fullPath,
      path: r.path,
      title: getTitle(r),
    })
  }
  activeKey.value = r.fullPath
}

function closeByFullPath(fullPath: string) {
  const index = tabs.value.findIndex((t) => t.fullPath === fullPath)
  if (index === -1) return

  const isActive = fullPath === route.fullPath
  tabs.value.splice(index, 1)

  if (!isActive) return

  const next = tabs.value[index] || tabs.value[index - 1]
  if (next) {
    router.push(next.fullPath)
  } else {
    router.push('/')
  }
}

function onTabClick(pane: any) {
  const name = pane.paneName as string
  if (name && name !== route.fullPath) {
    router.push(name)
  }
}

function onTabRemove(name: string | number) {
  closeByFullPath(String(name))
}

onMounted(() => {
  addTab(route)
})

watch(
  () => route.fullPath,
  () => {
    addTab(route)
  }
)
</script>

<style scoped>
.app-tabs {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.app-tabs-inner {
  width: 100%;
}

.app-tabs :deep(.el-tabs__header) {
  margin: 0;
  border-bottom: none;
}

.app-tabs :deep(.el-tabs__nav-wrap) {
  margin-bottom: 0;
  padding-left: 10px;
}

.app-tabs :deep(.el-tabs__nav) {
  border: none;
  margin-top: 4px;
  margin-left: 0;
}

.app-tabs :deep(.el-tabs__item) {
  height: 36px;
  line-height: 36px;
  font-size: 14px;
  padding: 0 14px;
  border-radius: 4px;
  margin-right: 6px;
  color: #4e5969;
  border: 1px solid #e5e6eb;
  background-color: #f7f8fa;
}

.app-tabs :deep(.el-tabs__item.is-active) {
  font-weight: 500;
  background-color: #e8f3ff;
  border-color: #165dff;
  color: #165dff;
}

.app-tabs :deep(.el-tabs__item .is-icon-close) {
  margin-left: 4px;
}

/* Element Plus card 模式会把第一个 tab 的左边框去掉，
   官方未提供配置项，这里仅恢复设计系统统一的边框样式 */
.app-tabs :deep(.el-tabs--card > .el-tabs__header .el-tabs__item:first-child) {
  border-left-width: 1px;
  border-left-style: solid;
  border-left-color: var(--color-border);
}
</style>

