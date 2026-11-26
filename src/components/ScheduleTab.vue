<template>
    <div class="schedule-page">
        <div class="schedule-header">
            <h2 class="page-title">我的行程</h2>
            <span class="hint">點選日期新增；點選事件可修改或刪除</span>
        </div>
        <div class="calendar-card">
            <div ref="calendarEl"></div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { Calendar } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import zhLocale from '@fullcalendar/core/locales/zh-tw'

const props = defineProps({
    userId: {
        type: String,
        default: 'test'
    }
})

const activeUid = computed(() => props.userId || 'test')
const calendarEl = ref(null)
const schedulesPayload = ref({ data: [] })
let calendarInstance = null
let dbRef = null

const getDb = () => window.db

const saveSchedulesToDb = async () => {
    const db = getDb()
    if (db) {
        await db.ref(`users/${activeUid.value}/schedules`).set(JSON.stringify(schedulesPayload.value))
    }
}

const mapEvents = (raw) => {
    if (!raw) return []
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    const list = parsed.data || []
    schedulesPayload.value = { data: list }
    return list.map((item) => ({
        id: String(item.id),
        title: `${item.name || ''}：${item.content || ''}`,
        start: item.start,
        end: item.end
    }))
}

const initCalendar = () => {
    if (!calendarEl.value) return
    if (calendarInstance) {
        calendarInstance.destroy()
        calendarInstance = null
    }

    calendarInstance = new Calendar(calendarEl.value, {
        plugins: [dayGridPlugin, interactionPlugin],
        initialView: 'dayGridMonth',
        locale: zhLocale,
        height: 'auto',
        editable: true,
        selectable: true,
        dayMaxEvents: true,
        dateClick: async (info) => {
            const title = prompt('輸入事件名稱（範例：備料:買高粉與奶油）')
            if (!title) return
            const [name, ...rest] = title.split(/[:：]/)
            const content = rest.join('：').trim()
            const nextId =
                schedulesPayload.value.data.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1

            schedulesPayload.value.data.push({
                id: nextId,
                name: name.trim(),
                content,
                start: info.dateStr,
                end: info.dateStr
            })
            await saveSchedulesToDb()
        },
        select: async (info) => {
            const title = prompt('輸入區間事件名稱（範例：開團:吐司預購）')
            calendarInstance?.unselect()
            if (!title) return
            const [name, ...rest] = title.split(/[:：]/)
            const content = rest.join('：').trim()
            const nextId =
                schedulesPayload.value.data.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1

            schedulesPayload.value.data.push({
                id: nextId,
                name: name.trim(),
                content,
                start: info.startStr,
                end: info.endStr
            })
            await saveSchedulesToDb()
        },
        eventClick: async (info) => {
            const removeIt = confirm('按「確定」刪除事件\n按「取消」修改事件標題')
            const targetId = Number(info.event.id)
            if (removeIt) {
                schedulesPayload.value.data = schedulesPayload.value.data.filter((r) => Number(r.id) !== targetId)
                await saveSchedulesToDb()
            } else {
                const updated = prompt('修改事件名稱（格式：名稱:內容）', info.event.title)
                if (!updated) return
                const [name, ...rest] = updated.split(/[:：]/)
                const content = rest.join('：').trim()
                const row = schedulesPayload.value.data.find((r) => Number(r.id) === targetId)
                if (row) {
                    row.name = name.trim()
                    row.content = content
                    await saveSchedulesToDb()
                }
            }
        },
        eventDrop: async (info) => {
            const targetId = Number(info.event.id)
            const row = schedulesPayload.value.data.find((r) => Number(r.id) === targetId)
            if (row) {
                row.start = info.event.startStr
                row.end = info.event.endStr || info.event.startStr
                await saveSchedulesToDb()
            }
        }
    })

    calendarInstance.render()
}

const bindScheduleListener = () => {
    const db = getDb()
    if (dbRef) {
        dbRef.off()
        dbRef = null
    }
    if (!db) return

    dbRef = db.ref(`users/${activeUid.value}/schedules`)
    dbRef.on('value', (snap) => {
        const events = mapEvents(snap.val())
        if (calendarInstance) {
            calendarInstance.removeAllEvents()
            events.forEach((ev) => calendarInstance.addEvent(ev))
        }
    })
}

watch(activeUid, () => {
    bindScheduleListener()
})

onMounted(() => {
    initCalendar()
    bindScheduleListener()
})

onBeforeUnmount(() => {
    if (dbRef) dbRef.off()
    if (calendarInstance) {
        calendarInstance.destroy()
        calendarInstance = null
    }
})
</script>

<style scoped>
.schedule-page {
    max-width: 600px;
    margin: 0 auto;
    padding: 8px;
    font-family: system-ui, -apple-system, sans-serif;
}
.schedule-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 8px;
}
.page-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: #0f172a;
}
.hint {
    font-size: 0.74rem;
    color: #64748b;
}
.calendar-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 8px;
}
</style>