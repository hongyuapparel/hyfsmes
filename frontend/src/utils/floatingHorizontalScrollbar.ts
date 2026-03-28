/**
 * 全局「悬浮横向滚动条」：自动发现横向溢出的表格/滚动容器，
 * 在原生横向滚动条不在视口内时，在视口底部提供可操作的同步滚动条。
 * 不修改业务与接口，仅增强滚动体验。
 */

const DEBOUNCE_MS = 280
/** 与全站表格细滚动条高度同量级，用于判断原生横条是否在视口内 */
const NATIVE_SCROLLBAR_ESTIMATE = 10
const MAX_TREE_WALK = 9000
const OVERFLOW_EPS = 2
/** 与 design-system.css 中 --app-table-floating-x-track-height 一致 */
const FLOATING_BAR_HEIGHT = 10
const FLOATING_BAR_GAP = 4
/** 安全区宽度过小则不显示，避免条带贴边不可操作 */
const MIN_SAFE_HOST_WIDTH = 120
/** 表格在视口内可见带高度过小则不显示 */
const MIN_SAFE_BAND_HEIGHT = 24

/** 已知 Element Plus 表格主体滚动容器 */
const EP_TABLE_BODY = '.el-table__body-wrapper'
/** Element Plus Scrollbar 内部可滚区域 */
const EP_SCROLLBAR_WRAP = '.el-scrollbar__wrap'

export type FloatingHorizontalScrollbarHostApi = {
  /** 由宿主组件注册，供控制器更新 UI */
  setState: (state: FloatingBarState) => void
}

export type FloatingBarState = {
  visible: boolean
  /** 与目标 scrollWidth 一致，用于轨道内占位 */
  contentWidth: number
  scrollLeft: number
  /** position:fixed 下与视口对齐的宿主几何（来自表格锚区 ∩ 主内容区 ∩ 视口） */
  hostLeft: number
  hostTop: number
  hostWidth: number
}

let hostApi: FloatingHorizontalScrollbarHostApi | null = null

let debounceTimer: ReturnType<typeof setTimeout> | null = null
let rafId = 0
let mo: MutationObserver | null = null
let ro: ResizeObserver | null = null
let layoutMainRo: ResizeObserver | null = null
let activeTarget: HTMLElement | null = null
let onTargetScroll: (() => void) | null = null
let started = false

function scheduleScan(): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    tick()
  }, DEBOUNCE_MS)
}

function isDisplayed(el: HTMLElement): boolean {
  if (!el.isConnected) return false
  const r = el.getBoundingClientRect()
  if (r.width === 0 && r.height === 0) {
    const st = getComputedStyle(el)
    if (st.display === 'none' || st.visibility === 'hidden') return false
  }
  return true
}

function hasHorizontalOverflow(el: HTMLElement): boolean {
  return el.scrollWidth > el.clientWidth + OVERFLOW_EPS
}

function overflowXScrollable(el: HTMLElement): boolean {
  const ox = getComputedStyle(el).overflowX
  return ox === 'auto' || ox === 'scroll'
}

/** 弹窗/抽屉内表格暂不挂悬浮条（避免 z-index 与 Teleport 结构冲突）；用户仍可用容器内原生滚动 */
function isInsideOverlayOrDrawer(el: HTMLElement): boolean {
  return !!el.closest('.el-overlay, .el-drawer__container, .el-dialog__wrapper')
}

function isFloatingHostElement(el: HTMLElement): boolean {
  return !!el.closest('.floating-x-scroll-host')
}

function collectKnownSelectors(root: HTMLElement): HTMLElement[] {
  const set = new Set<HTMLElement>()
  root.querySelectorAll<HTMLElement>(EP_TABLE_BODY).forEach((n) => set.add(n))
  root.querySelectorAll<HTMLElement>(EP_SCROLLBAR_WRAP).forEach((n) => set.add(n))
  return [...set]
}

function collectOverflowWalk(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = []
  let count = 0
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let n = w.nextNode() as HTMLElement | null
  while (n && count < MAX_TREE_WALK) {
    count++
    if (!(n instanceof HTMLElement)) {
      n = w.nextNode() as HTMLElement | null
      continue
    }
    if (!isDisplayed(n) || isFloatingHostElement(n) || isInsideOverlayOrDrawer(n)) {
      n = w.nextNode() as HTMLElement | null
      continue
    }
    if (hasHorizontalOverflow(n) && overflowXScrollable(n) && n.clientWidth >= 120) {
      out.push(n)
    }
    n = w.nextNode() as HTMLElement | null
  }
  return out
}

