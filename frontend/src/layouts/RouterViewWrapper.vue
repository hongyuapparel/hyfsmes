<template>
  <router-view v-slot="{ Component, route }">
    <keep-alive>
      <component :is="Component" :key="getNestedRouteCacheKey(route)" />
    </keep-alive>
  </router-view>
</template>

<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router'

function getNestedRouteCacheKey(r: RouteLocationNormalizedLoaded): string {
  const tabKey = typeof r.query?.tabKey === 'string' ? r.query.tabKey.trim() : ''
  return tabKey || r.path
}
</script>
