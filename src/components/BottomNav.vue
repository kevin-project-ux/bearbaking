<template>
    <nav class="bottom-nav-bar" aria-label="主功能導覽">
        <button
            type="button"
            :class="['bottom-nav-item', { active: modelValue === 'orders' }]"
            @click="$emit('update:modelValue', 'orders')"
        >
            <span class="nav-icon">🛒</span>
            <span class="nav-label">團購訂單</span>
        </button>

        <button
            type="button"
            :class="['bottom-nav-item', { active: modelValue === 'formula' }]"
            @click="$emit('update:modelValue', 'formula')"
        >
            <span class="nav-icon">🧁</span>
            <span class="nav-label">配方材料</span>
        </button>

        <button
            type="button"
            :class="['bottom-nav-item', { active: modelValue === 'schedule' }]"
            @click="$emit('update:modelValue', 'schedule')"
        >
            <span class="nav-icon">📅</span>
            <span class="nav-label">我的行程</span>
        </button>
    </nav>
</template>

<script setup>
defineProps({
    modelValue: {
        type: String,
        required: true // 'orders' | 'formula' | 'schedule'
    }
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.bottom-nav-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-width: 600px;
    margin: 0 auto;
    height: 58px;
    background: #ffffff;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-around;
    align-items: center;
    z-index: 900;
    box-shadow: 0 -2px 10px rgba(15, 23, 42, 0.06);
}

.bottom-nav-item {
    flex: 1;
    height: 100%;
    border: none;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: #64748b;
    cursor: pointer;
    font-family: inherit;
}

.bottom-nav-item.active {
    color: #16a34a;
    font-weight: 700;
    background: #f0fdf4;
}

.nav-icon {
    font-size: 1.05rem;
    line-height: 1;
}

.nav-label {
    font-size: 0.74rem;
    line-height: 1.1;
}
</style>