/** 同一滚动链只保留最内层候选，减少重复（如外层 page 与内层 table body 同时 overflow） */
function filterInnermost(candidates: HTMLElement[]): HTMLElement[] {
  return candidates.filter((el) => !candidates.some((o) => o !== el && el.contains(o)))
}

function nativeHorizontalScrollbarFullyInViewport(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  const barTop = r.bottom - NATIVE_SCROLLBAR_ESTIMATE
  const barBottom = r.bottom
  const vh = window.innerHeight
  // 认为「原生横向条在可视区内」：滚动条所在条带完全落在视口内
  return barTop >= 0 && barBottom <= vh && r.left < window.innerWidth && r.right > 0
}

function intersectsViewport(el: HTMLElement): boolean {
  const r = el.getBoundingClientRect()
  return r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth
}

function visibleIntersectionScore(el: HTMLElement): number {
  const r = el.getBoundingClientRect()
  const iw = window.innerWidth
  const ih = window.innerHeight
  const x1 = Math.max(0, r.left)
  const y1 = Math.max(0, r.top)
  const x2 = Math.min(iw, r.right)
  const y2 = Math.min(ih, r.bottom)
  const w = Math.max(0, x2 - x1)
  const h = Math.max(0, y2 - y1)
  return w * h
}

function pickBestTarget(candidates: HTMLElement[]): HTMLElement | null {
  let best: HTMLElement | null = null
  let bestScore = -1
  for (const el of candidates) {
    if (!isDisplayed(el) || !hasHorizontalOverflow(el) || !overflowXScrollable(el)) continue
    if (isInsideOverlayOrDrawer(el)) continue
    if (!intersectsViewport(el)) continue
    if (nativeHorizontalScrollbarFullyInViewport(el)) continue
    const score = visibleIntersectionScore(el)
    if (score > bestScore) {
      bestScore = score
      best = el
    }
  }
  return best
}

function intersectRects(a: DOMRectReadOnly, b: DOMRectReadOnly): DOMRect | null {
  const left = Math.max(a.left, b.left)
  const top = Math.max(a.top, b.top)
  const right = Math.min(a.right, b.right)
  const bottom = Math.min(a.bottom, b.bottom)
  const width = right - left
  const height = bottom - top
  if (width <= 0 || height <= 0) return null
  return new DOMRect(left, top, width, height)
}

/** 主内容区（不含左侧侧栏），用于与表格可视区求交，避免悬浮条进入菜单区 */
function getMainContentRect(): DOMRectReadOnly {
  const lm = document.querySelector('.layout-main') as HTMLElement | null
  if (lm && isDisplayed(lm)) return lm.getBoundingClientRect()
  const cw = document.querySelector('.content-wrapper') as HTMLElement | null
  if (cw && isDisplayed(cw)) return cw.getBoundingClientRect()
  const app = document.getElementById('app')
  if (app && isDisplayed(app)) return app.getBoundingClientRect()
  return new DOMRect(0, 0, window.innerWidth, window.innerHeight)
}

/** 视觉锚点：优先整表根节点，否则用实际滚动容器 */
function getTableAnchorElement(scrollEl: HTMLElement): HTMLElement {
  return scrollEl.closest('.el-table') ?? scrollEl
}

/**
 * 悬浮条几何：表格锚区 ∩ 主内容区 ∩ 视口，条贴在可见带下沿附近（fixed 坐标）。
 * 交集过窄/过矮或条带移出视口则返回 null。
 */
function computeFloatingHostLayout(scrollEl: HTMLElement): {
  hostLeft: number
  hostTop: number
  hostWidth: number
} | null {
  const anchor = getTableAnchorElement(scrollEl)
  const tableRect = anchor.getBoundingClientRect()
  const mainRect = getMainContentRect()
  const viewport = new DOMRect(0, 0, window.innerWidth, window.innerHeight)

  const clipMain = intersectRects(tableRect, mainRect)
  if (!clipMain) return null
  const clipAll = intersectRects(clipMain, viewport)
  if (!clipAll) return null

  if (clipAll.width < MIN_SAFE_HOST_WIDTH || clipAll.height < MIN_SAFE_BAND_HEIGHT) return null

  const hostWidth = clipAll.width
  const hostLeft = clipAll.left
  const hostTop = clipAll.bottom - FLOATING_BAR_HEIGHT - FLOATING_BAR_GAP

  if (hostTop < 0) return null
  if (hostTop + FLOATING_BAR_HEIGHT > window.innerHeight) return null

  return { hostLeft, hostTop, hostWidth }
}

