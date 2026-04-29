// ULTIMATE CLEANUP SCRIPT - FIRE GYM PROTECTION
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
        for (let registration of registrations) {
            registration.unregister();
            console.log('Old SW Unregistered');
        }
    });
}
if ('caches' in window) {
    caches.keys().then(function (names) {
        for (let name of names) caches.delete(name);
    });
}
console.log('System Purged!');
// إعدادات Firebase الحقيقية والمستقرة
console.log("FIRE GYM SCRIPT INITIALIZING...");

// منع ظهور صفحة الدخول لو المستخدم مسجل دخول بالفعل (Fast Path)
if (localStorage.getItem('fire_gym_phone')) {
    const style = document.createElement('style');
    style.innerHTML = '#auth-section { display: none !important; } #app-content { display: block !important; }';
    document.head.appendChild(style);
}

window.onerror = function (m, u, l) {
    const msg = "CRITICAL ERROR: " + m + "\nLine: " + l + "\nURL: " + u;
    console.error(msg);
};

const firebaseConfig = {
    apiKey: "AIzaSyAxMNBdkNk_brPMlq1O3_HPRWOIqj-lb24",
    authDomain: "fire-gym-9c753.firebaseapp.com",
    projectId: "fire-gym-9c753",
    storageBucket: "fire-gym-9c753.firebasestorage.app",
    messagingSenderId: "417014585133",
    appId: "1:417014585133:web:38f62686ae2e133298a5a4"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let currentUser = null; let activeTarget = null; let currentPlanData = {}; let finalBase64 = "";
let allUsersData = []; let editingCat = ""; let lastViewedCat = "";
const ADMIN_PHONE = "01100896637";
const PLAN_CATS = ['بنج', 'ظهر', 'كتف', 'دراع', 'رجل', 'بطن'];
const NUTRI_CATS = ['فطار', 'غداء', 'عشاء', 'سناك', 'قبل التمرين', 'بعد التمرين', 'فيتامينات ومكملات'];
const EX_ICONS = {
    'بنج': '💪', 'ظهر': '🦾', 'كتف': '⚡', 'دراع': '🔥', 'رجل': '🦵', 'بطن': '💎',
    'فطار': '🍳', 'غداء': '🍗', 'عشاء': '🍲', 'سناك': '🍎', 'قبل التمرين': '⚡', 'بعد التمرين': '🔄'
};

// Timer Variables
let workoutStartTime = null;
let workoutTimerInterval = null;
let workoutSeconds = 0;
let restInterval = null;

// --- AUTH & LOGIN ---
async function login() {
    const p = document.getElementById('login-phone').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    if (!p || !pass) return Swal.fire('خطأ', 'برجاء كتابة البيانات', 'error');
    Swal.fire({ title: 'جاري التحقق...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });
    try {
        if (p === ADMIN_PHONE) {
            localStorage.setItem('fire_gym_phone', p);
            const adminDoc = { phone: p, name: "كابتن أحمد", status: "approved", role: "admin" };
            await db.collection('users').doc(p).set(adminDoc, { merge: true });
            Swal.close(); enterApp(adminDoc); return;
        }
        const snap = await db.collection('users').doc(p).get();
        Swal.close();
        if (snap.exists) {
            const data = snap.data();
            if (data.password && data.password.toString().trim() === pass) {
                if (data.status !== 'approved') return Swal.fire('انتظر', 'طلبك تحت المراجعة من الكابتن', 'warning');
                localStorage.setItem('fire_gym_phone', p);
                enterApp(data);
            } else { Swal.fire('خطأ', 'كلمة السر غير صحيحة يا وحش ❌', 'error'); }
        } else { Swal.fire('خطأ', 'رقم الموبايل ده مش مسجل عندنا.. 🔥', 'error'); }
    } catch (e) {
        console.error(e);
        if (typeof Swal !== 'undefined') { Swal.close(); Swal.fire('خطأ', e.message, 'error'); }
        alert("Login Error: " + e.message);
    }
}


async function register() {
    const n = document.getElementById('reg-name').value.trim();
    const p = document.getElementById('reg-phone').value.trim();
    const pass = document.getElementById('reg-pass').value.trim();
    const durationMonths = parseInt(document.getElementById('reg-duration').value) || 1;

    if (!n || !p || !pass) return Swal.fire('نقص بيانات', 'برجاء ملء كل الخانات يا بطل', 'warning');
    Swal.fire({ title: 'جاري إرسال طلبك...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    // حساب تاريخ انتهاء الاشتراك
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + durationMonths);

    const data = {
        name: n, phone: p, age: document.getElementById('reg-age').value,
        height: document.getElementById('reg-height').value, weight: document.getElementById('reg-weight').value,
        fat: document.getElementById('reg-fat').value, goal: document.getElementById('reg-goal').value,
        duration: durationMonths, expiryDate: expiry.getTime(),
        password: pass, status: 'pending', workoutPlan: {}, ts: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
        await db.collection('users').doc(p).set(data);
        Swal.close();
        sendNotificationTo(ADMIN_PHONE, "طلب اشتراك جديد! 🆕", `البطل ${n} سجل بياناته ومستني موافقتك يا كوتش! 🔥`);
        Swal.fire('تم بنجاح! 🔥', 'طلبك وصل للكابتن، أول ما يوافق هتقدر تدخل حسابك فوراً', 'success');
        toggleAuth('login');
    } catch (e) { Swal.close(); Swal.fire('خطأ', 'فشل إرسال الطلب', 'error'); }
}

function logout() {
    localStorage.removeItem('fire_gym_phone');
    location.reload();
}

let userListener = null;
async function enterApp(u) {
    currentUser = u;
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    const nav = document.getElementById('bottom-nav-bar');
    if (nav) nav.classList.remove('hidden');
    
    // Choose starting tab based on role
    const startTab = (u.role === 'admin') ? 'admin' : 'user';
    const activeTabBtn = document.querySelector(`.bottom-tabs .tab[onclick*="'${startTab}'"]`) || document.querySelector('.bottom-tabs .tab.active');
    switchTab(startTab, activeTabBtn);

    if (u.role === 'admin') {
        if (typeof loadUsers === 'function') loadUsers();
    }
    
    if (typeof listenForCustomNotifications === 'function') listenForCustomNotifications();

    if (userListener) userListener();
    const userPhone = u.phone.toString().trim();
    userListener = db.collection('users').doc(userPhone).onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data(); currentUser = data; currentPlanData = data.workoutPlan || {};
            const goal = data.goal || ""; 
            const banner = document.getElementById('system-banner'); 
            const title = document.getElementById('system-main-title'); 
            const badge = document.getElementById('system-title-badge');
            
            if (data.role === 'admin') {
                if (banner) banner.style.background = "linear-gradient(135deg, #0f0f0f, #2a2a2a)"; 
                if (title) title.innerText = "لوحة قيادة الكابتن 👨‍🏫"; 
                if (badge) {
                    badge.innerText = "مدير المنظومة"; 
                    badge.style.background = "linear-gradient(to right, #e53935, #b71c1c)";
                }
            } else {
                if (goal.includes('VIP')) { 
                    if (banner) banner.style.background = "linear-gradient(135deg, #1a1500, #4d3d00)"; 
                    if (title) title.innerText = "نظام VIP الملكي ⭐"; 
                    if (badge) {
                        badge.innerText = "نظام VIP"; 
                        badge.style.background = "linear-gradient(to right, #ffb300, #ff8f00)"; 
                    }
                } else if (goal.includes('تغذيه')) { 
                    if (banner) banner.style.background = "linear-gradient(135deg, #0a140a, #1b5c2a)"; 
                    if (title) title.innerText = "نظام التغذية المتكامل 🥗"; 
                    if (badge) {
                        badge.innerText = "نظام تغذية"; 
                        badge.style.background = "#4caf50"; 
                    }
                } else { 
                    if (banner) banner.style.background = "linear-gradient(135deg, #0a0e14, #1b3d5c)"; 
                    if (title) title.innerText = "نظام التدريب الحديدي 🏋️‍♂️"; 
                    if (badge) {
                        badge.innerText = "نظام تدريب"; 
                        badge.style.background = "var(--primary)"; 
                    }
                }
            }
            
            // تحديث مسميات التبويبات بناءً على النظام
            const scheduleNav = document.getElementById('schedule-nav');
            const scheduleMainTitle = document.getElementById('schedule-main-title');
            const workoutInnerTitle = document.getElementById('workout-inner-title');
            const lowerGoal = goal.toLowerCase();
            const isNutritionOnly = (lowerGoal.includes('تغذيه') || lowerGoal.includes('تغذية')) && !lowerGoal.includes('تدريب') && !lowerGoal.includes('vip') && data.role !== 'admin';

            if (scheduleNav) {
                if (isNutritionOnly) {
                    scheduleNav.innerHTML = '<span>📋</span>وجباتك اليومية';
                    if (scheduleMainTitle) scheduleMainTitle.innerHTML = 'وجباتك <span style="color:var(--primary);">اليومية</span> 🥗';
                    if (workoutInnerTitle) workoutInnerTitle.innerText = 'نظام وجباتك اليومي 🍱';
                } else {
                    scheduleNav.innerHTML = '<span>📋</span>جدول تمرينك اليومي';
                    if (scheduleMainTitle) scheduleMainTitle.innerHTML = 'جدول <span style="color:var(--primary);">الأبطال</span> 📋';
                    if (workoutInnerTitle) workoutInnerTitle.innerText = 'جدول تمارينك اليومي 🏋️‍♂️';
                }
            }
            
            // تحديث الترحيب في الصفحة الرئيسية
            const welcomePrefix = document.getElementById('user-welcome-prefix');
            const welcomeName = document.getElementById('user-display-name');
            if (welcomeName) {
                welcomeName.innerText = (data.name || "").trim() || (data.role === 'admin' ? "هاني" : "البطل");
                if (welcomePrefix) welcomePrefix.innerText = (data.role === 'admin' ? "يا كابتن" : "يا بطل");
            }
            
            // إظهار/إخفاء زر تفضيلات الأكل في القائمة الجانبية بناءً على النظام
            const foodPrefsMenuBtn = document.getElementById('food-prefs-menu-btn');
            if (foodPrefsMenuBtn) {
                const lowerGoal = goal.toLowerCase();
                const canSeeFood = lowerGoal.includes('تغذيه') || lowerGoal.includes('تغذية') || lowerGoal.includes('vip') || data.role === 'admin';
                foodPrefsMenuBtn.classList.toggle('hidden', !canSeeFood);
            }

            const meNameEl = document.getElementById('me-name');
            if (meNameEl) meNameEl.innerText = (data.name || "").trim() || (data.role === 'admin' ? "الكابتن هاني" : "بطل فير جيم");
            
            const meAgeEl = document.getElementById('me-age');
            if (meAgeEl) meAgeEl.innerText = (data.age || '--');
            
            const meWeightEl = document.getElementById('me-weight');
            if (meWeightEl) meWeightEl.innerText = (data.weight || '--') + ' كغم';
            
            const meHeightEl = document.getElementById('me-height');
            if (meHeightEl) meHeightEl.innerText = (data.height || '--') + ' سم';
            
            const meFatEl = document.getElementById('me-fat');
            if (meFatEl) meFatEl.innerText = (data.fat || '0') + ' %';
            
            const meGoalEl = document.getElementById('me-goal-badge');
            if (meGoalEl) meGoalEl.innerText = (data.role === 'admin' ? '👑 كابتن الفريق' : (data.goal || 'بطل فير جيم'));
            
            if (data.photo && document.getElementById('me-photo')) document.getElementById('me-photo').src = data.photo;

            // Subscription updates
            if (data.expiryDate) {
                const exp = data.expiryDate;
                const now = Date.now();
                const diff = exp - now;
                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                const dateObj = new Date(exp);
                const dateStr = `${dateObj.getDate()} / ${dateObj.getMonth() + 1} / ${dateObj.getFullYear()}`;

                const expDateEl = document.getElementById('me-expiry-date');
                if (expDateEl) expDateEl.innerText = dateStr;

                const daysEl = document.getElementById('me-expiry-days');
                const progressFill = document.getElementById('expiry-progress-fill');

                if (days > 0) {
                    if (daysEl) {
                        daysEl.innerText = `باقي ${days} يوم`;
                        daysEl.style.color = "#fff";
                    }
                    if (progressFill) {
                        let totalDays = (data.duration || 1) * 30;
                        let percent = Math.max(0, Math.min(100, (days / totalDays) * 100));
                        progressFill.style.width = percent + "%";
                        progressFill.style.background = percent < 20 ? "#ff3b30" : "var(--primary)";
                    }
                } else {
                    if (daysEl) {
                        daysEl.innerText = "منتهي ⚠️";
                        daysEl.style.color = "#ff3b30";
                    }
                    if (progressFill) {
                        progressFill.style.width = "100%";
                        progressFill.style.background = "#ff3b30";
                    }
                }
            }

            const noteText = document.getElementById('captain-notes-text');
            if (noteText) {
                if (data.captainNotes) {
                    noteText.innerText = data.captainNotes;
                } else {
                    noteText.innerText = "استعد لتلقي تعليمات الكابتن هنا.. عاش يا وحش! 🔥";
                }
            }
            if (typeof renderUserPlanTabs === 'function') renderUserPlanTabs();
        }
    });

    renderTrackerGrid(); loadUserLogs(); checkWaterReset(); initSystemNotifications();
    updateMacroDashboard();
    initDailyQuote();
    if (u.role === 'admin') {
        document.getElementById('admin-nav').classList.remove('hidden');
        document.getElementById('admin-info-menu-btn').classList.remove('hidden');
        document.getElementById('add-technique-btn').classList.remove('hidden');

        // Hide Home and History for Admin
        if (document.getElementById('home-tab-nav')) document.getElementById('home-tab-nav').classList.add('hidden');
        if (document.getElementById('history-tab-nav')) document.getElementById('history-tab-nav').classList.add('hidden');

        switchTab('admin', document.getElementById('admin-nav'));
        loadAdmin();
    } else { 
        loadRecipes(); 
        loadFoodPrefs(); 
        loadHallOfFame();
    }
}

// --- UI HELPERS ---
function renderTrackerGrid() {
    const grid = document.getElementById('main-tracker-grid');
    if (!grid) return;
    const g = currentUser.goal || "";
    
    const cards = {
        'وزن': { icon: '⚖️', label: 'الوزن', sub: 'تتبع تقدمك' },
        'وجبة': { icon: '🥗', label: 'الوجبات', sub: 'سجل أكلك' },
        'تمرين': { icon: '💪', label: 'التمرين', sub: 'عاش يا بطل' },
        'صور': { icon: '📸', label: 'الصور', sub: 'وثق فورمتك' }
    };
    
    let items = ['تمرين', 'وجبة', 'وزن', 'صور'];
    if (currentUser.role !== 'admin') {
        if (g.includes('تدريب')) items = ['تمرين', 'صور', 'وزن'];
        else if (g.includes('تغذيه')) items = ['وجبة', 'وزن', 'صور'];
    }
    
    grid.innerHTML = items.map(key => `
        <div class="dash-card" onclick="openLogger('${key}')">
            <b>${cards[key].icon}</b>
            <span>${cards[key].label}</span>
            <small>${cards[key].sub}</small>
        </div>
    `).join('');
}

function updateMacroDashboard() {
    if (currentUser.role === 'admin') return; 
    const data = currentUser;
    calculateMacros(data);
    if (data.macros) {
        const m = data.macros;
        const pVal = document.getElementById('dash-prot');
        const cVal = document.getElementById('dash-carb');
        const fVal = document.getElementById('dash-fat');
        if (pVal) pVal.innerText = (m.p || 0) + 'g';
        if (cVal) cVal.innerText = (m.c || 0) + 'g';
        if (fVal) fVal.innerText = (m.f || 0) + 'g';
        
        const bP = document.getElementById('bar-prot');
        const bC = document.getElementById('bar-carb');
        const bF = document.getElementById('bar-fat');
        if (bP) bP.style.width = Math.min(100, ((m.p || 0) / 200) * 100) + '%';
        if (bC) bC.style.width = Math.min(100, ((m.c || 0) / 300) * 100) + '%';
        if (bF) bF.style.width = Math.min(100, ((m.f || 0) / 100) * 100) + '%';
    }
}

function renderUserPlanTabs() {
    const scheduleWTabs = document.getElementById('schedule-workout-tabs');
    const scheduleNTabs = document.getElementById('schedule-nutrition-tabs');
    const extras = document.getElementById('nutrition-extras');
    const g = currentUser.goal || "";
    let htmlW = "";
    let htmlN = "";

    if (g.includes('تدريب') || g.includes('VIP')) {
        htmlW = PLAN_CATS.map(c => `<button class="sub-btn" style="width:100%; flex-direction:row; justify-content:space-between; padding:22px !important; color:var(--primary); margin-bottom:5px;" onclick="viewCatPlan('${c}')"><div style="display:flex; align-items:center; gap:15px;"><span style="font-size:26px;">${EX_ICONS[c] || '🏋️'}</span> <b style="font-size:16px;">${c}</b></div> <span style="font-size:18px; opacity:0.5;">⬅️</span></button>`).join('');
    }
    if (g.includes('تغذيه') || g.includes('VIP')) {
        htmlN = NUTRI_CATS.map(c => `<button class="sub-btn" style="width:100%; flex-direction:row; justify-content:space-between; padding:22px !important; color:#4caf50; margin-bottom:5px;" onclick="viewCatPlan('${c}')"><div style="display:flex; align-items:center; gap:15px;"><span style="font-size:26px;">${EX_ICONS[c] || '🥗'}</span> <b style="font-size:16px;">${c}</b></div> <span style="font-size:18px; opacity:0.5;">⬅️</span></button>`).join('');
        if (extras) extras.classList.remove('hidden');
        loadFoodPrefs();
        loadRecipes();
    }

    if (scheduleWTabs) { scheduleWTabs.innerHTML = htmlW; }
    if (scheduleNTabs) { scheduleNTabs.innerHTML = htmlN; }

    // Preserve focus mode: if user was viewing a category, re-render it
    if (lastViewedCat) {
        viewCatPlan(lastViewedCat);
    } else {
        // Only reset to list if no category was active
        if (scheduleWTabs) scheduleWTabs.classList.remove('hidden');
        if (scheduleNTabs) scheduleNTabs.classList.remove('hidden');

        const workoutCont = document.getElementById('schedule-workout-container');
        const nutritionCont = document.getElementById('schedule-nutrition-container');
        if (workoutCont) { workoutCont.innerHTML = ""; workoutCont.classList.add('hidden'); }
        if (nutritionCont) { nutritionCont.innerHTML = ""; nutritionCont.classList.add('hidden'); }
    }
}

function switchVipMode(mode) {
    renderUserPlanTabs();
}

function viewCatPlan(cat) {
    const scheduleWCont = document.getElementById('schedule-workout-container');
    const scheduleNCont = document.getElementById('schedule-nutrition-container');
    const workoutTabs = document.getElementById('schedule-workout-tabs');
    const nutritionTabs = document.getElementById('schedule-nutrition-tabs');
    const isScheduleTab = !document.getElementById('workout-schedule-tab').classList.contains('hidden');
    const isNutri = NUTRI_CATS.includes(cat);

    const targetContainer = isNutri ? scheduleNCont : scheduleWCont;
    const targetTabs = isNutri ? nutritionTabs : workoutTabs;
    const timerCont = document.getElementById('workout-timer-container');

    lastViewedCat = cat;

    if (targetTabs) targetTabs.classList.add('hidden');
    if (targetContainer) targetContainer.classList.remove('hidden');

    const exs = currentPlanData[cat] || [];

    let backBtn = `
        <button onclick="backToPlanList('${isNutri ? 'nutrition' : 'workout'}')" 
            style="width:100%; padding:15px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:15px; color:#aaa; margin-bottom:20px; font-weight:bold; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
            ⬅️ العودة لقائمة الأقسام
        </button>
        <div style="background:rgba(255,255,255,0.03); border-radius:20px; padding:15px; margin-bottom:20px; border-right:4px solid ${isNutri ? '#4caf50' : 'var(--primary)'};">
            <h4 style="margin:0; color:#fff;">قسم: ${EX_ICONS[cat] || ''} ${cat}</h4>
        </div>
    `;

    if (isNutri) {
        let tableHtml = backBtn + `<div style="background:rgba(76,175,80,0.05); border:1px solid rgba(76,175,80,0.2); border-radius:30px; padding:20px; margin-bottom:15px;">
            <div style="overflow-x:auto; border-radius:15px; border:1px solid #222;">
                <table style="width:100%; border-collapse:collapse; text-align:right;">
                    <thead>
                        <tr style="background:#111; color:#4caf50; font-size:11px;">
                            <th style="padding:15px; border:1px solid #222;">نوع الأكل</th>
                            <th style="padding:15px; border:1px solid #222;">الكمية</th>
                            <th style="padding:15px; border:1px solid #222; text-align:center;">تم ✅</th>
                        </tr>
                    </thead>
                    <tbody>${exs.map((ex, i) => `
                        <tr style="border-bottom:1px solid #222; background:${ex.done ? 'rgba(76,175,80,0.05)' : 'transparent'};">
                            <td style="padding:15px; color:#fff;">
                                <div style="font-weight:bold;">${ex.name}</div>
                                <div style="font-size:10px; color:#777;">${ex.note || '---'}</div>
                            </td>
                            <td style="padding:15px; color:var(--accent); font-weight:bold;">${ex.weight || 'حسب الرغبة'}</td>
                            <td style="padding:15px; text-align:center;">
                                <div class="checkbox-wrapper" style="display:inline-block;">
                                    <input type="checkbox" id="check-nutri-${i}" class="custom-checkbox nutri-check" ${ex.done ? 'checked' : ''} onchange="toggleExDone('${cat}', ${i}, this.checked, '${ex.name}')">
                                    <label for="check-nutri-${i}"></label>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
        if (targetContainer) targetContainer.innerHTML = exs.length ? tableHtml : backBtn + '<p style="text-align:center; padding:30px; color:#444;">مفيش بيانات لسه يا بطل 🔥</p>';
    } else {
        let cardsHtml = backBtn + `<div style="display:flex; flex-direction:column; gap:8px; margin-bottom:20px;">${exs.map((ex, i) => `
            <div class="card exercise-card ${ex.done ? 'done' : ''}" 
                 onclick="openExEditor('${cat}', ${i})"
                 style="padding:18px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:24px; display:flex; justify-content:space-between; align-items:center; position:relative; overflow:hidden; transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor:pointer; backdrop-filter:blur(10px);">
                <div style="position:absolute; left:0; top:0; bottom:0; width:4px; background:${ex.done ? 'var(--success)' : 'var(--primary)'};"></div>
                <div style="flex:1;">
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                        <span style="font-size:18px;">${EX_ICONS[cat] || '🏋️'}</span>
                        <h4 style="margin:0; font-size:16px; color:#fff; font-weight:600; letter-spacing:0.5px;">${ex.name}</h4>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <p style="margin:0; font-size:11px; color:#777; background:rgba(255,255,255,0.05); padding:3px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);">🎯 ${ex.sets || '4'} مجموعات</p>
                        <span style="font-size:11px; color:${ex.done ? 'var(--success)' : 'var(--accent)'}; font-weight:bold; display:flex; align-items:center; gap:4px;">
                            ${ex.done ? '● مكتمل ✅' : '● قيد التنفيذ'}
                        </span>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px;" onclick="event.stopPropagation();">
                    <button onclick="openExEditor('${cat}', ${i})" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:var(--accent); width:40px; height:40px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:18px; transition:0.2s;">
                        ${currentUser.role === 'admin' ? '✏️' : 'ℹ️'}
                    </button>
                    <div class="checkbox-wrapper">
                        <input type="checkbox" id="check-${i}" class="custom-checkbox" ${ex.done ? 'checked' : ''} onchange="toggleExDone('${cat}', ${i}, this.checked, '${ex.name}')">
                        <label for="check-${i}"></label>
                    </div>
                </div>
            </div>
        `).join('')}</div>`;
        if (targetContainer) targetContainer.innerHTML = exs.length ? cardsHtml : backBtn + '<p style="text-align:center; padding:30px; color:#444;">مفيش تدريبات لسه. 🔥</p>';
    }

    if (timerCont) timerCont.classList.toggle('hidden', isNutri || !isScheduleTab);
}

function backToPlanList(mode) {
    const workoutTabs = document.getElementById('schedule-workout-tabs');
    const nutritionTabs = document.getElementById('schedule-nutrition-tabs');
    const workoutCont = document.getElementById('schedule-workout-container');
    const nutritionCont = document.getElementById('schedule-nutrition-container');
    const timerCont = document.getElementById('workout-timer-container');

    if (mode === 'workout') {
        if (workoutTabs) workoutTabs.classList.remove('hidden');
        if (workoutCont) { workoutCont.classList.add('hidden'); workoutCont.innerHTML = ""; }
        if (timerCont) timerCont.classList.add('hidden');
    } else {
        if (nutritionTabs) nutritionTabs.classList.remove('hidden');
        if (nutritionCont) { nutritionCont.classList.add('hidden'); nutritionCont.innerHTML = ""; }
    }
    lastViewedCat = "";
}


function openExEditor(cat, idx) {
    const ex = currentPlanData[cat][idx];
    document.getElementById('ex-editor-name').innerText = ex.name;
    document.getElementById('ex-editor-sets').innerText = ex.sets || '4';

    let html = `
        <table style="width:100%; border-collapse:collapse; text-align:center; min-width:300px;">
            <thead>
                <tr style="color:#777; font-size:11px; background:#111;">
                    <th style="padding:12px; border-bottom:1px solid #222;">مج</th>
                    <th style="padding:12px; border-bottom:1px solid #222;">وزن</th>
                    <th style="padding:12px; border-bottom:1px solid #222;">عدة</th>
                </tr>
            </thead>
            <tbody>
    `;

    const isAdmin = (currentUser.role === 'admin');
    for (let n = 1; n <= 6; n++) {
        html += `
            <tr style="border-bottom:1px solid #222;">
                <td style="padding:12px 5px; color:#aaa; font-weight:bold; font-size:14px;">${n}</td>
                <td style="padding:12px 5px;">
                    ${isAdmin ? `<input type="text" value="${ex['w'+n]||''}" onchange="updateExSet('${cat}', ${idx}, 'w${n}', this.value)" placeholder="-" style="width:100%; max-width:85px; padding:10px; background:#000; border:1px solid #333; color:var(--accent); text-align:center; border-radius:10px; font-size:16px; font-weight:bold;">` 
                    : `<span style="color:var(--accent); font-weight:900; font-size:18px;">${ex['w'+n]||'-'}</span>`}
                </td>
                <td style="padding:12px 5px;">
                    ${isAdmin ? `<input type="text" value="${ex['r'+n]||''}" onchange="updateExSet('${cat}', ${idx}, 'r${n}', this.value)" placeholder="-" style="width:100%; max-width:85px; padding:10px; background:#000; border:1px solid #333; color:var(--success); text-align:center; border-radius:10px; font-size:16px; font-weight:bold;">`
                    : `<span style="color:var(--success); font-weight:900; font-size:18px;">${ex['r'+n]||'-'}</span>`}
                </td>
            </tr>
        `;
    }

    document.getElementById('ex-editor-sets-container').innerHTML = html;
    document.getElementById('ex-editor-close-btn').innerText = isAdmin ? 'حفظ التعديلات ✅' : 'إغلاق ✕';
    document.getElementById('ex-editor-modal').classList.remove('hidden');
}

async function updateExSet(cat, idx, key, val) {
    if (currentUser.role !== 'admin') return;
    currentPlanData[cat][idx][key] = val;
    await db.collection('users').doc(currentUser.phone).update({ workoutPlan: currentPlanData });
}

// --- LOGGING & HISTORY ---
async function toggleExDone(cat, idx, status, exName) {
    currentPlanData[cat][idx].done = status;
    await db.collection('users').doc(currentUser.phone).update({ workoutPlan: currentPlanData });

    if (status) {
        const isNutri = NUTRI_CATS.includes(cat);
        const logType = isNutri ? 'تغذية' : 'تمرين';
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        const ex = currentPlanData[cat][idx];

        const newExData = {
            name: exName,
            time: timeStr,
            sets: ex.sets || (isNutri ? 'وجبة' : '4'),
            weight: ex.weight || 'حسب الرغبة',
            note: ex.note || '---',
            w: [ex.w1, ex.w2, ex.w3, ex.w4, ex.w5, ex.w6],
            r: [ex.r1, ex.r2, ex.r3, ex.r4, ex.r5, ex.r6]
        };

        try {
            const snap = await db.collection('logs')
                .where('uPhone', '==', currentUser.phone)
                .where('type', '==', logType)
                .where('sub', '==', cat)
                .get();

            let targetDoc = null;
            const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);

            snap.forEach(doc => {
                const data = doc.data();
                const ts = data.ts ? data.ts.toMillis() : 0;
                if (ts > twoHoursAgo) {
                    if (!targetDoc || ts > targetDoc.data().ts.toMillis()) targetDoc = doc;
                }
            });

            if (targetDoc) {
                let existingExs = JSON.parse(targetDoc.data().val);
                existingExs.push(newExData);
                await db.collection('logs').doc(targetDoc.id).update({ val: JSON.stringify(existingExs) });
            } else {
                throw new Error("No recent log");
            }
        } catch (e) {
            await db.collection('logs').add({
                uName: currentUser.name,
                uPhone: currentUser.phone,
                type: logType,
                sub: cat,
                val: JSON.stringify([newExData]),
                ts: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `تم تسجيل ${logType} ✅`, timer: 1500 });
        loadUserLogs();
    }
}

async function fetchAndRenderLogs(phone, containerId, isAdminView = false) {
    const list = document.getElementById(containerId); if (!list) return;
    const snap = await db.collection('logs').where('uPhone', '==', phone).get();
    let arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() })); arr.sort((a, b) => (b.ts?.seconds || 0) - (a.ts?.seconds || 0));
    let h = "";
    let processed = []; let lastW = null;
    arr.forEach(d => {
        if ((d.type === 'تمرين' || d.type === 'تغذية') && d.val && d.val.startsWith('[')) {
            try {
                let exs = JSON.parse(d.val);
                if (lastW && lastW.type === d.type && (lastW.ts?.seconds - d.ts?.seconds < 7200)) {
                    lastW.exs = lastW.exs.concat(exs); return;
                }
                d.exs = exs; lastW = d;
            } catch (e) { d.exs = []; }
        } else { lastW = null; }
        processed.push(d);
    });

    // تجميع حسب الشهر واليوم
    let monthGroups = {};
    processed.forEach(d => {
        const dt = (typeof d.ts === 'number') ? new Date(d.ts) : (d.ts?.toDate() || new Date());
        const monthKey = dt.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
        const dayKey = dt.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });

        if (!monthGroups[monthKey]) monthGroups[monthKey] = {};
        if (!monthGroups[monthKey][dayKey]) monthGroups[monthKey][dayKey] = [];
        monthGroups[monthKey][dayKey].push(d);
    });

    for (let month in monthGroups) {
        h += `
            <div class="month-group" style="margin-bottom:15px;">
                <div onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.arr').innerText = this.nextElementSibling.classList.contains('hidden') ? '▼' : '▲'" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:12px 15px; border-radius:15px; cursor:pointer; margin-bottom:8px; border:1px solid rgba(255,255,255,0.1);">
                    <span style="color:var(--accent); font-size:13px; font-weight:bold;">📅 ${month}</span>
                    <span class="arr" style="color:var(--accent); font-size:12px;">▲</span>
                </div>
                <div class="month-content">
        `;
        for (let day in monthGroups[month]) {
            h += `
                <div class="day-group" style="margin-right:10px; margin-bottom:10px;">
                    <div onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.arr').innerText = this.nextElementSibling.classList.contains('hidden') ? '▼' : '▲'" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02); padding:8px 12px; border-radius:10px; cursor:pointer; margin-bottom:5px;">
                        <span style="color:#777; font-size:11px;">📍 ${day}</span>
                        <span class="arr" style="color:#555; font-size:10px;">▲</span>
                    </div>
                    <div class="day-content">
            `;

            monthGroups[month][day].forEach(d => {
                let icon = '🔥', color = 'var(--primary)', valHtml = d.val;
                if (d.type === 'تمرين') { icon = '💪'; } else if (d.type === 'مياه') { icon = '💧'; color = '#007aff'; } else if (d.type === 'صور') { icon = '📸'; valHtml = `<img src="${d.val}" style="width:100%; border-radius:15px; margin-top:10px;">`; }

                if (d.type === 'تمرين' && d.exs) {
                    valHtml = `
                    <div style="overflow-x:auto; direction:rtl;">
                        <table style="width:100%; border-collapse:collapse; min-width:400px; background:rgba(0,0,0,0.2); border:1px solid #222; border-radius:15px; overflow:hidden;">
                            <thead>
                                <tr style="background:rgba(255,255,255,0.02); color:#777; font-size:10px;">
                                    <th style="padding:12px 8px; border:1px solid #222;">التمرين</th>
                                    <th style="padding:12px 8px; border:1px solid #222;">مج</th>
                                    <th style="padding:12px 8px; border:1px solid #222;">نوع</th>
                                    ${[1, 2, 3, 4, 5, 6].map(i => `<th style="padding:12px 8px; border:1px solid #222;">${i}</th>`).join('')}
                                    <th style="padding:12px 8px; border:1px solid #222;">صح</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${d.exs.map(ex => {
                        let rowW = `<td style="padding:10px; border:1px solid #222; color:var(--accent); font-weight:bold;">وزن</td>`;
                        let rowR = `<td style="padding:10px; border:1px solid #222; color:var(--success); font-weight:bold;">عدة</td>`;
                        for (let i = 0; i < 6; i++) {
                            const w = (ex.details && ex.details[i]) ? ex.details[i].weight : '-';
                            const r = (ex.details && ex.details[i]) ? ex.details[i].reps : '-';
                            rowW += `<td style="padding:10px; border:1px solid #222; color:var(--accent);">${w}</td>`;
                            rowR += `<td style="padding:10px; border:1px solid #222; color:var(--success);">${r}</td>`;
                        }
                        return `
                                        <tr>
                                            <td rowspan="2" style="padding:15px 10px; border:1px solid #222; font-weight:900; color:#fff; font-size:13px; text-align:center; min-width:110px;">
                                                ${ex.name}
                                                <div style="font-size:9px; color:#555; margin-top:5px; font-weight:normal;">🕒 ${ex.time || ''}</div>
                                            </td>
                                            <td rowspan="2" style="padding:10px; border:1px solid #222; color:var(--primary); font-weight:bold; font-size:14px; text-align:center;">${ex.sets}</td>
                                            ${rowW}
                                            <td rowspan="2" style="padding:10px; border:1px solid #222; text-align:center;">
                                                <div style="background:var(--success); color:#000; width:20px; height:20px; border-radius:4px; display:inline-flex; align-items:center; justify-content:center; font-weight:bold; font-size:12px;">✓</div>
                                            </td>
                                        </tr>
                                        <tr>${rowR}</tr>
                                    `;
                    }).join('')}
                            </tbody>
                        </table>
                    </div>`;
                } else if (d.type === 'تغذية' && d.exs) {
                    valHtml = `
                    <div style="overflow-x:auto; direction:rtl;">
                        <table style="width:100%; border-collapse:collapse; min-width:400px; background:rgba(0,0,0,0.2); border:1px solid #222; border-radius:15px; overflow:hidden;">
                            <thead>
                                <tr style="background:rgba(255,255,255,0.02); color:#4caf50; font-size:10px;">
                                    <th style="padding:12px 10px; border:1px solid #222; text-align:right;">الصنف 🥗</th>
                                    <th style="padding:12px 10px; border:1px solid #222;">الكمية ⚖️</th>
                                    <th style="padding:12px 10px; border:1px solid #222;">التفاصيل 📝</th>
                                    <th style="padding:12px 10px; border:1px solid #222;">الوقت 🕒</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${d.exs.map(m => `
                                    <tr style="border-bottom:1px solid #222;">
                                        <td style="padding:15px 10px; border:1px solid #222; font-weight:900; color:#fff; font-size:13px;">${m.name}</td>
                                        <td style="padding:15px 10px; border:1px solid #222; color:var(--accent); font-weight:bold; text-align:center;">${m.weight || 'حسب الرغبة'}</td>
                                        <td style="padding:15px 10px; border:1px solid #222; color:#777; font-size:11px;">${m.note || '---'}</td>
                                        <td style="padding:15px 10px; border:1px solid #222; color:#555; font-size:10px; text-align:center;">${m.time || ''}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>`;
                } else if ((d.type === 'وجبة' || d.type === 'تغذية') && d.val && d.val.startsWith('[')) {
                    try {
                        const meals = JSON.parse(d.val);
                        valHtml = `
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            ${meals.map(m => `
                                <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:15px; border:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
                                    <div style="display:flex; align-items:center; gap:10px;">
                                        <span style="font-size:18px;">🥗</span>
                                        <div>
                                            <b style="color:#fff; font-size:13px; display:block;">${m.name}</b>
                                            <small style="color:#777; font-size:10px;">🍳 ${m.type || m.note || '---'}</small>
                                        </div>
                                    </div>
                                    <div style="background:rgba(255,179,0,0.1); color:var(--accent); padding:5px 12px; border-radius:10px; font-size:12px; font-weight:bold; border:1px solid rgba(255,179,0,0.2);">
                                        ⚖️ ${m.weight || 'حسب الرغبة'}
                                    </div>
                                </div>
                            `).join('')}
                        </div>`;
                    } catch (e) { valHtml = d.val; }
                }

                const dt_item = (typeof d.ts === 'number') ? new Date(d.ts) : (d.ts?.toDate() || new Date());
                const timeStr = dt_item.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

                h += `
                    <div class="history-item">
                        <i class="del-btn" onclick="deleteLog('${d.id}', '${phone}', '${containerId}')">🗑️</i>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                            <div style="display:flex; align-items:center; gap:15px;">
                                <div style="width:45px; height:45px; background:rgba(255,255,255,0.05); border-radius:15px; display:flex; align-items:center; justify-content:center; font-size:22px; border:1px solid rgba(255,255,255,0.05);">${icon}</div>
                                <div>
                                    <b style="color:${color}; display:block; font-size:14px;">${d.type} ${d.sub || ''}</b>
                                    <small style="color:#555; font-size:10px;">${timeStr}</small>
                                </div>
                            </div>
                        </div>
                        ${d.type === 'وقت التمرين' || d.type === 'تمرين' ? `<div style="text-align:center; margin-bottom:15px;"><button onclick="openShareCard('${d.sub || ''}')" class="pulse-glow" style="background:linear-gradient(135deg, var(--primary), var(--primary-dark)); border:none; color:#fff; padding:10px 20px; border-radius:15px; font-size:12px; font-weight:900; cursor:pointer; display:inline-flex; align-items:center; gap:8px; box-shadow:0 6px 15px var(--primary-glow);">📤 شارك نجاحك مع أصدقائك 🔥</button></div>` : ''}
                        <div style="color:#eee; font-size:13px; line-height:1.6; background:rgba(0,0,0,0.2); padding:12px; border-radius:15px; border:1px solid rgba(255,255,255,0.02);">${valHtml}</div>
                    </div>`;
            });
            h += `</div></div>`;
        }
        h += `</div></div>`;
    }
    list.innerHTML = h || '<p style="text-align:center; padding:50px; color:#444;">مفيش نشاط مسجل لسه.. 🔥</p>';
}

function loadUserLogs() { fetchAndRenderLogs(currentUser.phone, 'user-history-list'); }
async function deleteLog(id, phone, containerId) { if (confirm('حذف؟')) { await db.collection('logs').doc(id).delete(); fetchAndRenderLogs(phone || currentUser.phone, containerId || 'user-history-list'); } }

// --- LOGGING ENGINE (Tracker Grid) ---
let currentLogType = ""; let currentLogSub = "";
function openLogger(type) {
    currentLogType = type;
    const titleMap = { 'وزن': '⚖️ تسجيل الوزن', 'وجبة': '🥗 تسجيل وجبة', 'تمرين': '💪 تسجيل تمرين', 'صور': '📸 تسجيل صور' };
    document.getElementById('logger-title').innerText = titleMap[type] || "تسجيل " + type;
    document.getElementById('logger-modal').classList.remove('hidden');

    const subList = document.getElementById('category-btns');
    if (subList) subList.innerHTML = "";
    document.getElementById('category-menu').classList.remove('hidden');
    document.getElementById('log-inputs').classList.add('hidden');

    let subs = [];
    if (type === 'وزن') { currentLogSub = "وزن يومي"; showInputs(); return; }
    if (type === 'تمرين') subs = PLAN_CATS;
    if (type === 'وجبة') subs = NUTRI_CATS;
    if (type === 'صور') subs = ['قبل التمرين', 'بعد التمرين', 'تحول أسبوعي'];

    const icons = {
        'وجبة 1': '🍳', 'وجبة 2': '🍗', 'وجبة 3': '🍲', 'وجبة 4': '🍎', 'وجبة 5': '🥛',
        'فطار': '🍳', 'غداء': '🍗', 'عشاء': '🍲', 'سناك': '🍎', 'قبل التمرين': '⚡', 'بعد التمرين': '🔄'
    };

    if (subList) {
        subList.innerHTML = subs.map(s => {
            const icon = icons[s] || '🔥';
            return `
            <button class="sub-btn" onclick="setSub('${s}')" 
                style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); padding:20px 10px; border-radius:20px; color:#fff; display:flex; flex-direction:column; align-items:center; gap:10px; transition:0.3s; cursor:pointer;">
                <span style="font-size:28px;">${icon}</span>
                <b style="font-size:12px;">${s}</b>
            </button>`;
        }).join('');
    }
}

function setSub(s) {
    currentLogSub = s; showInputs();
    document.querySelectorAll('#category-btns .sub-btn').forEach(b => {
        const isSelected = b.querySelector('b').innerText === s;
        b.style.background = isSelected ? 'rgba(229,57,53,0.2)' : 'rgba(255,255,255,0.03)';
        b.style.borderColor = isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.1)';
        b.style.transform = isSelected ? 'scale(1.05)' : 'scale(1)';
    });
}

function showInputs() {
    document.getElementById('category-menu').classList.add('hidden');
    const area = document.getElementById('log-fields-container');
    document.getElementById('log-inputs').classList.remove('hidden');

    const wrapper = document.getElementById('file-wrapper');
    if (wrapper) wrapper.classList.add('hidden');

    if (currentLogType === 'تمرين') {
        area.innerHTML = `<button class="btn-full" onclick="openWorkoutTable()" style="background:linear-gradient(135deg, var(--primary), var(--primary-dark)); box-shadow:0 10px 20px var(--primary-glow); border:none;">فتح جدول تسجيل التكرارات 💪</button>`;
    } else if (currentLogType === 'صور') {
        if (wrapper) wrapper.classList.remove('hidden');
        area.innerHTML = `<button class="btn-full" onclick="saveLog()" style="background:var(--success); color:#000; font-weight:bold; border:none; box-shadow:0 10px 20px rgba(76,175,80,0.3);">تأكيد وحفظ الصورة ✅</button>`;
    } else if (currentLogType === 'وجبة') {
        area.innerHTML = `
            <div id="meal-rows-container" style="margin-bottom:15px;"></div>
            <button onclick="addMealRow()" style="width:100%; background:none; border:1px dashed #444; color:#aaa; padding:15px; border-radius:20px; margin-bottom:20px; font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px;">
                <span style="font-size:20px;">+</span> إضافة نوع أكل آخر
            </button>
            <div style="margin-bottom:25px;">
                <label style="color:#777; font-size:11px; display:block; margin-bottom:8px; margin-right:5px;">ملاحظات إضافية (اختياري)</label>
                <div style="position:relative;">
                    <span style="position:absolute; left:15px; top:15px; font-size:18px;">📝</span>
                    <textarea id="log-note" placeholder="مثلاً: شعور جيد بعد الوجبة..." 
                        style="width:100%; height:100px; padding:15px 15px 15px 45px; background:rgba(0,0,0,0.3); border:1px solid #333; color:#fff; border-radius:18px; font-size:14px; outline:none; transition:0.3s; resize:none;"
                        onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#333'"></textarea>
                </div>
            </div>
            <button class="btn-full" onclick="saveLog()" style="background:linear-gradient(135deg, #e53935, #b71c1c); color:#fff; font-weight:bold; border:none; font-size:18px; padding:20px; border-radius:20px; box-shadow:0 10px 30px rgba(229,57,53,0.4); display:flex; align-items:center; justify-content:center; gap:10px;">
                <span style="background:#fff; border-radius:4px; padding:2px;">✅</span> تأكيد وحفظ
            </button>
        `;
        addMealRow(); // إضافة أول صف تلقائياً
    } else {
        const placeholder = currentLogType === 'وزن' ? "اكتب وزنك الحالي (كجم)..." : "اكتب التفاصيل...";
        const icon = currentLogType === 'وزن' ? '⚖️' : '📝';
        area.innerHTML = `
            <div style="margin-bottom:20px;">
                <label style="color:#777; font-size:11px; display:block; margin-bottom:8px; margin-right:5px;">القيمة المطلوبة</label>
                <div style="position:relative;">
                    <span style="position:absolute; right:15px; top:50%; transform:translateY(-50%); font-size:18px;">${icon}</span>
                    <input type="number" id="log-val" placeholder="${placeholder}" 
                        style="width:100%; padding:18px 45px 18px 15px; background:rgba(0,0,0,0.3); border:1px solid #333; border-radius:18px; color:#fff; font-size:16px; outline:none; transition:0.3s;"
                        onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#333'">
                </div>
            </div>
            <div style="margin-bottom:25px;">
                <label style="color:#777; font-size:11px; display:block; margin-bottom:8px; margin-right:5px;">ملاحظات إضافية (اختياري)</label>
                <textarea id="log-note" placeholder="ملاحظة إضافية..." 
                    style="width:100%; height:100px; padding:15px; background:rgba(0,0,0,0.3); border:1px solid #333; color:#fff; border-radius:18px; font-size:14px; outline:none; transition:0.3s; resize:none;"
                    onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='#333'"></textarea>
            </div>
            <button class="btn-full" onclick="saveLog()" style="background:linear-gradient(135deg, var(--primary), var(--primary-dark)); color:#fff; font-weight:bold; border:none; font-size:17px; padding:18px; border-radius:18px; box-shadow:0 10px 25px var(--primary-glow);">تأكيد وحفظ ✅</button>
        `;
    }
}

function addMealRow() {
    const container = document.getElementById('meal-rows-container');
    const row = document.createElement('div');
    row.className = 'meal-entry-row';
    row.style = "position:relative; background:rgba(255,255,255,0.03); border:1px solid #222; border-radius:25px; padding:20px; margin-bottom:15px; transition:0.3s;";
    row.innerHTML = `
        <div onclick="if(document.querySelectorAll('.meal-entry-row').length > 1) this.parentElement.remove()" style="position:absolute; top:12px; left:12px; color:#ff3b30; cursor:pointer; font-size:18px; opacity:0.6;">✕</div>
        
        <div style="margin-bottom:12px;">
            <div style="position:relative;">
                <span style="position:absolute; right:12px; top:50%; transform:translateY(-50%);">🥗</span>
                <input type="text" class="m-name" placeholder="اسم الأكل (مثلاً: أرز)" style="width:100%; background:#000; border:1px solid #333; color:#fff; padding:12px 35px 12px 10px; border-radius:12px; font-size:14px; outline:none;">
            </div>
        </div>
        
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div style="position:relative;">
                <span style="position:absolute; right:12px; top:50%; transform:translateY(-50%);">🍳</span>
                <input type="text" class="m-type" placeholder="الطبخ (مثلاً: مسلوق)" style="width:100%; background:#000; border:1px solid #333; color:#aaa; padding:10px 32px 10px 10px; border-radius:10px; font-size:11px; outline:none;">
            </div>
            <div style="position:relative;">
                <span style="position:absolute; right:12px; top:50%; transform:translateY(-50%);">⚖️</span>
                <input type="text" class="m-weight" placeholder="الكمية (مثلاً: 150ج)" style="width:100%; background:#000; border:1px solid #333; color:var(--accent); padding:10px 32px 10px 10px; border-radius:10px; font-size:11px; outline:none; font-weight:bold;">
            </div>
        </div>
    `;
    container.appendChild(row);
}

function handleImageProcessing(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 600; canvas.height = (img.height / img.width) * 600;
                canvas.getContext('2d').drawImage(img, 0, 0, 600, canvas.height);
                finalBase64 = canvas.toDataURL('image/jpeg', 0.6);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function saveLog(valOverride) {
    let val = valOverride;
    const note = document.getElementById('log-note')?.value || "";

    if (!val) {
        if (currentLogType === 'وجبة') {
            const rows = document.querySelectorAll('.meal-entry-row');
            let mealData = [];
            rows.forEach(r => {
                const name = r.querySelector('.m-name').value.trim();
                const type = r.querySelector('.m-type').value.trim();
                const weight = r.querySelector('.m-weight').value.trim();
                if (name) mealData.push({ name, type, weight });
            });
            if (!mealData.length) return Swal.fire('نقص بيانات', 'برجاء إضافة صنف واحد على الأقل', 'warning');
            val = JSON.stringify(mealData);
        } else {
            val = document.getElementById('log-val')?.value || finalBase64;
        }
    }

    if (!val && currentLogType !== 'وزن') return Swal.fire('نقص بيانات', 'برجاء كتابة البيانات أو رفع الصورة', 'warning');

    Swal.fire({ title: 'جاري الحفظ...', didOpen: () => Swal.showLoading() });
    await db.collection('logs').add({
        uName: currentUser.name, uPhone: currentUser.phone,
        type: currentLogType, sub: currentLogSub, val: val, note: note,
        ts: firebase.firestore.FieldValue.serverTimestamp()
    });
    Swal.close(); closeLogger(); loadUserLogs();
    if (currentLogType === 'تمرين') sendNotificationTo(ADMIN_PHONE, "بطل سجل تمرين! 💪", `البطل ${currentUser.name} خلص تمرين ${currentLogSub}.`);
}

function closeLogger() { document.getElementById('logger-modal').classList.add('hidden'); }

// --- WORKOUT TABLE (Detailed) ---
function openWorkoutTable() {
    document.getElementById('workout-table-modal').classList.remove('hidden');
    document.getElementById('workout-table-title').innerText = "تسجيل: " + currentLogSub;
    const body = document.getElementById('exercise-rows');
    if (body) body.innerHTML = "";
    addExerciseRow();
}

function addExerciseRow() {
    const body = document.getElementById('exercise-rows');
    const div = document.createElement('div');
    div.className = "workout-card-input";
    // التصميم المطابق للصورة
    div.innerHTML = `
        <div style="position:relative; background:#0f0f0f; border:1px solid #222; border-radius:25px; padding:20px; margin-bottom:20px; border-right:4px solid var(--primary);">
            <i onclick="this.parentElement.remove()" style="position:absolute; left:15px; top:15px; cursor:pointer; font-size:20px; opacity:0.6;">🗑️</i>
            
            <div style="margin-bottom:15px;">
                <label style="color:var(--primary); font-size:12px; display:block; margin-bottom:8px;">اسم التمرين</label>
                <input type="text" class="ex-name" placeholder="مثلاً: بنج عالي بالدمبل..." style="width:100%; background:#000; border:1px solid #333; color:#fff; padding:12px; border-radius:12px;">
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <label style="color:#777; font-size:12px;">المجموعات</label>
                <input type="number" class="ex-sets" value="4" oninput="renderSetDetails(this)" style="width:60px; text-align:center; background:#000; border:1px solid #333; color:var(--accent); padding:8px; border-radius:10px; font-weight:bold;">
            </div>

            <div class="sets-grid" style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px; background:rgba(0,0,0,0.3); padding:15px; border-radius:15px;">
                <!-- سيتم رندرة المجموعات هنا تلقائياً -->
            </div>
        </div>
    `;
    body.appendChild(div);
    renderSetDetails(div.querySelector('.ex-sets'));
}

function renderSetDetails(input) {
    const grid = input.parentElement.nextElementSibling;
    const count = parseInt(input.value) || 0;
    let h = "";
    for (let i = 1; i <= count; i++) {
        h += `
            <div style="text-align:center;">
                <small style="color:#555; font-size:9px; display:block; margin-bottom:5px;">مجموعة ${i}</small>
                <input type="text" class="set-weight" placeholder="وزن" style="width:100%; background:#000; border:1px solid #222; color:#fff; font-size:10px; padding:6px; border-radius:8px; margin-bottom:5px; text-align:center;">
                <input type="text" class="set-reps" placeholder="عدات" style="width:100%; background:#000; border:1px solid var(--success); color:var(--success); font-size:10px; padding:6px; border-radius:8px; text-align:center;">
            </div>
        `;
    }
    grid.innerHTML = h;
}

async function saveWorkoutTable() {
    const rows = document.querySelectorAll('#exercise-rows .workout-card-input');
    let data = [];
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    rows.forEach(r => {
        const name = r.querySelector('.ex-name').value;
        const setsCount = parseInt(r.querySelector('.ex-sets').value) || 0;
        if (name) {
            let details = [];
            const setDivs = r.querySelectorAll('.sets-grid > div');
            setDivs.forEach(sd => {
                const weight = sd.querySelector('.set-weight').value || '-';
                const reps = sd.querySelector('.set-reps').value || '-';
                details.push({ weight, reps });
            });
            data.push({ name, sets: setsCount, details, time: timeStr });
        }
    });
    if (!data.length) return;
    await saveLog(JSON.stringify(data));
    document.getElementById('workout-table-modal').classList.add('hidden');
}

// --- NOTIFICATIONS & MORE MENU ---
async function sendNotificationTo(p, t, m) {
    try { await db.collection('notifications').add({ targetPhone: p.toString().trim(), title: t, message: m, ts: Date.now(), read: false }); } catch (e) { }
}

function initSystemNotifications() {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") listenForCustomNotifications();
    else Notification.requestPermission().then(p => { if (p === "granted") listenForCustomNotifications(); });
}

function listenForCustomNotifications() {
    if (!currentUser) return;
    const p = currentUser.phone.toString().trim();
    db.collection('notifications').where('targetPhone', '==', p).orderBy('ts', 'desc').limit(20).onSnapshot(snap => {
        let unread = 0;
        const list = snap.docs.map(doc => {
            const d = doc.data();
            if (!d.read) unread++;
            return { id: doc.id, ...d };
        });

        // تحديث الجرس للأدمن أو المستخدم العادي
        const badgeAdmin = document.getElementById('notif-badge-admin');
        if (badgeAdmin) {
            if (unread > 0) {
                badgeAdmin.innerText = unread;
                badgeAdmin.classList.remove('hidden');
            } else {
                badgeAdmin.classList.add('hidden');
            }
        }
    });
}
function toggleMoreMenu() {
    const overlay = document.getElementById('more-menu-overlay');
    const content = document.getElementById('more-menu-content');
    const approved = allUsersData.filter(u => u.status === 'approved').length;
    const pending = allUsersData.filter(u => u.status === 'pending').length;
    const expired = allUsersData.filter(u => u.status === 'approved' && u.expiryDate && u.expiryDate < Date.now()).length;

    document.getElementById('stat-total-val').innerText = approved;
    document.getElementById('stat-pending-val').innerText = pending;
    document.getElementById('stat-expired-val').innerText = expired;
    if (overlay.classList.contains('hidden')) {
        overlay.classList.remove('hidden');
        setTimeout(() => content.style.bottom = '90px', 10);
    } else {
        content.style.bottom = '-100%';
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

// --- EVALUATION & ADMIN ---
async function loadEvaluationData() {
    try {
        const snap = await db.collection('evaluations').where('uPhone', '==', currentUser.phone).get();
        let evals = []; snap.forEach(d => evals.push(d.data()));
        evals.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        const lastEval = evals[0] || { score: 0, note: "في انتظار أول تقييم..." };
        document.getElementById('current-score-text').innerText = lastEval.score + " / 10";
        document.getElementById('coach-note-bubble').innerText = lastEval.note;
    } catch (e) { }
}
async function submitEvaluation() {
    const s = document.getElementById('admin-eval-score').value; const n = document.getElementById('admin-eval-note').value;
    await db.collection('evaluations').add({ uPhone: activeTarget, score: parseInt(s), note: n, ts: Date.now() });
    sendNotificationTo(activeTarget, "تقييم جديد! 📈", `الكابتن قيم أداءك بـ ${s} من 10.. عاش!`);
    Swal.fire('تم التقييم 🔥', '', 'success');
}
async function loadAdmin() {
    const snap = await db.collection('users').orderBy('name').get(); allUsersData = [];
    let pendingCount = 0;
    snap.forEach(d => {
        const u = d.data();
        allUsersData.push({ id: d.id, ...u });
        if (u.status === 'pending') pendingCount++;
    });

    // تحديث الأرقام الأساسية
    const approvedCount = allUsersData.filter(u => u.status === 'approved').length;
    const expiredCount = allUsersData.filter(u => u.status === 'approved' && u.expiryDate && u.expiryDate < Date.now()).length;

    document.getElementById('stat-total-val').innerText = approvedCount;
    document.getElementById('stat-pending-val').innerText = pendingCount;
    document.getElementById('stat-expired-val').innerText = expiredCount;
    document.getElementById('dot-pending').classList.toggle('hidden', pendingCount === 0);

    // رادار لحظي لطلبات تغيير النظام
    db.collection('goalChanges').onSnapshot(goalsSnap => {
        const goalsCount = goalsSnap.size;
        document.getElementById('stat-goals-val').innerText = goalsCount;
        document.getElementById('dot-goals').classList.toggle('hidden', goalsCount === 0);
        renderGoalChanges(goalsSnap);
    });

    renderAdminFilterChips('all');
    filterAdminUsers('all');

    let ph = "";
    const pSnap = await db.collection('users').where('status', '==', 'pending').get();
    pSnap.forEach(d => {
        const u = d.data();
        ph += `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-right:4px solid var(--primary); margin-bottom:10px; background:#111;">
                <b style="font-size:14px; color:#fff;">${u.name}</b>
                <div style="display:flex; gap:8px;">
                    <button onclick="openProfile('${d.id}')" style="background:#222; border:1px solid #444; border-radius:8px; padding:8px; cursor:pointer;" title="تجهيز الجدول">✍️</button>
                    <button onclick="approveUser('${d.id}')" style="background:var(--primary); color:#fff; border:none; border-radius:8px; padding:8px 12px; cursor:pointer; font-weight:bold;">تفعيل ✅</button>
                    <button onclick="deleteUser('${d.id}')" style="background:rgba(255,0,0,0.1); color:#ff3b30; border:1px solid #ff3b30; border-radius:8px; padding:8px; cursor:pointer;">🗑️</button>
                </div>
              </div>`;
    });
    document.getElementById('pending-users-list-modal').innerHTML = ph || '<p style="text-align:center; color:#444; font-size:12px; padding:20px;">لا يوجد طلبات انضمام حالياً</p>';
}

function renderGoalChanges(snap) {
    const list = document.getElementById('goal-change-list-modal');
    let h = "";
    snap.forEach(doc => {
        const d = doc.data();
        const goalId = doc.id;
        const userPhone = String(d.userPhone || "").trim();
        const newGoal = String(d.newGoal || "").trim();

        h += `<div class="card" style="margin-bottom:15px; background:#111; border-right:4px solid #ffb300; display:flex; justify-content:space-between; align-items:center; padding:15px; border-radius:18px;">
                <div style="flex:1; text-align:right;">
                    <b style="color:#fff; display:block; font-size:16px;">${d.userName}</b>
                    <small style="color:#ffb300; font-size:12px;">طلب تغيير إلى: ${newGoal}</small>
                </div>
                <button onclick="approveGoalChange('${goalId}', '${userPhone}', '${newGoal}')" style="background:#ffb300; color:#000; border:none; padding:10px 20px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:14px; box-shadow:0 4px 10px rgba(255,179,0,0.2);">
                    ✅ موافقة
                </button>
              </div>`;
    });
    list.innerHTML = h || '<div style="text-align:center; padding:40px; color:#444;"><span style="font-size:40px; display:block; margin-bottom:10px;">🚀</span> لا يوجد طلبات تغيير نظام حالياً</div>';
}

async function approveGoalChange(id, phone, goal) {
    if (!id || !phone || !goal) return;
    Swal.fire({ title: 'جاري التحديث...', didOpen: () => Swal.showLoading(), target: document.getElementById('goal-change-modal') });
    try {
        const cleanPhone = String(phone).trim();
        const cleanGoal = String(goal).trim();

        await db.collection('users').doc(cleanPhone).update({
            goal: cleanGoal,
            lastUpdate: Date.now()
        });

        await db.collection('goalChanges').doc(id).delete();
        sendNotificationTo(cleanPhone, "تم تغيير نظامك! 🚀", `الكابتن وافق على طلبك ودلوقتي نظامك هو: ${cleanGoal}`);

        Swal.fire({
            title: 'تم التحديث بنجاح ✅',
            icon: 'success',
            timer: 2000,
            target: document.getElementById('goal-change-modal')
        });
        loadAdmin();
    } catch (e) {
        console.error("Error in approveGoalChange:", e);
        Swal.fire({ title: 'خطأ', text: 'فشل التحديث، تأكد من الاتصال', icon: 'error', target: document.getElementById('goal-change-modal') });
    }
}
let currentAdminFilter = 'all';
function renderAdminFilterChips(currentFilter = 'all') {
    const filtersCont = document.getElementById('admin-user-filters');
    if (!filtersCont) return;

    const approved = allUsersData.filter(u => u.status === 'approved');
    const counts = {
        'all': approved.length,
        'نظام تدريب': approved.filter(u => (u.goal || "").includes('تدريب') && !(u.goal || "").includes('تغذيه') && !(u.goal || "").includes('VIP')).length,
        'نظام تغذيه': approved.filter(u => (u.goal || "").includes('تغذيه') && !(u.goal || "").includes('تدريب') && !(u.goal || "").includes('VIP')).length,
        'نظام تدريب + تغذيه': approved.filter(u => (u.goal || "").includes('تدريب') && (u.goal || "").includes('تغذيه') && !(u.goal || "").includes('VIP')).length,
        'نظام VIP': approved.filter(u => (u.goal || "").includes('VIP')).length,
        'expired': approved.filter(u => u.expiryDate && u.expiryDate < Date.now()).length
    };

    const filterConfigs = [
        { id: 'all', label: 'الكل', icon: '👥', color: 'var(--primary)' },
        { id: 'نظام تدريب', label: 'تدريب', icon: '🏋️', color: 'var(--primary)' },
        { id: 'نظام تغذيه', label: 'تغذية', icon: '🥗', color: '#4caf50' },
        { id: 'نظام تدريب + تغذيه', label: 'مكس', icon: '🔄', color: '#6a1b9a' },
        { id: 'نظام VIP', label: 'VIP', icon: '⭐', color: 'var(--accent)' },
        { id: 'expired', label: 'منتهي', icon: '⌛', color: '#ff3b30' }
    ];

    filtersCont.innerHTML = filterConfigs.map(f => {
        const isActive = f.id === currentFilter;
        const count = counts[f.id] || 0;
        return `
            <button onclick="filterAdminUsers('${f.id}')" style="
                background: ${isActive ? f.color : 'rgba(255,255,255,0.03)'};
                color: ${isActive ? '#000' : '#fff'};
                border: 1px solid ${isActive ? 'transparent' : 'rgba(255,255,255,0.1)'};
                padding: 10px 18px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: ${isActive ? '0 10px 20px -5px ' + f.color + '66' : 'none'};
                white-space: nowrap;
            ">
                <span style="font-size: 16px;">${f.icon}</span>
                ${f.label}
                <span style="
                    background: ${isActive ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.1)'};
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 11px;
                    margin-right: 4px;
                ">${count}</span>
            </button>
        `;
    }).join('');
}

function filterAdminUsers(goal = 'all') {
    renderAdminFilterChips(goal);
    const searchVal = document.getElementById('admin-search-phone').value.trim().toLowerCase();
    const list = document.getElementById('all-users-list');
    let approved = allUsersData.filter(u => u.status === 'approved');

    if (searchVal) {
        approved = approved.filter(u => 
            (u.phone && u.phone.includes(searchVal)) || 
            (u.name && u.name.toLowerCase().includes(searchVal))
        );
    }

    let groups = {};
    if (goal === 'all') {
        // Grouping logic for "All" view
        groups = {
            'نظام VIP ⭐': [],
            'نظام تدريب + تغذيه 🔄': [],
            'نظام تدريب فقط 🏋️': [],
            'نظام تغذيه فقط 🥗': [],
            'أنظمة أخرى ⚙️': [],
            'اشتراكات منتهية ⌛': []
        };

        approved.forEach(u => {
            const goalStr = (u.goal || "").toLowerCase();
            const isExpired = u.expiryDate && u.expiryDate < Date.now();
            
            if (isExpired) groups['اشتراكات منتهية ⌛'].push(u);

            if (goalStr.includes('vip')) {
                groups['نظام VIP ⭐'].push(u);
            } else if (goalStr.includes('تدريب') && (goalStr.includes('تغذيه') || goalStr.includes('تغذية'))) {
                groups['نظام تدريب + تغذيه 🔄'].push(u);
            } else if (goalStr.includes('تدريب')) {
                groups['نظام تدريب فقط 🏋️'].push(u);
            } else if (goalStr.includes('تغذيه') || goalStr.includes('تغذية')) {
                groups['نظام تغذيه فقط 🥗'].push(u);
            } else {
                groups['أنظمة أخرى ⚙️'].push(u);
            }
        });
    } else if (goal === 'expired') {
        groups = { 'المشتركين المنتهيين ⌛': approved.filter(u => u.expiryDate && u.expiryDate < Date.now()) };
    } else {
        const searchKey = goal.replace('نظام ', '').toLowerCase();
        groups = { [goal]: approved.filter(u => (u.goal || "").toLowerCase().includes(searchKey)) };
    }

    let finalHtml = "";
    // Order of display in "All" view
    const keys = goal === 'all' ? ['نظام VIP ⭐', 'نظام تدريب + تغذيه 🔄', 'نظام تدريب فقط 🏋️', 'نظام تغذيه فقط 🥗', 'أنظمة أخرى ⚙️', 'اشتراكات منتهية ⌛'] : Object.keys(groups);

    keys.forEach(cat => {
        const users = groups[cat] || [];
        if (users.length === 0) return;
        
        finalHtml += `
            <div style="margin-top:30px; margin-bottom:15px; display:flex; align-items:center; gap:10px;">
                <div style="height:1px; flex:1; background:linear-gradient(to right, transparent, rgba(255,255,255,0.1));"></div>
                <span style="color:#777; font-size:12px; font-weight:bold; text-transform:uppercase; letter-spacing:1px; background:rgba(255,255,255,0.03); padding:4px 12px; border-radius:10px;">${cat} (${users.length})</span>
                <div style="height:1px; flex:1; background:linear-gradient(to left, transparent, rgba(255,255,255,0.1));"></div>
            </div>
        `;

        finalHtml += users.map(u => {
            let goalIcon = "🏋️";
            let goalColor = "var(--primary)";
            const goalStr = (u.goal || "").toLowerCase();

            if (goalStr.includes('تغذيه') || goalStr.includes('تغذية')) {
                if (goalStr.includes('تدريب')) { goalIcon = "🔄"; goalColor = "#6a1b9a"; }
                else { goalIcon = "🥗"; goalColor = "#4caf50"; }
            } else if (goalStr.includes('vip')) {
                goalIcon = "⭐"; goalColor = "var(--accent)";
            }

            return `
                <div class="user-admin-card" style="margin-bottom:12px; display:flex; align-items:center; gap:12px; background:linear-gradient(135deg, #111, #070707); padding:12px; border-radius:20px; border:1px solid #222; transition:0.3s; position:relative; overflow:hidden; border-right:4px solid ${goalColor};">
                    <div style="width:45px; height:45px; border-radius:50%; background:rgba(255,255,255,0.03); display:flex; align-items:center; justify-content:center; font-size:20px; border:1px solid rgba(255,255,255,0.05); flex-shrink:0;">
                        ${u.photo ? `<img src="${u.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` : '👤'}
                    </div>
                    <div style="flex:1; text-align:right;" onclick="openProfile('${u.id}')">
                        <b style="color:#fff; display:block; font-size:15px; margin-bottom:2px;">${u.name}</b>
                        <span style="font-size:10px; color:${goalColor}; font-weight:bold;">${goalIcon} ${u.goal || 'بدون نظام'}</span>
                    </div>
                    <div style="display:flex; gap:8px;">
                        ${(goalStr.includes('تغذيه') || goalStr.includes('تغذية') || goalStr.includes('vip')) ? `
                            <button onclick="showAdminFoodPrefs('${u.id}', '${u.name}')" style="background:rgba(76,175,80,0.1); border:1px solid #4caf50; color:#4caf50; width:40px; height:40px; border-radius:12px; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.3s;">🥗</button>
                        ` : ''}
                        <button onclick="activeTarget='${u.phone}'; viewSelectedUserLogs()" style="background:rgba(255,255,255,0.05); border:1px solid #333; color:#fff; width:40px; height:40px; border-radius:12px; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.3s;">📜</button>
                        <button onclick="openChatWithUser('${u.phone}', '${u.name}'); document.getElementById('chat-window').classList.remove('hidden');" style="background:rgba(0,122,255,0.1); border:1px solid #007aff; color:#007aff; width:40px; height:40px; border-radius:12px; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:0.3s;">💬</button>
                    </div>
                </div>
            `;
        }).join('');
    });
    
    list.innerHTML = finalHtml || '<p style="text-align:center; color:#444; padding:50px;">مفيش أبطال هنا حالياً 🔥</p>';
}
async function openProfile(id) {
    activeTarget = id; const d = await db.collection('users').doc(id).get(); const data = d.data();
    document.getElementById('prof-name').innerText = data.name;
    document.getElementById('admin-captain-notes').value = data.captainNotes || "";

    // Fill Vitals for Admin
    document.getElementById('admin-view-age').innerText = data.age || '--';
    document.getElementById('admin-view-weight').innerText = data.weight || '--';
    document.getElementById('admin-view-height').innerText = data.height || '--';
    document.getElementById('admin-view-fat').innerText = data.fat || '--';

    document.getElementById('profile-modal').classList.remove('hidden'); currentPlanData = data.workoutPlan || {};

    // ستايل جديد بريميوم للزراير (Workout)
    document.getElementById('admin-plan-cats-workout').innerHTML = PLAN_CATS.map(c => `
        <button class="sub-btn" onclick="editAdminPlan('${c}')" style="background:#1a1a1a; border:1px solid #333; color:var(--primary); padding:15px; border-radius:15px; font-weight:bold; font-size:14px; transition:all 0.3s; box-shadow:0 4px 6px rgba(0,0,0,0.3);">
            🏋️ ${c}
        </button>`).join('');

    // ستايل جديد بريميوم للزراير (Nutrition)
    document.getElementById('admin-plan-cats-nutri').innerHTML = NUTRI_CATS.map(c => `
        <button class="sub-btn" onclick="editAdminPlan('${c}')" style="background:#1a1a1a; border:1px solid #333; color:#4caf50; padding:15px; border-radius:15px; font-weight:bold; font-size:14px; transition:all 0.3s; box-shadow:0 4px 6px rgba(0,0,0,0.3);">
            🥗 ${c}
        </button>`).join('');
}

async function showAdminFoodPrefs(id, name) {
    const d = await db.collection('users').doc(id).get();
    const data = d.data();
    if (!data.foodPrefs || data.foodPrefs.length === 0) {
        return Swal.fire({
            title: 'تنبيه',
            text: `البطل ${name} مضافش أي تفضيلات أكل لسه.. 🥗`,
            icon: 'info',
            background: '#0a0a0a',
            color: '#fff',
            confirmButtonColor: 'var(--primary)'
        });
    }
    
    let html = `
        <div style="text-align:right; color:#ccc; font-size:14px; max-height:400px; overflow-y:auto; padding:10px;">
            ${data.foodPrefs.map(p => `
                <div style="display:flex; justify-content:space-between; margin-bottom:12px; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:10px;">
                    <span style="font-weight:bold; color:#fff; font-size:16px;">${p.name}</span>
                    <span style="color:${p.status === 'like' ? '#4caf50' : '#ff3b30'}; font-weight:900; background:rgba(255,255,255,0.03); padding:4px 10px; border-radius:8px;">${p.status === 'like' ? '❤️ بحب' : '💔 بلاش'}</span>
                </div>
            `).join('')}
        </div>
    `;
    
    Swal.fire({
        title: `ذوق البطل ${name} 🥗`,
        html: html,
        background: '#0a0a0a',
        color: '#fff',
        confirmButtonText: 'تمام يا كابتن ✅',
        confirmButtonColor: '#4caf50',
        width: '90%'
    });
}
function editAdminPlan(cat) { editingCat = cat; document.getElementById('admin-plan-editor').classList.remove('hidden'); const container = document.getElementById('admin-plan-rows'); container.innerHTML = ""; const exs = currentPlanData[cat] || []; exs.forEach(ex => addAdminPlanRow(ex)); if (exs.length === 0) addAdminPlanRow(); }
function addAdminPlanRow(d = {}) {
    const container = document.getElementById('admin-plan-rows');
    const card = document.createElement('div');
    card.className = "plan-edit-card";
    const isNutri = NUTRI_CATS.includes(editingCat);
    const rowId = 'row-' + Date.now() + Math.random().toString(36).substr(2, 5);

    card.style = `
        background: #1a1a1a;
        border: 1px solid #333;
        border-right: 4px solid ${isNutri ? '#4caf50' : 'var(--primary)'};
        border-radius: 20px;
        padding: 20px;
        margin-bottom: 15px;
        position: relative;
        box-shadow: 0 10px 20px rgba(0,0,0,0.4);
    `;

    // إبعاد السلة قليلاً لليمين
    const deleteBtn = `<div onclick="this.parentElement.remove()" style="position:absolute; right:15px; top:15px; color:#ff3b30; cursor:pointer; font-size:18px; filter:drop-shadow(0 0 5px rgba(255,59,48,0.3)); z-index:10;">🗑️</div>`;

    if (isNutri) {
        card.innerHTML = `
            ${deleteBtn}
            <div style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">
                <input type="text" value="${d.name || ''}" class="p-name" placeholder="🥗 اسم الوجبة (مثلاً: فطار بطل)" style="width:100%; background:#000; border:1px solid #333; color:#fff; padding:12px; border-radius:12px; font-weight:bold;">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                    <input type="text" value="${d.note || ''}" class="p-note" placeholder="📝 التفاصيل" style="background:#000; border:1px solid #333; color:#aaa; padding:10px; border-radius:10px; font-size:13px;">
                    <input type="text" value="${d.weight || ''}" class="p-weight" placeholder="⚖️ الكمية" style="background:#000; border:1px solid #333; color:#4caf50; padding:10px; border-radius:10px; font-size:13px; font-weight:bold;">
                </div>
            </div>`;
    } else {
        const initialSets = d.sets || 4;
        card.innerHTML = `
            ${deleteBtn}
            <div style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">
                <div style="display:flex; gap:10px; align-items:center; padding-left:30px;">
                    <input type="text" value="${d.name || ''}" class="p-name" placeholder="🏋️ اسم التمرين" style="flex:1; background:#000; border:1px solid #333; color:#fff; padding:12px; border-radius:12px; font-weight:bold;">
                    <div style="display:flex; align-items:center; background:#000; padding:5px 10px; border-radius:10px; border:1px solid #333;">
                        <small style="color:#777; margin-left:5px;">مجموعات:</small>
                        <input type="number" value="${initialSets}" class="p-sets" 
                               oninput="updateSetsVisibility('${rowId}', this.value)"
                               style="width:45px; background:none; border:none; color:var(--primary); font-weight:bold; text-align:center;">
                    </div>
                </div>
                <div id="${rowId}" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px; background:rgba(0,0,0,0.3); padding:15px; border-radius:18px;">
                    ${[1, 2, 3, 4, 5, 6].map(n => `
                        <div class="set-box-${n}" style="display:${n > initialSets ? 'none' : 'flex'}; flex-direction:column; gap:8px; background:#000; padding:10px; border-radius:12px; border:1px solid #222;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="font-size:10px; color:#777; font-weight:bold;">مجموعة ${n}</span>
                            </div>
                            <input type="text" value="${d['w' + n] || ''}" class="w${n}" placeholder="الوزن (مثلاً: 20 ك)" style="width:100%; background:rgba(255,179,0,0.05); border:1px solid #333; color:var(--accent); font-size:14px; text-align:center; padding:8px; border-radius:8px;">
                            <input type="text" value="${d['r' + n] || ''}" class="r${n}" placeholder="العدات (مثلاً: 12)" style="width:100%; background:rgba(76,175,80,0.05); border:1px solid #333; color:var(--success); font-size:14px; text-align:center; padding:8px; border-radius:8px;">
                        </div>
                    `).join('')}
                </div>
            </div>`;
    }
    container.appendChild(card);
}

function updateSetsVisibility(rowId, count) {
    const container = document.getElementById(rowId);
    if (!container) return;
    const num = parseInt(count) || 0;
    for (let i = 1; i <= 6; i++) {
        const box = container.querySelector('.set-box-' + i);
        if (box) box.style.display = (i <= num) ? 'flex' : 'none';
    }
}

async function saveAdminPlan(ev) { if (ev) ev.preventDefault(); const targetId = activeTarget; let exs = []; document.querySelectorAll('.plan-edit-card').forEach(card => { const name = card.querySelector('.p-name').value.trim(); if (name) { const isNutri = NUTRI_CATS.includes(editingCat); let row = { name, done: false }; if (isNutri) { row.note = card.querySelector('.p-note').value; row.weight = card.querySelector('.p-weight').value; } else { row.sets = card.querySelector('.p-sets').value; for (let i = 1; i <= 6; i++) { row['w' + i] = card.querySelector('.w' + i).value; row['r' + i] = card.querySelector('.r' + i).value; } } exs.push(row); } }); currentPlanData[editingCat] = exs; await db.collection('users').doc(targetId).update({ workoutPlan: currentPlanData }); sendNotificationTo(targetId, "تحديث من الكابتن 🔥", `تم تعديل جدول ${editingCat}`); Swal.fire('تم الحفظ', '', 'success'); }

// --- ADMIN USER CONTROLS ---
async function viewSelectedUserLogs() {
    Swal.fire({
        title: 'سجل نشاط البطل 📜',
        html: '<div id="admin-user-history" style="max-height:500px; overflow-y:auto;">جاري التحميل...</div>',
        width: '95%', background: '#121212', color: '#fff'
    });
    fetchAndRenderLogs(activeTarget, 'admin-user-history', true);
}

async function saveCaptainNotes() {
    const notes = document.getElementById('admin-captain-notes').value.trim();
    if (!activeTarget) return Swal.fire('خطأ', 'برجاء اختيار مشترك أولاً', 'error');
    
    await db.collection('users').doc(activeTarget.toString().trim()).update({ captainNotes: notes });
    sendNotificationTo(activeTarget, "رسالة من الكابتن 🔔", "الكابتن ساب لك ملاحظة جديدة في صفحتك الرئيسية.. شوفها دلوقت!");
    Swal.fire('تم الحفظ وإرسال تنبيه ✅', '', 'success');
}

async function resetUserPass() {
    const { value: newPass } = await Swal.fire({ title: 'تعيين كلمة سر جديدة', input: 'text', showCancelButton: true });
    if (newPass) {
        await db.collection('users').doc(activeTarget).update({ password: newPass });
        Swal.fire('تم التغيير ✅', `كلمة السر الجديدة: ${newPass}`, 'success');
    }
}

async function approveUser(id) {
    await db.collection('users').doc(id).update({ status: 'approved' });
    sendNotificationTo(id, "تم تفعيل حسابك! 🎉", "ألف مبروك! الكابتن وافق على اشتراكك، تقدر تدخل دلوقت وتشوف نظامك.");
    loadAdmin();
    Swal.fire('تم التفعيل ✅', '', 'success');
}

async function deleteUser(id) {
    const targetId = id || activeTarget;
    if (!targetId) return;

    const result = await Swal.fire({
        title: 'هل أنت متأكد؟ ⚠️',
        text: "سيتم حذف هذا البطل نهائياً!",
        icon: 'warning',
        target: document.getElementById('profile-modal'), // الربط بالصفحة الحالية
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#333',
        confirmButtonText: 'نعم، احذفه! 🗑️',
        cancelButtonText: 'إلغاء',
        background: '#181818',
        color: '#fff',
        backdrop: 'rgba(0,0,0,0.4)'
    });

    if (result.isConfirmed) {
        Swal.fire({ title: 'جاري الحذف...', didOpen: () => Swal.showLoading() });
        try {
            await db.collection('users').doc(targetId).delete();

            // إغلاق كل المودالات المفتوحة
            document.getElementById('profile-modal').classList.add('hidden');
            document.getElementById('pending-requests-modal').classList.add('hidden');

            await loadAdmin();
            Swal.fire('تم الحذف!', 'تمت إزالة البطل بنجاح.', 'success');
        } catch (e) {
            Swal.fire('خطأ', 'فشل حذف المشترك', 'error');
        }
    }
}

// --- OTHERS & KNOWLEDGE ---
function openInfoBank() {
    document.getElementById('info-bank-modal').classList.remove('hidden');
    const content = document.getElementById('info-bank-content');
    content.innerHTML = '<p style="text-align:center; color:#777;">جاري التحميل... 🔥</p>';

    const fallbackTips = [
        { q: "أهمية شرب المياة أثناء التمرين 💧", a: "شرب المياة بيحافظ على رطوبة عضلاتك وبيمنع التشنجات، لازم تشرب على الأقل 2 لتر خلال يومك." },
        { q: "إزاي تستفيد من الـ Creatine؟ 🧪", a: "الكرياتين بيزود القوة والحجم، جرعته اليومية 5 جرام ولازم تشرب معاه مياة كتير." },
        { q: "ليه النوم مهم لبناء العضلات؟ 😴", a: "العضلات بتكبر وإنت نايم! جسمك بيفرز هرمون النمو خلال النوم العميق، لازم تنام 7-8 ساعات." },
        { q: "القاعدة الذهبية للتغذية 🥗", a: "عشان تشوف نتيجة، لازم 70% من مجهودك يكون في المطبخ! البروتين هو حجر الأساس لبناء العضلات." }
    ];

    function renderTips(tips) {
        let h = "";
        tips.forEach(t => {
            h += `<div style="background:rgba(255,255,255,0.03); border:1px solid #222; padding:15px; border-radius:15px; margin-bottom:10px;"><b style="color:var(--accent);">💡 ${t.q}</b><p style="color:#eee; font-size:13px; line-height:1.6;">${t.a}</p></div>`;
        });
        content.innerHTML = h;
    }

    db.collection('knowledge').orderBy('ts', 'desc').get().then(snap => {
        if (!snap.empty) {
            let items = [];
            snap.forEach(doc => items.push(doc.data()));
            renderTips(items);
        } else {
            renderTips(fallbackTips);
        }
    }).catch(() => {
        renderTips(fallbackTips);
    });
}
function toggleWorkoutTimer() {
    const btn = document.getElementById('workout-timer-btn');
    const display = document.getElementById('workout-timer-display');
    const btnSchedule = document.getElementById('workout-timer-btn-schedule');
    const displaySchedule = document.getElementById('workout-timer-display-schedule');

    if (!workoutTimerInterval) {
        workoutStartTime = Date.now() - (workoutSeconds * 1000);
        workoutTimerInterval = setInterval(() => {
            workoutSeconds = Math.floor((Date.now() - workoutStartTime) / 1000);
            const h = Math.floor(workoutSeconds / 3600).toString().padStart(2, '0');
            const m = Math.floor((workoutSeconds % 3600) / 60).toString().padStart(2, '0');
            const s = (workoutSeconds % 60).toString().padStart(2, '0');
            const timeStr = `${h}:${m}:${s}`;
            if (display) display.innerText = timeStr;
            if (displaySchedule) displaySchedule.innerText = timeStr;
        }, 1000);
        if (btn) btn.style.background = "#ff3b30";
        if (btnSchedule) btnSchedule.style.background = "#ff3b30";
    } else {
        clearInterval(workoutTimerInterval);
        workoutTimerInterval = null;
        const totalTime = display ? display.innerText : (displaySchedule ? displaySchedule.innerText : "00:00:00");
        Swal.fire({ title: 'خلصت التمرين؟ 💪', text: `وقتك: ${totalTime}`, showCancelButton: true }).then(async (res) => {
            if (res.isConfirmed) {
                await db.collection('logs').add({ uPhone: currentUser.phone, uName: currentUser.name, type: 'وقت التمرين', val: totalTime, ts: firebase.firestore.FieldValue.serverTimestamp() });
                sendNotificationTo(ADMIN_PHONE, "بطل خلص تمرينه! 🏆", `البطل ${currentUser.name} خلص تمرينه في وقت ${totalTime}.`);

                // مسح علامات الصح
                for (let c of PLAN_CATS) { if (currentPlanData[c]) currentPlanData[c].forEach(ex => ex.done = false); }
                await db.collection('users').doc(currentUser.phone).update({ workoutPlan: currentPlanData });

                workoutSeconds = 0;
                if (display) display.innerText = "00:00:00";
                if (displaySchedule) displaySchedule.innerText = "00:00:00";
                if (btn) btn.style.background = "var(--accent)";
                if (btnSchedule) btnSchedule.style.background = "var(--accent)";
                if (lastViewedCat) viewCatPlan(lastViewedCat);
                loadUserLogs();

                // إظهار بطاقة المشاركة مع اسم التمرين الحالي
                openShareCard(lastViewedCat || "الحديد");
            } else {
                // If cancelled, resume the timer logic if needed, but usually users just pause. 
                // To keep it simple, we stop it. If they want to continue, they'd need a "Resume" logic.
            }
        });
    }
}
async function loadTechniques() { const list = document.getElementById('technique-list'); try { const snap = await db.collection('techniques').orderBy('ts', 'desc').get(); let h = ""; snap.forEach(doc => { const d = doc.data(); h += `<div class="card" style="margin-bottom:15px;"><div style="display:flex; justify-content:space-between; align-items:center;"><b>${d.name}</b>${currentUser.role === 'admin' ? `<i onclick="deleteTechnique('${doc.id}')" style="color:#ff3b30; cursor:pointer;">🗑️</i>` : ''}</div><div style="display:flex; gap:10px; margin-top:10px;">${d.correctUrl ? `<a href="${d.correctUrl}" target="_blank" class="sub-btn">✅ الأداء</a>` : ''}${d.wrongUrl ? `<a href="${d.wrongUrl}" target="_blank" class="sub-btn" style="color:#ff3b30;">❌ الخطأ</a>` : ''}</div></div>`; }); list.innerHTML = h || '<p>قريباً..</p>'; } catch (e) { } }
function switchTab(t, el) {
    document.querySelectorAll('.content-tab').forEach(c => c.classList.add('hidden'));

    // Support for the new workout-schedule-tab
    const targetTab = document.getElementById(t + '-tab');
    if (targetTab) targetTab.classList.remove('hidden');

    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    if (el) el.classList.add('active');

    if (t === 'workout-schedule') {
        renderUserPlanTabs();
        
        const goal = (currentUser && currentUser.goal) ? currentUser.goal.toLowerCase() : '';
        const btnWorkout = document.getElementById('btn-schedule-workout');
        const btnNutrition = document.getElementById('btn-schedule-nutrition');
        
        if (btnWorkout && btnNutrition) {
            const hasWorkout = goal.includes('تدريب') || goal.includes('vip') || currentUser.role === 'admin';
            const hasNutrition = goal.includes('تغذيه') || goal.includes('تغذية') || goal.includes('vip') || currentUser.role === 'admin';
            
            btnWorkout.classList.toggle('hidden', !hasWorkout);
            btnNutrition.classList.toggle('hidden', !hasNutrition);
            
            const navContainer = btnWorkout.parentElement;
            if (hasWorkout && hasNutrition) {
                navContainer.style.display = 'flex';
                switchScheduleView('workout', btnWorkout);
                if (PLAN_CATS.length > 0) viewCatPlan(PLAN_CATS[0]);
            } else {
                navContainer.style.display = 'none';
                if (hasWorkout) {
                    switchScheduleView('workout', btnWorkout);
                    if (PLAN_CATS.length > 0) viewCatPlan(PLAN_CATS[0]);
                } else if (hasNutrition) {
                    switchScheduleView('nutrition', btnNutrition);
                }
            }
        }
    }

    // إظهار الأقسام الأساسية عند التبديل لتبويب المستخدم
    if (t === 'user') {
        const goal = (currentUser && currentUser.goal) ? currentUser.goal : '';
        if (goal.includes('تغذيه') || goal.includes('VIP')) {
            if (document.getElementById('nutrition-extras')) document.getElementById('nutrition-extras').classList.remove('hidden');
            if (document.getElementById('food-prefs-section')) document.getElementById('food-prefs-section').classList.remove('hidden');
        }
    }

    if (t === 'history') loadUserLogs();
    if (t === 'technique') loadTechniques();
    if (t === 'eval') loadEvaluationData();
}


function startRestTimer(s) {
    const overlay = document.getElementById('rest-timer-overlay');
    const display = document.getElementById('rest-seconds');
    const circle = document.getElementById('rest-progress-circle');
    if (!overlay || !display || !circle) return;

    overlay.style.display = 'flex';
    let r = s;
    display.innerText = r;

    const totalLength = 282.7; // 2 * PI * 45
    circle.style.strokeDashoffset = 0;

    if (restInterval) clearInterval(restInterval);
    restInterval = setInterval(() => {
        r--;
        display.innerText = r;
        const offset = totalLength - (r / s) * totalLength;
        circle.style.strokeDashoffset = offset;

        if (r <= 0) {
            stopRestTimer();
        }
    }, 1000);
}

function stopRestTimer() {
    clearInterval(restInterval);
    const overlay = document.getElementById('rest-timer-overlay');
    if (overlay) overlay.style.display = 'none';
}

// --- RECOVERY FUNCTIONS ---
async function fireGymChangePass() { const { value: pass } = await Swal.fire({ title: 'تغيير كلمة السر 🔒', input: 'password', showCancelButton: true }); if (pass) { await db.collection('users').doc(currentUser.phone).update({ password: pass }); Swal.fire('تم التغيير ✅', '', 'success'); } }
async function requestGoalChange() { const { value: goal } = await Swal.fire({ title: 'اختر نظامك الجديد 🚀', input: 'select', inputOptions: { 'نظام تدريب': 'نظام تدريب 🏋️‍♂️', 'نظام تغذيه': 'نظام تغذيه 🥗', 'نظام VIP': 'نظام VIP ⭐' }, showCancelButton: true }); if (goal) { await db.collection('users').doc(currentUser.phone).update({ pendingGoal: goal }); sendNotificationTo(ADMIN_PHONE, "طلب تغيير نظام 📝", `البطل ${currentUser.name} طالب يغير نظامه لـ ${goal}`); Swal.fire('تم الإرسال ✅', '', 'success'); } }
function checkWaterReset() { const d = new Date().toDateString(); if (localStorage.getItem('w_date') !== d) { localStorage.setItem('w_date', d); localStorage.setItem('w_count', "0"); } document.getElementById('water-count').innerText = localStorage.getItem('w_count') || "0"; }
async function updateWater(v) {
    let c = parseInt(localStorage.getItem('w_count') || "0") + v;
    localStorage.setItem('w_count', c);
    if (document.getElementById('water-count')) document.getElementById('water-count').innerText = c;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const snap = await db.collection('logs')
        .where('uPhone', '==', currentUser.phone)
        .where('type', '==', 'مياه')
        .where('ts', '>=', startOfDay)
        .get();

    if (!snap.empty) {
        const docId = snap.docs[0].id;
        await db.collection('logs').doc(docId).update({
            val: c + ' كوب',
            ts: firebase.firestore.FieldValue.serverTimestamp()
        });
    } else {
        await db.collection('logs').add({
            uPhone: currentUser.phone,
            type: 'مياه',
            val: c + ' كوب',
            ts: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    loadUserLogs();
}
// --- UI LOADERS ---

function toggleAuth(mode) {
    if (mode === 'register') {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    } else {
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    }
}

function toggleNutritionSection(id) {
    const sections = ['food-prefs-section', 'recipes-section'];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (!el) return;
        if (s === id) el.classList.toggle('hidden');
        else el.classList.add('hidden');
    });
}

// --- RECIPES SYSTEM ---


function openRecipeDetail(id) {
    db.collection('recipes').doc(id).get().then(doc => {
        const d = doc.data();
        document.getElementById('recipe-detail-img').style.backgroundImage = `url('${d.img}')`;
        document.getElementById('recipe-detail-name').innerText = d.name;
        document.getElementById('recipe-detail-desc').innerText = d.desc;
        document.getElementById('recipe-detail-modal').classList.remove('hidden');
    });
}

function processRecipeImg(input) {
    if (input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 500; canvas.height = (img.height / img.width) * 500;
                canvas.getContext('2d').drawImage(img, 0, 0, 500, canvas.height);
                finalBase64 = canvas.toDataURL('image/jpeg', 0.6);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

async function saveRecipe() {
    const name = document.getElementById('recipe-name').value;
    const desc = document.getElementById('recipe-desc').value;
    if (!name || !finalBase64) return Swal.fire('نقص بيانات', 'لازم اسم وصورة للوصفة', 'warning');
    await db.collection('recipes').add({ name, desc, img: finalBase64, ts: Date.now() });
    Swal.fire('تم النشر ✅', '', 'success');
    document.getElementById('admin-recipes-tool').classList.add('hidden');
    loadRecipes();
}

async function deleteRecipe(id) {
    if (currentUser.role === 'admin') {
        if (confirm('حذف الوصفة نهائياً من الجميع؟')) {
            await db.collection('recipes').doc(id).delete();
            loadRecipes();
        }
    } else {
        if (confirm('حذف هذه الوصفة من قائمتك؟')) {
            if (!currentUser.hiddenRecipes) currentUser.hiddenRecipes = [];
            currentUser.hiddenRecipes.push(id);
            await db.collection('users').doc(currentUser.phone).update({
                hiddenRecipes: firebase.firestore.FieldValue.arrayUnion(id)
            });
            loadRecipes();
        }
    }
}

// --- FOOD PREFERENCES ---
async function loadFoodPrefs() {
    const body = document.getElementById('food-prefs-body');
    if (!body) return;
    const prefs = currentUser.foodPrefs || [];
    body.innerHTML = prefs.map((p, i) => `
        <tr style="border-bottom:1px solid #222;">
            <td style="padding:10px;"><input type="text" value="${p.name}" class="pref-name" style="width:100%; background:none; border:none; color:#fff;"></td>
            <td>
                <select class="pref-status" style="background:#000; color:#fff; border:1px solid #333; border-radius:5px; padding:5px;">
                    <option value="like" ${p.status === 'like' ? 'selected' : ''}>❤️ بحب</option>
                    <option value="dislike" ${p.status === 'dislike' ? 'selected' : ''}>💔 بكره</option>
                </select>
            </td>
            <td><button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:#ff3b30;">✕</button></td>
        </tr>
    `).join('');
}

function addPrefRow() {
    const body = document.getElementById('food-prefs-body');
    if (!body) return;
    const tr = document.createElement('tr');
    tr.style.borderBottom = "1px solid #222";
    tr.innerHTML = `
        <td style="padding:10px;"><input type="text" class="pref-name" placeholder="مثلاً: بامية" style="width:100%; background:none; border:none; color:#fff;"></td>
        <td>
            <select class="pref-status" style="background:#000; color:#fff; border:1px solid #333; border-radius:5px; padding:5px;">
                <option value="like">❤️ بحب</option>
                <option value="dislike">💔 بكره</option>
            </select>
        </td>
        <td><button onclick="this.parentElement.parentElement.remove()" style="background:none; border:none; color:#ff3b30;">✕</button></td>`;
    body.appendChild(tr);
}

async function saveFoodPrefs() {
    const rows = document.querySelectorAll('#food-prefs-body tr');
    let prefs = [];
    rows.forEach(r => {
        const name = r.querySelector('.pref-name').value;
        const status = r.querySelector('.pref-status').value;
        if (name) prefs.push({ name, status });
    });
    await db.collection('users').doc(currentUser.phone).update({ foodPrefs: prefs });
    Swal.fire('تم الحفظ ✅', 'الكابتن هيشوف تفضيلاتك في الأكل فوراً', 'success');
}

// --- GOAL CHANGE REQUESTS (ADMIN) ---
// Removed duplicate goal change handlers that were causing conflicts.


// --- KNOWLEDGE MANAGEMENT ---
async function saveKnowledge() {
    const q = document.getElementById('info-q').value;
    const a = document.getElementById('info-a').value;
    if (!q || !a) return;
    await db.collection('knowledge').add({ q, a, ts: Date.now() });
    Swal.fire('تم النشر ✅', '', 'success');
    document.getElementById('info-q').value = "";
    document.getElementById('info-a').value = "";
    loadKnowledgeAdmin();
}

async function loadKnowledgeAdmin() {
    const list = document.getElementById('admin-info-list');
    if (!list) return;
    const snap = await db.collection('knowledge').orderBy('ts', 'desc').get();
    let h = "";
    snap.forEach(doc => {
        h += `<div style="background:#111; padding:10px; border-radius:10px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px;">${doc.data().q}</span>
                <button onclick="deleteKnowledge('${doc.id}')" style="color:#ff3b30; background:none; border:none;">🗑️</button>
              </div>`;
    });
    list.innerHTML = h;
}

async function deleteKnowledge(id) {
    if (confirm('حذف؟')) { await db.collection('knowledge').doc(id).delete(); loadKnowledgeAdmin(); }
}

async function forceSeedKnowledge() {
    const res = await Swal.fire({
        title: 'إعادة تعيين بنك المعلومات؟',
        text: "سيتم مسح كل النصائح الحالية وإضافة النصائح الأساسية (المنقذة) فوراً!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، أعد التعيين 🔄',
        cancelButtonText: 'إلغاء',
        background: '#121212',
        color: '#fff',
        target: document.getElementById('admin-info-card')
    });

    if (res.isConfirmed) {
        Swal.fire({
            title: 'جاري التحديث...',
            allowOutsideClick: false,
            target: document.getElementById('admin-info-card'),
            didOpen: () => Swal.showLoading()
        });
        try {
            // مسح القديم
            const snap = await db.collection('knowledge').get();
            const batch = db.batch();
            snap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();

            // إضافة الأساسيات
            const defaults = [
                { q: "أهمية شرب المياة أثناء التمرين 💧", a: "شرب المياة بيحافظ على رطوبة عضلاتك وبيمنع التشنجات، لازم تشرب على الأقل 2 لتر خلال يومك." },
                { q: "إزاي تستفيد من الـ Creatine؟ 🧪", a: "الكرياتين بيزود القوة والحجم، جرعته اليومية 5 جرام ولازم تشرب معاه مياة كتير." },
                { q: "ليه النوم مهم لبناء العضلات؟ 😴", a: "العضلات بتكبر وإنت نايم! جسمك بيفرز هرمون النمو خلال النوم العميق، لازم تنام 7-8 ساعات." },
                { q: "القاعدة الذهبية للتغذية 🥗", a: "عشان تشوف نتيجة، لازم 70% من مجهودك يكون في المطبخ! البروتين هو حجر الأساس لبناء العضلات." }
            ];

            for (const item of defaults) {
                await db.collection('knowledge').add({ ...item, ts: Date.now() });
            }

            Swal.fire({
                title: 'تمت إعادة التعيين بنجاح ✅',
                icon: 'success',
                target: document.getElementById('admin-info-card')
            });
            loadKnowledgeAdmin();
            openInfoBank(); // تحديث العرض للمستخدمين
        } catch (e) {
            Swal.fire({
                title: 'خطأ',
                text: 'فشل التحديث، تأكد من الاتصال',
                icon: 'error',
                target: document.getElementById('admin-info-card')
            });
        }
    }
}

// --- TECHNIQUES MANAGEMENT ---
async function saveTechnique() {
    const name = document.getElementById('tech-name').value;
    const correct = document.getElementById('tech-correct').value;
    const wrong = document.getElementById('tech-wrong').value;
    if (!name) return;
    await db.collection('techniques').add({ name, correctUrl: correct, wrongUrl: wrong, ts: Date.now() });
    Swal.fire('تم النشر ✅', '', 'success');
    document.getElementById('technique-modal').classList.add('hidden');
    loadTechniques();
}

async function deleteTechnique(id) {
    if (confirm('حذف؟')) { await db.collection('techniques').doc(id).delete(); loadTechniques(); }
}

// --- NOTIFICATIONS MODAL & BADGE ---
function openNotifModal() {
    document.getElementById('notif-modal').classList.remove('hidden');
    loadNotifications();
}

function closeNotifModal() {
    document.getElementById('notif-modal').classList.add('hidden');
}

async function loadNotifications() {
    const list = document.getElementById('static-notif-list-view');
    if (!list) return;
    list.innerHTML = '<p style="text-align:center; color:#777;">جاري تحميل التنبيهات... ⏳</p>';
    
    try {
        if (!currentUser || !currentUser.phone) {
            list.innerHTML = '<p style="color:red; text-align:center;">يجب تسجيل الدخول أولاً</p>';
            return;
        }

        const snap = await db.collection('notifications')
            .where('targetPhone', '==', currentUser.phone.toString().trim())
            .get();

        let arr = [];
        snap.forEach(d => {
            const data = d.data();
            let timeVal = 0;
            if (data.ts) {
                if (typeof data.ts === 'number') timeVal = data.ts;
                else if (data.ts.toMillis) timeVal = data.ts.toMillis();
                else if (data.ts.seconds) timeVal = data.ts.seconds * 1000;
            }
            arr.push({ id: d.id, ...data, timeVal });
        });

        arr.sort((a, b) => b.timeVal - a.timeVal);

        let h = arr.map(d => {
            let displayTime = "الآن";
            if (d.timeVal) displayTime = new Date(d.timeVal).toLocaleString('ar-EG', {hour:'2-digit', minute:'2-digit', day:'numeric', month:'short'});
            
            return `
                <div style="background:rgba(255,255,255,0.03); border:1px solid #222; padding:15px; border-radius:20px; margin-bottom:10px; border-right:4px solid var(--primary); transition:0.3s;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <b style="color:var(--accent); font-size:14px;">${d.title || 'تنبيه جديد'}</b>
                        <small style="color:#555; font-size:9px;">${displayTime}</small>
                    </div>
                    <p style="color:#eee; font-size:13px; line-height:1.6; margin:0;">${d.message}</p>
                </div>
            `;
        }).join('');

        list.innerHTML = arr.length ? h + `
            <button onclick="clearNotifications()" style="width:100%; padding:15px; background:rgba(255,59,48,0.05); border:1px dashed #ff3b30; color:#ff3b30; border-radius:15px; margin-top:15px; font-weight:bold; cursor:pointer;">🗑️ مسح جميع التنبيهات</button>
        ` : '<div style="text-align:center; padding:40px;"><p style="color:#444; font-size:14px;">مفيش تنبيهات جديدة يا بطل! 🔥</p></div>';

        // Reset badge
        const b1 = document.getElementById('notif-badge');
        const b2 = document.getElementById('notif-badge-admin');
        if (b1) { b1.classList.add('hidden'); b1.innerText = "0"; }
        if (b2) { b2.classList.add('hidden'); b2.innerText = "0"; }
    } catch (e) {
        console.error("Notif Error:", e);
        list.innerHTML = '<p style="color:#ff3b30; text-align:center; font-size:12px;">فشل في تحميل الرسائل ❌</p>';
    }
}

async function clearNotifications() {
    const snap = await db.collection('notifications').where('targetPhone', '==', currentUser.phone.toString().trim()).get();
    const batch = db.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    Swal.close();
    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم تنظيف الجرس 🧹', timer: 1500 });
}

// تعديل دالة الاستماع لتظهر النقطة الحمراء
function listenForCustomNotifications() {
    if (!currentUser || !currentUser.phone) return;
    const start = Date.now();
    db.collection('notifications').where('targetPhone', '==', currentUser.phone.toString().trim()).onSnapshot(snap => {
        snap.docChanges().forEach(c => {
            if (c.type === 'added') {
                const d = c.doc.data();
                if ((d.ts || 0) > start - 10000) {
                    Swal.fire({ toast: true, position: 'top-end', title: d.title, text: d.message, icon: 'info', timer: 4000 });
                    const b1 = document.getElementById('notif-badge');
                    const b2 = document.getElementById('notif-badge-admin');
                    if (b1) { b1.classList.remove('hidden'); b1.innerText = parseInt(b1.innerText || "0") + 1; }
                    if (b2) { b2.classList.remove('hidden'); b2.innerText = parseInt(b2.innerText || "0") + 1; }
                }
            }
        });

        // إظهار العلامة لو فيه إشعارات قديمة أصلاً في البداية
        if (!snap.empty) {
            const b1 = document.getElementById('notif-badge');
            const b2 = document.getElementById('notif-badge-admin');
            if (b1) { b1.classList.remove('hidden'); b1.innerText = snap.size; }
            if (b2) { b2.classList.remove('hidden'); b2.innerText = snap.size; }
        }
    });
}

// تحويل لـ DOMContentLoaded عشان يفتح أسرع بكتير من window.onload
document.addEventListener('DOMContentLoaded', async () => {
    const savedPhone = localStorage.getItem('fire_gym_phone');
    if (savedPhone) {
        try {
            const snap = await db.collection('users').doc(savedPhone).get();
            if (snap.exists) {
                const data = snap.data();
                if (data.status === 'approved' || data.role === 'admin') enterApp(data);
                else localStorage.removeItem('fire_gym_phone');
            } else { localStorage.removeItem('fire_gym_phone'); }
        } catch (e) { console.error("Auto Login Error:", e); }
    }
});

// --- SHARE CARD LOGIC ---
function openShareCard(workoutName) {
    const name = currentUser ? currentUser.name : "بطل فير جيم";
    const photo = (currentUser && currentUser.photo) ? currentUser.photo : "https://via.placeholder.com/150";

    // تخصيص اسم التمرين
    const workout = workoutName || "التمرين";
    document.getElementById('share-workout-text').innerHTML = `خلصت تمرينة <span style="color:var(--primary); font-weight:900;">${workout}</span> النهاردة<br>مع Fire Gym`;

    // جمل تشجيعية عشوائية
    const phrases = ["استمر يا دبابة 🦍", "استمر يا وحش 🦁", "عااااش يا جامد 🔥", "وحش اللعبة 👑", "فورمة الساحل جاية 🌊", "البطل الحقيقي 💪"];
    const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
    document.getElementById('share-random-phrase').innerText = randomPhrase;

    document.getElementById('share-user-name').innerText = name;
    document.getElementById('share-user-img').src = photo;
    document.getElementById('share-card-overlay').style.display = 'flex';
}

function closeShareCard() {
    document.getElementById('share-card-overlay').style.display = 'none';
}

async function downloadShareCard() {
    const card = document.getElementById('share-card');
    const btn = event.target;
    btn.innerText = "جاري التحضير... ⏳";
    btn.disabled = true;

    try {
        const canvas = await html2canvas(card, {
            scale: 2, // تقليل الحجم شوية عشان الأبلكيشن يقبله
            backgroundColor: '#000',
            useCORS: true,
            logging: false
        });

        canvas.toBlob(async (blob) => {
            if (!blob) throw new Error("Canvas to Blob failed");

            const file = new File([blob], `FireGym_Workout_${new Date().getTime()}.png`, { type: 'image/png' });

            // استخدام خاصية المشاركة لو متاحة (أفضل بكتير للموبايل)
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({
                        files: [file],
                        title: 'تمرينة Fire Gym 🔥',
                        text: 'عاش يا بطل! دي تمرينة النهاردة من تطبيق Fire Gym'
                    });
                } catch (err) {
                    // لو المستخدم كنسل المشاركة أو حصل خطأ بسيط
                    console.log("Share cancelled or failed:", err);
                    // نحاول نحملها بالطريقة العادية كـ fallback
                    saveBlobAsFile(blob);
                }
            } else {
                // الطريقة العادية للديسك توب أو الموبايلات القديمة
                saveBlobAsFile(blob);
            }
        }, 'image/png');

    } catch (e) {
        console.error(e);
        Swal.fire('خطأ', 'فشل في توليد الصورة، جرب تاخد سكرين شوت 📸', 'error');
    } finally {
        btn.innerText = "حفظ الصورة 📥";
        btn.disabled = false;
    }
}

function saveBlobAsFile(blob) {
    const reader = new FileReader();
    reader.onloadend = function () {
        const base64data = reader.result;
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        if (isMobile) {
            const viewer = document.getElementById('full-screen-viewer');
            const img = document.getElementById('viewer-img');
            const loadingText = document.getElementById('viewer-loading-text');
            const dlBtn = document.getElementById('direct-download-btn');

            if (viewer && img) {
                img.src = base64data;
                if (loadingText) loadingText.style.display = 'none';
                viewer.style.display = 'flex';

                // ضبط زرار التحميل المباشر
                if (dlBtn) {
                    dlBtn.onclick = () => {
                        const link = document.createElement('a');
                        link.href = base64data;
                        link.download = `FireGym_Workout_${new Date().getTime()}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    };
                }

                Swal.close();
                closeShareCard();
            } else {
                window.open(base64data, '_blank');
            }
        } else {
            const link = document.createElement('a');
            link.href = base64data;
            link.download = `FireGym_Workout_${new Date().getTime()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            Swal.fire({ icon: 'success', title: 'تم الحفظ! 📸', background: '#121212', color: '#fff' });
        }
    };
    reader.readAsDataURL(blob);
}

function closeFullViewer() {
    document.getElementById('full-screen-viewer').style.display = 'none';
}

async function requestGoalChange() {
    const { value: goal } = await Swal.fire({
        title: 'طلب تغيير النظام 🚀',
        input: 'select',
        inputOptions: {
            'نظام تدريب فقط': 'نظام تدريب فقط 🏋️‍♂️',
            'نظام تغذيه فقط': 'نظام تغذيه فقط 🥗',
            'نظام تدريب + تغذيه': 'نظام تدريب + تغذيه 🔄',
            'نظام VIP الملكي': 'نظام VIP الملكي ⭐'
        },
        inputPlaceholder: 'اختر النظام الجديد...',
        showCancelButton: true,
        confirmButtonText: 'إرسال الطلب ✅',
        cancelButtonText: 'إلغاء',
        background: '#121212',
        color: '#fff'
    });

    if (goal) {
        Swal.fire({ title: 'جاري إرسال طلبك...', didOpen: () => Swal.showLoading() });
        try {
            await db.collection('goalChanges').add({
                userPhone: currentUser.phone,
                userName: currentUser.name,
                newGoal: goal,
                ts: Date.now()
            });
            sendNotificationTo(ADMIN_PHONE, "طلب تغيير نظام! 🚀", `البطل ${currentUser.name} عايز يغير نظامه لـ ${goal}`);
            Swal.fire('تم الإرسال! 🔥', 'طلبك وصل للكابتن وهيتم مراجعته وتغيير النظام قريباً.', 'success');
        } catch (e) { Swal.fire('خطأ', 'فشل إرسال الطلب', 'error'); }
    }
}

async function editMyInfo() {
    const { value: f } = await Swal.fire({
        title: 'تعديل بياناتي الحيوية ✏️',
        background: '#121212',
        color: '#fff',
        confirmButtonColor: 'var(--accent)',
        confirmButtonText: 'حفظ التعديلات ✅',
        cancelButtonText: 'إلغاء',
        showCancelButton: true,
        html: `
            <div style="text-align:right; display:flex; flex-direction:column; gap:15px; padding:10px;">
                <div>
                    <label style="color:#aaa; font-size:12px;">السن:</label>
                    <input id="sw-age" type="number" class="swal2-input" style="width:90%; margin:5px 0; background:#000; color:#fff; border:1px solid #333;" value="${currentUser.age || ''}">
                </div>
                <div>
                    <label style="color:#aaa; font-size:12px;">الوزن (كغم):</label>
                    <input id="sw-weight" type="number" class="swal2-input" style="width:90%; margin:5px 0; background:#000; color:#fff; border:1px solid #333;" value="${currentUser.weight || ''}">
                </div>
                <div>
                    <label style="color:#aaa; font-size:12px;">الطول (سم):</label>
                    <input id="sw-height" type="number" class="swal2-input" style="width:90%; margin:5px 0; background:#000; color:#fff; border:1px solid #333;" value="${currentUser.height || ''}">
                </div>
                <div>
                    <label style="color:#aaa; font-size:12px;">نسبة الدهون (%):</label>
                    <input id="sw-fat" type="number" class="swal2-input" style="width:90%; margin:5px 0; background:#000; color:#fff; border:1px solid #333;" value="${currentUser.fat || ''}">
                </div>
            </div>
        `,
        preConfirm: () => {
            return {
                age: document.getElementById('sw-age').value,
                weight: document.getElementById('sw-weight').value,
                height: document.getElementById('sw-height').value,
                fat: document.getElementById('sw-fat').value
            }
        }
    });

    if (f) {
        Swal.fire({ title: 'جاري الحفظ...', didOpen: () => Swal.showLoading() });
        try {
            await db.collection('users').doc(currentUser.phone).update(f);
            Swal.fire({ icon: 'success', title: 'تم التحديث! 🔥', timer: 1500 });
        } catch (e) {
            Swal.fire('خطأ', 'فشل تحديث البيانات', 'error');
        }
    }
}

async function forceUpdate() {
    Swal.fire({
        title: 'جاري التحديث الشامل...',
        text: 'بنمحى الكاش وبنجيبلك أحدث نسخة من السيرفر 🔥',
        background: '#121212',
        color: '#fff',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        // حفظ بيانات الدخول قبل المسح
        const phone = localStorage.getItem('fire_gym_phone');

        // 1. مسح الكاش
        if ('caches' in window) {
            const keys = await caches.keys();
            for (let key of keys) await caches.delete(key);
        }

        // 2. إلغاء السيرفس وركر
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (let reg of regs) await reg.unregister();
        }

        // 3. مسح التخزين المؤقت فقط (مع الحفاظ على الدخول)
        sessionStorage.clear();

        // إعادة بيانات الدخول
        if (phone) localStorage.setItem('fire_gym_phone', phone);

        // 4. ريفريش سريع
        window.location.reload();
    } catch (e) {
        window.location.reload();
    }
}

function closeNotifModal() {
    document.getElementById('notif-modal').classList.add('hidden');
}

// Admin Send Notification Function (Fixed to Compat Style)
function sendAdminNotif(targetUserId, message, senderName = 'Captain') {
    firebase.firestore().collection("notifications").add({
        targetId: targetUserId,
        message: message,
        senderName: senderName,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        type: 'admin'
    }).then(() => {
        Swal.fire('تم الإرسال', 'تم إرسال الرسالة بنجاح ✅', 'success');
    }).catch((e) => {
        Swal.fire('خطأ', 'فشل إرسال الرسالة ❌', 'error');
    });
}


// --- REAL-TIME CHAT LOGIC (WHATSAPP-STYLE) ---
let chatUnsubscribe = null;
let chatListUnsubscribe = null;
let adminActiveChatUser = null; 

function toggleChatWindow() {
    const win = document.getElementById('chat-window');
    win.classList.toggle('hidden');
    if (!win.classList.contains('hidden')) {
        if (currentUser.role === 'admin') {
            if (adminActiveChatUser) {
                // If we already have a selected user (from the direct chat button), show messages
                openChatWithUser(adminActiveChatUser);
            } else {
                showChatUserList();
            }
        } else {
            document.getElementById('chat-admin-list').classList.add('hidden');
            document.getElementById('chat-messages-view').classList.remove('hidden');
            document.getElementById('chat-back-btn').classList.add('hidden');
            loadChatMessages();
            document.getElementById('chat-input').focus();
        }
    } else {
        if (chatUnsubscribe) chatUnsubscribe();
        if (chatListUnsubscribe) chatListUnsubscribe();
    }
}

function showChatUserList() {
    adminActiveChatUser = null;
    document.getElementById('chat-title-text').innerText = "رسائل الأبطال 🔥";
    document.getElementById('chat-back-btn').classList.add('hidden');
    document.getElementById('chat-admin-list').classList.remove('hidden');
    document.getElementById('chat-messages-view').classList.add('hidden');
    loadChatUserList();
}

function loadChatUserList() {
    const listContainer = document.getElementById('chat-admin-list');
    if (chatListUnsubscribe) chatListUnsubscribe();

    chatListUnsubscribe = firebase.firestore().collection("chats")
        .where("participants", "array-contains", ADMIN_PHONE)
        .onSnapshot((snapshot) => {
            const userMap = {};
            snapshot.forEach(doc => {
                const data = doc.data();
                const other = data.participants.find(p => p !== ADMIN_PHONE);
                if (!other) return;
                
                if (!userMap[other] || (data.timestamp?.toMillis() || 0) > (userMap[other].timestamp?.toMillis() || 0)) {
                    userMap[other] = {
                        phone: other,
                        text: data.text,
                        timestamp: data.timestamp,
                        senderId: data.senderId
                    };
                }
            });

            const sortedUsers = Object.values(userMap).sort((a, b) => {
                return (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0);
            });

            if (sortedUsers.length === 0) {
                listContainer.innerHTML = '<div style="padding:40px; text-align:center; color:#444;">لا توجد محادثات بعد 🔥</div>';
                return;
            }

            listContainer.innerHTML = sortedUsers.map(u => {
                const timeStr = u.timestamp ? new Date(u.timestamp.toMillis()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
                const isNew = u.senderId !== ADMIN_PHONE;
                
                // Look up user name
                const userData = allUsersData.find(usr => usr.phone === u.phone);
                const displayName = userData ? userData.name : u.phone;

                return `
                    <div onclick="openChatWithUser('${u.phone}', '${displayName}')" style="display:flex; align-items:center; gap:12px; padding:15px; border-bottom:1px solid #111; cursor:pointer; transition:0.2s; background:${isNew ? 'rgba(255,179,0,0.02)' : 'transparent'};">
                        <div style="width:45px; height:45px; border-radius:50%; background:#222; display:flex; align-items:center; justify-content:center; font-size:20px; border:1px solid #333; overflow:hidden;">
                            ${userData && userData.photo ? `<img src="${userData.photo}" style="width:100%; height:100%; object-fit:cover;">` : '👤'}
                        </div>
                        <div style="flex:1; overflow:hidden;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                                <b style="color:#fff; font-size:14px;">${displayName}</b>
                                <span style="font-size:10px; color:#555;">${timeStr}</span>
                            </div>
                            <p style="margin:0; font-size:12px; color:${isNew ? 'var(--accent)' : '#777'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                                ${u.senderId === ADMIN_PHONE ? 'You: ' : ''}${u.text}
                            </p>
                        </div>
                        ${isNew ? '<div style="width:8px; height:8px; background:var(--accent); border-radius:50%;"></div>' : ''}
                    </div>
                `;
            }).join('');
        });
}

function openChatWithUser(phone, name) {
    adminActiveChatUser = phone;
    document.getElementById('chat-title-text').innerText = "دردشة: " + (name || phone);
    document.getElementById('chat-back-btn').classList.remove('hidden');
    document.getElementById('chat-admin-list').classList.add('hidden');
    document.getElementById('chat-messages-view').classList.remove('hidden');
    loadChatMessages();
}

function openAdminChat() {
    if (!activeTarget) return;
    const userData = allUsersData.find(usr => usr.phone === activeTarget);
    openChatWithUser(activeTarget, userData ? userData.name : activeTarget);
    toggleChatWindow();
}

function loadChatMessages() {
    if (!currentUser) return;
    const userId = currentUser.phone;
    const isChattingAsAdmin = currentUser.role === 'admin';
    const targetUserId = isChattingAsAdmin ? adminActiveChatUser : ADMIN_PHONE;
    
    if (isChattingAsAdmin && !targetUserId) return;

    const msgContainer = document.getElementById('chat-messages');
    if (chatUnsubscribe) chatUnsubscribe();

    chatUnsubscribe = firebase.firestore().collection("chats")
        .where("participants", "array-contains", userId)
        .onSnapshot((snapshot) => {
            msgContainer.innerHTML = '';
            
            const docs = snapshot.docs.filter(doc => {
                const parts = doc.data().participants || [];
                return parts.includes(targetUserId);
            }).sort((a, b) => {
                return (a.data().timestamp?.toMillis() || 0) - (b.data().timestamp?.toMillis() || 0);
            });

            if (docs.length === 0) {
                msgContainer.innerHTML = '<p style="text-align:center; color:#444; font-size:11px; margin-top:20px;">ابدأ الدردشة الآن 🛡️</p>';
            }

            docs.forEach((doc) => {
                const data = doc.data();
                const isMe = data.senderId === userId;
                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.alignItems = isMe ? 'flex-end' : 'flex-start';
                wrapper.style.marginBottom = '12px';

                const msgDiv = document.createElement('div');
                msgDiv.style.maxWidth = '85%';
                msgDiv.style.padding = '12px 16px';
                msgDiv.style.borderRadius = isMe ? '20px 20px 4px 20px' : '20px 20px 20px 4px';
                msgDiv.style.fontSize = '14px';
                msgDiv.style.background = isMe ? 'var(--primary)' : '#1e1e1e';
                msgDiv.style.color = '#fff';
                msgDiv.innerText = data.text;
                
                wrapper.appendChild(msgDiv);

                if (data.timestamp) {
                    const time = document.createElement('small');
                    time.style.fontSize = '8px';
                    time.style.color = '#444';
                    time.style.marginTop = '4px';
                    const d = data.timestamp.toDate();
                    time.innerText = d.getHours() + ":" + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
                    wrapper.appendChild(time);
                }
                msgContainer.appendChild(wrapper);
            });
            msgContainer.scrollTop = msgContainer.scrollHeight;
        });
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentUser) return;

    const userId = currentUser.phone;
    const isChattingAsAdmin = currentUser.role === 'admin';
    const targetUserId = isChattingAsAdmin ? adminActiveChatUser : ADMIN_PHONE;

    if (isChattingAsAdmin && !targetUserId) return;

    firebase.firestore().collection("chats").add({
        text: text,
        senderId: userId,
        participants: [userId, targetUserId],
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        input.value = '';
    });
}

// --- EXTRA PREMIUM FEATURES (RESTORED & IMPROVED) ---

// 1. نظام النصائح اليومية
const DAILY_QUOTES = [
    "البطل الحقيقي هو اللي بيكمل لما الكل بيقف! 🔥",
    "عضلتك مش هتكبر من الكلام، هتكبر من العرق والحديد! 🏋️‍♂️",
    "الدايت مش حرمان، الدايت ذكاء في الاختيار 🥗",
    "صحتك هي استثمارك الوحيد اللي مش بيخسر 🔋",
    "لو عاوز تكون نسخة أحسن، لازم تتعب أكتر من نسخة امبارح 🚀",
    "الوحش اللي جواك مستني تطلعه في الجيم النهاردة! 🦁"
];

function initDailyQuote() {
    const card = document.getElementById('daily-quote-card');
    const text = document.getElementById('daily-quote-text');
    if (card && text) {
        const randomQuote = DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)];
        text.innerText = randomQuote;
        card.style.display = 'block';
    }
}

// 2. حاسبة الماكروس الذكية
function calculateMacros(userData) {
    const weight = parseFloat(userData.weight) || 70;
    const goal = userData.goal || "نظام تدريب";

    let protein = 0, carb = 0, fat = 0;

    if (goal.includes("VIP") || goal.includes("تدريب")) {
        protein = weight * 2.2;
        fat = weight * 0.8;
        carb = weight * 3;
    } else if (goal.includes("تغذيه")) {
        protein = weight * 1.8;
        fat = weight * 0.6;
        carb = weight * 2;
    }

    const pEl = document.getElementById('macro-prot');
    const cEl = document.getElementById('macro-carb');
    const fEl = document.getElementById('macro-fat');

    if (pEl) pEl.innerText = Math.round(protein);
    if (cEl) cEl.innerText = Math.round(carb);
    if (fEl) fEl.innerText = Math.round(fat);
}

// 3. لوحة الشرف (Hall of Fame)
async function loadHallOfFame() {
    const list = document.getElementById('hall-of-fame-list');
    try {
        const snapshot = await firebase.firestore().collection('users')
            .where('status', '==', 'approved')
            .limit(10).get();

        list.innerHTML = '';
        const users = [];
        snapshot.forEach(doc => users.push(doc.data()));
        users.sort((a, b) => (b.score || 0) - (a.score || 0));

        list.style.justifyContent = "center"; // سنترة الأبطال الثلاثة
        users.slice(0, 3).forEach((u, index) => {
            const item = document.createElement('div');
            item.style = "display:flex; flex-direction:column; align-items:center; min-width:90px; gap:8px;";
            item.innerHTML = `
                <div style="width:70px; height:70px; border-radius:50%; border:2px solid ${index === 0 ? 'var(--accent)' : '#333'}; padding:3px; position:relative; transform: ${index === 0 ? 'scale(1.1)' : 'scale(1)'};">
                    <div style="width:100%; height:100%; border-radius:50%; background:url('${u.img || 'https://via.placeholder.com/100'}') center/cover, #222; display:flex; align-items:center; justify-content:center; font-size:20px;">
                        ${!u.img ? '👤' : ''}
                    </div>
                    <span style="position:absolute; top:-5px; right:-5px; font-size:16px;">${index === 0 ? '🥇' : (index === 1 ? '🥈' : '🥉')}</span>
                </div>
                <b style="color:#fff; font-size:12px; white-space:nowrap;">${u.name.split(' ')[0]}</b>
                <div style="background:rgba(0,0,0,0.5); padding:2px 8px; border-radius:10px; font-size:10px; color:var(--accent); font-weight:bold; border:1px solid rgba(255,179,0,0.2);">
                    ${u.score || 10} ★
                </div>
            `;
            list.appendChild(item);
        });
    } catch (e) {
        list.innerHTML = '<p style="color:#555; text-align:center;">تعذر تحميل الأبطال حالياً</p>';
    }
}

// تعديل وظيفة enterApp لتشغيل الميزات الجديدة
const oldEnterApp = typeof enterApp !== 'undefined' ? enterApp : null;
window.enterApp = function (userData) {
    if (oldEnterApp) oldEnterApp(userData);
    initDailyQuote();
    calculateMacros(userData);
    loadHallOfFame();
};

// --- RESTORED FROM BACKUP (APR 28) ---
async function loadRecipes() {
    const gallery = document.getElementById('recipes-gallery');
    if (!gallery) return;
    
    const hiddenRecipes = JSON.parse(localStorage.getItem('fire_gym_hidden_recipes') || '[]');
    
    try {
        const snap = await firebase.firestore().collection('recipes').orderBy('ts', 'desc').get();
        let h = "";
        snap.forEach(doc => {
            const d = doc.data();
            const id = doc.id;
            
            // Skip if hidden by user
            if (hiddenRecipes.includes(id)) return;
            
            h += `<div class="card" style="padding:0; overflow:hidden; position:relative; cursor:pointer;" onclick="openRecipeDetail('${id}')">
                <div style="height:140px; background:url('${d.img || 'https://via.placeholder.com/200'}') center/cover;"></div>
                <div style="padding:15px; font-size:13px; text-align:center; background:#111;">
                    <b style="color:#fff;">${d.name}</b>
                </div>
                <button onclick="event.stopPropagation(); event.stopImmediatePropagation(); hideRecipe('${id}'); return false;" style="position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.7); border:1px solid rgba(255,59,48,0.3); color:#ff3b30; width:42px; height:42px; border-radius:12px; font-size:18px; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:10; transition:0.2s;">🗑️</button>
            </div>`;
        });
        gallery.innerHTML = h || '<p style="grid-column: 1 / -1; text-align:center; color:#444; padding:50px;">مفيش وصفات لسه 🔥</p>';
    } catch (e) { 
        console.error("Load recipes error:", e);
    }
}

function hideRecipe(id) {
    Swal.fire({
        title: 'مسح الوصفة؟',
        text: "هل تريد مسح هذه الوصفة من قائمتك؟ (يمكنك استعادتها بمسح الكاش)",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff3b30',
        cancelButtonColor: '#333',
        confirmButtonText: 'نعم، امسحها',
        cancelButtonText: 'إلغاء',
        background: '#121212',
        color: '#fff'
    }).then((result) => {
        if (result.isConfirmed) {
            const hidden = JSON.parse(localStorage.getItem('fire_gym_hidden_recipes') || '[]');
            hidden.push(id);
            localStorage.setItem('fire_gym_hidden_recipes', JSON.stringify(hidden));
            loadRecipes();
            Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'تم مسح الوصفة من عندك ✅', timer: 1500 });
        }
    });
}

async function openRecipeDetail(id) {
    Swal.fire({ title: 'جاري تحميل التفاصيل...', didOpen: () => Swal.showLoading(), background: '#121212', color: '#fff' });
    try {
        const doc = await firebase.firestore().collection('recipes').doc(id).get();
        Swal.close();
        if (doc.exists) {
            const d = doc.data();
            document.getElementById('recipe-detail-img').style.backgroundImage = `url('${d.img || 'https://via.placeholder.com/400'}')`;
            document.getElementById('recipe-detail-name').innerText = d.name;
            document.getElementById('recipe-detail-desc').innerText = d.desc || d.content || "لا يوجد تفاصيل حالياً.";
            document.getElementById('recipe-detail-modal').classList.remove('hidden');
        }
    } catch (e) {
        Swal.close();
        Swal.fire('خطأ', 'تعذر تحميل بيانات الوصفة', 'error');
    }
}

