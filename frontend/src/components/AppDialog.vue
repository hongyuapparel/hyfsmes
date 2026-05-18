<template>
  <el-dialog
    v-bind="$attrs"
    :close-on-click-modal="false"
    :draggable="true"
    class="app-dialog"
  >
    <template v-for="(_, name) in $slots" #[name]="slotData">
      <slot :name="name" v-bind="slotData ?? {}" />
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
defineOptions({ name: 'AppDialog', inheritAttrs: false })
</script>
