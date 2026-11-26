import Swal from 'sweetalert2'

export const notifySuccess = (title, text = '') => {
    return Swal.fire({
        icon: 'success',
        title,
        text: text || undefined,
        confirmButtonText: '確定',
        confirmButtonColor: '#16a34a'
    })
}

export const notifyError = (title, text = '') => {
    return Swal.fire({
        icon: 'error',
        title,
        text: text || undefined,
        confirmButtonText: '確定',
        confirmButtonColor: '#dc2626'
    })
}

export const notifyInfo = (title, text = '') => {
    return Swal.fire({
        icon: 'info',
        title,
        text: text || undefined,
        confirmButtonText: '確定',
        confirmButtonColor: '#2563eb'
    })
}

export const confirmAction = async ({
    title = '確定要執行此操作嗎？',
    text = '此操作無法復原！',
    confirmText = '確定',
    cancelText = '取消',
    icon = 'warning'
} = {}) => {
    const res = await Swal.fire({
        icon,
        title,
        text,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#64748b',
        reverseButtons: true
    })
    return Boolean(res.isConfirmed)
}