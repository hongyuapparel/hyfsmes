import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import type { OrderFormPayload } from '@/api/orders'
import { uploadImage } from '@/api/uploads'
import { IMAGE_URL_DRAG_TYPE, isUploadImageFile } from '@/utils/image'

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
    const file = e.dataTransfer?.files?.[0]
    if (file && isUploadImageFile(file)) {
      void uploadOrderImageFile(file)
      return
    }
    // 附件区等站内图片拖入：直接复用已上传 URL
    const droppedUrl = (e.dataTransfer?.getData(IMAGE_URL_DRAG_TYPE) ?? '').trim()
    if (droppedUrl) form.imageUrl = droppedUrl
  }

  return {
    orderImageFileInputRef,
    triggerOrderImageUpload,
    onOrderImageFileChange,
    onOrderImageDrop,
  }
}
