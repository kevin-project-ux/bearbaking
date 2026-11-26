<template>
    <div class="formula-page">
        <div class="top-bar">
            <h2 class="page-title">配方 / 材料</h2>
            <button type="button" class="btn-primary-action" @click="openAddFormulaModal">
                ＋ 新增配方
            </button>
        </div>

        <div v-if="loading" class="empty-box">載入配方中...</div>
        <div v-else-if="formulasList.length === 0" class="empty-box">
            目前尚無配方，點擊上方「＋ 新增配方」建立。
        </div>

        <div v-else class="formula-card-list">
            <div v-for="item in formulasList" :key="item.id" class="formula-card">
                <div class="card-top">
                    <strong class="formula-name">{{ item.name }}</strong>
                    <span :class="['cost-pill', Number(item.total_price) > 0 ? 'has-cost' : 'no-cost']">
                        成本: ${{ Number(item.total_price || 0).toLocaleString() }}
                    </span>
                </div>
                <div class="card-meta">
                    <span>總重: {{ item.total_weight || 0 }}</span>
                    <span>份量: {{ item.total_size || 0 }}</span>
                </div>
                <div class="card-actions">
                    <button type="button" class="btn-soft-green" @click="openEditFormulaModal(item)">
                        編輯配方 / 材料 / 成本
                    </button>
                    <button type="button" class="btn-soft-red" @click="deleteFormula(item)">
                        刪除
                    </button>
                </div>
            </div>
        </div>

        <!-- 新增 / 維護配方 Modal -->
        <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
            <div class="sheet-box">
                <div class="sheet-header">
                    <h3>{{ editMode ? `維護配方 - ${formulaName}` : '新增配方' }}</h3>
                    <button type="button" class="btn-close-x" @click="showModal = false">✕</button>
                </div>

                <div v-if="editMode" class="sub-tab-row">
                    <button
                        type="button"
                        :class="['sub-tab', { active: activeSubTab === 'formula' }]"
                        @click="activeSubTab = 'formula'"
                    >
                        配方內容
                    </button>
                    <button
                        type="button"
                        :class="['sub-tab', { active: activeSubTab === 'material' }]"
                        @click="activeSubTab = 'material'"
                    >
                        材料內容
                    </button>
                    <button
                        type="button"
                        :class="['sub-tab', { active: activeSubTab === 'matcost' }]"
                        @click="activeSubTab = 'matcost'; recalcTotals()"
                    >
                        材料成本
                    </button>
                </div>

                <div class="sheet-body">
                    <!-- Tab 1: 配方名稱 -->
                    <div v-if="!editMode || activeSubTab === 'formula'" class="form-col">
                        <label class="field-label">配方名稱</label>
                        <input
                            v-model.trim="formulaName"
                            type="text"
                            class="field-input"
                            placeholder="請輸入配方名稱"
                        />
                        <button type="button" class="btn-submit-main" @click="editMode ? updateFormula() : createFormula()">
                            {{ editMode ? '儲存名稱修改' : '建立配方' }}
                        </button>
                    </div>

                    <!-- Tab 2: 材料內容 -->
                    <div v-else-if="activeSubTab === 'material'" class="form-col">
                        <div class="add-custom-mat-box">
                            <div class="inline-row">
                                <input
                                    v-model.trim="newMaterialName"
                                    type="text"
                                    class="field-input flex-1"
                                    placeholder="自訂材料名稱"
                                />
                                <select v-model="newMaterialCategory" class="field-select">
                                    <option value="" disabled>類別</option>
                                    <optgroup label="烘焙">
                                        <option value="powder">粉類原料</option>
                                        <option value="grease">油脂類</option>
                                        <option value="sugar">糖類</option>
                                        <option value="dairy">乳製品</option>
                                        <option value="moistur">濕性材料</option>
                                        <option value="spices">香料與裝飾</option>
                                    </optgroup>
                                    <optgroup label="水餃">
                                        <option value="meat">肉類主料</option>
                                        <option value="fillings">蔬菜/餡料</option>
                                        <option value="flavor">辛香提味</option>
                                        <option value="seasoning">調味料</option>
                                    </optgroup>
                                </select>
                                <button type="button" class="btn-mini-blue" @click="addCustomMaterial">新增</button>
                            </div>
                        </div>

                        <div class="seg-row">
                            <button
                                type="button"
                                :class="['seg-btn', { active: matDomain === 'Bakings' }]"
                                @click="matDomain = 'Bakings'"
                            >
                                烘焙
                            </button>
                            <button
                                type="button"
                                :class="['seg-btn', { active: matDomain === 'Dumplings' }]"
                                @click="matDomain = 'Dumplings'"
                            >
                                水餃
                            </button>
                            <button
                                type="button"
                                :class="['seg-btn', { active: matEditMode }]"
                                @click="matEditMode = !matEditMode"
                            >
                                {{ matEditMode ? '完成刪除模式' : '管理自訂材料' }}
                            </button>
                        </div>

                        <div v-for="(matArr, catKey) in currentDomainGroups" :key="catKey" class="cat-group">
                            <div class="cat-title">{{ categoryLabels[catKey] || catKey }}</div>
                            <div class="chip-wrap">
                                <span
                                    v-for="m in matArr"
                                    :key="`${catKey}-${m.name}`"
                                    :class="['mat-chip', { active: m.active }]"
                                    @click="!matEditMode && toggleMaterialSelection(m)"
                                >
                                    {{ m.name }}
                                    <button
                                        v-if="matEditMode && m.is_basic === 'Y'"
                                        type="button"
                                        class="chip-del"
                                        @click.stop="removeCustomMaterial(m)"
                                    >
                                        ✕
                                    </button>
                                </span>
                            </div>
                        </div>

                        <button type="button" class="btn-submit-main" @click="saveSelectedMaterials">
                            儲存已選材料
                        </button>
                    </div>

                    <!-- Tab 3: 材料成本 -->
                    <div v-else-if="activeSubTab === 'matcost'" class="form-col">
                        <div v-if="selectedMaterials.length === 0" class="empty-box">
                            尚未勾選任何材料，請先到「材料內容」選擇。
                        </div>

                        <div v-for="(mat, idx) in selectedMaterials" :key="`${mat.category}-${mat.name}-${idx}`" class="cost-card">
                            <div class="cost-card-top">
                                <strong>{{ mat.name }}</strong>
                                <select v-model="mat.unit" class="field-select-sm">
                                    <option value="">單位</option>
                                    <option value="公克">公克</option>
                                    <option value="公斤">公斤</option>
                                    <option value="公升">公升</option>
                                    <option value="個">個</option>
                                    <option value="顆">顆</option>
                                </select>
                                <span class="badge-info">份量: {{ mat.size || 0 }}</span>
                                <span class="badge-price">單價: ${{ mat.price || 0 }}</span>
                            </div>
                            <div class="cost-inputs-row">
                                <input
                                    v-model.number="mat.weight"
                                    type="number"
                                    min="0"
                                    class="field-input flex-1"
                                    placeholder="計量"
                                    @input="recalcRow(mat)"
                                />
                                <select v-model.number="mat.double" class="field-select-sm" @change="recalcRow(mat)">
                                    <option :value="1">x1</option>
                                    <option :value="2">x2</option>
                                    <option :value="3">x3</option>
                                </select>
                                <input
                                    v-model.number="mat.cost"
                                    type="number"
                                    min="0"
                                    class="field-input flex-1"
                                    placeholder="進貨價格"
                                    @input="recalcRow(mat)"
                                />
                            </div>
                        </div>

                        <div class="summary-strip">
                            <div><span>總重</span><b>{{ totalWeight }}</b></div>
                            <div><span>份量</span><b>{{ totalSize }}</b></div>
                            <div><span>金額</span><b>${{ totalPrice }}</b></div>
                        </div>

                        <button type="button" class="btn-submit-main" @click="saveMaterialCosts">
                            儲存材料成本
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
    userId: {
        type: String,
        default: 'test'
    }
})

