import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.min.css'

// 如果需要繁體中文語系，也可以一併引入
import { MandarinTraditional } from 'flatpickr/dist/l10n/zh-tw.js'

createApp(App).mount('#app')
