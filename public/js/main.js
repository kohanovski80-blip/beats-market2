// Глобальные переменные
let currentUser = null;
let beats = [];
let cart = [];
let currentAudio = null;
let currentPlayingCard = null;

// Загрузка страницы
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    
    const path = window.location.pathname;
    if (path === '/shop' || path === '/shop.html') {
        loadBeats();
    } else if (path === '/profile' || path === '/profile.html') {
        loadProfile();
    } else if (path === '/cart' || path === '/cart.html') {
        loadCartPage();
    }
});

// Навигация
function loadNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    
    if (currentUser) {
        navbar.innerHTML = `
            <div class="navbar">
                <div class="nav-left">
                    <button class="nav-btn" onclick="window.location.href='/'">HOME</button>
                    <span class="logo">BEATS MARKET</span>
                </div>
                <div class="nav-right">
                    <button class="nav-btn" onclick="window.location.href='/cart'">CART<span class="cart-badge" id="cartCount">${cart.length}</span></button>
                    <button class="nav-btn" onclick="window.location.href='/profile'">${currentUser.username}</button>
                    <button class="nav-btn" onclick="logout()">LOGOUT</button>
                </div>
            </div>
        `;
    } else {
        navbar.innerHTML = `
            <div class="navbar">
                <div class="nav-left">
                    <button class="nav-btn" onclick="window.location.href='/'">HOME</button>
                    <span class="logo">BEATS MARKET</span>
                </div>
                <div class="nav-right">
                    <button class="nav-btn" onclick="showLoginModal()">LOGIN</button>
                    <button class="nav-btn" onclick="showRegisterModal()">REGISTER</button>
                </div>
            </div>
        `;
    }
}

function checkAdminAccess() {
    return currentUser && (currentUser.role === 'admin' || currentUser.role === 'creator');
}

// Загрузка битов
async function loadBeats() {
    try {
        const res = await fetch('/api/beats');
        beats = await res.json();
        displayBeats();
    } catch (error) {
        console.error(error);
        const grid = document.getElementById('beatsGrid');
        if (grid) grid.innerHTML = '<p>ERROR LOADING BEATS</p>';
    }
}

function displayBeats() {
    const grid = document.getElementById('beatsGrid');
    if (!grid) return;
    
    if (!beats || beats.length === 0) {
        grid.innerHTML = '<p>NO BEATS AVAILABLE</p>';
        return;
    }
    
    grid.innerHTML = beats.map(beat => `
        <div class="beat-card" data-id="${beat.id}" data-url="${beat.audio_url}">
            <div class="beat-cover" onclick="togglePlay(this.parentElement)"></div>
            <audio class="beat-player" preload="none">
                <source src="${beat.audio_url}" type="audio/mpeg">
            </audio>
            <h3 class="beat-title">${escapeHtml(beat.title)}</h3>
            <p class="beat-price">$${beat.price} USD</p>
            ${currentUser ? 
                `<button class="add-to-cart" onclick="addToCart(${beat.id})">ADD TO CART</button>` :
                `<button class="add-to-cart" onclick="showLoginModal()">LOGIN TO BUY</button>`
            }
        </div>
    `).join('');
}

function togglePlay(card) {
    const audio = card.querySelector('.beat-player');
    if (!audio) return;
    
    if (currentAudio && currentAudio !== audio) {
        currentAudio.pause();
        if (currentPlayingCard) currentPlayingCard.classList.remove('playing');
    }
    
    if (audio.paused) {
        audio.play();
        card.classList.add('playing');
        currentAudio = audio;
        currentPlayingCard = card;
    } else {
        audio.pause();
        card.classList.remove('playing');
        currentAudio = null;
        currentPlayingCard = null;
    }
}

// Корзина
async function loadCart() {
    if (!currentUser) return;
    try {
        const res = await fetch('/api/cart');
        cart = await res.json();
        updateCartCount();
    } catch (error) {
        cart = [];
    }
}

function updateCartCount() {
    const count = document.getElementById('cartCount');
    if (count) count.textContent = cart ? cart.length : 0;
}

