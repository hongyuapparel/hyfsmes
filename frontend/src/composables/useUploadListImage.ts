import { reactive } from 'vue'
import {
  advanceListImagePhaseOnError,
  getListImageDisplaySrc,
  type ListImagePhase,
} from '@/utils/image'

/**
 * 全站共享：同一 URL 仅一套 thumb/full/placeholder 阶段，多组件/多表格单元格共用，避免重复请求与 onerror 死循环。
 */
const sharedPhases = reactive<Record<string, ListImagePhase>>({})

/**
 * 列表/弹窗小图：优先 small_，失败回退原图，再失败占位；阶段键按 resolve 后 URL 去重。
 */
export function useUploadListImage() {
  function src(raw: string | undefined) {
    return getListImageDisplaySrc(raw, sharedPhases)
  }

  function onError(raw: string | undefined) {
    advanceListImagePhaseOnError(raw, sharedPhases)
  }

  return { src, onError, phases: sharedPhases }
}