function mergeCandidates(root: HTMLElement): HTMLElement[] {
  const a = collectKnownSelectors(root)
  const b = collectOverflowWalk(root)
  const map = new Map<HTMLElement, true>()
  ;[...a, ...b].forEach((el) => {
    if (isDisplayed(el) && !isFloatingHostElement(el)) map.set(el, true)
  })
  return filterInnermost([...map.keys()])
}

function detachActiveTarget(): void {
  if (activeTarget && onTargetScroll) {
    activeTarget.removeEventListener('scroll', onTargetScroll, { passive: true } as AddEventListenerOptions)
  }
  activeTarget = null
  onTargetScroll = null
  if (ro) {
    ro.disconnect()
    ro = null
  }
}

function attachTarget(el: HTMLElement): void {
  detachActiveTarget()
  activeTarget = el
  onTargetScroll = () => {
    pushStateFromTarget()
  }
  el.addEventListener('scroll', onTargetScroll, { passive: true })
  if (typeof ResizeObserver !== 'undefined') {
    if (ro) ro.disconnect()
    ro = new ResizeObserver(() => scheduleScan())
    ro.observe(el)
  }
}

function pushStateFromTarget(): void {
  if (!hostApi) return
  if (!activeTarget) {
    hostApi.setState({
      visible: false,
      contentWidth: 0,
      scrollLeft: 0,
      hostLeft: 0,
      hostTop: 0,
      hostWidth: 0,
    })
    return
  }
  const el = activeTarget
  const contentWidth = el.scrollWidth
  const baseVisible =
    hasHorizontalOverflow(el) &&
    intersectsViewport(el) &&
    !nativeHorizontalScrollbarFullyInViewport(el) &&
    !isInsideOverlayOrDrawer(el)
  const layout = baseVisible ? computeFloatingHostLayout(el) : null
  hostApi.setState({
    visible: baseVisible && !!layout,
    contentWidth,
    scrollLeft: el.scrollLeft,
    hostLeft: layout?.hostLeft ?? 0,
    hostTop: layout?.hostTop ?? 0,
    hostWidth: layout?.hostWidth ?? 0,
  })
}

function tick(): void {
  if (!hostApi || !started) return
  const app = document.getElementById('app')
  if (!app) return
  const candidates = mergeCandidates(app)
  const next = pickBestTarget(candidates)
  if (next !== activeTarget) {
    if (next) attachTarget(next)
    else detachActiveTarget()
  }
  pushStateFromTarget()
}

function requestTick(): void {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    rafId = 0
    tick()
  })
}

export function setFloatingHorizontalScrollbarHost(api: FloatingHorizontalScrollbarHostApi | null): void {
  hostApi = api
  if (api && started) requestTick()
}

export function applyScrollLeftFromTrack(scrollLeft: number): void {
  if (!activeTarget) return
  activeTarget.scrollLeft = scrollLeft
}

/** 路由切换或外部需要立即重算时调用 */
export function requestFloatingHorizontalScrollbarUpdate(): void {
  scheduleScan()
}

export function startFloatingHorizontalScrollbar(): void {
  if (started) return
  started = true
  const app = document.getElementById('app')
  if (!app) return

  mo = new MutationObserver(() => scheduleScan())
  mo.observe(app, { childList: true, subtree: true })

  const layoutMain = document.querySelector('.layout-main') as HTMLElement | null
  if (layoutMain && typeof ResizeObserver !== 'undefined') {
    layoutMainRo = new ResizeObserver(() => scheduleScan())
    layoutMainRo.observe(layoutMain)
  }

  window.addEventListener('scroll', requestTick, { passive: true, capture: true })
  window.addEventListener('resize', scheduleScan, { passive: true })

  scheduleScan()
}

export function stopFloatingHorizontalScrollbar(): void {
  if (!started) return
  started = false
  mo?.disconnect()
  mo = null
  layoutMainRo?.disconnect()
  layoutMainRo = null
  window.removeEventListener('scroll', requestTick, { capture: true } as AddEventListenerOptions)
  window.removeEventListener('resize', scheduleScan)
  detachActiveTarget()
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
}