async function addToCart(beatId) {
    if (!currentUser) { showLoginModal(); return; }
    try {
        const res = await fetch('/api/cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ beatId })
        });
        const data = await res.json();
        if (data.success) {
            await loadCart();
            alert('ADDED TO CART');
        } else {
            alert(data.error || 'ERROR');
        }
    } catch (error) {
        alert('ERROR');
    }
}

// Страница корзины
async function loadCartPage() {
    if (!currentUser) { window.location.href = '/'; return; }
    await loadCart();
    
    const container = document.querySelector('.container');
    if (!container) return;
    
    if (!cart || cart.length === 0) {
        container.innerHTML = `
            <div class="cart-page">
                <h2>YOUR CART IS EMPTY</h2>
                <button class="btn" onclick="window.location.href='/shop'">CONTINUE SHOPPING</button>
            </div>
        `;
        return;
    }
    
    const total = cart.reduce((s, i) => s + i.price, 0);
    container.innerHTML = `
        <div class="cart-page">
            <h2>YOUR CART</h2>
            <div class="cart-items-list">
                ${cart.map(item => `<div class="cart-item"><div>${escapeHtml(item.title)}</div><div>$${item.price} USD</div></div>`).join('')}
            </div>
            <div class="payment-section">
                <h3>TOTAL: $${total} USD</h3>
                <h3>PAYMENT METHOD:</h3>
                <div class="payment-methods">
                    <button class="payment-btn" onclick="processPayment('card')">CREDIT CARD</button>
                    <button class="payment-btn" onclick="processPayment('paypal')">PAYPAL</button>
                </div>
                <button class="btn" onclick="window.location.href='/shop'">← BACK TO SHOP</button>
            </div>
        </div>
    `;
}

async function processPayment(method) {
    if (!cart || cart.length === 0) { alert('CART EMPTY'); return; }
    const beatIds = cart.map(i => i.id);
    try {
        const res = await fetch('/api/purchase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ beatIds })
        });
        const data = await res.json();
        if (data.success) {
            alert('PAYMENT SUCCESSFUL!');
            await loadCart();
            window.location.href = '/shop';
        } else {
            alert('PAYMENT ERROR');
        }
    } catch (error) {
        alert('ERROR');
    }
}

// Профиль
function loadProfile() {
    if (!currentUser) { window.location.href = '/'; return; }
    
    const photo = document.getElementById('profilePhoto');
    const username = document.getElementById('profileUsername');
    const email = document.getElementById('profileEmail');
    
    if (photo) photo.src = currentUser.photo_url || 'https://via.placeholder.com/150';
    if (username) username.value = currentUser.username;
    if (email) email.value = currentUser.email;
    
    const adminBtn = document.getElementById('adminPanelBtn');
    if (adminBtn) adminBtn.style.display = checkAdminAccess() ? 'block' : 'none';
}

function showAdminPanel() {
    if (!checkAdminAccess()) { alert('ACCESS DENIED'); return; }
    const modal = document.getElementById('adminPanelModal');
    if (modal) modal.style.display = 'flex';
}

function showUploadModal() {
    if (!checkAdminAccess()) { alert('ACCESS DENIED'); return; }
    const modal = document.getElementById('adminModal');
    if (modal) modal.style.display = 'flex';
}

async function uploadBeat() {
    if (!checkAdminAccess()) { alert('ACCESS DENIED'); return; }
    
    const title = document.getElementById('beatTitle')?.value.trim();
    const price = document.getElementById('beatPrice')?.value;
    const audio = document.getElementById('beatAudio')?.files[0];
    
    if (!title || !price || !audio) { alert('FILL ALL FIELDS'); return; }
    
    const formData = new FormData();
    formData.append('title', title);
    formData.append('price', price);
    formData.append('audio', audio);
    
    try {
        const res = await fetch('/api/beats', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            alert('BEAT UPLOADED!');
            closeModal();
            await loadBeats();
        } else {
            alert('ERROR: ' + (data.error || 'UNKNOWN'));
        }
    } catch (error) {
        alert('UPLOAD ERROR');
    }
}

