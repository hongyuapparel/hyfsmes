import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import type { OrderFormPayload } from '@/api/orders'
import { uploadImage } from '@/api/uploads'

export function useOrderImageUpload(form: OrderFormPayload) {
  const orderImageFileInputRef = ref<HTMLInputElement | null>(null)

  function triggerOrderImageUpload() {
    orderImageFileInputRef.value?.click()
  }

  async function onOrderImageFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
      const url = await uploadImage(file)
      form.imageUrl = url
    } catch (err: unknown) {
      if (!isErrorHandled(err)) ElMessage.error(getErrorMessage(err))
    }
  }

  return {
    orderImageFileInputRef,
    triggerOrderImageUpload,
    onOrderImageFileChange,
  }
}
