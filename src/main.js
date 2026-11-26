import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.min.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import '@fortawesome/fontawesome-free/css/all.min.css'
import 'tippy.js/dist/tippy.css'
import 'quill/dist/quill.snow.css'

// 如果需要繁體中文語系，也可以一併引入
import { MandarinTraditional } from 'flatpickr/dist/l10n/zh-tw.js'

createApp(App).mount('#app')
