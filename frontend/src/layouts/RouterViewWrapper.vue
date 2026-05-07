<template>
  <router-view v-slot="{ Component, route }">
    <keep-alive :max="INNER_ROUTE_CACHE_MAX">
      <component :is="Component" :key="getInnerRouteCacheKey(route)" />
    </keep-alive>
  </router-view>
</template>

<script setup lang="ts">
import { INNER_ROUTE_CACHE_MAX, getInnerRouteCacheKey } from '@/composables/useRouteCacheControl'
</script>
