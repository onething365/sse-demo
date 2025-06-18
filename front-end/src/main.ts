import { createApp } from 'vue'
import './style.scss'
import App from './App.vue'
import { router } from './router/index'
import pinia from './store'

const app = createApp(App)
app.use(pinia).use(router)
app.mount('#app')
