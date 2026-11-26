<template>
    <div class="customer-order-page">
        <!-- 載入遮罩 -->
        <div v-if="loading" class="loading-mask">
            <div class="spinner"></div>
        </div>

        <template v-if="expiredOrMissing">
            <h2 class="page-title"></h2>
            <div class="empty-msg">查無該品項或已到期關閉</div>
        </template>

        <template v-else>
            <h2 class="page-title">{{ itemName || 'Loading...' }}</h2>

            <div v-if="cart.length === 0 && !loading" class="empty-msg">
                載入中...
            </div>

            <ul v-else class="cart-list">
                <li v-for="(item, index) in cart" :key="`${item.flavor || 'single'}-${index}`" class="cart-card">
                    <div class="item-row">
                        <!-- 左側圖片輪播 -->
                        <div v-if="getImgList(item.imgs).length > 0" class="img-box">
                            <div :ref="(el) => setSwiperRef(el, index)" class="swiper">
                                <div class="swiper-wrapper">
                                    <div
                                        v-for="(imgName, imgIdx) in getImgList(item.imgs)"
                                        :key="imgIdx"
                                        class="swiper-slide"
                                    >
                                        <img
                                            :src="`${CLOUDINARY_BASE_URL}${imgName}`"
                                            :alt="`${item.flavor || itemName} ${imgIdx + 1}`"
                                        />
                                        <template v-if="Number(item.num) !== 0">
                                            <div v-if="Number(item.remain) === 0" class="slide-caption">已售完</div>
                                            <div v-else class="slide-caption">剩餘 {{ item.remain }}個</div>
                                        </template>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 中間口味與庫存 -->
                        <div class="flavors-col">
                            <span class="flavor-name">{{ item.flavor }}</span>
                            <span
                                v-if="getImgList(item.imgs).length === 0 && Number(item.num) !== 0"
                                class="stock-text"
                            >
                                {{ Number(item.remain) === 0 ? '已售完' : `剩餘 ${item.remain} 個` }}
                            </span>
                        </div>

                        <!-- 右側價格與數量控制 -->
                        <div class="controls-col">
                            <span class="price-text">${{ item.price }}</span>
                            <div class="controls-row">
                                <button
                                    type="button"
                                    class="qty-btn"
                                    :disabled="isItemSoldOut(item) || quantities[index] <= 0"
                                    @click="changeQty(index, -1)"
                                    aria-label="減少數量"
                                >
                                    <i class="fas fa-minus"></i>
                                </button>

                                <input
                                    type="number"
                                    min="0"
                                    :max="hasLimit(item) ? Number(item.remain) : undefined"
                                    :disabled="isItemSoldOut(item)"
                                    :value="quantities[index]"
                                    class="qty-input"
                                    @input="onQtyInput(index, item, $event)"
                                />

                                <button
                                    type="button"
                                    class="qty-btn"
                                    :disabled="isItemSoldOut(item) || isReachedMax(index, item)"
                                    @click="changeQty(index, 1)"
                                    aria-label="增加數量"
                                >
                                    <i class="fas fa-plus"></i>
                                </button>
                            </div>

                            <div v-if="hasLimit(item) && isReachedMax(index, item)" class="limit-msg">
                                已達數量上限
                            </div>
                        </div>
                    </div>
                </li>
            </ul>

            <div v-if="cart.length > 0" class="total-bar">
                總金額 <span class="total-amount">{{ totalAmount }}</span> 元
            </div>

            <button
                v-if="cart.length > 0"
                type="button"
                class="submit-btn"
                :disabled="!liffReady || submitting"
                @click="submitCart"
            >
                {{ submitting ? '送出中...' : '✅ 確認送出' }}
            </button>
        </template>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Swal from 'sweetalert2'
import Swiper from 'swiper'
import { Autoplay } from 'swiper/modules'
import 'swiper/css'

const LIFF_ID = '2007457926-DVgm8yJO'
const GAS_URL = 'https://script.google.com/macros/s/AKfycby9FDii0ihOn_GKNOtxyxOo1bTvOaEt6X8OEu82dahqYvJUJ0t-mLQ3zUAp1n8onj8bFQ/exec'
const CLOUDINARY_BASE_URL = 'https://res.cloudinary.com/dwavqm0sh/image/upload/'

const params = new URLSearchParams(window.location.search)
const itemName = ref((params.get('name') || '').trim())

const userId = ref('')
const userName = ref('')
const liffReady = ref(false)
const loading = ref(false)
const submitting = ref(false)
const expiredOrMissing = ref(false)

const cart = ref([])
const quantities = ref([])

const swiperElMap = new Map()
let swiperInstances = []

const setSwiperRef = (el, index) => {
    if (el) {
        swiperElMap.set(index, el)
    } else {
        swiperElMap.delete(index)
    }
}

