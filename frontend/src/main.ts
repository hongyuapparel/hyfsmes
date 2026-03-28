import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './styles/design-system.css'
import App from './App.vue'
import router from './router'
import AppImageThumb from './components/AppImageThumb.vue'

const app = createApp(App)
app.component('AppImageThumb', AppImageThumb)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.mount('#app')