const BAKING_BASE = {
    powder: ['高粉', '中粉', '低粉', '玉米粉', '酵母', '泡打粉', '小蘇打粉', '太白粉', '奶粉', '可可粉', '抹茶粉', '杏仁粉', '咖啡粉', '紅茶粉', '起司粉', '七味粉'],
    grease: ['奶油', '鮮奶油', '無水奶油', '發酵奶油', '沙拉油', '植物油'],
    sugar: ['糖', '砂糖', '黑糖', '冰糖', '二砂糖', '糖粉', '純糖粉'],
    dairy: ['鮮奶', '乳酪', '蛋', '蛋白', '蛋黃', '鹹蛋黃', '煉乳'],
    moistur: ['馬斯卡彭', '檸檬汁', '水', '冰水', '醬油', '蜂蜜', '榛果醬'],
    spices: ['鹽', '香草莢', '香草精', '巧克力豆', '夏威夷豆', '碎核桃', '蔓越莓乾', '葡萄乾', 'OREO碎塊', '杏仁片', '棉花糖', '吉利丁片', '蘭姆酒', '檸檬皮屑', '八角', '甘草', '黃耆', '黑芝麻', '白芝麻']
}

const DUMPLING_BASE = {
    meat: ['豬肉'],
    fillings: ['高麗菜', '韭菜', '蝦仁', '玉米', '剝皮辣椒', '泡菜', '蔥'],
    flavor: ['蔥花', '薑末'],
    seasoning: ['鹽', '糖', '砂糖', '細砂糖', '醬油', '薄醬油', '白胡椒粉', '太白粉', '玉米粉', '味素', '香油', '蛋', '冰水']
}

