import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch, type Ref } from 'vue'
import { syncCloneImagesFromSource, waitForPrintImages } from '@/utils/printImages'

const PRINT_ROOT_ID = 'packing-print-root'
const PAGE_STYLE_TEXT = '@page { size: A4 landscape; margin: 0; }'

export type PackingPrintBodyClass = 'printing-packing-label' | 'printing-packing-doc'

export function usePackingPrintRoot(options: {
  printAreaRef: Ref<HTMLElement | null>
  getVisible: () => boolean
  bodyClass: PackingPrintBodyClass
  /** 克隆挂载后回调（箱贴用于 fitLabelsToPage 量高缩放） */
  onRootPrepared?: (root: HTMLElement) => void
  /** 内容变更时（如 detail 更新）重新预加载图片 */
  getContentVersion?: () => unknown
}) {
  const printing = ref(false)
  let printRoot: HTMLElement | null = null
  let pageStyle: HTMLStyleElement | null = null
  let pageActive = true
  let preloadToken = 0

  function canManagePrint(): boolean {
    return pageActive && options.getVisible() && !!options.printAreaRef.value
  }

  function cleanupPrintArtifacts() {
    document.body.classList.remove(options.bodyClass)
    printRoot?.remove()
    printRoot = null
    pageStyle?.remove()
    pageStyle = null
    document.querySelectorAll(`#${PRINT_ROOT_ID}`).forEach((el) => el.remove())
  }

  function ensurePageStyle() {
    if (pageStyle) return
    pageStyle = document.createElement('style')
    pageStyle.textContent = PAGE_STYLE_TEXT
    document.head.appendChild(pageStyle)
  }

  function mountCloneRoot(source: HTMLElement): HTMLElement {
    cleanupPrintArtifacts()
    printRoot = document.createElement('div')
    printRoot.id = PRINT_ROOT_ID
    printRoot.appendChild(source.cloneNode(true))
    document.body.appendChild(printRoot)
    syncCloneImagesFromSource(source, printRoot)
    return printRoot
  }

  async function preparePrintRoot(applyBodyClass: boolean): Promise<void> {
    const source = options.printAreaRef.value
    if (!source) return
    const root = mountCloneRoot(source)
    await waitForPrintImages(root)
    ensurePageStyle()
    options.onRootPrepared?.(root)
    if (applyBodyClass) document.body.classList.add(options.bodyClass)
  }

  /** Ctrl+P：同步克隆最新 DOM（含 contenteditable 改动），依赖弹窗打开时的图片预加载 */
  function buildPrintRootSync(): void {
    const source = options.printAreaRef.value
    if (!source) return
    const root = mountCloneRoot(source)
    ensurePageStyle()
    options.onRootPrepared?.(root)
    document.body.classList.add(options.bodyClass)
  }

  async function preloadSourceImages(): Promise<void> {
    if (!canManagePrint()) return
    const token = ++preloadToken
    await nextTick()
    if (token !== preloadToken || !canManagePrint()) return
    await waitForPrintImages(options.printAreaRef.value)
  }

  function onBeforePrint() {
    if (!canManagePrint()) return
    if (printRoot?.isConnected) {
      document.body.classList.add(options.bodyClass)
      options.onRootPrepared?.(printRoot)
      return
    }
    buildPrintRootSync()
  }

  function onAfterPrint() {
    cleanupPrintArtifacts()
  }

  async function print() {
    if (printing.value || !options.printAreaRef.value) return
    printing.value = true
    try {
      await waitForPrintImages(options.printAreaRef.value)
      await preparePrintRoot(true)
      window.print()
    } finally {
      printing.value = false
    }
  }

  watch(
    () => options.getVisible(),
    (visible) => {
      preloadToken++
      if (!visible) {
        cleanupPrintArtifacts()
        return
      }
      void preloadSourceImages()
    },
  )

  if (options.getContentVersion) {
    watch(
      () => options.getContentVersion?.(),
      () => {
        if (!options.getVisible()) return
        preloadToken++
        void preloadSourceImages()
      },
    )
  }

  onMounted(() => {
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
  })

  onActivated(() => {
    pageActive = true
  })

  onDeactivated(() => {
    pageActive = false
    cleanupPrintArtifacts()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeprint', onBeforePrint)
    window.removeEventListener('afterprint', onAfterPrint)
    onAfterPrint()
  })

  return { printing, print }
}