const destroySwipers = () => {
    swiperInstances.forEach((inst) => {
        if (inst && typeof inst.destroy === 'function') {
            inst.destroy(true, true)
        }
    })
    swiperInstances = []
}

const initSwipers = async () => {
    destroySwipers()
    await nextTick()
    swiperElMap.forEach((el) => {
        if (el) {
            const inst = new Swiper(el, {
                modules: [Autoplay],
                autoplay: {
                    delay: 3000,
                    disableOnInteraction: false
                },
                loop: true
            })
            swiperInstances.push(inst)
        }
    })
}

const getImgList = (imgs) => {
    if (!imgs || String(imgs).trim() === '') return []
    return String(imgs)
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
}

const hasLimit = (item) => Number(item?.num) !== 0
const isItemSoldOut = (item) => hasLimit(item) && Number(item?.remain) === 0
const isReachedMax = (index, item) => {
    if (!hasLimit(item)) return false
    return Number(quantities.value[index] || 0) >= Number(item.remain || 0)
}

const clampQty = (index, rawVal) => {
    const item = cart.value[index]
    let num = parseInt(rawVal, 10)
    if (isNaN(num) || num < 0) num = 0
    if (item && hasLimit(item)) {
        const max = Number(item.remain) || 0
        if (num > max) num = max
    }
    quantities.value[index] = num
}

const changeQty = (index, delta) => {
    const cur = Number(quantities.value[index] || 0)
    clampQty(index, cur + delta)
}

const onQtyInput = (index, item, event) => {
    let val = parseInt(event.target.value, 10)
    if (isNaN(val) || val < 0) val = 0
    if (hasLimit(item)) {
        const max = Number(item.remain) || 0
        if (val > max) val = max
    }
    event.target.value = String(val)
    quantities.value[index] = val
}

const totalAmount = computed(() => {
    return cart.value.reduce((sum, item, idx) => {
        return sum + (Number(item.price) || 0) * (Number(quantities.value[idx]) || 0)
    }, 0)
})

const buildOrderSummaryHtml = () => {
    let html = '<table style="width:100%; text-align:left;"><tr><th>品項</th><th>數量</th><th>小計</th></tr>'
    let total = 0

    cart.value.forEach((item, index) => {
        const qty = Number(quantities.value[index]) || 0
        if (qty > 0) {
            const subtotal = (Number(item.price) || 0) * qty
            total += subtotal
            const label =
                item.flavor && item.flavor !== itemName.value
                    ? `${itemName.value} - ${item.flavor}`
                    : itemName.value
            html += `<tr><td>${label}</td><td>${qty}</td><td>$${subtotal}</td></tr>`
        }
    })

    html += `</table><hr><strong>總金額：$${total}</strong>`
    return html
}

const fetchCart = async () => {
    if (!itemName.value) return
    loading.value = true
    expiredOrMissing.value = false
    try {
        const url = `${GAS_URL}?name=${encodeURIComponent(itemName.value)}`
        const res = await fetch(url)
        const data = await res.json()

        if (Array.isArray(data) && data[0] && typeof data[0].status !== 'undefined') {
            expiredOrMissing.value = true
            cart.value = []
            await Swal.fire({
                icon: 'warning',
                title: '查無該品項',
                text: '該品項已到期或已提前關閉！',
                confirmButtonText: '知道了'
            })
            return
        }

        cart.value = Array.isArray(data) ? data : []
        quantities.value = cart.value.map(() => 0)
        await initSwipers()
    } catch (err) {
        console.error('無法取得 cart 資料:', err)
        await Swal.fire({
            icon: 'error',
            title: '載入失敗',
            text: '無法取得購物車品項，請稍後再試'
        })
    } finally {
        loading.value = false
    }
}

const initLiff = async () => {
    if (!itemName.value) {
        console.warn('缺少 name 參數，無法載入團購品項')
        return
    }

    const liff = window.liff
    if (!liff) {
        // 本機或無 LIFF SDK 測試備援
        userId.value = params.get('userId') || localStorage.getItem('cached_userId') || 'test_buyer'
        userName.value = params.get('userName') || '測試買家'
        liffReady.value = true
        await fetchCart()
        return
    }

    try {
        await liff.init({ liffId: LIFF_ID })
        if (!liff.isLoggedIn()) {
            const redirectUri = `${window.location.origin}${window.location.pathname}?name=${encodeURIComponent(itemName.value)}`
            liff.login({
                redirectUri,
                state: itemName.value
            })
            return
        }

        const profile = await liff.getProfile()
        userId.value = profile.userId
        userName.value = profile.displayName
        liffReady.value = true
        await fetchCart()
    } catch (err) {
        console.error('LIFF 初始化失敗:', err)
        await Swal.fire({
            icon: 'error',
            title: 'LINE 登入失敗',
            text: '請重新開啟連結再試一次'
        })
    }
}