const categoryLabels = {
    powder: '粉類原料',
    grease: '油脂類',
    sugar: '糖類',
    dairy: '乳製品',
    moistur: '濕性材料',
    spices: '香料與裝飾',
    meat: '肉類主料',
    fillings: '蔬菜/餡料',
    flavor: '辛香提味',
    seasoning: '調味料'
}

const getDb = () => window.db
const activeUid = computed(() => props.userId || 'test')

const loading = ref(false)
const formulasPayload = ref({ data: [] })
const formulasList = computed(() => formulasPayload.value.data || [])

const rawMaterialsMap = ref({})
const bakingBasic = ref({})
const dumplingBasic = ref({})

const showModal = ref(false)
const editMode = ref(false)
const activeSubTab = ref('formula')
const formulaId = ref(null)
const formulaName = ref('')

const newMaterialName = ref('')
const newMaterialCategory = ref('')
const matDomain = ref('Bakings')
const matEditMode = ref(false)

const bakingGroups = ref({})
const dumplingGroups = ref({})
const selectedMaterials = ref([])

const totalWeight = ref(0)
const totalSize = ref(0)
const totalPrice = ref(0)

const currentDomainGroups = computed(() =>
    matDomain.value === 'Bakings' ? bakingGroups.value : dumplingGroups.value
)

const loadAllFormulaData = async () => {
    const db = getDb()
    if (!db) return
    loading.value = true
    try {
        const [fSnap, mSnap, bSnap] = await Promise.all([
            db.ref(`users/${activeUid.value}/formulas`).once('value'),
            db.ref(`users/${activeUid.value}/materials`).once('value'),
            db.ref(`users/${activeUid.value}/matbasic`).once('value')
        ])

        if (fSnap.exists()) {
            const val = fSnap.val()
            formulasPayload.value = typeof val === 'string' ? JSON.parse(val) : val
        } else {
            formulasPayload.value = { data: [] }
        }

        rawMaterialsMap.value = mSnap.exists() ? mSnap.val() || {} : {}

        if (bSnap.exists()) {
            const bVal = bSnap.val() || {}
            bakingBasic.value = bVal.baking || {}
            dumplingBasic.value = bVal.dumpling || {}
        } else {
            bakingBasic.value = {}
            dumplingBasic.value = {}
        }
    } finally {
        loading.value = false
    }
}

