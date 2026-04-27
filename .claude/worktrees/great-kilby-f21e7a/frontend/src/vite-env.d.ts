/// <reference types="vite/client" />

import 'axios'

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** 与 `api/request` 拦截器配合：跳过全局错误提示 */
    skipGlobalErrorHandler?: boolean
  }
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_UPLOAD_BASE_URL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
