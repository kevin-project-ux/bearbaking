<template>
    <div class="modern-dashboard">
        <!-- 頂部操作列：新增團購品項與重新整理 -->
        <div class="dashboard-top-bar">
            <button class="btn-primary-action" @click="openAddItemModal">
                ＋ 新增團購項目
            </button>
            <button class="btn-refresh" @click="loadData" :disabled="loading">
                {{ loading ? '更新中...' : '重新整理' }}
            </button>
        </div>

        <!-- 載入中狀態 -->
        <div v-if="loading && items.length === 0" class="loading-state">
            <p>正在載入資料...</p>
        </div>

        <!-- 緊湊卡片列表 (固定 5 筆一頁) -->
        <div v-else class="card-list">
            <div v-if="paginatedItems.length === 0" class="empty-state">
                <p>目前沒有符合條件的品項</p>
            </div>

            <div v-for="row in paginatedItems" :key="row.ID" class="item-card-compact">
                <!-- 第一行：左側狀態，右側金額總計/追加金額 -->
                <div class="card-line-top">
                    <span :class="['status-pill', getStatusClass(row.狀態)]">
                        {{ row.狀態 }}
                    </span>
                    
                    <div class="amount-display">
                        <span v-if="Number(row.追加金額總計) > 0" class="addition-highlight" title="追加金額總計">
                            追加: ${{ Number(row.追加金額總計).toLocaleString() }}
                        </span>
                        <span v-if="Number(row.訂單金額總計) > 0" class="total-highlight" title="訂單金額總計">
                            總計: ${{ Number(row.訂單金額總計).toLocaleString() }}
                        </span>
                    </div>
                </div>

                <!-- 第二行：品項名稱獨佔一行 -->
                <div class="card-line-title">
                    <h3 class="item-title">{{ row.名稱 }}</h3>
                </div>

                <!-- 第三行：單一口味與多口味的智慧判斷 -->
                <div class="card-line-info">
                    <!-- 單一口味 -->
                    <div class="single-item-info" v-if="getValidFlavors(row.ID).length === 0">
                        <span class="price-single" v-if="row.售價">
                            售價: ${{ row.售價 }}
                        </span>
                        <span v-if="getSingleItemLimit(row.ID)" class="limit-badge">
                            限量: {{ getSingleItemLimit(row.ID) }}
                        </span>
                        <span v-if="row.限時開始 || row.限時結束" class="time-badge">
                            限時: {{ row.限時開始 }} ~ {{ row.限時結束 }}
                        </span>
                    </div>

                    <!-- 多口味 -->
                    <div class="flavor-inline-list" v-else>
                        <span class="flavor-label">口味：</span>
                        <span 
                            v-for="flv in getValidFlavors(row.ID)" 
                            :key="flv.ID || flv.口味" 
                            class="flavor-mini-tag"
                        >
                            {{ flv.口味 }} <b class="text-emerald">${{ flv.價格 }}</b>
                            <span v-if="flv.限量" class="limit-badge">限量: {{ flv.限量 }}</span>
                        </span>
                    </div>
                </div>

                <!-- 額外備註顯示 -->
                <div class="card-line-details" v-if="row.備註">
                    <span class="remark-text">備註: {{ row.備註 }}</span>
                </div>

                <!-- 第四行：操作按鈕區 -->
                <div class="card-line-footer">
                    <template v-if="row.狀態 === '已結單'">
                        <button class="action-btn btn-view-full" @click="handleAction('view', row)">
                            👁️ 檢視訂單
                        </button>
                    </template>

                    <template v-else-if="row.狀態 === '開啟中'">
                        <button class="action-btn btn-primary-soft" @click="handleAction('open', row)">
                            開啟
                        </button>
                        <button class="action-btn btn-success-soft" @click="handleAction('upd', row)">
                            管理
                        </button>
                        
                        <div class="dropdown-wrapper">
                            <button class="action-btn btn-more" @click.stop="toggleDropdown(row.ID)">
                                更多
                            </button>
                            <ul v-if="activeDropdownId === row.ID" class="dropdown-menu-modern">
                                <li><a href="#" @click.prevent="handleAction('edit', row)">編輯訂單</a></li>
                                <li><a href="#" @click.prevent="handleAction('chkout', row)">結算訂單</a></li>
                                <li><a href="#" @click.prevent="handleAction('agent', row)">代購訂單</a></li>
                                <li><a href="#" class="text-danger" @click.prevent="handleAction('delete', row)">刪除訂單</a></li>
                            </ul>
                        </div>
                    </template>

                    <template v-else>
                        <span class="text-muted text-xs">等待處理 {{ row.備註 ? `(${row.備註})` : '' }}</span>
                    </template>
                </div>
            </div>
        </div>

        <!-- 現代化分頁導航 -->
        <div class="pagination-modern" v-if="totalPages > 1">
            <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">
                ← 上一頁
            </button>
            <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 頁</span>
            <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">
                下一頁 →
            </button>
        </div>

        <!-- 📱 1. 檢視訂單側滑抽屜 Modal -->
        <div v-if="showOrderModal" class="modal-backdrop" @click.self="closeOrderModal">
            <div class="bottom-sheet-modal">
                <div class="sheet-handle-bar"></div>
                <div class="modal-header">
                    <h3>{{ currentOrderTitle }} - 訂單明細</h3>
                    <button class="btn-close" @click="closeOrderModal">✕</button>
                </div>

                <div class="summary-banner">
                    <div class="summary-banner-title">📊 總量統計</div>
                    <div class="summary-banner-content">
                        <span v-if="isCurrentItemMultiFlavor" class="summary-flavor-group">
                            <span v-for="(qty, flv) in overallFlavorTotals" :key="flv" class="summary-flavor-badge">
                                {{ flv }}: <b class="summary-q-num">{{ qty }}</b>
                            </span>
                        </span>
                        <span v-else class="summary-single-group">
                            總訂購數量: <b class="summary-total-num">{{ overallTotalQty }}</b> 份
                        </span>
                    </div>
                </div>
                
                <div class="modal-body">
                    <div v-if="orderLoading" class="loading-state"><p>載入訂單資料中...</p></div>
                    <div v-else-if="groupedOrders.length === 0" class="empty-state"><p>目前沒有相關訂單資料</p></div>
                    
                    <div v-else class="order-items-list">
                        <div v-for="(group, index) in groupedOrders" :key="index" class="order-card-row">
                            <div class="ord-left">
                                <div class="ord-name-line">
                                    <span class="ord-name">{{ group.name }}</span>
                                    <span v-if="group.isAppend" class="append-tag">追加</span>
                                </div>
                                <div class="ord-flavor-tags" v-if="group.type === 'multi'">
                                    <span v-for="(q, flv) in group.flavorMap" :key="flv" class="flv-tag">
                                        {{ flv }} <b class="q-num">x{{ q }}</b>
                                    </span>
                                </div>
                            </div>
                            
                            <div class="ord-right">
                                <span class="ord-single-qty" v-if="group.type === 'single'">
                                    x{{ group.totalQty }}
                                </span>
                                <span class="ord-subtotal">${{ group.totalAmount.toLocaleString() }}</span>
                                <button class="btn-del-user" @click="handleDeleteUserOrder(group.name)">刪除</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <span class="total-label">總金額(元)：</span>
                    <span class="total-value">${{ orderTotal.toLocaleString() }}</span>
                </div>
            </div>
        </div>

        <!-- 📱 2. 新增團購項目側滑抽屜 Modal (對齊原 #groupBuyModal 完整規格) -->
        <div v-if="showAddItemModal" class="modal-backdrop" @click.self="closeAddItemModal">
            <div class="bottom-sheet-modal tall-sheet">
                <div class="sheet-handle-bar"></div>
                <div class="modal-header">
                    <h3>新增團購項目</h3>
                    <button class="btn-close" @click="closeAddItemModal">✕</button>
                </div>
                
                <div class="modal-body form-body">
                    <!-- 1. 品項名稱與新品項/舊品項切換 -->
                    <div class="form-group">
                        <div class="label-with-radios">
                            <label><span class="text-danger">*</span> 品項名稱</label>
                            <div class="radio-group-inline">
                                <label class="radio-label">
                                    <input type="radio" value="new" v-model="newItemForm.itemType" @change="handleItemTypeChange" />
                                    新品項
                                </label>
                                <label class="radio-label">
                                    <input type="radio" value="old" v-model="newItemForm.itemType" @change="handleItemTypeChange" />
                                    舊品項
                                </label>
                            </div>
                        </div>

                        <!-- 新品項輸入框 + AI 助手按鈕 -->
                        <div v-if="newItemForm.itemType === 'new'" class="input-with-ai">
                            <input 
                                type="text" 
                                v-model="newItemForm.name" 
                                placeholder="請輸入品項名稱" 
                                class="form-input flex-1" 
                            />
                            <button type="button" class="btn-ai-tool btn-ai-magic" title="AI 命名助手" @click="handleAiHelp('ainame')">
                                🪄
                            </button>
                            <button type="button" class="btn-ai-tool btn-ai-desc" title="AI 文案生成" @click="handleAiHelp('aidesc')">
                                ℹ️
                            </button>
                        </div>

                        <!-- AI 命名選項產生區 -->
                        <div v-if="newItemForm.itemType === 'new' && aiNameOptions.length > 0" class="ai-options-box">
                            <span 
                                v-for="(opt, idx) in aiNameOptions" 
                                :key="idx" 
                                class="ai-option-chip"
                                @click="newItemForm.name = opt"
                            >
                                {{ opt }}
                            </span>
                        </div>

                        <!-- 舊品項下拉選單 -->
                        <div v-if="newItemForm.itemType === 'old'">
                            <select v-model="newItemForm.selectedOldId" @change="handleSelectOldItem" class="form-select w-100">
                                <option value="">-- 請選擇歷史品項 --</option>
                                <option v-for="old in uniqueOldItems" :key="old.ID" :value="old.ID">
                                    {{ old.名稱 }}
                                </option>
                            </select>
                        </div>
                    </div>

                    <!-- 2. 團購期間 -->
                    <div class="form-group">
                        <label>團購期間</label>
                        <div class="form-row">
                            <div class="half">
                                <span class="sub-input-label">起始時間</span>
                                <input type="datetime-local" v-model="newItemForm.startDate" class="form-input w-100" />
                            </div>
                            <div class="half">
                                <span class="sub-input-label">結束時間</span>
                                <input type="datetime-local" v-model="newItemForm.endDate" class="form-input w-100" />
                            </div>
                        </div>
                    </div>

                    <!-- 3. 口味選擇切換 -->
                    <div class="form-group">
                        <div class="label-with-radios">
                            <label>口味選擇</label>
                            <div class="radio-group-inline">
                                <label class="radio-label">
                                    <input type="radio" value="single" v-model="newItemForm.flavorType" />
                                    單口味
                                </label>
                                <label class="radio-label">
                                    <input type="radio" value="multiple" v-model="newItemForm.flavorType" />
                                    多口味
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- 單口味欄位 -->
                    <div v-if="newItemForm.flavorType === 'single'" class="form-group box-panel">
                        <label><span class="text-danger">*</span> 價格與限量 <span class="hint-text">(※ 0為不限量)</span></label>
                        <div class="form-row">
                            <div class="half">
                                <input type="number" min="1" v-model="newItemForm.price" placeholder="價格" class="form-input w-100" />
                            </div>
                            <div class="half">
                                <input type="number" min="0" v-model="newItemForm.singleLimit" placeholder="數量 (0不限)" class="form-input w-100" />
                            </div>
                        </div>
                    </div>

                    <!-- 多口味欄位 -->
                    <div v-else class="form-group box-panel">
                        <label><span class="text-danger">*</span> 口味與限量 <span class="hint-text">(※ 0為不限量)</span></label>
                        <div v-for="(flv, index) in newItemForm.flavors" :key="index" class="flavor-input-row">
                            <input type="number" min="1" v-model="flv.price" placeholder="價格" class="form-input flex-1" />
                            <input type="text" v-model="flv.name" placeholder="口味" class="form-input flex-2" />
                            <input type="number" min="0" v-model="flv.limit" placeholder="數量" class="form-input flex-1" />
                            <button 
                                v-if="newItemForm.flavors.length > 1" 
                                type="button" 
                                class="btn-remove-flavor" 
                                @click="removeFlavorRow(index)"
                            >
                                ✕
                            </button>
                        </div>
                        <button type="button" class="btn-add-flavor-full" @click="addFlavorRow">
                            ＋ 新增口味
                        </button>
                    </div>

                    <!-- 4. 圖片上傳與預覽 -->
                    <div class="form-group">
                        <label>圖片 <span class="hint-text">(支援多張 .jpg, .png)</span></label>
                        <input 
                            type="file" 
                            multiple 
                            accept=".jpg, .jpeg, .png" 
                            @change="handleFileUpload" 
                            class="form-input file-input-custom" 
                        />
                        <div v-if="previewImages.length > 0" class="image-preview-grid">
                            <div v-for="(img, idx) in previewImages" :key="idx" class="preview-thumb-box">
                                <img :src="img.url" alt="預覽圖" />
                                <button type="button" class="btn-remove-img" @click="removePreviewImage(idx)">✕</button>
                            </div>
                        </div>
                        <div v-if="previewImages.length > 0" class="file-count-text">
                            已選擇 {{ previewImages.length }} 張圖片
                        </div>
                    </div>

                    <!-- 5. 可折疊「更多選項」與行程設定 -->
                    <div class="more-options-section">
                        <button type="button" class="btn-toggle-more" @click="showMoreOptions = !showMoreOptions">
                            更多選項 <span>{{ showMoreOptions ? '▴' : '▾' }}</span>
                        </button>

                        <div v-if="showMoreOptions" class="more-options-panel">
                            <div class="form-group">
                                <label>行程</label>
                                <div class="radio-group-inline wrap-radios">
                                    <label class="radio-label">
                                        <input type="radio" value="" v-model="newItemForm.scheduleType" />
                                        不設定
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" value="group_time" v-model="newItemForm.scheduleType" />
                                        依團購期間
                                    </label>
                                    <label class="radio-label">
                                        <input type="radio" value="custom_time" v-model="newItemForm.scheduleType" />
                                        自訂時間
                                    </label>
                                </div>
                            </div>

                            <div v-if="newItemForm.scheduleType === 'custom_time'" class="form-group mt-2">
                                <label>時間設定</label>
                                <div class="form-row">
                                    <div class="half">
                                        <span class="sub-input-label">行程起始</span>
                                        <input type="datetime-local" v-model="newItemForm.scheduleStartDate" class="form-input w-100" />
                                    </div>
                                    <div class="half">
                                        <span class="sub-input-label">行程結束</span>
                                        <input type="datetime-local" v-model="newItemForm.scheduleEndDate" class="form-input w-100" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn-submit-item" @click="submitAddItem" :disabled="submittingItem">
                        {{ submittingItem ? '建立中...' : '建立團購' }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue'
import { fetchItemsData, postGasData } from '../services/api.js'

const items = ref([])
const flavors = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = 5
const activeDropdownId = ref(null)

// 📱 檢視訂單 Modal 狀態
const showOrderModal = ref(false)
const orderLoading = ref(false)
const currentOrderTitle = ref('')
const currentItemId = ref(null)
const rawOrderList = ref([])
const orderTotal = ref(0)

// 📱 新增團購項目 Modal 狀態 (對齊原 #groupBuyModal)
const showAddItemModal = ref(false)
const submittingItem = ref(false)
const showMoreOptions = ref(false)
const aiNameOptions = ref([])
const previewImages = ref([])

const newItemForm = reactive({
    itemType: 'new',       // 'new' | 'old'
    selectedOldId: '',
    name: '',
    startDate: '',
    endDate: '',
    flavorType: 'single',  // 'single' | 'multiple'
    price: '',
    singleLimit: 0,
    flavors: [
        { price: '', name: '', limit: 0 },
        { price: '', name: '', limit: 0 }
    ],
    files: [],
    scheduleType: '',      // '' | 'group_time' | 'custom_time'
    scheduleStartDate: '',
    scheduleEndDate: ''
})

const userId = window.userId || 'LINE_USER_ID_PLACEHOLDER'

const loadData = async () => {
    loading.value = true
    try {
        const result = await fetchItemsData()
        items.value = result.items
        flavors.value = result.flavors
        currentPage.value = 1
    } catch (error) {
        alert('資料載入失敗，請稍後再試')
    } finally {
        loading.value = false
    }
}

const getValidFlavors = (itemId) => {
    return flavors.value.filter(f => {
        const matchId = String(f.品項ID || f.ID) === String(itemId)
        const hasFlavorName = f.口味 && String(f.口味).trim() !== ''
        return matchId && hasFlavorName
    })
}

const getSingleItemLimit = (itemId) => {
    const item = items.value.find(i => String(i.ID) === String(itemId))
    if (item && item.限量) return item.限量

    const flavorRecord = flavors.value.find(f => String(f.品項ID || f.ID) === String(itemId))
    if (flavorRecord && flavorRecord.限量) return flavorRecord.限量

    return null
}

// 取得不重複的歷史品項供「舊品項」下拉選單使用
const uniqueOldItems = computed(() => {
    const seen = new Set()
    return items.value.filter(item => {
        if (!item.名稱 || seen.has(item.名稱)) return false
        seen.add(item.名稱)
        return true
    })
})

const getStatusClass = (status) => {
    if (status === '開啟中') return 'status-active'
    if (status === '已結單') return 'status-closed'
    return 'status-default'
}

const sortedItems = computed(() => {
    return [...items.value].sort((a, b) => {
        const weightA = a.狀態 === '開啟中' ? 1 : 2
        const weightB = b.狀態 === '開啟中' ? 1 : 2
        return weightA - weightB
    })
})

const totalPages = computed(() => Math.ceil(sortedItems.value.length / pageSize))
const paginatedItems = computed(() => {
    const start = (currentPage.value - 1) * pageSize
    return sortedItems.value.slice(start, start + pageSize)
})

const toggleDropdown = (id) => {
    activeDropdownId.value = activeDropdownId.value === id ? null : id
}

const closeDropdowns = () => {
    activeDropdownId.value = null
}

const isCurrentItemMultiFlavor = computed(() => {
    if (!currentItemId.value) return false
    return getValidFlavors(currentItemId.value).length > 0
})

const overallTotalQty = computed(() => {
    return rawOrderList.value.reduce((sum, ord) => sum + (Number(ord.數量) || 1), 0)
})

const overallFlavorTotals = computed(() => {
    const totals = {}
    rawOrderList.value.forEach(ord => {
        const flv = ord.口味
        const qty = Number(ord.數量) || 1
        if (flv) {
            totals[flv] = (totals[flv] || 0) + qty
        }
    })
    return totals
})

const groupedOrders = computed(() => {
    const map = {}
    
    rawOrderList.value.forEach(ord => {
        const name = ord.名稱 || ord.姓名 || ord.使用者 || '未具名'
        const flavor = ord.口味 || ''
        const qty = Number(ord.數量) || 1
        const amount = Number(ord.小計 || ord.金額) || 0
        const isAppend = ord.追加 === true || ord.isAppend === true || String(ord.備註 || '').includes('追加')

        if (!map[name]) {
            map[name] = {
                name: name,
                isAppend: isAppend,
                flavorMap: {},
                totalQty: 0,
                totalAmount: 0,
                type: flavor ? 'multi' : 'single'
            }
        }

        map[name].totalQty += qty
        map[name].totalAmount += amount
        if (isAppend) map[name].isAppend = true

        if (flavor) {
            map[name].flavorMap[flavor] = (map[name].flavorMap[flavor] || 0) + qty
        }
    })

    return Object.values(map)
})

// 💡 動作處理 (檢視、結單、刪除、延後)
const handleAction = async (type, row) => {
    activeDropdownId.value = null
    
    if (type === 'view') {
        currentOrderTitle.value = row.名稱
        currentItemId.value = row.ID
        showOrderModal.value = true
        orderLoading.value = true
        rawOrderList.value = []
        orderTotal.value = 0

        const payload = {
            type: 'view',
            userId: userId,
            id: row.ID,
            name: row.名稱,
            flavor: row.口味 || '',
            search: row.search || ''
        }

        try {
            const result = await postGasData(payload)
            if (result && result[0] && result[0].status === 'success') {
                rawOrderList.value = result[0].orders || []
                orderTotal.value = Number(result[0].total) || 0
            } else {
                alert(result[0]?.alert || '讀取訂單失敗')
            }
        } catch (err) {
            console.error(err)
            alert('系統異常')
        } finally {
            orderLoading.value = false
        }
        return
    }

    let title = ''
    if (type === 'chkout') title = '結單'
    else if (type === 'delete') title = '刪除'
    else if (type === 'stop') title = '延後'
    else return

    if (!confirm(`確定要${title}品項「${row.名稱}」嗎？`)) return

    try {
        loading.value = true
        const payload = { type: type, userId: userId, id: row.ID, name: row.名稱 }
        const result = await postGasData(payload)
        if (result && result[0] && result[0].status === 'success') {
            alert(`${title}成功！${result[0].alert || ''}`)
            await loadData()
        } else {
            alert(`${title}失敗: ${result[0]?.alert || '請稍後再試'}`)
        }
    } catch (err) {
        console.error(err)
        alert('系統異常')
    } finally {
        loading.value = false
    }
}

// 💡 刪除特定使用者下單品項
const handleDeleteUserOrder = async (userName) => {
    if (!confirm(`確定要刪除「${userName}」在此品項的訂單嗎？`)) return

    const payload = {
        type: 'deluser',
        userId: userId,
        user: userName,
        id: currentItemId.value,
        name: currentOrderTitle.value
    }

    try {
        orderLoading.value = true
        const result = await postGasData(payload)

        if (result && result[0] && result[0].status === 'success') {
            alert(`「${userName}」的下單品項已刪除！`)
            rawOrderList.value = rawOrderList.value.filter(ord => {
                const n = ord.名稱 || ord.姓名 || ord.使用者
                return n !== userName
            })
        } else {
            alert(result[0]?.alert || '刪除失敗，請稍後再試')
        }
    } catch (err) {
        console.error(err)
        alert('系統異常')
    } finally {
        orderLoading.value = false
    }
}

// 💡 新增團購項目 Modal 操作邏輯
const openAddItemModal = () => {
    newItemForm.itemType = 'new'
    newItemForm.selectedOldId = ''
    newItemForm.name = ''
    newItemForm.startDate = ''
    newItemForm.endDate = ''
    newItemForm.flavorType = 'single'
    newItemForm.price = ''
    newItemForm.singleLimit = 0
    newItemForm.flavors = [
        { price: '', name: '', limit: 0 },
        { price: '', name: '', limit: 0 }
    ]
    newItemForm.files = []
    newItemForm.scheduleType = ''
    newItemForm.scheduleStartDate = ''
    newItemForm.scheduleEndDate = ''
    showMoreOptions.value = false
    aiNameOptions.value = []
    previewImages.value = []
    showAddItemModal.value = true
}

const closeAddItemModal = () => {
    showAddItemModal.value = false
}

const handleItemTypeChange = () => {
    newItemForm.name = ''
    newItemForm.selectedOldId = ''
    aiNameOptions.value = []
}

// 選擇舊品項時自動帶入價格與口味 (對應原本的 setItemData)
const handleSelectOldItem = () => {
    const oldId = newItemForm.selectedOldId
    if (!oldId) return

    const targetItem = items.value.find(i => String(i.ID) === String(oldId))
    if (!targetItem) return

    newItemForm.name = targetItem.名稱
    const validFlvs = getValidFlavors(oldId)

    if (validFlvs.length > 0) {
        newItemForm.flavorType = 'multiple'
        newItemForm.flavors = validFlvs.map(f => ({
            price: f.價格 || '',
            name: f.口味 || '',
            limit: f.限量 || 0
        }))
    } else {
        newItemForm.flavorType = 'single'
        newItemForm.price = targetItem.售價 || ''
        newItemForm.singleLimit = getSingleItemLimit(oldId) || 0
    }
}

const addFlavorRow = () => {
    newItemForm.flavors.push({ price: '', name: '', limit: 0 })
}

const removeFlavorRow = (index) => {
    newItemForm.flavors.splice(index, 1)
}

// 圖片上傳與預覽處理
const handleFileUpload = (event) => {
    const files = Array.from(event.target.files || [])
    files.forEach(file => {
        newItemForm.files.push(file)
        const reader = new FileReader()
        reader.onload = (e) => {
            previewImages.value.push({
                name: file.name,
                url: e.target.result
            })
        }
        reader.readAsDataURL(file)
    })
}

const removePreviewImage = (index) => {
    previewImages.value.splice(index, 1)
    newItemForm.files.splice(index, 1)
}

// AI 助手功能預留接口
const handleAiHelp = async (mode) => {
    if (!newItemForm.name.trim()) {
        alert('請先輸入關鍵字或品項名稱，再使用 AI 助手')
        return
    }
    try {
        submittingItem.value = true
        const result = await postGasData({
            type: mode,
            userId: userId,
            keyword: newItemForm.name
        })
        if (result && result[0] && result[0].status === 'success') {
            if (mode === 'ainame' && Array.isArray(result[0].options)) {
                aiNameOptions.value = result[0].options
            } else if (result[0].text) {
                alert(result[0].text)
            }
        } else {
            alert(result[0]?.alert || 'AI 產生失敗')
        }
    } catch (err) {
        console.error(err)
        alert('AI 服務連線異常')
    } finally {
        submittingItem.value = false
    }
}

// 送出建立團購 (對應原本的 submitForm)
const submitAddItem = async () => {
    if (!newItemForm.name.trim()) {
        alert('請輸入或選擇品項名稱')
        return
    }

    if (newItemForm.flavorType === 'single') {
        if (!newItemForm.price || Number(newItemForm.price) <= 0) {
            alert('請輸入有效的價格')
            return
        }
    } else {
        const validFlavors = newItemForm.flavors.filter(f => f.name.trim() && Number(f.price) > 0)
        if (validFlavors.length === 0) {
            alert('請至少填寫一組有效的口味名稱與價格')
            return
        }
    }

    const payload = {
        type: 'create', // 可依您原本 submitForm 送往 GAS 的 type 名稱微調
        userId: userId,
        itemType: newItemForm.itemType,
        name: newItemForm.name.trim(),
        startDate: newItemForm.startDate,
        endDate: newItemForm.endDate,
        flavorType: newItemForm.flavorType,
        price: newItemForm.flavorType === 'single' ? Number(newItemForm.price) : 0,
        limit: newItemForm.flavorType === 'single' ? Number(newItemForm.singleLimit || 0) : 0,
        flavors: newItemForm.flavorType === 'multiple'
            ? newItemForm.flavors
                .filter(f => f.name.trim())
                .map(f => ({
                    price: Number(f.price),
                    name: f.name.trim(),
                    limit: Number(f.limit || 0)
                }))
            : [],
        images: previewImages.value.map(img => img.url), // Base64 圖片資料
        scheduleType: newItemForm.scheduleType,
        scheduleStartDate: newItemForm.scheduleStartDate,
        scheduleEndDate: newItemForm.scheduleEndDate
    }

    try {
        submittingItem.value = true
        const result = await postGasData(payload)

        if (result && result[0] && result[0].status === 'success') {
            alert(result[0].alert || '團購建立成功！')
            showAddItemModal.value = false
            await loadData()
        } else {
            alert(result[0]?.alert || '建立失敗，請稍後再試')
        }
    } catch (err) {
        console.error(err)
        alert('系統異常')
    } finally {
        submittingItem.value = false
    }
}

const closeOrderModal = () => {
    showOrderModal.value = false
}

onMounted(() => {
    loadData()
    window.addEventListener('click', closeDropdowns)
})

onUnmounted(() => {
    window.removeEventListener('click', closeDropdowns)
})
</script>

<style scoped>
.modern-dashboard {
    max-width: 600px;
    margin: 0 auto;
    padding: 4px;
    font-family: system-ui, -apple-system, sans-serif;
    background-color: #f8fafc;
}

/* 頂部操作列 */
.dashboard-top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
    padding: 0 2px;
}

.btn-primary-action {
    background: #16a34a;
    color: #ffffff;
    border: none;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
}

.btn-primary-action:hover {
    background: #15803d;
}

.btn-refresh {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 0.8rem;
    color: #334155;
    cursor: pointer;
}

.card-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.item-card-compact {
    background: #ffffff;
    border-radius: 8px;
    padding: 6px 10px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    border: 1px solid #f1f5f9;
}

.card-line-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
}

