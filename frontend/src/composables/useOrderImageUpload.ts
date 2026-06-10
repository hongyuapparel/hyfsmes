import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import type { OrderFormPayload } from '@/api/orders'
import { uploadImage } from '@/api/uploads'
import { IMAGE_URL_DRAG_TYPE, isUploadImageFile } from '@/utils/image'
import { consumeImageUrlDrop } from '@/composables/useImageUrlDragSingleton'

export function useOrderImageUpload(form: OrderFormPayload) {
  const orderImageFileInputRef = ref<HTMLInputElement | null>(null)

  function triggerOrderImageUpload() {
    orderImageFileInputRef.value?.click()
  }

  async function uploadOrderImageFile(file: File) {
    try {
      const url = await uploadImage(file)
      form.imageUrl = url
    } catch (err: unknown) {
      if (!isErrorHandled(err)) ElMessage.error(getErrorMessage(err))
    }
  }

  async function onOrderImageFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    await uploadOrderImageFile(file)
  }

  function onOrderImageDrop(e: DragEvent) {
    // 附件区等站内图片拖入：直接复用已上传 URL。
    // 必须先于 files 判断：浏览器拖动页面内 <img> 时 files 里会自带一份图片文件，否则会被重复上传
    const droppedUrl = (e.dataTransfer?.getData(IMAGE_URL_DRAG_TYPE) ?? '').trim()
    if (droppedUrl) {
      form.imageUrl = droppedUrl
      consumeImageUrlDrop(droppedUrl)
      return
    }
    const file = e.dataTransfer?.files?.[0]
    if (file && isUploadImageFile(file)) void uploadOrderImageFile(file)
  }

  return {
    orderImageFileInputRef,
    triggerOrderImageUpload,
    onOrderImageFileChange,
    onOrderImageDrop,
  }
}