const buildMaterialGroups = (baseMap, customMap) => {
    const groups = {}
    const savedForFormula = rawMaterialsMap.value?.[formulaName.value] || {}

    Object.entries(baseMap).forEach(([cat, names]) => {
        groups[cat] = names.map((name) => {
            const saved = savedForFormula?.[cat]?.[name]
            if (saved) {
                return {
                    name,
                    active: Boolean(saved.active),
                    category: cat,
                    weight: Number(saved.weight) || 0,
                    double: Number(saved.double) || 1,
                    size: Number(saved.size) || 0,
                    cost: Number(saved.cost) || 0,
                    price: Number(saved.price) || 0,
                    unit: saved.unit || ''
                }
            }
            return {
                name,
                active: false,
                category: cat,
                weight: 0,
                double: 1,
                size: 0,
                cost: 0,
                price: 0,
                unit: ''
            }
        })

        const customInCat = customMap?.[cat] || {}
        Object.keys(customInCat).forEach((cName) => {
            const saved = savedForFormula?.[cat]?.[cName]
            groups[cat].push({
                name: cName,
                active: saved ? Boolean(saved.active) : false,
                category: cat,
                weight: saved ? Number(saved.weight) || 0 : 0,
                double: saved ? Number(saved.double) || 1 : 1,
                size: saved ? Number(saved.size) || 0 : 0,
                cost: saved ? Number(saved.cost) || 0 : 0,
                price: saved ? Number(saved.price) || 0 : 0,
                unit: saved ? saved.unit || '' : '',
                is_basic: 'Y',
                mattype: baseMap === BAKING_BASE ? 'baking' : 'dumpling'
            })
        })
    })

    return groups
}

const refreshGroupsAndSelected = () => {
    bakingGroups.value = buildMaterialGroups(BAKING_BASE, bakingBasic.value)
    dumplingGroups.value = buildMaterialGroups(DUMPLING_BASE, dumplingBasic.value)

    const picked = []
    const allGroups = { ...bakingGroups.value, ...dumplingGroups.value }
    Object.values(allGroups).forEach((arr) => {
        arr.forEach((m) => {
            if (m.active) picked.push(m)
        })
    })
    selectedMaterials.value = picked
    recalcTotals()
}

const openAddFormulaModal = () => {
    editMode.value = false
    activeSubTab.value = 'formula'
    formulaId.value = null
    formulaName.value = ''
    showModal.value = true
}

const openEditFormulaModal = (row) => {
    editMode.value = true
    activeSubTab.value = 'formula'
    formulaId.value = row.id
    formulaName.value = row.name
    matEditMode.value = false
    refreshGroupsAndSelected()
    showModal.value = true
}

const createFormula = async () => {
    if (!formulaName.value) return alert('請輸入配方名稱')
    const dup = formulasList.value.some((f) => f.name === formulaName.value)
    if (dup) return alert('該配方名稱已存在')

    const db = getDb()
    const nextId = formulasList.value.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1
    formulasPayload.value.data.push({
        id: nextId,
        name: formulaName.value,
        active: false,
        total_weight: 0,
        total_size: 0,
        total_price: 0
    })

    if (db) {
        await db.ref(`users/${activeUid.value}/formulas`).set(JSON.stringify(formulasPayload.value))
    }
    showModal.value = false
}

const updateFormula = async () => {
    if (!formulaName.value) return alert('請輸入配方名稱')
    const db = getDb()
    const target = formulasPayload.value.data.find((f) => f.id === formulaId.value)
    if (target) target.name = formulaName.value

    if (db) {
        await db.ref(`users/${activeUid.value}/formulas`).set(JSON.stringify(formulasPayload.value))
    }
    showModal.value = false
}

const deleteFormula = async (row) => {
    if (!confirm(`確定要刪除配方「${row.name}」嗎？此操作無法復原。`)) return
    const db = getDb()
    formulasPayload.value.data = formulasPayload.value.data.filter((f) => f.id !== row.id)
    if (db) {
        await db.ref(`users/${activeUid.value}/formulas`).set(JSON.stringify(formulasPayload.value))
    }
}