.card-line-title {
    margin-bottom: 3px;
}

.item-title {
    margin: 0;
    font-size: 1rem;
    color: #0f172a;
    font-weight: 700;
    word-break: break-all;
    line-height: 1.2;
}

.amount-display {
    display: flex;
    gap: 6px;
    align-items: center;
}

.total-highlight, .addition-highlight {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    white-space: nowrap;
}

.total-highlight { color: #059669; background: #ecfdf5; }
.addition-highlight { color: #d97706; background: #fef3c7; }

.status-pill {
    padding: 1px 5px;
    border-radius: 6px;
    font-size: 0.7rem;
    font-weight: 600;
    white-space: nowrap;
}

.status-active { background-color: #dcfce7; color: #166534; }
.status-closed { background-color: #fee2e2; color: #991b1b; }
.status-default { background-color: #f1f5f9; color: #475569; }

.card-line-info {
    margin-bottom: 3px;
    font-size: 0.8rem;
}

.single-item-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
}

.price-single {
    font-weight: 600;
    color: #0284c7;
}

.flavor-inline-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
}

.flavor-label {
    color: #64748b;
    font-size: 0.75rem;
}

.flavor-mini-tag {
    background: #f1f5f9;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 0.75rem;
    color: #334155;
}

.text-emerald { color: #059669; }

.limit-badge, .time-badge {
    background: #fef3c7;
    color: #d97706;
    font-size: 0.7rem;
    padding: 0 4px;
    border-radius: 4px;
    font-weight: 500;
}

.card-line-details {
    margin-bottom: 2px;
    font-size: 0.75rem;
}

.remark-text { color: #64748b; }

.card-line-footer {
    display: flex;
    gap: 4px;
    padding-top: 4px;
    border-top: 1px dashed #f1f5f9;
    position: relative;
    align-items: center;
}

.action-btn {
    padding: 4px 8px;
    border-radius: 5px;
    border: none;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
}

.btn-view-full {
    width: 100%;
    background-color: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
    padding: 5px 0;
}

.btn-primary-soft { background-color: #eff6ff; color: #1d4ed8; flex: 1; }
.btn-success-soft { background-color: #f0fdf4; color: #15803d; flex: 1; }
.btn-more { background-color: #f1f5f9; color: #475569; flex: 0.7; }

.dropdown-wrapper {
    position: relative;
    display: inline-block;
    flex: 0.7;
}

.dropdown-menu-modern {
    position: absolute;
    right: 0;
    bottom: 110%;
    background: #ffffff;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    list-style: none;
    padding: 4px 0;
    margin: 0;
    min-width: 100px;
    z-index: 30;
    border: 1px solid #e2e8f0;
}

.dropdown-menu-modern li a {
    display: block;
    padding: 5px 10px;
    color: #334155;
    text-decoration: none;
    font-size: 0.75rem;
}

.text-danger { color: #dc2626 !important; }
.text-muted { color: #64748b; }
.text-xs { font-size: 0.75rem; }

/* 📱 底部滑出抽屜 (Bottom Sheet) 樣式 */
.modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: flex-end;
    z-index: 1000;
}

.bottom-sheet-modal {
    background: #ffffff;
    width: 100%;
    max-width: 600px;
    max-height: 85vh;
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 -10px 25px rgba(0, 0, 0, 0.15);
    animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.tall-sheet {
    max-height: 92vh;
}

@keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
}

.sheet-handle-bar {
    width: 36px;
    height: 4px;
    background: #cbd5e1;
    border-radius: 2px;
    margin: 8px auto 0 auto;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
}

.modal-header h3 {
    margin: 0;
    font-size: 1.15rem;
    color: #1e293b;
}

.btn-close {
    background: #f1f5f9;
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    font-size: 1rem;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* 📊 頂部總量統計儀表板 */
.summary-banner {
    background: #f0fdf4;
    border-bottom: 1px solid #dcfce7;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.summary-banner-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #166534;
}

.summary-banner-content {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 1.05rem;
    color: #14532d;
    font-weight: 600;
}

.summary-flavor-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.summary-flavor-badge {
    background: #ffffff;
    border: 1px solid #bbf7d0;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 0.95rem;
}

.summary-q-num, .summary-total-num {
    color: #059669;
    font-size: 1.15rem;
    font-weight: 800;
}

.modal-body {
    padding: 14px 16px;
    overflow-y: auto;
    max-height: 68vh;
}

/* 新增團購表單專屬樣式 */
.form-body {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-group label {
    font-size: 0.9rem;
    font-weight: 700;
    color: #334155;
}

.label-with-radios {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.radio-group-inline {
    display: flex;
    gap: 12px;
    align-items: center;
}

.wrap-radios {
    flex-wrap: wrap;
    gap: 10px;
}

.radio-label {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.9rem !important;
    font-weight: 500 !important;
    color: #475569 !important;
    cursor: pointer;
}

.input-with-ai {
    display: flex;
    gap: 6px;
    align-items: center;
}

.btn-ai-tool {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    padding: 8px 10px;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
}

.btn-ai-magic { border-color: #93c5fd; background: #eff6ff; }
.btn-ai-desc { border-color: #cbd5e1; background: #f8fafc; }

.ai-options-box {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 4px;
}

.ai-option-chip {
    background: #e0f2fe;
    color: #0369a1;
    padding: 4px 10px;
    border-radius: 14px;
    font-size: 0.8rem;
    cursor: pointer;
}

.box-panel {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 10px;
    border-radius: 10px;
}

.hint-text {
    font-size: 0.75rem;
    font-weight: 500;
    color: #64748b;
}

.sub-input-label {
    display: block;
    font-size: 0.75rem;
    color: #64748b;
    margin-bottom: 2px;
}

.form-input, .form-select {
    padding: 8px 10px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.9rem;
    background: #ffffff;
    color: #1e293b;
}

.w-100 { width: 100%; box-sizing: border-box; }
.mt-2 { margin-top: 8px; }

.form-row {
    display: flex;
    gap: 8px;
}

.form-row .half {
    flex: 1;
}

.flavor-input-row {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 6px;
}

.flex-2 { flex: 2; min-width: 0; }
.flex-1 { flex: 1; min-width: 0; }

.btn-add-flavor-full {
    width: 100%;
    background: #eff6ff;
    color: #2563eb;
    border: 1px dashed #93c5fd;
    padding: 7px;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    margin-top: 2px;
}

.btn-remove-flavor {
    background: #fee2e2;
    color: #dc2626;
    border: none;
    width: 30px;
    height: 34px;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    flex-shrink: 0;
}

/* 圖片預覽網格 */
.image-preview-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 6px;
}

.preview-thumb-box {
    position: relative;
    width: 64px;
    height: 64px;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #cbd5e1;
}

.preview-thumb-box img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.btn-remove-img {
    position: absolute;
    top: 2px;
    right: 2px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    border: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    font-size: 0.65rem;
    cursor: pointer;
}

.file-count-text {
    font-size: 0.8rem;
    color: #64748b;
}

/* 更多選項折疊區 */
.btn-toggle-more {
    background: transparent;
    border: none;
    color: #2563eb;
    font-size: 0.9rem;
    font-weight: 600;
    padding: 0;
    cursor: pointer;
}

.more-options-panel {
    margin-top: 8px;
    padding: 10px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
}

.order-items-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.order-card-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    background: #f8fafc;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
}

.ord-left {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
}

.ord-name-line {
    display: flex;
    align-items: center;
    gap: 8px;
}

.ord-name {
    font-size: 1.05rem;
    font-weight: 700;
    color: #1e293b;
}

.append-tag {
    font-size: 0.75rem;
    font-weight: 700;
    color: #d97706;
    background: #fef3c7;
    padding: 2px 6px;
    border-radius: 4px;
}

.ord-flavor-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.flv-tag {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 0.85rem;
    color: #334155;
}

.q-num {
    color: #059669;
    font-size: 0.9rem;
}

.ord-right {
    display: flex;
    align-items: center;
    gap: 10px;
}

.ord-single-qty {
    font-size: 0.95rem;
    font-weight: 700;
    color: #0284c7;
    background: #e0f2fe;
    padding: 2px 8px;
    border-radius: 6px;
}

.ord-subtotal {
    font-size: 1.05rem;
    font-weight: 700;
    color: #059669;
}

.btn-del-user {
    background: #fee2e2;
    color: #dc2626;
    border: 1px solid #fca5a5;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 14px 16px;
    border-top: 1px solid #f1f5f9;
    background: #f8fafc;
    border-bottom-left-radius: 20px;
    border-bottom-right-radius: 20px;
}

.btn-submit-item {
    width: 100%;
    background: #16a34a;
    color: #ffffff;
    border: none;
    padding: 10px;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    text-align: center;
}

.btn-submit-item:hover {
    background: #15803d;
}

.total-label {
    font-size: 1rem;
    color: #334155;
}

.total-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #dc2626;
    margin-left: 8px;
}

.pagination-modern {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
    padding: 0 2px;
}

.page-btn {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 0.8rem;
    color: #334155;
    cursor: pointer;
}

.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.page-info { font-size: 0.8rem; color: #64748b; }
.loading-state { text-align: center; padding: 20px; color: #64748b; }
</style>