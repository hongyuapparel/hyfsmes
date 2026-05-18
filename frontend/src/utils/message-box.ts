import { ElMessageBox } from 'element-plus'
import type { ElMessageBoxOptions } from 'element-plus'

const DEFAULTS: Partial<ElMessageBoxOptions> = {
  closeOnClickModal: false,
  closeOnPressEscape: true,
}

export function appConfirm(message: string, title?: string, options?: ElMessageBoxOptions) {
  return ElMessageBox.confirm(message, title, { ...DEFAULTS, ...options })
}

export function appAlert(message: string, title?: string, options?: ElMessageBoxOptions) {
  return ElMessageBox.alert(message, title, { ...DEFAULTS, ...options })
}

export function appPrompt(message: string, title?: string, options?: ElMessageBoxOptions) {
  return ElMessageBox.prompt(message, title, { ...DEFAULTS, ...options })
}
