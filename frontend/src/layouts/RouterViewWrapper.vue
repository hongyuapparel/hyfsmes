<template>
  <router-view v-slot="{ Component, route }">
    <keep-alive v-if="shouldUseInnerKeepAlive(route)">
      <component :is="Component" :key="getInnerCacheKey(route)" />
    </keep-alive>
    <component v-else :is="Component" :key="getInnerCacheKey(route)" />
  </router-view>
</template>

<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'

function shouldUseInnerKeepAlive(r: RouteLocationNormalizedLoaded): boolean {
  return Boolean(r.matched[1]?.meta?.useInnerKeepAlive)
}

function getInnerCacheKey(r: RouteLocationNormalizedLoaded): string {
  // 子路由按完整路径缓存，支持同一页面多标签（如不同 id 的编辑页）并保留列表页状态。
  return r.fullPath
}
</script>
