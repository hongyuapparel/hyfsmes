<template>
  <router-view v-slot="{ Component, route }">
    <keep-alive>
      <component :is="Component" :key="getInnerCacheKey(route)" />
    </keep-alive>
  </router-view>
</template>

<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'

function getInnerCacheKey(r: RouteLocationNormalizedLoaded): string {
  // 子路由按完整路径缓存，支持同一页面多标签（如不同 id 的编辑页）并保留列表页状态。
  return r.fullPath
}
</script>