function openInfoBank() {
    document.getElementById('info-bank-modal').classList.remove('hidden');
    const content = document.getElementById('info-bank-content');
    content.innerHTML = '<p style="text-align:center; color:#777;">جاري التحميل... 🔥</p>';
    firebase.firestore().collection('knowledge').orderBy('ts', 'desc').get().then(snap => {
        let h = "";
        snap.forEach(doc => {
            const t = doc.data();
            h += `<div style="background:rgba(255,255,255,0.03); border:1px solid #222; padding:15px; border-radius:15px; margin-bottom:10px;"><b style="color:var(--accent);">💡 ${t.q}</b><p style="color:#eee; font-size:13px; line-height:1.6;">${t.a}</p></div>`;
        });
        content.innerHTML = h;
    }).catch(e => {
        content.innerHTML = '<p>تعذر تحميل المعلومات حالياً</p>';
    });
}

// --- ADVANCED MACRO CALCULATOR LOGIC ---
let selectedMacroGoal = 'cut';

function openMacroModal() {
    document.getElementById('macro-modal').classList.remove('hidden');
}

function closeMacroModal() {
    document.getElementById('macro-modal').classList.add('hidden');
}

function setMacroGoal(goal, el) {
    selectedMacroGoal = goal;
    document.querySelectorAll('.m-goal-btn').forEach(btn => {
        btn.style.background = 'transparent';
        btn.style.color = '#777';
    });
    el.style.background = '#2e7d32';
    el.style.color = '#fff';
}