const toggleMaterialSelection = (mat) => {
    mat.active = !mat.active
    if (mat.active) {
        if (!selectedMaterials.value.includes(mat)) {
            selectedMaterials.value.push(mat)
        }
    } else {
        selectedMaterials.value = selectedMaterials.value.filter(
            (m) => !(m.name === mat.name && m.category === mat.category)
        )
    }
}

const addCustomMaterial = async () => {
    if (!newMaterialName.value || !newMaterialCategory.value) {
        return alert('請輸入材料名稱並選擇類別')
    }
    const db = getDb()
    const isDumpling = ['meat', 'fillings', 'flavor', 'seasoning'].includes(newMaterialCategory.value)
    const domainKey = isDumpling ? 'dumpling' : 'baking'

    if (db) {
        await db
            .ref(`users/${activeUid.value}/matbasic/${domainKey}/${newMaterialCategory.value}/${newMaterialName.value}`)
            .set({
                name: newMaterialName.value,
                category: newMaterialCategory.value,
                active: true
            })
    }

    if (domainKey === 'baking') {
        bakingBasic.value[newMaterialCategory.value] = {
            ...(bakingBasic.value[newMaterialCategory.value] || {}),
            [newMaterialName.value]: true
        }
    } else {
        dumplingBasic.value[newMaterialCategory.value] = {
            ...(dumplingBasic.value[newMaterialCategory.value] || {}),
            [newMaterialName.value]: true
        }
    }

    newMaterialName.value = ''
    refreshGroupsAndSelected()
}

const removeCustomMaterial = async (mat) => {
    const db = getDb()
    if (db && mat.mattype) {
        await db
            .ref(`users/${activeUid.value}/matbasic/${mat.mattype}/${mat.category}/${mat.name}`)
            .remove()
    }
    await loadAllFormulaData()
    refreshGroupsAndSelected()
}

const saveSelectedMaterials = async () => {
    const db = getDb()
    if (db && formulaName.value) {
        await db.ref(`users/${activeUid.value}/materials/${formulaName.value}`).remove()
        for (const m of selectedMaterials.value) {
            await db
                .ref(`users/${activeUid.value}/materials/${formulaName.value}/${m.category}/${m.name}`)
                .set({ ...m, active: true })
        }
    }
    await loadAllFormulaData()
    alert('已儲存配方材料！')
}

const recalcRow = (mat) => {
    const w = Number(mat.weight) || 0
    const d = Number(mat.double) || 1
    const c = Number(mat.cost) || 0
    mat.size = w * d

    if (w > 0 && c > 0) {
        let unitCost = c
        if (mat.unit === '公斤' || mat.unit === '公升') {
            unitCost = c / 1000
        }
        mat.price = Number(((unitCost / w) * mat.size).toFixed(2))
    } else {
        mat.price = 0
    }
    recalcTotals()
}

const recalcTotals = () => {
    totalWeight.value = selectedMaterials.value.reduce((s, m) => s + (Number(m.weight) || 0), 0)
    totalSize.value = selectedMaterials.value.reduce((s, m) => s + (Number(m.size) || 0), 0)
    totalPrice.value = Number(
        selectedMaterials.value.reduce((s, m) => s + (Number(m.price) || 0), 0).toFixed(2)
    )
}

const saveMaterialCosts = async () => {
    recalcTotals()
    const db = getDb()
    if (db && formulaName.value) {
        for (const m of selectedMaterials.value) {
            await db
                .ref(`users/${activeUid.value}/materials/${formulaName.value}/${m.category}/${m.name}`)
                .set({ ...m, active: true })
        }
        const target = formulasPayload.value.data.find((f) => f.id === formulaId.value)
        if (target) {
            target.total_weight = totalWeight.value
            target.total_size = totalSize.value
            target.total_price = totalPrice.value
        }
        await db.ref(`users/${activeUid.value}/formulas`).set(JSON.stringify(formulasPayload.value))
    }
    alert('已儲存材料成本！')
}

