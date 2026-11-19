<template>
    <div id="app" class="app-container">
        <!-- 載入中遮罩 (Mask) -->
        <div v-if="globalMask" class="global-mask">
            <div class="spinner"></div>
            <p>載入中...</p>
        </div>

        <!-- 頂部導覽列或歡迎詞 (可選) -->
        <header v-if="userName" class="app-header">
            <span class="welcome-text">歡迎, <b>{{ userName }}</b></span>
        </header>

        <!-- 主畫面元件：等身分準備完成後再掛載並傳入 userId -->
        <main class="app-content">
            <ItemTable v-if="liffReady" :user-id="userId" />
        </main>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import ItemTable from './components/ItemTable.vue'

const globalMask = ref(false)
const userName = ref('')
const userId = ref('')
const liffReady = ref(false)

// 檢查 LocalStorage 快取的驗證函式 (對應您原本的邏輯)
const isUserAuthenticated = (uid) => {
    const authTime = localStorage.getItem(`auth_${uid}`)
    if (!authTime) return false
    // 範例：快取 24 小時有效
    const now = new Date().getTime()
    return (now - Number(authTime)) < 24 * 60 * 60 * 1000
}

const authUser = async (uid) => {
    // 這裡可串接您的後端驗證 API
    localStorage.setItem(`auth_${uid}`, new Date().getTime().toString())
}

const isLocalhost = () => {
    const hostname = window.location.hostname
    return (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '[::1]'
    )
}

onMounted(async () => {
    try {
        globalMask.value = true

        // 先檢查網址參數或 cached_userId 作為備援
        const urlParams = new URLSearchParams(window.location.search)
        const fallbackUserId =
            urlParams.get('userId') ||
            localStorage.getItem('cached_userId') ||
            ''

        // 1. 初始化 LIFF (請替換為您的 LIFF ID)
        if (window.liff && !isLocalhost()) {
            await window.liff.init({ liffId: '2007457926-6GlfMVC3' })

            if (!window.liff.isLoggedIn()) {
                window.liff.login()
                return
            }

            // 2. 取得使用者 Profile 與 Token
            const profile = await window.liff.getProfile()

            // 3. 同步更新響應式狀態、localStorage 與全域 window 變數
            userId.value = profile.userId
            userName.value = profile.displayName
            window.userId = profile.userId
            window.userName = profile.displayName
            localStorage.setItem('cached_userId', profile.userId)

            // 4. LocalStorage 快取驗證與資料載入
            if (!isUserAuthenticated(profile.userId)) {
                await authUser(profile.userId)
            }
        } else {
            console.warn('LIFF SDK 未載入或處於本機開發環境，使用測試/快取身分')
            const devUserId = fallbackUserId || 'TEST'
            userId.value = devUserId
            userName.value = '測試管理員'
            window.userId = devUserId
            window.userName = '測試管理員'
            localStorage.setItem('cached_userId', devUserId)
        }
    } catch (err) {
        console.error('LIFF 初始化失敗:', err)
        const urlParams = new URLSearchParams(window.location.search)
        const fallbackUserId =
            urlParams.get('userId') ||
            localStorage.getItem('cached_userId') ||
            ''
        if (fallbackUserId) {
            userId.value = fallbackUserId
            window.userId = fallbackUserId
        }
    } finally {
        globalMask.value = false
        liffReady.value = true
    }
})
</script>

<style>
/* 全域 App 樣式 */
body {
    margin: 0;
    padding: 0;
    background-color: #f8fafc;
    font-family: system-ui, -apple-system, sans-serif;
}

.app-container {
    max-width: 600px;
    margin: 0 auto;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

.app-header {
    background: #ffffff;
    padding: 10px 16px;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    align-items: center;
}

.welcome-text {
    font-size: 0.85rem;
    color: #475569;
}

.app-content {
    flex: 1;
}

/* 全域遮罩樣式 */
.global-mask {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 255, 255, 0.8);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    color: #475569;
    font-size: 0.9rem;
}

.spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #cbd5e1;
    border-top-color: #2563eb;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 8px;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>