import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import './styles/design-system.css'
import App from './App.vue'
import router from './router'
import AppImageThumb from './components/AppImageThumb.vue'
import AppDialog from './components/AppDialog.vue'

const app = createApp(App)
app.component('AppImageThumb', AppImageThumb)
app.component('AppDialog', AppDialog)
app.use(createPinia())
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
