import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url' // <--- 確保有這行
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base: '/bearbaking/', // 記得改成您在 GitHub 上的 Repo 名稱（前後都要有斜線）
  resolve: {
      alias: {
          // 讓 @ 符號正確指向 src 資料夾
          '@': fileURLToPath(new URL('./src', import.meta.url))
      }
  },
  build: {
      rollupOptions: {
          input: {
                index: resolve(import.meta.dirname, 'index.html'),
                main: resolve(import.meta.dirname, 'manager.html'),
                order: resolve(import.meta.dirname, 'order.html')
          }
          // output: {
          //     manualChunks(id) {
          //         if (id.includes('node_modules')) {
          //             if (id.includes('@fullcalendar')) return 'fullcalendar'
          //             if (id.includes('swiper')) return 'swiper'
          //             return 'vendor'
          //         }
          //     }
          // }
      }
  }
})
