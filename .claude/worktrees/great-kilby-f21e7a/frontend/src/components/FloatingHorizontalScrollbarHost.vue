<template>
  <Teleport to="body">
    <div
      v-show="state.visible"
      class="floating-horizontal-scrollbar-host"
      :style="hostStyle"
      @wheel="onHostWheel"
    >
      <div
        ref="trackRef"
        class="floating-horizontal-scrollbar-host__track"
        @scroll="onTrackScroll"
      >
        <div
          class="floating-horizontal-scrollbar-host__spacer"
          :style="{ width: `${state.contentWidth}px` }"
        />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import type { FloatingBarState } from '@/utils/floatingHorizontalScrollbar'
import {
  applyScrollLeftFromTrack,
  setFloatingHorizontalScrollbarHost,
  startFloatingHorizontalScrollbar,
  stopFloatingHorizontalScrollbar,
} from '@/utils/floatingHorizontalScrollbar'

const state = ref<FloatingBarState>({
  visible: false,
  contentWidth: 0,
  scrollLeft: 0,
  hostLeft: 0,
  hostTop: 0,
  hostWidth: 0,
})

const trackRef = ref<HTMLElement | null>(null)
let syncingFromTarget = false

const hostStyle = computed(() => ({
  left: `${state.value.hostLeft}px`,
  top: `${state.value.hostTop}px`,
  width: `${state.value.hostWidth}px`,
}))

function applyState(next: FloatingBarState) {
  state.value = { ...next }
  nextTick(() => {
    const el = trackRef.value
    if (!el || !next.visible) return
    const sl = next.scrollLeft
    if (Math.abs(el.scrollLeft - sl) > 0.5) {
      syncingFromTarget = true
      el.scrollLeft = sl
      queueMicrotask(() => {
        syncingFromTarget = false
      })
    }
  })
}

function onTrackScroll() {
  if (syncingFromTarget) return
  const el = trackRef.value
  if (!el) return
  applyScrollLeftFromTrack(el.scrollLeft)
}

function onHostWheel(e: WheelEvent) {
  const dx = e.deltaX !== 0 ? e.deltaX : e.shiftKey ? e.deltaY : 0
  if (dx === 0) return
  e.preventDefault()
  const el = trackRef.value
  if (!el) return
  el.scrollLeft += dx
  applyScrollLeftFromTrack(el.scrollLeft)
}

onMounted(() => {
  setFloatingHorizontalScrollbarHost({ setState: applyState })
  startFloatingHorizontalScrollbar()
})

onUnmounted(() => {
  setFloatingHorizontalScrollbarHost(null)
  stopFloatingHorizontalScrollbar()
})
</script>

<style scoped>
.floating-horizontal-scrollbar-host {
  position: fixed;
  z-index: 2000;
  height: var(--app-table-floating-x-track-height, 10px);
  box-sizing: border-box;
  pointer-events: auto;
}

.floating-horizontal-scrollbar-host__track {
  width: 100%;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--app-table-scrollbar-thumb) var(--app-table-scrollbar-track);
}

.floating-horizontal-scrollbar-host__track::-webkit-scrollbar {
  height: var(--app-table-scrollbar-size);
}

.floating-horizontal-scrollbar-host__track::-webkit-scrollbar-thumb {
  background-color: var(--app-table-scrollbar-thumb);
  border-radius: var(--app-table-scrollbar-radius);
}

.floating-horizontal-scrollbar-host__track::-webkit-scrollbar-thumb:hover {
  background-color: var(--app-table-scrollbar-thumb-hover);
}

.floating-horizontal-scrollbar-host__track::-webkit-scrollbar-track {
  background: var(--app-table-scrollbar-track);
}

.floating-horizontal-scrollbar-host__spacer {
  height: 1px;
}
</style>
