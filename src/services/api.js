// src/services/api.js

// 您的 GAS Web App 部署網址（建議可以放在環境變數裡，此處先以常數為例）
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxTZd8YHd4stpcBcMdjNcs8SlJyViZ2e2Y4xMfYCzNTtOG2oNnQ_q9OLZ9Y0iP6zuAy/exec';

let data;
let prd_list;
let flv_list;
let fp;
let oldAgentName; //代購訂單-下拉選單
let fileList;
let prd_row;
let prd_name;
let prd_id;
let answer_flag = 0;
let order_chart;
let price_chart;

// 驗證使用者權限
export async function authUser(userId) {

    var data = { type: 'auth', userId: userId };

    try {
        mask.style.display = 'flex';
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result[0].status == 'success' && result[0].auth) {

            Swal.fire({ icon: 'success', title: '驗證成功' });
            data = await fetchData(result[0].data);
            saveAuthCache(userId);
        } else {
            Swal.fire({ icon: 'error', title: '驗證失敗', text: '您無權限使用此頁面' });
            window.location.href = "/";
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: '系統異常' });
    } finally {
        mask.style.display = 'none';
    }
}

/* 取得並整理品項與口味列表資料 */
export async function fetchItemsData(cachedData = null) {
    try {
        let data = cachedData

        // 若沒有傳入快取資料，才向 GAS 發送請求
        if (!data) {
            const res = await fetch(GAS_URL)
            if (!res.ok) {
                throw new Error(`HTTP 錯誤狀態碼: ${res.status}`)
            }
            data = await res.json()
        }

        const rawPrdList = data['品項列表'] || []
        const flvList = data['口味列表'] || []

        // 1. 依 ID 由大到小排序
        // 2. 過濾條件：訂單金額總計 > 0 或 狀態為「開啟中」或「延後中」
        const filteredPrdList = rawPrdList
            .sort((a, b) => Number(b.ID) - Number(a.ID))
            .filter(prd => Number(prd.訂單金額總計) > 0 || prd.狀態 === '開啟中' || prd.狀態 === '延後中')

        // 回傳乾淨的結構化資料給 Vue 元件使用
        return {
            raw: data,
            items: filteredPrdList,
            flavors: flvList
        }
    } catch (err) {
        console.error('讀取 Google Sheet 資料失敗:', err)
        throw err
    }
}

/* 統一的 GAS 後端資料請求函式 (可用於 檢視訂單、代訂、編輯、結算等所有操作) */
export async function postGasData(payload) {
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(payload)
        })

        if (!res.ok) {
            throw new Error(`HTTP 錯誤狀態碼: ${res.status}`)
        }

        const result = await res.json()
        return result
    } catch (err) {
        console.error('GAS API 請求失敗:', err)
        throw err
    }
}


// 訂單品項 延後/結單/刪除/追加
export async function actOrder(data) {

    let title;
    let text;
    if (data.type == 'stop') { title = '延後'; text = `品項「${data.name}」`; }
    if (data.type == 'chkout') { title = '結單'; text = `品項「${data.name}」`; }
    if (data.type == 'delete') { title = '刪除'; text = `品項「${data.name}」`; }
    if (data.type == 'delapd') { title = '刪除'; text = `追加訂單「${data.name}」`; }

    try {
        mask.style.display = 'flex';
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result[0].status == 'success') {
            await fetchData();
            Swal.fire({ icon: 'success', title: title + '成功', text: text + `${result[0].alert}！` });
        } else {
            Swal.fire({ icon: 'error', title: title + '失敗', text: result[0].alert || '請稍後再試' });
        }
    } catch (err) {
        console.log(err);
        Swal.fire({ icon: 'error', title: '系統異常' });
    } finally {
        mask.style.display = 'none';
    }
}

// 刪除使用者下單品項
export async function delUser(e) {

    const id = e.dataset.id;
    const name = e.dataset.name;
    const user = e.dataset.user;

    var data = { type: 'deluser', userId: userId, user: user, id: id, name: name };

    try {
        mask.style.display = 'flex';
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result[0].status == 'success') {
            Swal.fire({ icon: 'success', title: '刪除成功', text: `${user}下單品項「${name}」已刪除！` });
            $(e).closest(".card").remove();
            // getUserOrderData(e);
        } else {
            Swal.fire({ icon: 'error', title: '刪除失敗', text: result[0].alert || '請稍後再試' });
        }
    } catch (err) {
        Swal.fire({ icon: 'error', title: '系統異常' });
    } finally {
        mask.style.display = 'none';
    }
}

