<template>
    <div class="modern-dashboard">
        <!-- 頂部主分頁切換：品項列表 / 歷史訂單 -->
        <div class="main-nav-tabs">
            <button
                :class="['main-tab-btn', { active: activeMainTab === 'items' }]"
                @click="activeMainTab = 'items'"
            >
                品項列表
            </button>
            <button
                :class="['main-tab-btn', { active: activeMainTab === 'history' }]"
                @click="switchToHistoryTab"
            >
                歷史訂單
            </button>
        </div>

        <!-- ==================== TAB 1: 品項列表 ==================== -->
        <div v-show="activeMainTab === 'items'">
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

                    <!-- 第二行：品項名稱 + 右側緊湊縮圖 -->
                    <div class="card-line-title-row">
                        <h3 class="item-title flex-1">{{ row.名稱 }}</h3>
                        <div v-if="getItemImageUrls(row.ID, row.名稱).length > 0" class="card-thumb-strip">
                            <img
                                v-for="(imgUrl, idx) in getItemImageUrls(row.ID, row.名稱)"
                                :key="idx"
                                :src="imgUrl"
                                :alt="`${row.名稱} 圖片 ${idx + 1}`"
                                class="card-mini-thumb"
                                loading="lazy"
                            />
                        </div>
                    </div>

                    <!-- 第三行：單一口味與多口味的智慧判斷 + 限量剩餘提醒 -->
                    <div class="card-line-info">
                        <!-- 單一口味 -->
                        <div class="single-item-info" v-if="getValidFlavors(row.ID).length === 0">
                            <span class="price-single" v-if="row.售價 && row.售價 !== '---'">
                                售價: ${{ row.售價 }}
                            </span>
                            <template v-if="getSingleItemLimit(row.ID) > 0">
                                <span
                                    :class="[
                                        'limit-badge',
                                        {
                                            'limit-over': getSingleRemaining(row) < 0,
                                            'limit-soldout': getSingleRemaining(row) === 0
                                        }
                                    ]"
                                >
                                    限量: {{ getSingleItemLimit(row.ID) }} ({{ formatRemainingText(getSingleRemaining(row)) }})
                                </span>
                            </template>
                            <span v-if="hasValidDeadline(row)" class="time-badge">
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
                                <span
                                    v-if="Number(flv.限量) > 0"
                                    :class="[
                                        'limit-badge',
                                        {
                                            'limit-over': getFlavorRemaining(row, flv) < 0,
                                            'limit-soldout': getFlavorRemaining(row, flv) === 0
                                        }
                                    ]"
                                >
                                    限量: {{ flv.限量 }} ({{ formatRemainingText(getFlavorRemaining(row, flv)) }})
                                </span>
                            </span>
                            <span v-if="hasValidDeadline(row)" class="time-badge">
                                限時: {{ row.限時開始 }} ~ {{ row.限時結束 }}
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
        </div>

        <!-- ==================== TAB 2: 歷史訂單 ==================== -->
        <div v-show="activeMainTab === 'history'">
            <div class="dashboard-top-bar">
                <button class="btn-primary-action" @click="openSearchModal" :disabled="historyLoading">
                    🔍 條件查詢
                </button>
                <button class="btn-refresh" @click="reloadHistoryCache" :disabled="historyLoading">
                    重整快取
                </button>
            </div>

            <!-- 歷史查詢載入中動畫 -->
            <div v-if="historyLoading" class="history-loading-box">
                <div class="spinner-ring"></div>
                <p class="history-loading-text">正在查詢歷史紀錄，請稍候...</p>
            </div>

            <template v-else>
                <!-- 查詢結果摘要標題 -->
                <div v-if="historyResultTitle" class="history-summary-header">
                    <strong>{{ historyResultTitle }}</strong>
                    <span class="text-muted text-xs" v-if="historyResultSubtitle">{{ historyResultSubtitle }}</span>
                </div>

                <!-- 少於 3 筆：表格明細 -->
                <div v-if="historyViewMode === 'table'" class="card-list">
                    <div v-if="historyTableRows.length === 0" class="empty-state">
                        <p>目前沒有符合條件的歷史訂單資料</p>
                    </div>

                    <div v-for="hRow in historyTableRows" :key="hRow.ID" class="item-card-compact">
                        <div class="card-line-top">
                            <span class="status-pill status-closed">歷史開團</span>
                            <span class="total-highlight">總金額: ${{ Number(hRow.訂單金額總計 || 0).toLocaleString() }}</span>
                        </div>
                        <div class="card-line-title-row">
                            <h3 class="item-title flex-1">{{ hRow.名稱 }}</h3>
                        </div>
                        <div class="card-line-info">
                            <div class="single-item-info">
                                <span class="price-single">
                                    售價: {{ hRow.售價 === '---' ? '多口味' : `$${hRow.售價}` }}
                                </span>
                                <span class="time-badge" v-if="hRow.開啟時間">
                                    開團時間: {{ String(hRow.開啟時間).slice(0, 10) }}
                                </span>
                            </div>
                            <div v-if="hRow.售價 === '---'" class="flavor-inline-list mt-1">
                                <span
                                    v-for="flv in getHistoryRowFlavors(hRow.ID)"
                                    :key="flv.口味"
                                    class="flavor-mini-tag"
                                >
                                    {{ flv.口味 }} <b class="text-emerald">${{ flv.價格 }}</b>
                                    <span v-if="Number(flv.限量) > 0" class="text-muted"> (限{{ flv.限量 }})</span>
                                </span>
                            </div>
                        </div>
                        <div class="card-line-footer">
                            <button
                                class="action-btn btn-view-half"
                                @click="handleAction('view', { ...hRow, search: 'Y' })"
                            >
                                👁️ 檢視訂單明細
                            </button>
                            <button
                                class="action-btn btn-reopen-half"
                                @click="reopenFromHistory(hRow)"
                            >
                                🔁 再以此設定開團
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 3 筆以上或人員統計：數據長條視覺化圖表 -->
                <div v-else-if="historyViewMode === 'chart'" class="history-charts-wrapper">
                    <div class="box-panel" v-if="historyChartSeries.length > 0">
                        <h4 class="chart-section-title">📊 訂單金額 / 數量統計</h4>
                        <div v-for="(bar, idx) in historyChartSeries" :key="idx" class="chart-bar-item">
                            <div class="chart-bar-label">
                                <span>{{ bar.label }}</span>
                                <b>{{ bar.displayValue }}</b>
                            </div>
                            <div class="chart-bar-track">
                                <div
                                    class="chart-bar-fill"
                                    :style="{ width: bar.percent + '%', backgroundColor: bar.color }"
                                ></div>
                            </div>
                        </div>
                    </div>

                    <div class="box-panel mt-2" v-if="historyPriceSeries.length > 0">
                        <h4 class="chart-section-title">💰 歷次售價趨勢（點擊可直接套用設定開團）</h4>
                        <div v-for="(pItem, idx) in historyPriceSeries" :key="idx" class="price-trend-row">
                            <div class="trend-left-info">
                                <span class="trend-name">{{ pItem.label }}</span>
                                <span class="trend-values">{{ pItem.pricesText }}</span>
                            </div>
                            <button
                                v-if="pItem.sourceRow"
                                type="button"
                                class="btn-reopen-mini"
                                @click="reopenFromHistory(pItem.sourceRow)"
                            >
                                🔁 再以此開團
                            </button>
                        </div>
                    </div>
                </div>

                <div v-else class="empty-state">
                    <p>請點擊上方「🔍 條件查詢」篩選品項或人員購買紀錄</p>
                </div>
            </template>
        </div>

        <!-- ==================== MODAL 1: 管理 / 檢視訂單 + 追加訂單 ==================== -->
        <div v-if="showOrderModal" class="modal-backdrop" @click.self="closeOrderModal">
            <div class="bottom-sheet-modal tall-sheet">
                <div class="sheet-handle-bar"></div>
                <div class="modal-header">
                    <h3>{{ currentOrderTitle }} - {{ orderModalMode === 'upd' ? '管理訂單' : '檢視訂單' }}</h3>
                    <button class="btn-close" @click="closeOrderModal">✕</button>
                </div>

                <!-- 頁籤切換：已結單且非歷史查詢時顯示「追加訂單」頁籤 -->
                <div class="sub-tabs-bar" v-if="orderModalMode === 'view' && !isHistorySearchView">
                    <button
                        :class="['sub-tab-btn', { active: orderSubTab === 'list' }]"
                        @click="orderSubTab = 'list'"
                    >
                        訂購明細
                    </button>
                    <button
                        :class="['sub-tab-btn', { active: orderSubTab === 'append' }]"
                        @click="switchToAppendTab"
                    >
                        追加訂單
                    </button>
                </div>

                <!-- 子頁籤 A：訂購明細 -->
                <template v-if="orderSubTab === 'list'">
                    <div class="summary-banner">
                        <div class="summary-banner-top">
                            <div class="summary-banner-title">📊 總量統計</div>
                            <button
                                type="button"
                                class="btn-copy-small"
                                @click="copyOrderSummaryAndList"
                                :disabled="groupedOrders.length === 0"
                            >
                                📋 複製統計與名單
                            </button>
                        </div>

                        <div class="summary-banner-content">
                            <span v-if="isCurrentItemMultiFlavor" class="summary-flavor-group">
                                <span
                                    v-for="flvObj in getValidFlavors(currentItemId)"
                                    :key="flvObj.口味"
                                    class="summary-flavor-badge"
                                >
                                    {{ flvObj.口味 }}:
                                    <b class="summary-q-num">{{ overallFlavorTotals[flvObj.口味] || 0 }}</b>
                                    <template v-if="Number(flvObj.限量) > 0">
                                        <span
                                            :class="[
                                                'remain-inline',
                                                { 'text-danger': Number(flvObj.限量) - (overallFlavorTotals[flvObj.口味] || 0) < 0 }
                                            ]"
                                        >
                                            ({{ formatRemainingText(Number(flvObj.限量) - (overallFlavorTotals[flvObj.口味] || 0)) }})
                                        </span>
                                    </template>
                                </span>
                            </span>
                            <span v-else class="summary-single-group">
                                總訂購數量: <b class="summary-total-num">{{ overallTotalQty }}</b> 份
                                <template v-if="getSingleItemLimit(currentItemId) > 0">
                                    <span
                                        :class="[
                                            'remain-inline',
                                            { 'text-danger': Number(getSingleItemLimit(currentItemId)) - overallTotalQty < 0 }
                                        ]"
                                    >
                                        (限量 {{ getSingleItemLimit(currentItemId) }} / {{ formatRemainingText(Number(getSingleItemLimit(currentItemId)) - overallTotalQty) }})
                                    </span>
                                </template>
                            </span>
                        </div>
                    </div>

                    <!-- 已下單人員快速搜尋框 -->
                    <div class="order-search-bar" v-if="!orderLoading && groupedOrders.length > 0">
                        <input
                            type="text"
                            v-model.trim="orderNameFilter"
                            placeholder="🔍 搜尋已下單姓名..."
                            class="form-input order-search-input"
                        />
                        <button
                            v-if="orderNameFilter"
                            type="button"
                            class="btn-clear-filter"
                            @click="orderNameFilter = ''"
                        >
                            ✕
                        </button>
                    </div>

                    <div class="modal-body">
                        <div v-if="orderLoading" class="loading-state"><p>載入訂單資料中...</p></div>
                        <div v-else-if="groupedOrders.length === 0" class="empty-state"><p>該品項查無訂單！</p></div>
                        <div v-else-if="filteredGroupedOrders.length === 0" class="empty-state">
                            <p>找不到符合「{{ orderNameFilter }}」的訂單</p>
                        </div>

                        <div v-else class="order-items-list">
                            <div v-for="(group, index) in filteredGroupedOrders" :key="index" class="order-card-row">
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
                                    <button
                                        v-if="orderModalMode === 'upd'"
                                        class="btn-del-user"
                                        @click="handleDeleteUserOrder(group.name)"
                                    >
                                        刪除
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 底部總金額與管理操作按鈕 -->
                    <div class="modal-footer modal-footer-column">
                        <div class="footer-total-row">
                            <span class="total-label">總金額(元)：</span>
                            <span class="total-value">${{ orderTotal.toLocaleString() }}</span>
                        </div>

                        <div v-if="orderModalMode === 'upd'" class="footer-action-row">
                            <button class="action-btn btn-warning-solid flex-1" @click="handleOrderStatusAction('stop')">
                                ⏰ 延後訂單
                            </button>
                            <button class="action-btn btn-primary-solid flex-1" @click="handleShareOrderList">
                                📤 分享訂單
                            </button>
                        </div>

                        <div v-else-if="orderModalMode === 'view' && !isHistorySearchView" class="footer-action-row">
                            <button class="action-btn btn-danger-solid w-100" @click="handleOrderStatusAction('delapd')">
                                🗑️ 移除追加訂單
                            </button>
                        </div>
                    </div>
                </template>

                <!-- 子頁籤 B：追加訂單 -->
                <template v-else-if="orderSubTab === 'append'">
                    <div class="modal-body form-body">
                        <div class="info-alert-box">
                            <div>ℹ️ 因已結單關係，追加訂單如為相同姓名者不做累加計算</div>
                            <div>ℹ️ 追加後訂單，如需調整只能一併刪除重新填寫追加訂單</div>
                        </div>

                        <div class="form-group">
                            <label><span class="text-danger">*</span> 追加名單</label>
                            <div
                                v-for="(apRow, idx) in appendRows"
                                :key="idx"
                                class="flavor-input-row"
                            >
                                <input
                                    type="text"
                                    v-model="apRow.name"
                                    placeholder="姓名"
                                    class="form-input flex-2"
                                />
                                <select
                                    v-if="isCurrentItemMultiFlavor"
                                    v-model="apRow.flavor"
                                    class="form-select flex-2"
                                >
                                    <option value="" disabled>口味</option>
                                    <option
                                        v-for="flv in getValidFlavors(currentItemId)"
                                        :key="flv.口味"
                                        :value="flv.口味"
                                    >
                                        {{ flv.口味 }}
                                    </option>
                                </select>
                                <input
                                    type="number"
                                    min="1"
                                    v-model="apRow.qty"
                                    placeholder="數量"
                                    class="form-input flex-1"
                                />
                                <button
                                    v-if="appendRows.length > 1"
                                    type="button"
                                    class="btn-remove-flavor"
                                    @click="appendRows.splice(idx, 1)"
                                >
                                    ✕
                                </button>
                            </div>

                            <button
                                type="button"
                                class="btn-add-flavor-full"
                                @click="appendRows.push({ name: '', flavor: '', qty: '' })"
                            >
                                ＋ 新增名字
                            </button>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button class="btn-submit-item" @click="submitAppendOrder" :disabled="submittingItem">
                            {{ submittingItem ? '送出中...' : '確認送出追加' }}
                        </button>
                    </div>
                </template>
            </div>
        </div>

        <!-- ==================== MODAL 2: 新增團購項目 (#groupBuyModal) ==================== -->
        <div v-if="showAddItemModal" class="modal-backdrop" @click.self="closeAddItemModal">
            <div class="bottom-sheet-modal tall-sheet">
                <div class="sheet-handle-bar"></div>
                <div class="modal-header">
                    <h3>新增團購項目</h3>
                    <button class="btn-close" @click="closeAddItemModal">✕</button>
                </div>

                <div class="modal-body form-body">
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
                            <button type="button" class="btn-ai-tool btn-ai-desc" title="AI 命名說明" @click="showAiDescription">
                                ℹ️
                            </button>
                        </div>

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

                        <div v-if="newItemForm.itemType === 'old'">
                            <select v-model="newItemForm.selectedOldId" @change="handleSelectOldItem" class="form-select w-100">
                                <option value="">-- 請選擇歷史品項 --</option>
                                <option v-for="old in uniqueOldItems" :key="old.ID" :value="old.ID">
                                    {{ old.名稱 }}
                                </option>
                            </select>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>團購期間</label>
                        <div class="form-row">
                            <div class="half">
                                <span class="sub-input-label">起始時間</span>
                                <input
                                    type="text"
                                    :value="newItemForm.startDate"
                                    v-flatpickr="{ form: newItemForm, field: 'startDate', endField: 'endDate', minToday: true }"
                                    placeholder="請選擇起始日期"
                                    class="form-input w-100 datepickr"
                                />
                            </div>
                            <div class="half">
                                <span class="sub-input-label">結束時間</span>
                                <input
                                    type="text"
                                    :value="newItemForm.endDate"
                                    v-flatpickr="{ form: newItemForm, field: 'endDate', minToday: true }"
                                    placeholder="請選擇結束日期"
                                    class="form-input w-100 datepickr"
                                />
                            </div>
                        </div>
                    </div>

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

                    <div v-else class="form-group box-panel">
                        <label><span class="text-danger">*</span> 口味與限量 <span class="hint-text">(※ 0為不限量)</span></label>
                        <div v-for="(flv, index) in newItemForm.flavors" :key="index" class="flavor-input-row">
                            <input type="number" min="1" v-model="flv.price" placeholder="價格" class="form-input flex-1" />
                            <input type="text" v-model="flv.name" placeholder="口味" class="form-input flex-2" />
                            <input type="number" min="0" v-model="flv.limit" placeholder="數量" class="form-input flex-1" />
                            <button
                                v-if="newItemForm.flavors.length > 2"
                                type="button"
                                class="btn-remove-flavor"
                                @click="newItemForm.flavors.splice(index, 1)"
                            >
                                ✕
                            </button>
                        </div>
                        <button
                            type="button"
                            class="btn-add-flavor-full"
                            @click="newItemForm.flavors.push({ price: '', name: '', limit: 0 })"
                        >
                            ＋ 新增口味
                        </button>
                    </div>

                    <div class="form-group">
                        <label>圖片 <span class="hint-text">(最多 3 張，單張限 5MB 內 .jpg/.png)</span></label>
                        <input
                            type="file"
                            multiple
                            accept=".jpg, .jpeg, .png"
                            @change="(e) => handleImageUpload(e, 'add')"
                            class="form-input file-input-custom"
                        />
                        <div v-if="newItemForm.images.length > 0" class="image-preview-grid">
                            <div v-for="(img, idx) in newItemForm.images" :key="idx" class="preview-thumb-box">
                                <img :src="img.previewUrl" alt="預覽圖" />
                                <button type="button" class="btn-remove-img" @click="newItemForm.images.splice(idx, 1)">✕</button>
                            </div>
                        </div>
                        <div v-if="newItemForm.images.length > 0" class="file-count-text">
                            已選擇 {{ newItemForm.images.length }} 張圖片
                        </div>
                    </div>

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
                                        <input
                                            type="text"
                                            :value="newItemForm.scheduleStartDate"
                                            v-flatpickr="{ form: newItemForm, field: 'scheduleStartDate', endField: 'scheduleEndDate', minToday: true }"
                                            placeholder="請選擇行程起始"
                                            class="form-input w-100 datepickr"
                                        />
                                    </div>
                                    <div class="half">
                                        <span class="sub-input-label">行程結束</span>
                                        <input
                                            type="text"
                                            :value="newItemForm.scheduleEndDate"
                                            v-flatpickr="{ form: newItemForm, field: 'scheduleEndDate', minToday: true }"
                                            placeholder="請選擇行程結束"
                                            class="form-input w-100 datepickr"
                                        />
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

        <!-- ==================== MODAL 3: 維護 / 編輯團購項目 (#editModal) ==================== -->
        <div v-if="showEditModal" class="modal-backdrop" @click.self="showEditModal = false">
            <div class="bottom-sheet-modal tall-sheet">
                <div class="sheet-handle-bar"></div>
                <div class="modal-header">
                    <h3>維護團購項目</h3>
                    <button class="btn-close" @click="showEditModal = false">✕</button>
                </div>

                <div class="modal-body form-body">
                    <div class="form-group">
                        <label><span class="text-danger">*</span> 品項名稱</label>
                        <input type="text" :value="editForm.name" disabled class="form-input w-100 input-disabled" />
                    </div>

                    <div class="form-group">
                        <label>團購期間</label>
                        <div class="form-row">
                            <div class="half">
                                <span class="sub-input-label">起始時間</span>
                                <input
                                    id="editStartDate"
                                    type="text"
                                    :value="editForm.editStartDate"
                                    v-flatpickr="{ form: editForm, field: 'editStartDate', endField: 'editEndDate', minToday: true }"
                                    placeholder="請選擇起始日期"
                                    class="form-input w-100 datepickr"
                                />
                            </div>
                            <div class="half">
                                <span class="sub-input-label">結束時間</span>
                                <input
                                    id="editEndDate"
                                    type="text"
                                    :value="editForm.editEndDate"
                                    v-flatpickr="{ form: editForm, field: 'editEndDate', minToday: true }"
                                    placeholder="請選擇結束日期"
                                    class="form-input w-100 datepickr"
                                />
                            </div>
                        </div>
                    </div>

                    <div v-if="editForm.flavorType === 'single'" class="form-group box-panel">
                        <label><span class="text-danger">*</span> 價格與限量 <span class="hint-text">(※ 0為不限量)</span></label>
                        <div class="form-row">
                            <div class="half">
                                <input type="number" min="1" v-model="editForm.editPrice" placeholder="價格" class="form-input w-100" />
                            </div>
                            <div class="half">
                                <input type="number" min="0" v-model="editForm.editNum" placeholder="數量" class="form-input w-100" />
                            </div>
                        </div>
                    </div>

                    <div v-else class="form-group box-panel">
                        <label><span class="text-danger">*</span> 口味與限量 <span class="hint-text">(※ 0為不限量)</span></label>
                        <div v-for="(flv, index) in editForm.flavors" :key="index" class="flavor-input-row">
                            <input type="number" min="1" v-model="flv.price" placeholder="價格" class="form-input flex-1" />
                            <input type="text" v-model="flv.name" placeholder="口味" class="form-input flex-2" />
                            <input type="number" min="0" v-model="flv.limit" placeholder="數量" class="form-input flex-1" />
                            <button
                                v-if="editForm.flavors.length > 1"
                                type="button"
                                class="btn-remove-flavor"
                                @click="editForm.flavors.splice(index, 1)"
                            >
                                ✕
                            </button>
                        </div>
                        <button
                            type="button"
                            class="btn-add-flavor-full"
                            @click="editForm.flavors.push({ price: '', name: '', limit: 0 })"
                        >
                            ＋ 新增口味
                        </button>
                    </div>

                    <div class="form-group">
                        <label>圖片 <span class="hint-text">(最多 3 張 .jpg/.png)</span></label>
                        <input
                            type="file"
                            multiple
                            accept=".jpg, .jpeg, .png"
                            @change="(e) => handleImageUpload(e, 'edit')"
                            class="form-input file-input-custom"
                        />
                        <div v-if="editForm.images.length > 0" class="image-preview-grid">
                            <div v-for="(img, idx) in editForm.images" :key="idx" class="preview-thumb-box">
                                <img :src="img.previewUrl" alt="預覽圖" />
                                <button type="button" class="btn-remove-img" @click="editForm.images.splice(idx, 1)">✕</button>
                            </div>
                        </div>
                        <div v-if="editForm.images.length > 0" class="file-count-text">
                            已選擇 {{ editForm.images.length }} 張圖片
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn-submit-item" @click="submitEditItem" :disabled="submittingItem">
                        {{ submittingItem ? '儲存中...' : '編輯團購' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- ==================== MODAL 4: 開啟團購文案 (#cartModal) ==================== -->
        <div v-if="showCartModal" class="modal-backdrop" @click.self="showCartModal = false">
            <div class="bottom-sheet-modal tall-sheet">
                <div class="sheet-handle-bar"></div>
                <div class="modal-header">
                    <h3>開啟團購 - {{ cartTargetRow?.名稱 }}</h3>
                    <button class="btn-close" @click="showCartModal = false">✕</button>
                </div>

                <div class="modal-body form-body">
                    <button
                        type="button"
                        class="btn-ai-banner"
                        @click="generateAiCartCopy"
                        :disabled="generatingAiCopy"
                    >
                        📝 {{ generatingAiCopy ? 'AI 撰寫中...' : 'AI 文案助手' }}
                        <span class="beta-badge">Beta</span>
                    </button>

                    <div class="form-group">
                        <div class="label-with-radios">
                            <label>團購宣傳文案</label>
                            <button type="button" class="btn-copy-small" @click="copyCartText">
                                📋 複製文案
                            </button>
                        </div>
                        <textarea
                            v-model="cartContentText"
                            rows="9"
                            class="form-input w-100 textarea-copy"
                            placeholder="請輸入團購內容..."
                        ></textarea>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn-submit-item" @click="shareCartToLine">
                        🚀 開啟並分享團購
                    </button>
                </div>
            </div>
        </div>

        <!-- ==================== MODAL 5: 代購訂單 (#AgentModal) ==================== -->
        <div v-if="showAgentModal" class="modal-backdrop" @click.self="showAgentModal = false">
            <div class="bottom-sheet-modal tall-sheet">
                <div class="sheet-handle-bar"></div>
                <div class="modal-header">
                    <h3>代購訂單 - {{ agentForm.prdName }}</h3>
                    <button class="btn-close" @click="showAgentModal = false">✕</button>
                </div>

                <div class="modal-body form-body">
                    <div class="form-group">
                        <div class="label-with-radios">
                            <label><span class="text-danger">*</span> 代訂姓名來源</label>
                            <div class="radio-group-inline">
                                <label class="radio-label">
                                    <input
                                        type="radio"
                                        value="new"
                                        v-model="agentForm.nameType"
                                        @change="handleAgentNameTypeChange"
                                    />
                                    新名字
                                </label>
                                <label class="radio-label">
                                    <input
                                        type="radio"
                                        value="old"
                                        v-model="agentForm.nameType"
                                        :disabled="!agentForm.hasClosedHistory"
                                        @change="handleAgentNameTypeChange"
                                    />
                                    舊名字
                                </label>
                            </div>
                        </div>
                    </div>

                    <div class="form-group box-panel">
                        <div v-for="(agRow, idx) in agentForm.rows" :key="idx" class="flavor-input-row">
                            <input
                                v-if="agentForm.nameType === 'new'"
                                type="text"
                                v-model="agRow.name"
                                placeholder="姓名"
                                class="form-input flex-2"
                            />
                            <select
                                v-else
                                v-model="agRow.name"
                                class="form-select flex-2"
                            >
                                <option value="" disabled>請選擇姓名</option>
                                <option v-for="oldName in agentOldNames" :key="oldName" :value="oldName">
                                    {{ oldName }}
                                </option>
                            </select>

                            <select
                                v-if="agentForm.isMultiFlavor"
                                v-model="agRow.flavor"
                                class="form-select flex-2"
                            >
                                <option value="" disabled>口味</option>
                                <option
                                    v-for="flv in getValidFlavors(agentForm.prdId)"
                                    :key="flv.口味"
                                    :value="flv.口味"
                                >
                                    {{ flv.口味 }}
                                </option>
                            </select>

                            <input
                                type="number"
                                min="1"
                                v-model="agRow.qty"
                                placeholder="數量"
                                class="form-input flex-1"
                            />

                            <button
                                v-if="agentForm.rows.length > 1"
                                type="button"
                                class="btn-remove-flavor"
                                @click="agentForm.rows.splice(idx, 1)"
                            >
                                ✕
                            </button>
                        </div>

                        <button
                            type="button"
                            class="btn-add-flavor-full"
                            @click="agentForm.rows.push({ name: '', flavor: '', qty: '' })"
                        >
                            ＋ 新增名字
                        </button>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn-submit-item" @click="submitAgentOrder" :disabled="submittingItem">
                        {{ submittingItem ? '送出中...' : '確認送出代購' }}
                    </button>
                </div>
            </div>
        </div>

        <!-- ==================== MODAL 6: 歷史訂單查詢 (#searchModal) ==================== -->
        <div v-if="showSearchModal" class="modal-backdrop" @click.self="showSearchModal = false">
            <div class="bottom-sheet-modal tall-sheet">
                <div class="sheet-handle-bar"></div>
                <div class="modal-header">
                    <h3>歷史訂單查詢</h3>
                    <button class="btn-close" @click="showSearchModal = false">✕</button>
                </div>

                <div class="sub-tabs-bar">
                    <button
                        :class="['sub-tab-btn', { active: searchSubTab === 'prd' }]"
                        @click="searchSubTab = 'prd'"
                    >
                        訂單查詢
                    </button>
                    <button
                        :class="['sub-tab-btn', { active: searchSubTab === 'emp' }]"
                        @click="searchSubTab = 'emp'"
                    >
                        人員購買紀錄
                    </button>
                </div>

                <div v-if="searchSubTab === 'prd'" class="modal-body form-body">
                    <div class="form-group">
                        <div class="label-with-radios">
                            <label><span class="text-danger">*</span> 選擇品項</label>
                            <button type="button" class="btn-copy-small" @click="reloadHistoryCache" :disabled="historyLoading">
                                🔄 同步資料
                            </button>
                        </div>
                        <select v-model="searchForm.selectedPrd" class="form-select w-100">
                            <option value="" disabled>請選擇品項</option>
                            <option v-for="p in searchPrdOptions" :key="p.name" :value="p.name">
                                {{ p.name }} ({{ p.isMulti ? '多' : '單' }} / 共 {{ p.count }} 次)
                            </option>
                        </select>
                    </div>

                    <div v-if="selectedSearchPrdCount >= 3" class="form-group">
                        <label><span class="text-danger">*</span> 日期範圍 <span class="hint-text">(最多 6 個月)</span></label>
                        <div class="form-row">
                            <div class="half">
                                <span class="sub-input-label">起始日期</span>
                                <input
                                    type="text"
                                    :value="searchForm.ordStartDate"
                                    v-flatpickr="{ form: searchForm, field: 'ordStartDate', endField: 'ordEndDate', enableTime: false, dateFormat: 'Y/m/d', maxToday: true }"
                                    class="form-input w-100 datepickr"
                                />
                            </div>
                            <div class="half">
                                <span class="sub-input-label">結束日期</span>
                                <input
                                    type="text"
                                    :value="searchForm.ordEndDate"
                                    v-flatpickr="{ form: searchForm, field: 'ordEndDate', enableTime: false, dateFormat: 'Y/m/d', maxToday: true }"
                                    class="form-input w-100 datepickr"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer px-0">
                        <button class="btn-submit-item" @click="executeOrderSearch" :disabled="historyLoading">
                            {{ historyLoading ? '查詢中...' : '🔍 查詢品項紀錄' }}
                        </button>
                    </div>
                </div>

                <div v-else class="modal-body form-body">
                    <div class="form-group">
                        <div class="label-with-radios">
                            <label><span class="text-danger">*</span> 選擇人員</label>
                            <button type="button" class="btn-copy-small" @click="reloadHistoryCache" :disabled="historyLoading">
                                🔄 同步資料
                            </button>
                        </div>
                        <select v-model="searchForm.selectedEmp" class="form-select w-100">
                            <option value="" disabled>請選擇人員</option>
                            <option v-for="emp in searchEmpOptions" :key="emp" :value="emp">
                                {{ emp }}
                            </option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label><span class="text-danger">*</span> 日期範圍 <span class="hint-text">(最多 3 個月)</span></label>
                        <div class="form-row">
                            <div class="half">
                                <span class="sub-input-label">起始日期</span>
                                <input
                                    type="text"
                                    :value="searchForm.prdStartDate"
                                    v-flatpickr="{ form: searchForm, field: 'prdStartDate', endField: 'prdEndDate', enableTime: false, dateFormat: 'Y/m/d', maxToday: true }"
                                    class="form-input w-100 datepickr"
                                />
                            </div>
                            <div class="half">
                                <span class="sub-input-label">結束日期</span>
                                <input
                                    type="text"
                                    :value="searchForm.prdEndDate"
                                    v-flatpickr="{ form: searchForm, field: 'prdEndDate', enableTime: false, dateFormat: 'Y/m/d', maxToday: true }"
                                    class="form-input w-100 datepickr"
                                />
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer px-0">
                        <button class="btn-submit-item" @click="executeEmpSearch" :disabled="historyLoading">
                            {{ historyLoading ? '查詢中...' : '🔍 查詢人員購買紀錄' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, onUnmounted, nextTick } from 'vue'
import Swal from 'sweetalert2'
import flatpickr from 'flatpickr'
import 'flatpickr/dist/flatpickr.min.css'
import { MandarinTraditional } from 'flatpickr/dist/l10n/zh-tw.js'
import { fetchItemsData, postGasData } from '../services/api.js'

const props = defineProps({
    userId: {
        type: String,
        default: ''
    }
})

const CLOUDINARY_BASE_URL = 'https://res.cloudinary.com/dwavqm0sh/image/upload/'

// ==================== SweetAlert2 輔助函式 ====================
const showSwalSuccess = (title, text = '') => {
    return Swal.fire({
        icon: 'success',
        title,
        text: text || undefined,
        confirmButtonText: '確定',
        confirmButtonColor: '#16a34a'
    })
}

const showSwalError = (title, text = '') => {
    return Swal.fire({
        icon: 'error',
        title,
        text: text || undefined,
        confirmButtonText: '確定',
        confirmButtonColor: '#dc2626'
    })
}

const showSwalInfo = (title, text = '') => {
    return Swal.fire({
        icon: 'info',
        title,
        text: text || undefined,
        confirmButtonText: '確定',
        confirmButtonColor: '#2563eb'
    })
}

const showSwalConfirm = async (title, text = '此操作無法復原！', confirmText = '確定') => {
    const result = await Swal.fire({
        icon: 'warning',
        title,
        text,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: '取消',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        reverseButtons: true
    })
    return Boolean(result.isConfirmed)
}

const items = ref([])
const flavors = ref([])
const loading = ref(false)
const historyLoading = ref(false)
const currentPage = ref(1)
const pageSize = 5
const activeDropdownId = ref(null)
const activeMainTab = ref('items') // 'items' | 'history'

// ==================== 共用 Flatpickr 指令 (.datepickr) ====================
const pickerMap = new Map()

const vFlatpickr = {
    mounted(el, binding) {
        const {
            form,
            field,
            endField,
            enableTime = true,
            dateFormat = 'Y-m-d H:i',
            minToday = false,
            maxToday = false
        } = binding.value || {}

        if (!form || !field) return

        const options = {
            locale: MandarinTraditional,
            enableTime,
            time_24hr: true,
            dateFormat,
            disableMobile: true,
            defaultDate: form[field] || null,
            onChange: (_selectedDates, dateStr) => {
                form[field] = dateStr

                if (endField) {
                    const endFp = pickerMap.get(endField)
                    if (endFp) {
                        endFp.set('minDate', dateStr || null)
                        if (form[endField] && dateStr && form[endField] < dateStr) {
                            form[endField] = dateStr
                            endFp.setDate(dateStr, false)
                        }
                    }
                }
            }
        }

        if (minToday) options.minDate = 'today'
        if (maxToday) options.maxDate = 'today'

        const instance = flatpickr(el, options)
        el._fpInstance = instance
        pickerMap.set(field, instance)
    },
    updated(el, binding) {
        const { form, field } = binding.value || {}
        const instance = el._fpInstance
        if (!instance || !form || !field) return

        const val = form[field] || ''
        if (instance.input.value !== val) {
            instance.setDate(val, false)
        }
    },
    unmounted(el, binding) {
        const { field } = binding.value || {}
        if (field) pickerMap.delete(field)
        if (el._fpInstance) {
            el._fpInstance.destroy()
            delete el._fpInstance
        }
    }
}

// ==================== 身分 UserId 初始化 ====================
const getInitialUserId = () => {
    const urlParams = new URLSearchParams(window.location.search)
    const paramUserId = urlParams.get('userId')

    if (props.userId) {
        localStorage.setItem('cached_userId', props.userId)
        return props.userId
    }

    if (paramUserId) {
        localStorage.setItem('cached_userId', paramUserId)
        return paramUserId
    }

    return localStorage.getItem('cached_userId') || window.userId || ''
}

const userId = ref(getInitialUserId())

watch(
    () => props.userId,
    (newVal) => {
        if (newVal) {
            userId.value = newVal
            localStorage.setItem('cached_userId', newVal)
        }
    },
    { immediate: true }
)

// ==================== 載入品項列表 ====================
const loadData = async () => {
    loading.value = true
    try {
        const result = await fetchItemsData()
        const rawItems = result.items || []
        flavors.value = result.flavors || []

        items.value = [...rawItems]
            .sort((a, b) => Number(b.ID) - Number(a.ID))
            .filter(prd => Number(prd.訂單金額總計) > 0 || prd.狀態 === '開啟中' || prd.狀態 === '延後中')

        currentPage.value = 1
    } catch (error) {
        console.error(error)
        await showSwalError('資料載入失敗', '請稍後再試')
    } finally {
        loading.value = false
    }
}

// ==================== 圖片與限量 helper ====================
const getItemFlavorRecords = (itemId) => {
    return flavors.value.filter(f => String(f.品項ID || f.ID) === String(itemId))
}

const parseRawImageString = (rawImgStr) => {
    if (!rawImgStr || String(rawImgStr).trim() === '') return []
    return String(rawImgStr)
        .split('|')
        .map(s => s.trim())
        .filter(Boolean)
        .map(filename => (filename.startsWith('http') ? filename : `${CLOUDINARY_BASE_URL}${filename}`))
}

const getRawImageByItemId = (itemId) => {
    const recs = getItemFlavorRecords(itemId)
    return recs.map(r => r.圖片).find(img => img && String(img).trim() !== '') || ''
}

const getItemImageUrls = (itemId, itemName = '') => {
    const directRaw = getRawImageByItemId(itemId)
    if (directRaw) {
        return parseRawImageString(directRaw)
    }

    const targetName =
        itemName || items.value.find(i => String(i.ID) === String(itemId))?.名稱 || ''
    if (!targetName) return []

    const sameNameItems = items.value.filter(
        i => i.名稱 === targetName && String(i.ID) !== String(itemId)
    )
    for (const other of sameNameItems) {
        const fallbackRaw = getRawImageByItemId(other.ID)
        if (fallbackRaw) {
            return parseRawImageString(fallbackRaw)
        }
    }

    return []
}

const formatRemainingText = (remain) => {
    const num = Number(remain) || 0
    if (num < 0) return `多 ${Math.abs(num)}`
    if (num === 0) return '完售'
    return `剩 ${num}`
}

const getValidFlavors = (itemId) => {
    return getItemFlavorRecords(itemId).filter(f => f.口味 && String(f.口味).trim() !== '')
}

const getSingleItemLimit = (itemId) => {
    const item = items.value.find(i => String(i.ID) === String(itemId))
    if (item && Number(item.限量) > 0) return Number(item.限量)

    const flavorRecord = getItemFlavorRecords(itemId)[0]
    if (flavorRecord && Number(flavorRecord.限量) > 0) return Number(flavorRecord.限量)

    return 0
}

const getSingleRemaining = (row) => {
    const limit = getSingleItemLimit(row.ID)
    if (!limit) return 0

    const unitPrice = Number(row.售價)
    if (!unitPrice || unitPrice <= 0) return limit

    const hasAppend = Number(row.追加金額總計) > 0
    const baseAmount = hasAppend
        ? Number(row.追加金額總計) || 0
        : Number(row.訂單金額總計) || 0

    const estimatedQty = Math.round(baseAmount / unitPrice)
    return limit - estimatedQty
}

const getFlavorRemaining = (row, flv) => {
    const limit = Number(flv.限量) || 0
    if (!limit) return 0

    const unitPrice = Number(flv.價格)
    if (!unitPrice || unitPrice <= 0) return limit

    const validFlvs = getValidFlavors(row.ID)
    if (validFlvs.length === 0) return limit

    const sumOfAllFlavorPrices = validFlvs.reduce((acc, cur) => acc + (Number(cur.價格) || 0), 0)
    if (sumOfAllFlavorPrices <= 0) return limit

    const hasAppend = Number(row.追加金額總計) > 0
    const baseAmount = hasAppend
        ? Number(row.追加金額總計) || 0
        : Number(row.訂單金額總計) || 0

    const allocatedAmount = baseAmount * (unitPrice / sumOfAllFlavorPrices)
    const estimatedQty = Math.round(allocatedAmount / unitPrice)
    return limit - estimatedQty
}

const hasValidDeadline = (row) => {
    return (
        row.限時開始 &&
        row.限時結束 &&
        row.限時開始 !== '---' &&
        row.限時結束 !== '---'
    )
}

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

// ==================== MODAL 1: 管理 / 檢視訂單 & 追加訂單 ====================
const showOrderModal = ref(false)
const orderModalMode = ref('view') // 'view' | 'upd'
const orderSubTab = ref('list')    // 'list' | 'append'
const isHistorySearchView = ref(false)
const orderLoading = ref(false)
const currentOrderTitle = ref('')
const currentItemId = ref(null)
const rawOrderList = ref([])
const orderTotal = ref(0)
const orderNameFilter = ref('')
const appendRows = ref([{ name: '', flavor: '', qty: '' }])

const isCurrentItemMultiFlavor = computed(() => {
    if (!currentItemId.value) return false
    return getValidFlavors(currentItemId.value).length > 0
})

const overallTotalQty = computed(() => {
    if (orderModalMode.value === 'upd') {
        return rawOrderList.value.reduce((sum, item) => {
            const sub = Array.isArray(item.orders)
                ? item.orders.reduce((s, o) => s + (Number(o.count) || 0), 0)
                : 0
            return sum + sub
        }, 0)
    }
    return rawOrderList.value.reduce((sum, ord) => sum + (Number(ord.數量) || 1), 0)
})

const overallFlavorTotals = computed(() => {
    const totals = {}
    if (orderModalMode.value === 'upd') {
        rawOrderList.value.forEach(item => {
            (item.orders || []).forEach(ord => {
                if (ord.taste) {
                    totals[ord.taste] = (totals[ord.taste] || 0) + (Number(ord.count) || 0)
                }
            })
        })
    } else {
        rawOrderList.value.forEach(ord => {
            const flv = ord.口味
            const qty = Number(ord.數量) || 1
            if (flv) {
                totals[flv] = (totals[flv] || 0) + qty
            }
        })
    }
    return totals
})

const groupedOrders = computed(() => {
    const map = {}

    if (orderModalMode.value === 'upd') {
        rawOrderList.value.forEach(item => {
            const name = item.name || '未具名'
            if (!map[name]) {
                map[name] = {
                    name,
                    isAppend: String(name).includes('追加'),
                    flavorMap: {},
                    totalQty: 0,
                    totalAmount: 0,
                    type: isCurrentItemMultiFlavor.value ? 'multi' : 'single'
                }
            }
            ;(item.orders || []).forEach(ord => {
                const qty = Number(ord.count) || 0
                const total = Number(ord.total) || 0
                map[name].totalQty += qty
                map[name].totalAmount += total
                if (ord.taste) {
                    map[name].flavorMap[ord.taste] = (map[name].flavorMap[ord.taste] || 0) + qty
                }
            })
        })
    } else {
        rawOrderList.value.forEach(ord => {
            const name = ord.名稱 || ord.姓名 || ord.使用者 || '未具名'
            const flavor = ord.口味 || ''
            const qty = Number(ord.數量) || 1
            const amount = Number(ord.小計 || ord.金額) || 0
            const isAppend = String(name).includes('追加') || String(ord.備註 || '').includes('追加')

            if (!map[name]) {
                map[name] = {
                    name,
                    isAppend,
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
    }

    return Object.values(map)
})

const filteredGroupedOrders = computed(() => {
    const kw = orderNameFilter.value.trim().toLowerCase()
    if (!kw) return groupedOrders.value
    return groupedOrders.value.filter(g => String(g.name).toLowerCase().includes(kw))
})

const copyOrderSummaryAndList = async () => {
    const lines = [`【${currentOrderTitle.value}】訂單統計與名單`]

    if (isCurrentItemMultiFlavor.value) {
        const flvSummary = Object.entries(overallFlavorTotals.value)
            .map(([flv, q]) => `${flv} x${q}`)
            .join('、')
        lines.push(`口味統計：${flvSummary || '無'}（共 ${overallTotalQty.value} 份）`)
    } else {
        lines.push(`總訂購數量：${overallTotalQty.value} 份`)
    }

    lines.push('--------------------')
    groupedOrders.value.forEach(g => {
        if (g.type === 'multi') {
            const detail = Object.entries(g.flavorMap)
                .map(([flv, q]) => `${flv}x${q}`)
                .join('、')
            lines.push(`• ${g.name}：${detail}（$${Number(g.totalAmount || 0).toLocaleString()}）`)
        } else {
            lines.push(`• ${g.name}：x${g.totalQty}（$${Number(g.totalAmount || 0).toLocaleString()}）`)
        }
    })
    lines.push('--------------------')
    lines.push(`總金額：$${Number(orderTotal.value || 0).toLocaleString()}`)

    const output = lines.join('\n')
    try {
        await navigator.clipboard.writeText(output)
        await showSwalSuccess('已複製統計與下單名單！')
    } catch {
        await showSwalInfo('複製失敗，請手動複製', output)
    }
}

const switchToAppendTab = () => {
    appendRows.value = [{ name: '', flavor: '', qty: '' }]
    orderSubTab.value = 'append'
}

const submitAppendOrder = async () => {
    const validRows = appendRows.value.filter(r => r.name.trim() && Number(r.qty) > 0)
    if (validRows.length === 0) {
        await showSwalInfo('請填寫追加姓名與有效數量')
        return
    }
    if (isCurrentItemMultiFlavor.value && validRows.some(r => !r.flavor)) {
        await showSwalInfo('請為每筆追加名單選擇口味')
        return
    }

    const apOrders = validRows.map(r => ({
        orders: [{ flavor: isCurrentItemMultiFlavor.value ? r.flavor : '', qty: r.qty }],
        name: '(追加)' + r.name.trim(),
        id: '(追加)' + r.name.trim(),
        item: currentOrderTitle.value
    }))

    try {
        submittingItem.value = true
        const result = await postGasData({
            type: 'append',
            userId: userId.value,
            id: currentItemId.value,
            name: currentOrderTitle.value,
            apOrders
        })

        if (result && result[0] && result[0].status === 'success') {
            await showSwalSuccess('追加成功！')
            showOrderModal.value = false
            await loadData()
        } else {
            await showSwalError('追加失敗', result[0]?.alert || '請稍後再試')
        }
    } catch (err) {
        console.error(err)
        await showSwalError('系統異常')
    } finally {
        submittingItem.value = false
    }
}

const handleOrderStatusAction = async (type) => {
    const labelMap = { stop: '延後該品項', delapd: '刪除追加訂單' }
    const confirmed = await showSwalConfirm(
        `確定要${labelMap[type] || '執行此操作'}「${currentOrderTitle.value}」嗎？`,
        '此操作無法復原！',
        '確定執行'
    )
    if (!confirmed) return

    try {
        orderLoading.value = true
        const result = await postGasData({
            type,
            userId: userId.value,
            id: currentItemId.value,
            name: currentOrderTitle.value
        })

        if (result && result[0] && result[0].status === 'success') {
            await showSwalSuccess('操作成功！', result[0].alert || '')
            showOrderModal.value = false
            await loadData()
        } else {
            await showSwalError('操作失敗', result[0]?.alert || '請稍後再試')
        }
    } catch (err) {
        console.error(err)
        await showSwalError('系統異常')
    } finally {
        orderLoading.value = false
    }
}

const handleShareOrderList = async () => {
    const text = `親愛的朋友們~\n已下單【${currentOrderTitle.value}】名單如下哦!`
    try {
        if (window.liff && window.liff.isInClient()) {
            const res = await window.liff.shareTargetPicker([{ type: 'text', text }])
            if (res) await showSwalSuccess('分享成功！', '請回到該群組查看訊息。')
        } else {
            await navigator.clipboard.writeText(text)
            await showSwalSuccess('已複製分享文案', text)
        }
    } catch (e) {
        if (e?.code !== 'USER_CANCEL') console.error('分享失敗:', e)
    }
}

const handleDeleteUserOrder = async (userName) => {
    const confirmed = await showSwalConfirm(
        `確定要刪除「${userName}」在此品項的訂單嗎？`,
        '此操作無法復原！',
        '確定刪除'
    )
    if (!confirmed) return

    try {
        orderLoading.value = true
        const result = await postGasData({
            type: 'deluser',
            userId: userId.value,
            user: userName,
            id: currentItemId.value,
            name: currentOrderTitle.value
        })

        if (result && result[0] && result[0].status === 'success') {
            await showSwalSuccess(`${userName} 下單品項「${currentOrderTitle.value}」已刪除！`)
            rawOrderList.value = rawOrderList.value.filter(item => {
                const n = item.name || item.姓名 || item.名稱
                return n !== userName
            })
        } else {
            await showSwalError('刪除失敗', result[0]?.alert || '請稍後再試')
        }
    } catch (err) {
        console.error(err)
        await showSwalError('系統異常')
    } finally {
        orderLoading.value = false
    }
}

const closeOrderModal = () => {
    showOrderModal.value = false
    orderNameFilter.value = ''
}

// ==================== 卡片操作入口分流 ====================
const handleAction = async (type, row) => {
    activeDropdownId.value = null

    if (type === 'view' || type === 'upd') {
        orderModalMode.value = type
        orderSubTab.value = 'list'
        isHistorySearchView.value = row.search === 'Y'
        currentOrderTitle.value = row.名稱
        currentItemId.value = row.ID
        orderNameFilter.value = ''
        showOrderModal.value = true
        orderLoading.value = true
        rawOrderList.value = []
        orderTotal.value = 0

        const flavorCode = row.售價 === '---' ? 2 : 1

        try {
            const result = await postGasData({
                type,
                userId: userId.value,
                id: row.ID,
                name: row.名稱,
                flavor: flavorCode,
                search: row.search || ''
            })
            if (result && result[0] && result[0].status === 'success') {
                rawOrderList.value = result[0].orders || []
                orderTotal.value = Number(result[0].total) || 0
            } else {
                await showSwalError('讀取訂單失敗', result[0]?.alert || '請稍後再試')
            }
        } catch (err) {
            console.error(err)
            await showSwalError('系統異常')
        } finally {
            orderLoading.value = false
        }
        return
    }

    if (type === 'open') {
        openCartModal(row)
        return
    }

    if (type === 'edit') {
        openEditModal(row)
        return
    }

    if (type === 'agent') {
        openAgentModal(row)
        return
    }

    const title = type === 'chkout' ? '結單' : type === 'delete' ? '刪除' : ''
    if (!title) return
    const confirmed = await showSwalConfirm(
        `你確定要${title}品項「${row.名稱}」嗎？`,
        '此操作無法復原！',
        `確定${title}`
    )
    if (!confirmed) return

    try {
        loading.value = true
        const result = await postGasData({
            type,
            userId: userId.value,
            id: row.ID,
            name: row.名稱
        })
        if (result && result[0] && result[0].status === 'success') {
            await showSwalSuccess(`${title}成功！`, result[0].alert || '')
            await loadData()
        } else {
            await showSwalError(`${title}失敗`, result[0]?.alert || '請稍後再試')
        }
    } catch (err) {
        console.error(err)
        await showSwalError('系統異常')
    } finally {
        loading.value = false
    }
}

// ==================== 圖片上傳處理 ====================
const handleImageUpload = async (event, target) => {
    const files = Array.from(event.target.files || [])
    const targetList = target === 'add' ? newItemForm.images : editForm.images

    if (targetList.length + files.length > 3) {
        await showSwalInfo('最多只能上傳 3 張圖片')
        event.target.value = ''
        return
    }

    for (const file of files) {
        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            await showSwalError('圖片格式錯誤', `${file.name} 只允許 JPG 或 PNG`)
            continue
        }
        if (file.size > 5 * 1024 * 1024) {
            await showSwalError('圖片超過大小限制', `${file.name} 超過 5MB 限制`)
            continue
        }

        const reader = new FileReader()
        reader.onload = (e) => {
            targetList.push({
                filename: file.name,
                mimeType: file.type,
                data: e.target.result,
                previewUrl: e.target.result
            })
        }
        reader.readAsDataURL(file)
    }

    event.target.value = ''
}

// ==================== MODAL 2: 新增團購項目 ====================
const showAddItemModal = ref(false)
const submittingItem = ref(false)
const showMoreOptions = ref(false)
const aiNameOptions = ref([])

const newItemForm = reactive({
    itemType: 'new',
    selectedOldId: '',
    name: '',
    startDate: '',
    endDate: '',
    flavorType: 'single',
    price: '',
    singleLimit: 0,
    flavors: [
        { price: '', name: '', limit: 0 },
        { price: '', name: '', limit: 0 }
    ],
    images: [],
    scheduleType: '',
    scheduleStartDate: '',
    scheduleEndDate: ''
})

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
    newItemForm.images = []
    newItemForm.scheduleType = ''
    newItemForm.scheduleStartDate = ''
    newItemForm.scheduleEndDate = ''
    showMoreOptions.value = false
    aiNameOptions.value = []
    showAddItemModal.value = true
}

const closeAddItemModal = () => {
    showAddItemModal.value = false
}

const handleItemTypeChange = () => {
    newItemForm.name = ''
    newItemForm.selectedOldId = ''
    newItemForm.images = []
    aiNameOptions.value = []
}

const handleSelectOldItem = () => {
    const oldId = newItemForm.selectedOldId
    if (!oldId) {
        newItemForm.images = []
        return
    }

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

    const imgUrls = getItemImageUrls(oldId, targetItem.名稱)
    newItemForm.images = imgUrls.slice(0, 3).map(url => {
        const filename = url.replace(CLOUDINARY_BASE_URL, '')
        return {
            filename,
            mimeType: 'uploaded',
            data: '',
            previewUrl: url
        }
    })
}

const showAiDescription = async () => {
    await showSwalInfo(
        'AI 命名助手說明',
        '助手將會一次產生三組名稱，產生後點擊該名稱即可套用至品項名稱上！'
    )
}

const handleAiHelp = async (mode) => {
    if (!newItemForm.name.trim()) {
        await showSwalInfo('請先輸入品項名稱！')
        return
    }
    try {
        submittingItem.value = true
        const result = await postGasData({
            type: mode,
            userId: userId.value,
            name: newItemForm.name.trim(),
            price: '',
            deadline: ''
        })
        if (result && result[0] && result[0].status === 'success') {
            const rawText = result[0].text || ''
            try {
                const parsed = JSON.parse(rawText)
                if (Array.isArray(parsed)) {
                    aiNameOptions.value = parsed.map(s => String(s).trim())
                    return
                }
            } catch {
                // 若非 JSON 陣列則直接提示
            }
            await showSwalInfo('AI 建議結果', rawText)
        } else {
            await showSwalError('AI 命名失敗', result[0]?.alert || '撰寫失敗，已達每月使用上限！')
        }
    } catch (err) {
        console.error(err)
        await showSwalError('AI 服務連線異常')
    } finally {
        submittingItem.value = false
    }
}

const submitAddItem = async () => {
    if (!userId.value) {
        await showSwalError('尚未取得 userId')
        return
    }
    if (!newItemForm.name.trim()) {
        await showSwalInfo('請填寫品項名稱')
        return
    }

    if (newItemForm.scheduleType === 'group_time' && (!newItemForm.startDate || !newItemForm.endDate)) {
        await showSwalInfo('請輸入團購期間！')
        return
    }
    if (newItemForm.scheduleType === 'custom_time' && (!newItemForm.scheduleStartDate || !newItemForm.scheduleEndDate)) {
        await showSwalInfo('請輸入自訂時間！')
        return
    }

    const range =
        newItemForm.startDate && newItemForm.endDate
            ? `${newItemForm.startDate} 至 ${newItemForm.endDate}`
            : ''

    let flavorsPayload = []
    let pricePayload = []

    if (newItemForm.flavorType === 'single') {
        const p = parseInt(newItemForm.price, 10)
        const limitVal = parseInt(newItemForm.singleLimit, 10)
        if (!p || p <= 0) {
            await showSwalInfo('價格不能為 0 或小於 0')
            return
        }
        if (isNaN(limitVal) || limitVal < 0) {
            await showSwalInfo('請輸入有效的限量')
            return
        }
        pricePayload.push(p)
        flavorsPayload.push({ flavor: '', num: limitVal, price: p })
    } else {
        for (const row of newItemForm.flavors) {
            const fName = row.name.trim()
            const p = parseInt(row.price, 10)
            const limitVal = parseInt(row.limit, 10)
            if (!fName || isNaN(limitVal) || limitVal < 0 || !p || p <= 0) {
                await showSwalInfo('請填寫所有口味與有效數量及價格')
                return
            }
            pricePayload.push(p)
            flavorsPayload.push({ flavor: fName, num: limitVal, price: p })
        }
    }

    const filePayload = newItemForm.images.map(img => ({
        filename: img.filename,
        mimeType: img.mimeType,
        data: img.data
    }))

    try {
        submittingItem.value = true
        const result = await postGasData({
            type: 'create',
            userId: userId.value,
            name: newItemForm.name.trim(),
            range,
            price: pricePayload,
            flavors: flavorsPayload,
            file: filePayload.length > 0 ? filePayload : '',
            scheduleType: newItemForm.scheduleType,
            scheduleStartDate: newItemForm.scheduleStartDate,
            scheduleEndDate: newItemForm.scheduleEndDate
        })

        if (result && result[0] && result[0].status === 'success') {
            await showSwalSuccess(`品項「${newItemForm.name.trim()}」已新增！`)
            closeAddItemModal()
            await loadData()
        } else {
            await showSwalError('新增失敗', result[0]?.alert || '送出失敗，請稍後再試')
        }
    } catch (err) {
        console.error(err)
        await showSwalError('系統異常')
    } finally {
        submittingItem.value = false
    }
}

// ==================== MODAL 3: 維護 / 編輯團購項目 (#editModal) ====================
const showEditModal = ref(false)
const editForm = reactive({
    id: '',
    name: '',
    flavorType: 'single',
    editStartDate: '',
    editEndDate: '',
    editPrice: '',
    editNum: 0,
    flavors: [],
    images: []
})

const openEditModal = async (row) => {
    const validFlvs = getValidFlavors(row.ID)
    editForm.id = row.ID
    editForm.name = row.名稱
    editForm.editStartDate = hasValidDeadline(row) ? row.限時開始 : ''
    editForm.editEndDate = hasValidDeadline(row) ? row.限時結束 : ''

    if (validFlvs.length > 0) {
        editForm.flavorType = 'multiple'
        editForm.flavors = validFlvs.map(f => ({
            price: f.價格 || '',
            name: f.口味 || '',
            limit: f.限量 || 0
        }))
    } else {
        editForm.flavorType = 'single'
        editForm.editPrice = row.售價 !== '---' ? row.售價 : ''
        editForm.editNum = getSingleItemLimit(row.ID) || 0
    }

    const imgUrls = getItemImageUrls(row.ID, row.名稱)
    editForm.images = imgUrls.map(url => {
        const filename = url.replace(CLOUDINARY_BASE_URL, '')
        return {
            filename,
            mimeType: 'uploaded',
            data: '',
            previewUrl: url
        }
    })

    showEditModal.value = true

    await nextTick()
    if (editForm.editStartDate) {
        pickerMap.get('editEndDate')?.set('minDate', editForm.editStartDate)
    }
}

const submitEditItem = async () => {
    const range =
        editForm.editStartDate && editForm.editEndDate
            ? `${editForm.editStartDate} 至 ${editForm.editEndDate}`
            : ''

    let flavorsPayload = []
    let pricePayload = []

    if (editForm.flavorType === 'multiple') {
        for (const row of editForm.flavors) {
            const fName = row.name.trim()
            const p = parseInt(row.price, 10)
            const limitVal = parseInt(row.limit, 10)
            if (!fName || isNaN(limitVal) || limitVal < 0 || !p || p <= 0) {
                await showSwalInfo('請填寫所有口味與有效數量及價格')
                return
            }
            flavorsPayload.push({ flavor: fName, num: limitVal, price: p })
            pricePayload.push(p)
        }
    } else {
        const p = parseInt(editForm.editPrice, 10)
        const limitVal = parseInt(editForm.editNum, 10) || 0
        if (!p || p <= 0) {
            await showSwalInfo('請輸入有效的價格')
            return
        }
        flavorsPayload.push({ flavor: '', num: limitVal, price: p })
        pricePayload.push(p)
    }

    const filePayload = editForm.images.map(img => ({
        filename: img.filename,
        mimeType: img.mimeType,
        data: img.data
    }))

    try {
        submittingItem.value = true
        const result = await postGasData({
            type: 'edit',
            userId: userId.value,
            id: editForm.id,
            name: editForm.name,
            flavors: flavorsPayload,
            price: pricePayload,
            range,
            file: filePayload.length > 0 ? filePayload : ''
        })

        if (result && result[0] && result[0].status === 'success') {
            await showSwalSuccess('編輯成功！')
            showEditModal.value = false
            await loadData()
        } else {
            await showSwalError('編輯失敗', result[0]?.alert || '請稍後再試')
        }
    } catch (err) {
        console.error(err)
        await showSwalError('系統異常')
    } finally {
        submittingItem.value = false
    }
}

// ==================== MODAL 4: 開啟團購文案 (#cartModal) ====================
const showCartModal = ref(false)
const cartTargetRow = ref(null)
const cartContentText = ref('')
const generatingAiCopy = ref(false)

const buildItemPriceAndDeadline = (row) => {
    let priceText = ''
    const flvs = flavors.value.filter(val => String(val.品項ID) === String(row.ID))

    if (flvs.length > 0) {
        flvs.forEach((item, i) => {
            if (row.售價 === '---') {
                priceText += i === 0 ? `${item.價格}元/盒` : `、${item.價格}元/盒`
                priceText += `(${item.口味}`
                if (Number(item.限量) > 0) priceText += `，限量${item.限量}盒`
                priceText += `)`
            } else {
                priceText += `${row.售價}元/個`
                if (Number(item.限量) > 0) priceText += `(限量${item.限量}個)`
            }
        })
    }

    const deadlineText = hasValidDeadline(row) ? `${row.限時開始} ~ ${row.限時結束}` : ''
    return { priceText, deadlineText }
}

const openCartModal = (row) => {
    cartTargetRow.value = row
    const { priceText, deadlineText } = buildItemPriceAndDeadline(row)

    let text = `親愛的朋友們~\n開團【${row.名稱}】\n想吃的人客記得下單喔\n`
    if (priceText) text += `價格：${priceText}\n`
    if (deadlineText) text += `限時：${deadlineText}\n`
    text += `下單後才會開始製作請耐心等待❤️`

    cartContentText.value = text
    showCartModal.value = true
}

const generateAiCartCopy = async () => {
    if (!cartTargetRow.value) return
    const row = cartTargetRow.value
    const { priceText, deadlineText } = buildItemPriceAndDeadline(row)

    try {
        generatingAiCopy.value = true
        const result = await postGasData({
            type: 'aiwrite',
            userId: userId.value,
            id: row.ID,
            name: row.名稱,
            price: priceText,
            deadline: deadlineText
        })

        if (result && result[0] && result[0].status === 'success') {
            cartContentText.value = result[0].text || ''
        } else {
            await showSwalError('AI 文案生成失敗', result[0]?.alert || '撰寫失敗，已達每月使用上限！')
        }
    } catch (err) {
        console.error(err)
        await showSwalError('AI 文案生成異常')
    } finally {
        generatingAiCopy.value = false
    }
}

const copyCartText = async () => {
    try {
        await navigator.clipboard.writeText(cartContentText.value)
        await showSwalSuccess('已複製團購文案！')
    } catch {
        await showSwalInfo('複製失敗，請手動選取複製')
    }
}

const shareCartToLine = async () => {
    const text = cartContentText.value.trim()
    if (!text) return

    try {
        if (window.liff && window.liff.isInClient()) {
            const result = await window.liff.shareTargetPicker([{ type: 'text', text }])
            if (result && result.status !== 'cancel') {
                await showSwalSuccess('開團成功！', '請回到分享該群組查看訊息哦！')
                showCartModal.value = false
            }
        } else {
            await navigator.clipboard.writeText(text)
            await showSwalSuccess('已複製開團文案（非 LINE 內建瀏覽器環境）', text)
        }
    } catch (e) {
        if (e?.code !== 'USER_CANCEL') console.error('分享失敗:', e)
    }
}

// ==================== MODAL 5: 代購訂單 (#AgentModal) ====================
const showAgentModal = ref(false)
const agentOldNames = ref([])
const agentForm = reactive({
    prdId: '',
    prdName: '',
    isMultiFlavor: false,
    hasClosedHistory: false,
    nameType: 'new',
    rows: [{ name: '', flavor: '', qty: '' }]
})

const openAgentModal = (row) => {
    const validFlvs = getValidFlavors(row.ID)
    const closedSameItems = items.value.filter(
        prd => prd.狀態 === '已結單' && prd.名稱 === row.名稱
    )

    agentForm.prdId = row.ID
    agentForm.prdName = row.名稱
    agentForm.isMultiFlavor = validFlvs.length > 0
    agentForm.hasClosedHistory = closedSameItems.length > 0
    agentForm.nameType = 'new'
    agentForm.rows = [{ name: '', flavor: '', qty: '' }]
    agentOldNames.value = []
    showAgentModal.value = true
}

const handleAgentNameTypeChange = async () => {
    agentForm.rows = [{ name: '', flavor: '', qty: '' }]

    if (agentForm.nameType === 'old' && agentOldNames.value.length === 0) {
        try {
            submittingItem.value = true
            const result = await postGasData({
                type: 'aguser',
                userId: userId.value,
                name: agentForm.prdName
            })
            if (result && result[0] && result[0].status === 'success') {
                const rawOrders = result[0].orders || {}
                agentOldNames.value = [
                    ...new Set(Object.values(rawOrders).flat().map(item => item.姓名).filter(Boolean))
                ]
            }
        } catch (err) {
            console.error(err)
        } finally {
            submittingItem.value = false
        }
    }
}

const submitAgentOrder = async () => {
    const validRows = agentForm.rows.filter(r => r.name.trim() && Number(r.qty) > 0)
    if (validRows.length === 0) {
        await showSwalInfo('請填寫代訂姓名與有效數量')
        return
    }
    if (agentForm.isMultiFlavor && validRows.some(r => !r.flavor)) {
        await showSwalInfo('請為每筆代購選擇口味')
        return
    }

    const agOrders = validRows.map(r => ({
        orders: [{ flavor: agentForm.isMultiFlavor ? r.flavor : '', qty: r.qty }],
        name: r.name.trim(),
        id: r.name.trim(),
        item: agentForm.prdName
    }))

    try {
        submittingItem.value = true
        const result = await postGasData({
            type: 'agent',
            userId: userId.value,
            agOrders
        })

        if (result && result[0] && result[0].status === 'success') {
            await showSwalSuccess(result[0].alert || '代購成功！', '請到管理訂單查看訂單明細')
            showAgentModal.value = false
            await loadData()
        } else {
            await showSwalError('代訂失敗', result[0]?.alert || '請稍後再試')
        }
    } catch (err) {
        console.error(err)
        await showSwalError('系統異常')
    } finally {
        submittingItem.value = false
    }
}

// ==================== TAB 2 & MODAL 6: 歷史訂單查詢 ====================
const showSearchModal = ref(false)
const searchSubTab = ref('prd') // 'prd' | 'emp'
const historyViewMode = ref('empty') // 'empty' | 'table' | 'chart'
const historyTableRows = ref([])
const historyResultTitle = ref('')
const historyResultSubtitle = ref('')
const historyChartSeries = ref([])
const historyPriceSeries = ref([])

const cachedSearchPrds = ref([])
const cachedSearchFlvs = ref([])
const cachedSearchEmps = ref([])

const getMonthsAgoStr = (months) => {
    const d = new Date()
    d.setMonth(d.getMonth() - months)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}/${m}/${day}`
}

const getTodayStr = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}/${m}/${day}`
}

const searchForm = reactive({
    selectedPrd: '',
    ordStartDate: getMonthsAgoStr(6),
    ordEndDate: getTodayStr(),
    selectedEmp: '',
    prdStartDate: getMonthsAgoStr(3),
    prdEndDate: getTodayStr()
})

const ensureHistoryCacheLoaded = async () => {
    let prd = JSON.parse(localStorage.getItem('prd_list') || '[]')
    let flv = JSON.parse(localStorage.getItem('flv_list') || '[]')
    let emp = JSON.parse(localStorage.getItem('emp_list') || '[]')

    if (prd.length === 0 && flv.length === 0 && emp.length === 0) {
        try {
            historyLoading.value = true
            const res = await postGasData({ type: 'search', userId: userId.value })
            if (res && res[0] && res[0].status === 'success') {
                const pData = res[0].data || {}
                prd = pData['品項列表'] || []
                flv = pData['口味列表'] || []
                emp = pData['人員列表'] || []

                localStorage.setItem('prd_list', JSON.stringify(prd))
                localStorage.setItem('flv_list', JSON.stringify(flv))
                localStorage.setItem('emp_list', JSON.stringify(emp))
            }
        } catch (err) {
            console.error(err)
            await showSwalError('歷史資料載入失敗')
        } finally {
            historyLoading.value = false
        }
    }

    cachedSearchPrds.value = prd
    cachedSearchFlvs.value = flv
    cachedSearchEmps.value = emp
}

const switchToHistoryTab = async () => {
    activeMainTab.value = 'history'
    await ensureHistoryCacheLoaded()
}

const openSearchModal = async () => {
    await ensureHistoryCacheLoaded()
    showSearchModal.value = true
}

const reloadHistoryCache = async () => {
    localStorage.removeItem('prd_list')
    localStorage.removeItem('flv_list')
    localStorage.removeItem('emp_list')
    await ensureHistoryCacheLoaded()
    await showSwalSuccess('歷史快取資料已重新同步！')
}

const searchPrdOptions = computed(() => {
    const map = {}
    cachedSearchPrds.value.forEach(item => {
        if (!item.名稱) return
        if (!map[item.名稱]) {
            map[item.名稱] = {
                name: item.名稱,
                count: 0,
                isMulti: item.售價 === '---'
            }
        }
        map[item.名稱].count++
    })
    return Object.values(map)
})

const selectedSearchPrdCount = computed(() => {
    const found = searchPrdOptions.value.find(p => p.name === searchForm.selectedPrd)
    return found ? found.count : 0
})

const searchEmpOptions = computed(() => {
    return [...new Set(cachedSearchEmps.value.map(item => item.姓名).filter(Boolean))]
})

const getHistoryRowFlavors = (itemId) => {
    return cachedSearchFlvs.value.filter(flv => String(flv.品項ID || flv.ID) === String(itemId))
}

const reopenFromHistory = (hRow) => {
    if (!hRow) return

    openAddItemModal()
    activeMainTab.value = 'items'

    newItemForm.itemType = 'new'
    newItemForm.name = hRow.名稱 || ''

    const historyFlvRecs = getHistoryRowFlavors(hRow.ID)
    const fallbackFlvRecs = historyFlvRecs.length > 0 ? historyFlvRecs : getItemFlavorRecords(hRow.ID)
    const validMultiFlvs = fallbackFlvRecs.filter(f => f.口味 && String(f.口味).trim() !== '')

    if (hRow.售價 === '---' || validMultiFlvs.length > 0) {
        newItemForm.flavorType = 'multiple'
        if (validMultiFlvs.length > 0) {
            newItemForm.flavors = validMultiFlvs.map(f => ({
                price: f.價格 || '',
                name: f.口味 || '',
                limit: Number(f.限量) || 0
            }))
        } else {
            newItemForm.flavors = [
                { price: '', name: '', limit: 0 },
                { price: '', name: '', limit: 0 }
            ]
        }
    } else {
        newItemForm.flavorType = 'single'
        newItemForm.price = hRow.售價 || ''

        const limitFromRow = Number(hRow.限量) || 0
        const limitFromFlv = Number(fallbackFlvRecs[0]?.限量) || 0
        newItemForm.singleLimit = limitFromRow > 0 ? limitFromRow : limitFromFlv
    }

    const rawFromHistory = fallbackFlvRecs
        .map(r => r.圖片)
        .find(img => img && String(img).trim() !== '')

    let imgUrls = rawFromHistory ? parseRawImageString(rawFromHistory) : []
    if (imgUrls.length === 0) {
        imgUrls = getItemImageUrls(hRow.ID, hRow.名稱)
    }
    if (imgUrls.length === 0 && hRow.名稱) {
        const sameNamePrds = cachedSearchPrds.value.filter(
            p => p.名稱 === hRow.名稱 && String(p.ID) !== String(hRow.ID)
        )
        for (const other of sameNamePrds) {
            const otherRaw = getHistoryRowFlavors(other.ID)
                .map(r => r.圖片)
                .find(img => img && String(img).trim() !== '')
            if (otherRaw) {
                imgUrls = parseRawImageString(otherRaw)
                break
            }
        }
    }

    newItemForm.images = imgUrls.slice(0, 3).map(url => {
        const filename = url.replace(CLOUDINARY_BASE_URL, '')
        return {
            filename,
            mimeType: 'uploaded',
            data: '',
            previewUrl: url
        }
    })
}

const barColors = ['#0284c7', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0d9488']

const executeOrderSearch = async () => {
    if (!searchForm.selectedPrd) {
        await showSwalInfo('請選擇要查詢的品項')
        return
    }

    historyLoading.value = true
    try {
        const filtered = cachedSearchPrds.value.filter(prd => {
            if (prd.名稱 !== searchForm.selectedPrd) return false
            if (selectedSearchPrdCount.value >= 3 && prd.開啟時間) {
                const d = String(prd.開啟時間).substring(0, 10).replace(/-/g, '/')
                return d >= searchForm.ordStartDate && d <= searchForm.ordEndDate
            }
            return true
        })

        historyResultTitle.value = `品項查詢：${searchForm.selectedPrd}`
        historyResultSubtitle.value =
            selectedSearchPrdCount.value >= 3
                ? `${searchForm.ordStartDate} ~ ${searchForm.ordEndDate}`
                : `共 ${filtered.length} 筆開團紀錄`

        if (filtered.length < 3) {
            historyTableRows.value = filtered
            historyViewMode.value = 'table'
            showSearchModal.value = false
            return
        }

        const sheetNames = filtered.map(prd => `${prd.ID}-${prd.名稱}`)
        const ids = filtered.map(prd => prd.ID)
        const hasMulti = filtered.some(i => i.售價 === '---')

        const res = await postGasData({
            type: 'chart',
            userId: userId.value,
            name: searchForm.selectedPrd,
            ids,
            sheets: sheetNames
        })

        if (!res || !res[0] || res[0].status !== 'success') {
            await showSwalError('載入統計資料失敗')
            return
        }

        const maxAmount = Math.max(...filtered.map(i => Number(i.訂單金額總計) || 0), 1)
        historyChartSeries.value = filtered.map((item, idx) => {
            const amt = Number(item.訂單金額總計) || 0
            return {
                label: `${String(item.開啟時間 || '').slice(5, 10)} 開團`,
                displayValue: `$${amt.toLocaleString()}`,
                percent: Math.round((amt / maxAmount) * 100),
                color: barColors[idx % barColors.length]
            }
        })

        if (!hasMulti) {
            historyPriceSeries.value = filtered.map(item => ({
                label: `${String(item.開啟時間 || '').slice(5, 10)} 開團`,
                pricesText: `$${item.售價}`,
                sourceRow: item
            }))
        } else {
            const flvData = res[0].data?.flv || {}
            historyPriceSeries.value = filtered.map(item => {
                const arr = flvData[item.ID] || []
                const txt = arr.map(a => `${a[2]} $${a[4]}`).join('、') || '---'
                return {
                    label: `${String(item.開啟時間 || '').slice(5, 10)} 開團`,
                    pricesText: txt,
                    sourceRow: item
                }
            })
        }

        historyViewMode.value = 'chart'
        showSearchModal.value = false
    } catch (err) {
        console.error(err)
        await showSwalError('查詢統計異常')
    } finally {
        historyLoading.value = false
    }
}

const executeEmpSearch = async () => {
    if (!searchForm.selectedEmp) {
        await showSwalInfo('請選擇人員')
        return
    }

    historyLoading.value = true
    try {
        const rangePrds = cachedSearchPrds.value.filter(prd => {
            if (!prd.開啟時間) return false
            const d = String(prd.開啟時間).substring(0, 10).replace(/-/g, '/')
            return d >= searchForm.prdStartDate && d <= searchForm.prdEndDate
        })

        const sheetNames = rangePrds.map(prd => `${prd.ID}-${prd.名稱}`)

        const res = await postGasData({
            type: 'chart',
            userId: userId.value,
            emp: searchForm.selectedEmp,
            sheets: sheetNames
        })

        if (!res || !res[0] || res[0].status !== 'success') {
            await showSwalInfo('查無購買紀錄', '尚未有該人員購買紀錄！')
            return
        }

        const list = res[0].data || []
        const maxPrice = Math.max(...list.map(r => Number(r.price) || 0), 1)

        historyResultTitle.value = `人員購買紀錄：${searchForm.selectedEmp}`
        historyResultSubtitle.value = `${searchForm.prdStartDate} ~ ${searchForm.prdEndDate}`
        historyPriceSeries.value = []
        historyChartSeries.value = list.map((r, idx) => ({
            label: `${r.item} (${r.nums} 份)`,
            displayValue: `$${Number(r.price || 0).toLocaleString()}`,
            percent: Math.round(((Number(r.price) || 0) / maxPrice) * 100),
            color: barColors[idx % barColors.length]
        }))

        historyViewMode.value = 'chart'
        showSearchModal.value = false
    } catch (err) {
        console.error(err)
        await showSwalError('查詢人員購買紀錄異常')
    } finally {
        historyLoading.value = false
    }
}

onMounted(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const paramUserId = urlParams.get('userId')
    if (paramUserId) {
        userId.value = paramUserId
        localStorage.setItem('cached_userId', paramUserId)
    }

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
    padding: 6px;
    font-family: system-ui, -apple-system, sans-serif;
    background-color: #f8fafc;
    min-height: 100vh;
}

/* 頂部主分頁切換 */
.main-nav-tabs {
    display: flex;
    gap: 6px;
    background: #e2e8f0;
    padding: 4px;
    border-radius: 10px;
    margin-bottom: 8px;
}

.main-tab-btn {
    flex: 1;
    border: none;
    background: transparent;
    padding: 7px 10px;
    border-radius: 7px;
    font-size: 0.88rem;
    font-weight: 700;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
}

.main-tab-btn.active {
    background: #ffffff;
    color: #0f172a;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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

.btn-primary-action:disabled {
    opacity: 0.55;
    cursor: not-allowed;
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

.btn-refresh:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

/* 歷史查詢載入中動畫 */
.history-loading-box {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 32px 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin-top: 6px;
}

.spinner-ring {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: #16a34a;
    border-radius: 50%;
    animation: spinRing 0.8s linear infinite;
}

.history-loading-text {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 600;
    color: #475569;
}

@keyframes spinRing {
    to { transform: rotate(360deg); }
}

.card-list {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.item-card-compact {
    background: #ffffff;
    border-radius: 8px;
    padding: 7px 10px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    border: 1px solid #f1f5f9;
}

.card-line-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 3px;
}

.card-line-title-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.item-title {
    margin: 0;
    font-size: 1rem;
    color: #0f172a;
    font-weight: 700;
    word-break: break-all;
    line-height: 1.25;
}

/* 卡片右側緊湊縮圖列 */
.card-thumb-strip {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
}

.card-mini-thumb {
    width: 38px;
    height: 38px;
    border-radius: 6px;
    object-fit: cover;
    border: 1px solid #e2e8f0;
    background: #f1f5f9;
}

.amount-display {
    display: flex;
    gap: 6px;
    align-items: center;
}

.total-highlight, .addition-highlight {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    white-space: nowrap;
}

.total-highlight { color: #059669; background: #ecfdf5; }
.addition-highlight { color: #d97706; background: #fef3c7; }

.status-pill {
    padding: 1px 6px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 600;
    white-space: nowrap;
}

.status-active { background-color: #dcfce7; color: #166534; }
.status-closed { background-color: #fee2e2; color: #991b1b; }
.status-default { background-color: #f1f5f9; color: #475569; }

.card-line-info {
    margin-bottom: 4px;
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
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
    color: #334155;
}

.text-emerald { color: #059669; }

.limit-badge, .time-badge {
    background: #fef3c7;
    color: #d97706;
    font-size: 0.72rem;
    padding: 1px 5px;
    border-radius: 4px;
    font-weight: 500;
}

.limit-badge.limit-over {
    background: #fee2e2;
    color: #dc2626;
    font-weight: 700;
}

.limit-badge.limit-soldout {
    background: #e2e8f0;
    color: #475569;
    font-weight: 700;
}

.remain-inline {
    font-size: 0.8rem;
    color: #15803d;
    font-weight: 600;
}

.card-line-details {
    margin-bottom: 3px;
    font-size: 0.75rem;
}

.remark-text { color: #64748b; }

.card-line-footer {
    display: flex;
    gap: 5px;
    padding-top: 5px;
    border-top: 1px dashed #f1f5f9;
    position: relative;
    align-items: center;
}

.action-btn {
    padding: 5px 8px;
    border-radius: 6px;
    border: none;
    font-size: 0.78rem;
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

.btn-view-half {
    flex: 1;
    background-color: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
    padding: 5px 4px;
}

.btn-reopen-half {
    flex: 1;
    background-color: #f0fdf4;
    color: #15803d;
    border: 1px solid #bbf7d0;
    padding: 5px 4px;
}

.btn-reopen-mini {
    background-color: #f0fdf4;
    color: #15803d;
    border: 1px solid #86efac;
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 0.74rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
}

.btn-primary-soft { background-color: #eff6ff; color: #1d4ed8; flex: 1; }
.btn-success-soft { background-color: #f0fdf4; color: #15803d; flex: 1; }
.btn-more { background-color: #f1f5f9; color: #475569; width: 100%; }

.btn-primary-solid { background-color: #2563eb; color: #ffffff; }
.btn-warning-solid { background-color: #d97706; color: #ffffff; }
.btn-danger-solid { background-color: #dc2626; color: #ffffff; }

.dropdown-wrapper {
    position: relative;
    display: inline-block;
    flex: 0.75;
}

.dropdown-menu-modern {
    position: absolute;
    right: 0;
    bottom: 115%;
    background: #ffffff;
    border-radius: 8px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14);
    list-style: none;
    padding: 4px 0;
    margin: 0;
    min-width: 112px;
    z-index: 30;
    border: 1px solid #e2e8f0;
}

.dropdown-menu-modern li a {
    display: block;
    padding: 7px 12px;
    color: #334155;
    text-decoration: none;
    font-size: 0.8rem;
    font-weight: 500;
}

.dropdown-menu-modern li a:hover {
    background-color: #f8fafc;
}

.text-danger { color: #dc2626 !important; }
.text-muted { color: #64748b; }
.text-xs { font-size: 0.75rem; }

/* 歷史查詢圖表與摘要 */
.history-summary-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #ffffff;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    margin-bottom: 6px;
    font-size: 0.88rem;
    color: #0f172a;
}

.chart-section-title {
    margin: 0 0 8px 0;
    font-size: 0.9rem;
    color: #1e293b;
}

.chart-bar-item {
    margin-bottom: 8px;
}

.chart-bar-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: #334155;
    margin-bottom: 3px;
}

.chart-bar-track {
    width: 100%;
    height: 10px;
    background: #e2e8f0;
    border-radius: 999px;
    overflow: hidden;
}

.chart-bar-fill {
    height: 100%;
    border-radius: 999px;
    transition: width 0.3s ease;
}

.price-trend-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px dashed #e2e8f0;
    font-size: 0.8rem;
}

.trend-left-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
}

.trend-name { color: #475569; font-weight: 600; }
.trend-values { color: #059669; font-weight: 700; }

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
    font-size: 1.1rem;
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

.sub-tabs-bar {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
}

.sub-tab-btn {
    flex: 1;
    border: none;
    background: transparent;
    padding: 9px;
    font-size: 0.88rem;
    font-weight: 700;
    color: #64748b;
    cursor: pointer;
    border-bottom: 2px solid transparent;
}

.sub-tab-btn.active {
    color: #16a34a;
    border-bottom-color: #16a34a;
    background: #ffffff;
}

/* 📊 頂部總量統計儀表板 */
.summary-banner {
    background: #f0fdf4;
    border-bottom: 1px solid #dcfce7;
    padding: 10px 16px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.summary-banner-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.summary-banner-title {
    font-size: 0.88rem;
    font-weight: 700;
    color: #166534;
}

.summary-banner-content {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 1rem;
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
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 0.9rem;
}

.summary-q-num, .summary-total-num {
    color: #059669;
    font-size: 1.1rem;
    font-weight: 800;
}

/* 訂單姓名快速搜尋列 */
.order-search-bar {
    display: flex;
    gap: 6px;
    padding: 8px 16px 0 16px;
}

.order-search-input {
    flex: 1;
    padding: 6px 10px;
    font-size: 0.85rem;
}

.btn-clear-filter {
    background: #e2e8f0;
    color: #334155;
    border: none;
    border-radius: 8px;
    padding: 0 10px;
    font-size: 0.82rem;
    cursor: pointer;
}

.modal-body {
    padding: 12px 16px 14px 16px;
    overflow-y: auto;
    max-height: 66vh;
}

.form-body {
    display: flex;
    flex-direction: column;
    gap: 13px;
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
    font-size: 0.88rem !important;
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

.info-alert-box {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #1e40af;
    padding: 10px;
    border-radius: 8px;
    font-size: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 4px;
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

.input-disabled {
    background-color: #f1f5f9;
    color: #64748b;
}

.datepickr {
    background-color: #ffffff;
    cursor: pointer;
}

.textarea-copy {
    line-height: 1.5;
    resize: vertical;
}

.btn-ai-banner {
    width: 100%;
    background: #2563eb;
    color: #ffffff;
    border: none;
    padding: 9px;
    border-radius: 8px;
    font-size: 0.92rem;
    font-weight: 700;
    cursor: pointer;
}

.beta-badge {
    background: #dc2626;
    color: #ffffff;
    font-size: 0.7rem;
    padding: 1px 6px;
    border-radius: 999px;
    margin-left: 4px;
}

.btn-copy-small {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 0.75rem;
    color: #334155;
    cursor: pointer;
}

.btn-copy-small:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.w-100 { width: 100%; box-sizing: border-box; }
.mt-1 { margin-top: 4px; }
.mt-2 { margin-top: 8px; }
.px-0 { padding-left: 0 !important; padding-right: 0 !important; }

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
    gap: 8px;
}

.order-card-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 12px;
    background: #f8fafc;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
}

.ord-left {
    display: flex;
    flex-direction: column;
    gap: 5px;
    flex: 1;
}

.ord-name-line {
    display: flex;
    align-items: center;
    gap: 8px;
}

.ord-name {
    font-size: 1rem;
    font-weight: 700;
    color: #1e293b;
}

.append-tag {
    font-size: 0.72rem;
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
    font-size: 0.82rem;
    color: #334155;
}

.q-num {
    color: #059669;
    font-size: 0.88rem;
}

.ord-right {
    display: flex;
    align-items: center;
    gap: 8px;
}

.ord-single-qty {
    font-size: 0.9rem;
    font-weight: 700;
    color: #0284c7;
    background: #e0f2fe;
    padding: 2px 8px;
    border-radius: 6px;
}

.ord-subtotal {
    font-size: 1rem;
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
    padding: 12px 16px;
    border-top: 1px solid #f1f5f9;
    background: #f8fafc;
    border-bottom-left-radius: 20px;
    border-bottom-right-radius: 20px;
}

.modal-footer-column {
    flex-direction: column;
    gap: 8px;
}

.footer-total-row {
    width: 100%;
    display: flex;
    justify-content: flex-end;
    align-items: center;
}

.footer-action-row {
    width: 100%;
    display: flex;
    gap: 8px;
}

.btn-submit-item {
    width: 100%;
    background: #16a34a;
    color: #ffffff;
    border: none;
    padding: 10px;
    border-radius: 8px;
    font-size: 0.98rem;
    font-weight: 700;
    cursor: pointer;
    text-align: center;
}

.btn-submit-item:hover {
    background: #15803d;
}

.btn-submit-item:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.total-label {
    font-size: 0.95rem;
    color: #334155;
}

.total-value {
    font-size: 1.2rem;
    font-weight: 700;
    color: #dc2626;
    margin-left: 6px;
}

.pagination-modern {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
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
.loading-state, .empty-state { text-align: center; padding: 24px 12px; color: #64748b; font-size: 0.9rem; }
</style>

<!-- 確保 flatpickr 日曆彈窗與 SweetAlert2 都在底部抽屜彈窗之上 -->
<style>
.flatpickr-calendar {
    z-index: 1100 !important;
}

.swal2-container {
    z-index: 2000 !important;
}
</style>