const submitCart = async () => {
    if (!userId.value) {
        await Swal.fire({
            icon: 'warning',
            title: '尚未取得使用者身分',
            text: '請確認已登入 LINE 後再送出'
        })
        return
    }

    const allZero = quantities.value.every((q) => !Number(q) || Number(q) <= 0)
    if (allZero) {
        await Swal.fire({
            icon: 'warning',
            title: '無法送出',
            text: '請至少選擇一項數量再送出！',
            confirmButtonText: '知道了'
        })
        return
    }

    submitting.value = true
    loading.value = true

    try {
        const orderPayload = {
            orders: cart.value.map((item, idx) => ({
                flavor: item.flavor,
                qty: Number(quantities.value[idx]) || 0
            })),
            name: userName.value,
            id: userId.value,
            item: itemName.value
        }

        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify(orderPayload)
        })
        const result = await response.json()

        if (result && result[0] && result[0].status === 'success') {
            const summaryHtml = buildOrderSummaryHtml()
            await Swal.fire({
                title: '訂單明細',
                html: summaryHtml,
                icon: 'success',
                footer: '<small>如有其他任何問題，可詢問熊幸福小小烘焙哦~</small>'
            })

            quantities.value = cart.value.map(() => 0)
            await fetchCart()
        } else {
            await Swal.fire({
                title: '訂購失敗',
                html: result?.[0]?.alert || '送出失敗，請稍後再試',
                icon: 'error',
                footer: '<small>如有其他任何問題，可詢問熊幸福小小烘焙哦~</small>'
            })
        }
    } catch (err) {
        console.error('送出訂單錯誤:', err)
        await Swal.fire({
            title: '系統異常',
            icon: 'error'
        })
    } finally {
        submitting.value = false
        loading.value = false
    }
}

onMounted(() => {
    initLiff()
})

onBeforeUnmount(() => {
    destroySwipers()
})
</script>

<style scoped>
.customer-order-page {
    font-family: Arial, sans-serif;
    margin: 0 auto;
    max-width: 600px;
    padding: 1em;
    background-color: #f9f9f9;
    font-size: 20px;
    min-height: 100vh;
    box-sizing: border-box;
}

.page-title {
    text-align: center;
    font-size: 28px;
    margin: 0 0 1em 0;
}

.empty-msg {
    text-align: center;
    color: #64748b;
    padding: 24px 12px;
}

.cart-list {
    list-style: none;
    padding: 0;
    margin: 0;
    text-align: center;
}

.cart-card {
    background: #ffffff;
    padding: 1em;
    margin-bottom: 1em;
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    font-size: 24px;
}

.img-box {
    width: 70px;
    height: 70px;
    border-radius: 8px;
    overflow: hidden;
    flex-shrink: 0;
}

.swiper {
    width: 70px;
    height: 70px;
}

.swiper-slide {
    position: relative;
    width: 100%;
    height: 100%;
}

.swiper-slide img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.slide-caption {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    padding: 4px 6px;
    background: rgba(0, 0, 0, 0.55);
    color: #ffffff;
    font-size: 11px;
    box-sizing: border-box;
    text-align: center;
}

.flavors-col {
    display: flex;
    flex-direction: column;
    flex: 1;
    text-align: center;
    min-width: 0;
}

.flavor-name {
    word-break: break-word;
}

.stock-text {
    font-size: 0.7em;
    color: #888888;
    margin-top: 4px;
}

.controls-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
}

.price-text {
    font-weight: bold;
    color: #dc2626;
    min-width: 70px;
    text-align: center;
    font-size: 20px;
}

.controls-row {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
}

.qty-btn {
    font-size: 24px;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    border: none;
    background-color: #e0e0e0;
    color: #111827;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
}

.qty-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.qty-input {
    width: 58px;
    text-align: center;
    font-size: 22px;
    padding: 0.2em;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
}

.limit-msg {
    color: #dc2626;
    font-size: 14px;
    margin-top: 4px;
}

.total-bar {
    margin: 16px 0;
    font-size: 20px;
    font-weight: bold;
    text-align: right;
    color: #dc2626;
}

.submit-btn {
    display: block;
    width: 100%;
    padding: 0.9em;
    font-size: 22px;
    font-weight: bold;
    background-color: #06c755;
    color: #ffffff;
    border: none;
    border-radius: 12px;
    margin-top: 1em;
    cursor: pointer;
}

.submit-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.loading-mask {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
}

.spinner {
    width: 56px;
    height: 56px;
    border: 6px solid #f3f3f3;
    border-top: 6px solid #ffffff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
</style>