onMounted(() => {
    loadAllFormulaData()
})
</script>

<style scoped>
.formula-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 8px;
    font-family: system-ui, -apple-system, sans-serif;
}
.top-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
}
.page-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: #0f172a;
}
.btn-primary-action {
    background: #16a34a;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
}
.formula-card-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.formula-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px 12px;
}
.card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}
.formula-name {
    font-size: 0.98rem;
    color: #0f172a;
}
.cost-pill {
    font-size: 0.78rem;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
}
.cost-pill.has-cost {
    background: #ecfdf5;
    color: #059669;
}
.cost-pill.no-cost {
    background: #fef2f2;
    color: #dc2626;
}
.card-meta {
    display: flex;
    gap: 14px;
    font-size: 0.8rem;
    color: #64748b;
    margin-bottom: 8px;
}
.card-actions {
    display: flex;
    gap: 8px;
}
.btn-soft-green, .btn-soft-red {
    flex: 1;
    border: none;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
}
.btn-soft-green { background: #f0fdf4; color: #15803d; }
.btn-soft-red { background: #fef2f2; color: #dc2626; flex: 0.4; }
.modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1000;
}
.sheet-box {
    width: 100%;
    max-width: 600px;
    max-height: 88vh;
    background: #fff;
    border-top-left-radius: 18px;
    border-top-right-radius: 18px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.sheet-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
}
.sheet-header h3 { margin: 0; font-size: 1rem; }
.btn-close-x {
    border: none;
    background: #f1f5f9;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    cursor: pointer;
}
.sub-tab-row {
    display: flex;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
}
.sub-tab {
    flex: 1;
    border: none;
    background: transparent;
    padding: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
}
.sub-tab.active {
    color: #16a34a;
    background: #fff;
    border-bottom: 2px solid #16a34a;
}
.sheet-body {
    padding: 14px 16px 20px;
    overflow-y: auto;
}
.form-col { display: flex; flex-direction: column; gap: 10px; }
.field-label { font-size: 0.85rem; font-weight: 700; color: #334155; }
.field-input, .field-select, .field-select-sm {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 7px 9px;
    font-size: 0.86rem;
    background: #fff;
}
.inline-row, .seg-row, .cost-inputs-row { display: flex; gap: 6px; align-items: center; }
.flex-1 { flex: 1; min-width: 0; }
.seg-btn {
    flex: 1;
    border: 1px solid #cbd5e1;
    background: #fff;
    border-radius: 7px;
    padding: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
}
.seg-btn.active { background: #16a34a; color: #fff; border-color: #16a34a; }
.cat-group { margin-top: 6px; }
.cat-title { font-size: 0.82rem; font-weight: 700; color: #475569; margin-bottom: 4px; }
.chip-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
.mat-chip {
    background: #f1f5f9;
    color: #334155;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.8rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
}
.mat-chip.active { background: #dc2626; color: #fff; }
.chip-del {
    border: none;
    background: rgba(255, 255, 255, 0.85);
    color: #111;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    font-size: 0.65rem;
    cursor: pointer;
}
.cost-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.cost-card-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.82rem; }
.badge-info { background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 5px; font-weight: 600; }
.badge-price { background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 5px; font-weight: 600; }
.summary-strip {
    display: flex;
    justify-content: space-around;
    background: #f1f5f9;
    border-radius: 8px;
    padding: 8px;
    font-size: 0.82rem;
}
.summary-strip > div { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.btn-mini-blue {
    background: #2563eb;
    color: #fff;
    border: none;
    border-radius: 7px;
    padding: 7px 10px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
}
.btn-submit-main {
    background: #16a34a;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 9px;
    font-size: 0.92rem;
    font-weight: 700;
    cursor: pointer;
    margin-top: 4px;
}
.empty-box { text-align: center; color: #64748b; padding: 20px 10px; font-size: 0.88rem; }
</style>