function resetMacroCalc() {
    document.getElementById('macro-input-view').classList.remove('hidden');
    document.getElementById('macro-result-view').classList.add('hidden');
}

function performMacroCalc() {
    const age = parseInt(document.getElementById('m-age').value);
    const gender = document.getElementById('m-gender').value;
    const activity = parseFloat(document.getElementById('m-activity').value);
    const weight = parseFloat(currentUser.weight) || 75;
    const height = parseFloat(currentUser.height) || 175;

    // BMR (Mifflin-St Jeor)
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr = (gender === 'male') ? bmr + 5 : bmr - 161;

    let tdee = bmr * activity;
    let targetCalories = tdee;

    if (selectedMacroGoal === 'cut') targetCalories -= 500;
    else if (selectedMacroGoal === 'bulk') targetCalories += 500;

    // Distribution
    const protein = weight * 2; // 2g per kg
    const fat = weight * 0.8;   // 0.8g per kg
    const carb = (targetCalories - (protein * 4) - (fat * 9)) / 4;

    // Update Result View UI
    document.getElementById('res-calories').innerText = Math.round(targetCalories);
    document.getElementById('res-prot').innerText = Math.round(protein) + 'g';
    document.getElementById('res-carb').innerText = Math.round(carb) + 'g';
    document.getElementById('res-fat').innerText = Math.round(fat) + 'g';

    // Switch Views
    document.getElementById('macro-input-view').classList.add('hidden');
    document.getElementById('macro-result-view').classList.remove('hidden');
}

function switchScheduleView(type, el) {
    const slider = document.getElementById('tab-slider-bg');
    const workoutView = document.getElementById('schedule-workout-view');
    const nutritionView = document.getElementById('schedule-nutrition-view');
    const timerCont = document.getElementById('workout-timer-container');
    const buttons = el.parentElement.querySelectorAll('button');

    buttons.forEach(btn => btn.style.color = '#777');
    el.style.color = '#fff';

    if (type === 'workout') {
        slider.style.left = '6px';
        workoutView.classList.remove('hidden');
        nutritionView.classList.add('hidden');
        if (timerCont) timerCont.classList.remove('hidden');
    } else {
        slider.style.left = 'calc(50% - 0px)';
        workoutView.classList.add('hidden');
        nutritionView.classList.remove('hidden');
        if (timerCont) timerCont.classList.add('hidden');
    }

    // Sync the original UI if needed
    if (typeof switchVipMode === 'function') switchVipMode(type);
}

function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('hidden');
}

function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.add('hidden');
}