// 開啟品項團購訂單
export async function submitForm() {

    if (!userId) { alert("⚠️ 尚未取得 userId"); return; }

    let name = document.getElementById('itemName').value.trim();
    const id = document.getElementById('itemNames').value.trim();
    // const range = document.getElementById('rangePicker').value;
    const range1 = document.getElementById('startDate').value;
    const range2 = document.getElementById('endDate').value;
    const range = range1 + ' 至 ' + range2;

    // 抓取網址參數
    const params = new URLSearchParams(window.location.search);
    const debug = params.get("debug"); // 抓取debug的值

    let file = '';
    if (fileList.length > 0) {
        file = await uploadImg();
    }

    if (!name && !id) { Swal.fire('請填寫名稱'); return; }

    if (id) {
        var prd = prd_list.find(item => item.ID === Number(id));
        if (prd) { name = prd.名稱; }
    }

    const flavorType = document.querySelector('input[name="flavorType"]:checked').value;
    const scheduleType = document.querySelector('input[name="scheduleType"]:checked').value;

    // if( debug=='Y' ){ // 帶入行程新功能
    if (scheduleType == 'group_time') { // 依團購期間
        if (range1 == '' || range2 == '') { Swal.fire('請輸入團購期間!!'); return; }

        var beg = DateToFirebase(range1);
        var end = DateToFirebase(range2);

        schedulesToFirebase(name, beg, end);

    }

    if (scheduleType == 'custom_time') { // 自訂時間

        var beg = document.getElementById('scheduleStartDate').value;
        var end = document.getElementById('scheduleEndDate').value;

        if (beg == '' || end == '') { Swal.fire('請輸入自訂時間!!'); return; }

        beg = DateToFirebase(beg);
        end = DateToFirebase(end);

        schedulesToFirebase(name, beg, end);
    }

    // return;
    // }

    let flavors = [];
    let price = [];

    if (flavorType === 'single') {
        const singleLimit = parseInt(document.getElementById('singleLimit').value);
        p = parseInt(document.getElementById('price').value);

        if (p <= 0) { Swal.fire('價格不能為0或小於0'); return; }
        if (isNaN(singleLimit) || singleLimit < 0) { Swal.fire('請輸入有效的限量'); return; }

        price.push(p);
        flavors.push({ flavor: '', num: singleLimit, price: p });
    } else {
        const flavorRows = document.querySelectorAll('#multiFlavor .flavor-row');
        for (const row of flavorRows) {
            const name = row.querySelector('.flavor-name').value.trim();
            const p = row.querySelector('.flavor-price').value.trim();
            const limitValue = parseInt(row.querySelector('.flavor-limit').value);
            if (!name || isNaN(limitValue) || limitValue < 0 || p <= 0) {
                Swal.fire('請填寫所有口味與有效數量及價格');
                return;
            }
            price.push(p);
            flavors.push({ flavor: name, num: limitValue, price: p });
        }

        if (flavors.length === 0) { Swal.fire('至少新增一個口味'); return; }
    }

    const data = { type: 'create', userId: userId, name: name, range: range, price: price, flavors: flavors, file: file };

    try {
        mask.style.display = 'flex';
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result[0].status == 'success') {
            // 清空表單
            resetForm();

            // 重新載入資料
            await fetchData();

            Swal.fire({ icon: 'success', title: '送出成功', text: `品項「${name}」已新增！` });

            $('#groupBuyModal').modal('hide');
            // $('#rangePicker').flatpickr().clear();
            $('#startDate').flatpickr().clear();
            $('#endDate').flatpickr().clear();
            $('input[type="text"]').val('');
            $('input[type="number"]').val('');
        } else {
            Swal.fire({ icon: 'error', title: '送出失敗', text: result[0].alert || '請稍後再試' });
        }
    } catch (err) {
        console.log(err);
        Swal.fire({ icon: 'error', title: '系統異常' });
    } finally {
        mask.style.display = 'none';
    }
}

// GAS POST Data
export async function gasPostData(data) {

    try {
        mask.style.display = 'flex';
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result[0].status == 'success') {
            return result[0].orders;
        } else {
            Swal.fire({ icon: 'error', title: title + '失敗', text: result[0].alert || '請稍後再試' });
        }
    } catch (err) {
        console.log(err);
        Swal.fire({ icon: 'error', title: '系統異常' });
    } finally {
        mask.style.display = 'none';
    }
}


//---------------------------------------------------------------------------------------------//

// 帳號ID存快取
function saveAuthCache(userId) {
    const data = { userId: userId, timestamp: Date.now() };
    localStorage.setItem('AUTH_CACHE_KEY', JSON.stringify(data));
}