async function showStatistics() {
    if (!checkAdminAccess()) { alert('ACCESS DENIED'); return; }
    try {
        const beatsRes = await fetch('/api/beats');
        const usersRes = await fetch('/api/users');
        const beats = await beatsRes.json();
        let users = [];
        if (usersRes.ok) users = await usersRes.json();
        
        const html = `
            <p>TOTAL BEATS: ${beats.length}</p>
            <p>TOTAL USERS: ${users.length}</p>
            <p>ADMINS: ${users.filter(u => u.role === 'admin').length}</p>
            <p>CREATORS: ${users.filter(u => u.role === 'creator').length}</p>
        `;
        const content = document.getElementById('statsContent');
        if (content) content.innerHTML = html;
        const modal = document.getElementById('statsModal');
        if (modal) modal.style.display = 'flex';
    } catch (error) {
        alert('STATISTICS ERROR');
    }
}

async function showManageRoles() {
    if (currentUser?.role !== 'creator') { alert('ONLY CREATOR CAN MANAGE ROLES'); return; }
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        const list = users.map(u => `
            <div class="user-item">
                <div><strong>${escapeHtml(u.username)}</strong><br><small>${escapeHtml(u.email)}</small></div>
                ${u.id !== currentUser.id ? `
                    <select onchange="changeRole(${u.id}, this.value)">
                        <option value="user" ${u.role === 'user' ? 'selected' : ''}>USER</option>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>ADMIN</option>
                        <option value="creator" ${u.role === 'creator' ? 'selected' : ''}>CREATOR</option>
                    </select>
                ` : '<span>YOU</span>'}
            </div>
        `).join('');
        const listDiv = document.getElementById('usersList');
        if (listDiv) listDiv.innerHTML = list;
        const modal = document.getElementById('rolesModal');
        if (modal) modal.style.display = 'flex';
    } catch (error) {
        alert('ERROR');
    }
}

async function changeRole(userId, role) {
    try {
        const res = await fetch(`/api/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role })
        });
        const data = await res.json();
        if (data.success) {
            alert('ROLE CHANGED!');
            await showManageRoles();
        } else {
            alert('ERROR');
        }
    } catch (error) {
        alert('ERROR');
    }
}

async function updateProfile() {
    const username = document.getElementById('profileUsername')?.value;
    const email = document.getElementById('profileEmail')?.value;
    if (!username || !email) return;
    try {
        const res = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email })
        });
        const data = await res.json();
        if (data.success) {
            alert('PROFILE UPDATED');
            currentUser.username = username;
            currentUser.email = email;
            loadNavbar();
        } else {
            alert('ERROR');
        }
    } catch (error) {
        alert('ERROR');
    }
}

async function uploadPhoto(input) {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
        const res = await fetch('/api/users/profile/photo', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            currentUser.photo_url = data.photo_url;
            const photo = document.getElementById('profilePhoto');
            if (photo) photo.src = data.photo_url;
            alert('PHOTO UPDATED');
        }
    } catch (error) {
        alert('ERROR');
    }
}

// Авторизация
async function checkAuth() {
    try {
        const res = await fetch('/api/check');
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            await loadCart();
            loadNavbar();
            if (window.location.pathname === '/profile') loadProfile();
            if (window.location.pathname === '/cart') loadCartPage();
        } else {
            loadNavbar();
        }
    } catch (error) {
        loadNavbar();
    }
}

function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'flex';
}

function showRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) modal.style.display = 'flex';
}

async function login() {
    const email = document.getElementById('loginEmail')?.value;
    const password = document.getElementById('loginPassword')?.value;
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            closeModal();
            await loadCart();
            loadNavbar();
            location.reload();
        } else {
            alert('INVALID EMAIL OR PASSWORD');
        }
    } catch (error) {
        alert('LOGIN ERROR');
    }
}

async function register() {
    const username = document.getElementById('regUsername')?.value;
    const email = document.getElementById('regEmail')?.value;
    const password = document.getElementById('regPassword')?.value;
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        if (data.success) {
            alert('REGISTRATION SUCCESSFUL! PLEASE LOGIN');
            closeModal();
        } else {
            alert(data.error || 'REGISTRATION ERROR');
        }
    } catch (error) {
        alert('ERROR');
    }
}

async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    currentUser = null;
    cart = [];
    loadNavbar();
    window.location.href = '/';
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}