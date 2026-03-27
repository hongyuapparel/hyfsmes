<template>
  <!-- 与 MainLayout 内层 keep-alive 嵌套时易触发异常 patch 栈；缓存仅保留外层即可 -->
  <router-view />
</template>
