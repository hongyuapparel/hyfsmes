<template>
  <div class="main-layout">
    <div class="layout-body">
      <div
        class="sidebar-wrapper"
        :class="{ collapsed: appStore.sidebarCollapsed }"
      >
        <div class="sidebar-brand">
          <div class="brand-logo">
            <img class="brand-logo-image" :src="brandLogoUrl" alt="鸿宇ERP" />
          </div>
          <span v-show="!appStore.sidebarCollapsed" class="brand-name">鸿宇服饰</span>
        </div>
        <el-menu
          :default-active="activeMenu"
          :collapse="appStore.sidebarCollapsed"
          :collapse-transition="false"
          :unique-opened="true"
          :show-timeout="0"
          :hide-timeout="0"
          router
          class="sidebar-menu"
        >
          <template v-for="item in allowedMenus" :key="item.path">
            <el-sub-menu
              v-if="item.children?.length"
              :index="item.path"
              popper-class="sidebar-submenu-popper"
              :popper-offset="0"
            >
              <template #title>
                <el-icon v-if="item.icon" class="menu-icon">
                  <component :is="iconMap[item.icon]" />
                </el-icon>
                <span class="menu-title">{{ item.title }}</span>
              </template>
              <el-menu-item
                v-for="child in item.children"
                :key="child.path"
                :index="child.path"
              >
                <span class="menu-title">{{ child.title }}</span>
              </el-menu-item>
            </el-sub-menu>
            <el-menu-item v-else :index="item.path">
              <el-icon v-if="item.icon" class="menu-icon">
                <component :is="iconMap[item.icon]" />
              </el-icon>
              <span class="menu-title">{{ item.title }}</span>
            </el-menu-item>
          </template>
        </el-menu>
      </div>

      <div class="content-wrapper">
        <header class="layout-header">
          <div class="header-left-section">
            <el-button
              :icon="appStore.sidebarCollapsed ? Expand : Fold"
              class="header-toggle"
              text
              @click="appStore.toggleSidebar"
            />
            <AppTabs v-if="showHeaderTabs" />
          </div>
          <div class="header-actions">
            <el-tag v-if="healthStatus" type="success" size="small">{{ healthStatus }}</el-tag>
            <span class="user-name">{{ authStore.user?.displayName || authStore.user?.username }}</span>
            <el-button text type="primary" @click="handleLogout">退出</el-button>
          </div>
        </header>
        <main ref="layoutMainRef" class="layout-main">
          <router-view v-slot="{ Component, route }">
            <keep-alive>
              <component :is="Component" :key="getRouteCacheKey(route)" />
            </keep-alive>
          </router-view>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import {
  Expand,
  Fold,
  HomeFilled,
  UserFilled,
  ShoppingCart,
  OfficeBuilding,
  Box,
  Coin,
  Shop,
  Avatar,
  Briefcase,
  Link,
  Setting,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import AppTabs from './AppTabs.vue'
import { menuConfig } from '@/router/menu'
import { getHealth } from '@/api/health'
import type { MenuItem } from '@/router/menu'
import brandLogoUrl from '@/assets/brand-logo.svg'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const authStore = useAuthStore()
const healthStatus = ref('')
const layoutMainRef = ref<HTMLElement | null>(null)

interface RouteScrollSnapshot {
  fullPath: string
  path: string
  tabKey: string
}

interface LayoutScrollPosition {
  top: number
  left: number
}

const layoutScrollMap = new Map<string, LayoutScrollPosition>()
let restoreFrame = 0
let restoreTimer: number | undefined

const showHeaderTabs = computed(() => route.path !== '/')

const iconMap = {
  HomeFilled,
  UserFilled,
  ShoppingCart,
  OfficeBuilding,
  Box,
  Coin,
  Shop,
  Avatar,
  Briefcase,
  Link,
  Setting,
} as const

const allowedMenus = computed(() => {
  const allowed = authStore.permissionRoutes
  if (!allowed.length) return []
  return menuConfig
    .map((item) => {
      if (item.children) {
        const children = item.children.filter((c) => allowed.includes(c.path))
        if (!children.length && !allowed.includes(item.path)) return null
        return { ...item, children }
      }
      return allowed.includes(item.path) ? item : null
    })
    .filter(Boolean) as MenuItem[]
})

const activeMenu = computed(() => route.path)

function getRouteScrollSnapshot(r: RouteLocationNormalizedLoaded): RouteScrollSnapshot {
  return {
    fullPath: r.fullPath,
    path: r.path,
    tabKey: typeof r.query?.tabKey === 'string' ? r.query.tabKey.trim() : '',
  }
}

function getRouteScrollKey(snapshot: RouteScrollSnapshot): string {
  return snapshot.tabKey || snapshot.path || snapshot.fullPath
}

function saveLayoutScroll(key = getRouteScrollKey(getRouteScrollSnapshot(route))) {
  const el = layoutMainRef.value
  if (!el) return
  layoutScrollMap.set(key, { top: el.scrollTop, left: el.scrollLeft })
}

function restoreLayoutScroll(key = getRouteScrollKey(getRouteScrollSnapshot(route))) {
  const el = layoutMainRef.value
  if (!el) return
  const pos = layoutScrollMap.get(key) ?? { top: 0, left: 0 }
  el.scrollTop = pos.top
  el.scrollLeft = pos.left
}

function queueRestoreLayoutScroll(key: string) {
  if (restoreFrame) {
    window.cancelAnimationFrame(restoreFrame)
    restoreFrame = 0
  }
  if (restoreTimer != null) {
    window.clearTimeout(restoreTimer)
    restoreTimer = undefined
  }
  nextTick(() => {
    restoreLayoutScroll(key)
    restoreFrame = window.requestAnimationFrame(() => {
      restoreFrame = 0
      restoreLayoutScroll(key)
      restoreTimer = window.setTimeout(() => {
        restoreTimer = undefined
        restoreLayoutScroll(key)
      }, 50)
    })
  })
}

function getRouteCacheKey(r: RouteLocationNormalizedLoaded): string {
  // MainLayout 只按一级业务分组缓存（如 /orders、/inventory），
  // 避免在二级页面切换时重建 RouterViewWrapper 导致子页面闪刷。
  return r.matched[1]?.path || r.path
}

function shouldUseOuterKeepAlive(r: RouteLocationNormalizedLoaded): boolean {
  // 对声明了 useInnerKeepAlive 的分组，外层不再缓存，避免双层 keep-alive。
  return !Boolean(r.matched[1]?.meta?.useInnerKeepAlive)
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

onMounted(async () => {
  try {
    const res = await getHealth()
    healthStatus.value = res.data?.status === 'ok' ? '后端正常' : ''
  } catch {
    healthStatus.value = '后端未连接'
  }
})

watch(
  () => getRouteScrollSnapshot(route),
  (nextRoute, previousRoute) => {
    saveLayoutScroll(getRouteScrollKey(previousRoute))
    queueRestoreLayoutScroll(getRouteScrollKey(nextRoute))
  },
  { flush: 'pre' },
)

onBeforeUnmount(() => {
  saveLayoutScroll()
  if (restoreFrame) window.cancelAnimationFrame(restoreFrame)
  if (restoreTimer != null) window.clearTimeout(restoreTimer)
})
</script>

<style scoped>
.main-layout {
  height: 100vh;
  display: flex;
}

.layout-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.sidebar-wrapper {
  width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: #071327;
  color: var(--color-white);
  transition: width 0.2s ease;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 1px 0 4px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.sidebar-wrapper.collapsed {
  width: 64px;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: 48px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-wrapper.collapsed .sidebar-brand {
  justify-content: center;
  padding: 0 8px;
}

.brand-logo {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 8px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-logo-image {
  width: 100%;
  height: 100%;
  display: block;
  border-radius: inherit;
}

.brand-name {
  font-size: var(--font-size-title);
  font-weight: 600;
  color: var(--color-white);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.content-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.layout-header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--color-white);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.header-left-section {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  padding-top: 4px;
}

.header-toggle {
  padding: 0;
  min-width: auto;
  height: 36px;
  background-color: transparent;
  border: none;
}

.header-toggle:hover,
.header-toggle:focus {
  background-color: transparent;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.user-name {
  font-size: var(--font-size-body);
  color: var(--color-text-muted);
}

.layout-main {
  flex: 1;
  min-height: 0;
  padding: var(--space-sm);
  background: var(--color-bg);
  overflow: auto;
}

.sidebar-wrapper :deep(.el-menu) {
  background-color: transparent;
  border-right: none;
  padding: 8px 8px;
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.sidebar-wrapper :deep(.el-menu)::-webkit-scrollbar {
  width: 4px;
}

.sidebar-wrapper :deep(.el-menu)::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-wrapper :deep(.el-menu)::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.sidebar-wrapper :deep(.el-menu)::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.18);
}

.sidebar-wrapper.collapsed :deep(.el-menu) {
  padding: 8px 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.sidebar-wrapper.collapsed :deep(.el-menu-item),
.sidebar-wrapper.collapsed :deep(.el-sub-menu > .el-sub-menu__title) {
  width: 44px;
  height: 44px;
  min-width: 44px;
  padding: 0 !important;
  margin: 1px 0;
  justify-content: center;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-wrapper.collapsed :deep(.el-sub-menu) {
  width: 100%;
  display: flex;
  justify-content: center;
}

.sidebar-wrapper :deep(.el-menu-item),
.sidebar-wrapper :deep(.el-sub-menu__title) {
  color: rgba(255, 255, 255, 0.8);
  border-radius: 6px;
  margin: 1px 2px;
  padding-left: 12px;
  padding-right: 12px;
  min-height: 36px;
  height: auto;
}

.sidebar-wrapper :deep(.el-menu-item.is-active),
.sidebar-wrapper :deep(.el-menu-item:hover),
.sidebar-wrapper :deep(.el-sub-menu__title:hover) {
  background-color: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}

.sidebar-wrapper :deep(.el-menu-item.is-active) {
  font-weight: 600;
}

.sidebar-wrapper :deep(.el-sub-menu__title i) {
  color: inherit;
}

.sidebar-wrapper.collapsed .menu-icon {
  margin-right: 0;
}

.menu-icon {
  margin-right: 8px;
  font-size: var(--font-size-subtitle);
}

.menu-title {
  font-size: var(--font-size-body);
}
</style>

<style>
@media print {
  .main-layout .sidebar-wrapper,
  .main-layout .layout-header {
    display: none;
  }

  .main-layout,
  .main-layout .layout-body,
  .main-layout .content-wrapper,
  .main-layout .layout-main {
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
  }

  .main-layout .content-wrapper {
    width: 100%;
  }

  .main-layout .layout-main {
    padding: 0;
    overflow: visible;
  }
}
</style>
