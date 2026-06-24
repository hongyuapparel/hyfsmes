<template>
  <div class="app-tabs">
    <div v-show="canScrollLeft" class="app-tabs-fade app-tabs-fade--left" aria-hidden="true" />
    <div
      ref="stripRef"
      class="app-tabs-strip"
      role="tablist"
      @scroll="updateScrollState"
      @wheel="onWheel"
    >
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="app-tab"
        :class="{ 'is-active': tab.key === activeKey }"
        :data-key="tab.key"
        role="tab"
        :aria-selected="tab.key === activeKey"
        @click="onTabClick(tab.key)"
      >
        <span class="app-tab__label">{{ tab.title }}</span>
        <el-icon
          class="app-tab__close"
          :aria-label="`关闭 ${tab.title}`"
          @click.stop="onTabRemove(tab.key)"
        >
          <Close />
        </el-icon>
      </button>
    </div>
    <div v-show="canScrollRight" class="app-tabs-fade app-tabs-fade--right" aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import { Close } from '@element-plus/icons-vue'
import Sortable from 'sortablejs'
import { getRouteTabKey, markRouteCacheDropped } from '@/composables/useRouteCacheControl'

interface TabItem {
  key: string
  fullPath: string
  path: string
  title: string
}

const route = useRoute()
const router = useRouter()

const tabs = ref<TabItem[]>([])
const activeKey = ref('')

const stripRef = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

let sortable: Sortable | null = null
// 拖动重排刚结束时抑制紧随的 click，避免误切到刚拖过的页签
let justSorted = false

function getTitle(r: RouteLocationNormalizedLoaded) {
  if (r.name === 'OrdersDetail' || r.name === 'OrdersEdit' || r.name === 'OrdersCost') {
    const queryTitle = typeof r.query?.tabTitle === 'string' ? r.query.tabTitle.trim() : ''
    if (queryTitle) return queryTitle
  }
  const metaTitle = r.meta?.title as string | undefined
  if (metaTitle) return metaTitle
  if (typeof r.name === 'string') return r.name
  return r.path || '页面'
}

function addTab(r: RouteLocationNormalizedLoaded) {
  if (r.meta?.hideInTabs) return
  const key = getRouteTabKey(r)

  const title = getTitle(r)
  const exists = tabs.value.find((t) => t.key === key)
  if (!exists) {
    tabs.value.push({ key, fullPath: r.fullPath, path: r.path, title })
  } else {
    exists.fullPath = r.fullPath
    exists.path = r.path
    exists.title = title
  }
  activeKey.value = key
}

function closeByKey(key: string) {
  const index = tabs.value.findIndex((t) => t.key === key)
  if (index === -1) return

  const isActive = key === activeKey.value
  const [closed] = tabs.value.splice(index, 1)
  if (closed) markRouteCacheDropped(closed)

  if (!isActive) return

  const next = tabs.value[index] || tabs.value[index - 1]
  if (next) {
    router.push(next.fullPath)
  } else {
    router.push('/')
  }
}

function onTabClick(key: string) {
  if (justSorted) return
  if (!key || key === activeKey.value) return
  const tab = tabs.value.find((t) => t.key === key)
  if (tab) router.push(tab.fullPath)
}

function onTabRemove(key: string) {
  closeByKey(key)
}

function updateScrollState() {
  const el = stripRef.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 1
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

function scrollActiveIntoView() {
  const el = stripRef.value
  if (!el) return
  const active = el.querySelector<HTMLElement>('.app-tab.is-active')
  if (!active) return
  const tabLeft = active.offsetLeft
  const tabRight = tabLeft + active.offsetWidth
  const viewLeft = el.scrollLeft
  const viewRight = viewLeft + el.clientWidth
  if (tabLeft < viewLeft) {
    el.scrollLeft = Math.max(0, tabLeft - 8)
  } else if (tabRight > viewRight) {
    el.scrollLeft = tabRight - el.clientWidth + 8
  }
}

function refreshTabsLayout() {
  nextTick(() => {
    scrollActiveIntoView()
    updateScrollState()
  })
}

// 鼠标滚轮横向滚动页签（仅在溢出时接管，避免影响整页滚动）
function onWheel(e: WheelEvent) {
  const el = stripRef.value
  if (!el || el.scrollWidth <= el.clientWidth || e.deltaY === 0) return
  el.scrollLeft += e.deltaY
  updateScrollState()
  e.preventDefault()
}

function initSortable() {
  const el = stripRef.value
  if (!el) return
  sortable = Sortable.create(el, {
    animation: 150,
    draggable: '.app-tab',
    filter: '.app-tab__close',
    preventOnFilter: false,
    ghostClass: 'app-tab--ghost',
    chosenClass: 'app-tab--chosen',
    scroll: true,
    onEnd: (evt: Sortable.SortableEvent) => {
      const oldIndex = evt.oldIndex
      const newIndex = evt.newIndex
      if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
      if (
        oldIndex < 0 ||
        newIndex < 0 ||
        oldIndex >= tabs.value.length ||
        newIndex >= tabs.value.length
      ) {
        return
      }
      const arr = tabs.value.slice()
      const [moved] = arr.splice(oldIndex, 1)
      if (!moved) return
      arr.splice(newIndex, 0, moved)
      tabs.value = arr
      justSorted = true
      setTimeout(() => {
        justSorted = false
      }, 0)
    },
  })
}

onMounted(() => {
  addTab(route)
  refreshTabsLayout()
  initSortable()
  window.addEventListener('resize', updateScrollState)
})

onBeforeUnmount(() => {
  sortable?.destroy()
  sortable = null
  window.removeEventListener('resize', updateScrollState)
})

watch(
  () => [route.fullPath, route.query?.tabKey, route.query?.tabTitle],
  () => {
    addTab(route)
    refreshTabsLayout()
  }
)

watch(
  () => tabs.value.length,
  () => refreshTabsLayout()
)
</script>

<style scoped>
.app-tabs {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.app-tabs-strip {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 10px 0;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.app-tabs-strip::-webkit-scrollbar {
  display: none;
}

.app-tab {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  height: 36px;
  padding: 0 14px;
  font-size: var(--font-size-body);
  color: #4e5969;
  background-color: #f7f8fa;
  border: 1px solid #e5e6eb;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}

.app-tab.is-active {
  font-weight: 500;
  color: #165dff;
  background-color: #e8f3ff;
  border-color: #165dff;
}

/* 拖动重排：被拖元素占位与抓取态 */
.app-tab--ghost {
  opacity: 0.4;
}

.app-tab--chosen {
  cursor: grabbing;
}

.app-tab__label {
  line-height: 1;
}

.app-tab__close {
  margin-left: 4px;
  font-size: 14px;
  border-radius: 50%;
  transition: background-color 0.15s;
}

.app-tab__close:hover {
  background-color: rgba(0, 0, 0, 0.08);
}

.app-tabs-fade {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 24px;
  pointer-events: none;
  z-index: 1;
}

.app-tabs-fade--left {
  left: 0;
  background: linear-gradient(to right, var(--color-white), transparent);
}

.app-tabs-fade--right {
  right: 0;
  background: linear-gradient(to left, var(--color-white), transparent);
}
</style>
