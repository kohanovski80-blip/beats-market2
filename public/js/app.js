// ============================================
// BEATS MARKET - MAIN APPLICATION WITH SECURITY
// ============================================

// Global references
let beats = [];
let currentPage = 1;
let totalPages = 1;
let isLoading = false;

// ============================================
// UTILITY FUNCTIONS
// ============================================

function sanitizeInput(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Проверяем запомненного пользователя
    const remembered = localStorage.getItem('rememberedUser');
    if (remembered && !authManager.getUser()) {
        try {
            const { email } = JSON.parse(remembered);
            if (document.getElementById('loginEmail')) {
                document.getElementById('loginEmail').value = email;
            }
        } catch (e) {}
    }
    
    await authManager.init();
    cartManager.setUser(authManager.getUser());
    await loadPageContent();
    setupEventListeners();
    console.log('✅ Application initialized');
});

async function loadPageContent() {
    const path = window.location.pathname;
    
    if (path === '/shop' || path === '/shop.html') {
        await loadBeats(1);
    } else if (path === '/profile' || path === '/profile.html') {
        await loadProfilePage();
    } else if (path === '/cart' || path === '/cart.html') {
        await cartManager.renderCartPage(document.querySelector('.container'));
    } else if (path === '/admin' || path === '/admin.html') {
        // Admin page loads via adminManager
    } else if (path === '/chat' || path === '/chat.html') {
        // Chat page loads via chat.js
    }
    
    // Обновляем навигацию
    updateNavbar();
}

// ============================================
// НАВИГАЦИЯ
// ============================================

function updateNavbar() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;
    
    const user = authManager.getUser();
    const cartCount = cartManager.getCount();
    const lang = currentLang;
    
    if (user) {
        navbar.innerHTML = `
            <div class="navbar">
                <div class="nav-left">
                    <button class="nav-btn" onclick="window.location.href='/'">${translate('home')}</button>
                    <span class="separator">|</span>
                    <span class="logo">BEATS MARKET</span>
                </div>
                <div class="nav-center">
                    <button class="license-btn" onclick="window.location.href='/license'">${translate('buyLicense')}</button>
                </div>
                <div class="nav-right">
                    <div class="language-switcher">
                        <button class="lang-btn ${lang === 'en' ? 'active' : ''}" onclick="forceUpdateLanguage('en')">EN</button>
                        <button class="lang-btn ${lang === 'ru' ? 'active' : ''}" onclick="forceUpdateLanguage('ru')">RU</button>
                    </div>
                    <button class="nav-btn" onclick="window.location.href='/chat'">💬 ${translate('chat')}</button>
                    <button class="nav-btn" onclick="window.location.href='/cart'">
                        ${translate('cart')}<span class="cart-badge" id="cartCount">${cartCount}</span>
                    </button>
                    ${authManager.isAdmin() ? 
                        `<button class="nav-btn" onclick="window.location.href='/admin.html'">${translate('admin')}</button>` : ''}
                    <button class="nav-btn" onclick="window.location.href='/profile'">${sanitizeInput(user.username)}</button>
                    <button class="nav-btn" onclick="authManager.logout()">${translate('logout')}</button>
                </div>
            </div>
        `;
    } else {
        navbar.innerHTML = `
            <div class="navbar">
                <div class="nav-left">
                    <button class="nav-btn" onclick="window.location.href='/'">${translate('home')}</button>
                    <span class="separator">|</span>
                    <span class="logo">BEATS MARKET</span>
                </div>
                <div class="nav-center">
                    <button class="license-btn" onclick="window.location.href='/license'">${translate('buyLicense')}</button>
                </div>
                <div class="nav-right">
                    <div class="language-switcher">
                        <button class="lang-btn ${lang === 'en' ? 'active' : ''}" onclick="forceUpdateLanguage('en')">EN</button>
                        <button class="lang-btn ${lang === 'ru' ? 'active' : ''}" onclick="forceUpdateLanguage('ru')">RU</button>
                    </div>
                    <button class="nav-btn" onclick="window.location.href='/chat'">💬 ${translate('chat')}</button>
                    <button class="nav-btn" onclick="authManager.showLoginModal()">${translate('login')}</button>
                    <button class="nav-btn" onclick="authManager.showRegisterModal()">${translate('register')}</button>
                </div>
            </div>
        `;
    }
}

// ============================================
// BEATS WITH PAGINATION
// ============================================

async function loadBeats(page = 1) {
    const grid = document.getElementById('beatsGrid');
    if (!grid) return;
    
    if (isLoading) return;
    isLoading = true;
    
    grid.innerHTML = '<div class="loading-spinner">Loading beats...</div>';
    
    const search = document.getElementById('searchInput')?.value || '';
    const sort = document.getElementById('sortSelect')?.value || 'latest';
    const tag = document.getElementById('tagFilter')?.value || '';
    const minPrice = document.getElementById('minPrice')?.value || '';
    const maxPrice = document.getElementById('maxPrice')?.value || '';
    
    let url = `/api/beats?page=${page}&limit=12`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (sort) url += `&sort=${sort}`;
    if (tag) url += `&tag=${tag}`;
    if (minPrice) url += `&minPrice=${minPrice}`;
    if (maxPrice) url += `&maxPrice=${maxPrice}`;
    
    try {
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.pagination && page > result.pagination.totalPages) {
            isLoading = false;
            loadBeats(result.pagination.totalPages);
            return;
        }
        
        beats = result.data;
        currentPage = result.pagination.currentPage;
        totalPages = result.pagination.totalPages;
        
        await loadFavorites();
        displayBeats();
        displayPagination(result.pagination, currentPage);
        
    } catch (error) {
        console.error('Error loading beats:', error);
        grid.innerHTML = '<p class="text-center">Error loading beats</p>';
    } finally {
        isLoading = false;
    }
}

async function loadFavorites() {
    if (!authManager.getUser()) return;
    
    try {
        const response = await fetch('/api/favorites', { credentials: 'include' });
        if (response.ok) {
            const favorites = await response.json();
            beats.forEach(beat => {
                beat.is_favorite = favorites.some(f => f.beat_id === beat.id);
            });
        }
    } catch (error) {
        console.error('Error loading favorites:', error);
    }
}

function displayBeats() {
    const grid = document.getElementById('beatsGrid');
    if (!grid) return;
    
    if (!beats || beats.length === 0) {
        grid.innerHTML = '<p class="text-center">No beats available</p>';
        return;
    }
    
    grid.innerHTML = beats.map(beat => `
    <div class="beat-card" data-id="${beat.id}" data-url="${beat.audio_url}">
        <div class="beat-card-inner">
            <div class="beat-cover" data-src="${beat.cover_url || '/uploads/images/default-cover.jpg'}">
                <div class="play-button">
                    <svg viewBox="0 0 24 24" width="28" height="28">
                        <polygon points="5,3 19,12 5,21" fill="currentColor"/>
                    </svg>
                </div>
                ${authManager.getUser() ? `
                    <button class="favorite-btn ${beat.is_favorite ? 'active' : ''}" onclick="toggleFavorite(${beat.id}, event)">
                        ${beat.is_favorite ? '❤️' : '♡'}
                    </button>
                ` : ''}
            </div>
            <div class="beat-content">
                <h3 class="beat-title">${escapeHtml(beat.title)}</h3>
                <p class="beat-price">$${beat.price} USD</p>
                ${authManager.getUser() ? 
                    `<button class="add-to-cart" onclick="addToCart(${beat.id}, '${escapeHtml(beat.title)}', ${beat.price})">
                        ADD TO CART
                    </button>` :
                    `<button class="add-to-cart" onclick="authManager.showLoginModal()">
                        LOGIN TO BUY
                    </button>`
                }
            </div>
        </div>
       <audio class="beat-player" preload="none" src="/api/beats/${beat.id}/preview" crossorigin="use-credentials"></audio>
    </div>
`).join('');
    
    // Добавляем обработчики для кнопок play
    setTimeout(() => {
        document.querySelectorAll('.beat-card').forEach(card => {
            const audioPlayer = card.querySelector('.beat-player');
            const playButton = card.querySelector('.play-button');
            
            if (!audioPlayer || !playButton) return;
            
            // Убираем старый обработчик, если был
            const newPlayButton = playButton.cloneNode(true);
            playButton.parentNode.replaceChild(newPlayButton, playButton);
            
            // Функция обновления иконки
            const updateIcon = (isPlaying) => {
                if (isPlaying) {
                    newPlayButton.classList.add('pause');
                    newPlayButton.innerHTML = `
                        <svg viewBox="0 0 24 24" width="28" height="28">
                            <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
                            <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
                        </svg>
                    `;
                } else {
                    newPlayButton.classList.remove('pause');
                    newPlayButton.innerHTML = `
                        <svg viewBox="0 0 24 24" width="28" height="28">
                            <polygon points="5,3 19,12 5,21" fill="currentColor"/>
                        </svg>
                    `;
                }
            };
            
            // Слушаем события аудио
            audioPlayer.addEventListener('play', () => updateIcon(true));
            audioPlayer.addEventListener('pause', () => updateIcon(false));
            audioPlayer.addEventListener('ended', () => updateIcon(false));
            
            // Обработчик клика по кнопке
            newPlayButton.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Останавливаем все другие аудио
                document.querySelectorAll('.beat-player').forEach(other => {
                    if (other !== audioPlayer && !other.paused) {
                        other.pause();
                        const otherCard = other.closest('.beat-card');
                        if (otherCard) {
                            const otherBtn = otherCard.querySelector('.play-button');
                            if (otherBtn) {
                                otherBtn.classList.remove('pause');
                                otherBtn.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28"><polygon points="5,3 19,12 5,21" fill="currentColor"/></svg>`;
                            }
                        }
                    }
                });
                
                // Воспроизводим или ставим на паузу текущий
                if (audioPlayer.paused) {
                    audioPlayer.play();
                } else {
                    audioPlayer.pause();
                }
            });
        });
        
        lazyLoadImages();
        if (typeof forceMobileLayout === 'function') {
            forceMobileLayout();
        }
    }, 50);
}

// ============================================
// PAGINATION
// ============================================

function displayPagination(pagination, currentPageNum) {
    const paginationContainer = document.getElementById('pagination');
    if (!paginationContainer) return;
    
    if (!pagination || pagination.totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination">';
    
    if (pagination.hasPrevPage) {
        html += `<button class="page-btn" onclick="loadBeats(${currentPageNum - 1})">← Prev</button>`;
    }
    
    const startPage = Math.max(1, currentPageNum - 2);
    const endPage = Math.min(pagination.totalPages, currentPageNum + 2);
    
    if (startPage > 1) {
        html += `<button class="page-btn" onclick="loadBeats(1)">1</button>`;
        if (startPage > 2) html += `<span class="page-dots">...</span>`;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPageNum ? 'active' : ''}" onclick="loadBeats(${i})">${i}</button>`;
    }
    
    if (endPage < pagination.totalPages) {
        if (endPage < pagination.totalPages - 1) html += `<span class="page-dots">...</span>`;
        html += `<button class="page-btn" onclick="loadBeats(${pagination.totalPages})">${pagination.totalPages}</button>`;
    }
    
    if (pagination.hasNextPage) {
        html += `<button class="page-btn" onclick="loadBeats(${currentPageNum + 1})">Next →</button>`;
    }
    
    html += '</div>';
    paginationContainer.innerHTML = html;
}

// ============================================
// FAVORITES
// ============================================

async function toggleFavorite(beatId, event) {
    event.stopPropagation();
    
    if (!authManager.getUser()) {
        authManager.showLoginModal();
        return;
    }
    
    try {
        const response = await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ beatId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const btn = event.target;
            if (btn.textContent === '♡') {
                btn.textContent = '❤️';
                btn.classList.add('active');
            } else {
                btn.textContent = '♡';
                btn.classList.remove('active');
            }
            const beat = beats.find(b => b.id === beatId);
            if (beat) beat.is_favorite = !beat.is_favorite;
        } else {
            alert(data.error || 'Failed to update favorite');
        }
    } catch (error) {
        console.error('Favorite error:', error);
        alert('Error updating favorite');
    }
}

// ============================================
// CART FUNCTIONS
// ============================================

async function addToCart(beatId, title, price) {
    if (!authManager.getUser()) {
        authManager.showLoginModal();
        return;
    }
    
    await cartManager.addItem(beatId, title, price);
    updateNavbar();
}

// ============================================
// ADMIN FUNCTIONS
// ============================================

function showUploadModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.style.display = 'flex';
}

function showStatistics() {
    const modal = document.getElementById('statsModal');
    if (modal) modal.style.display = 'flex';
}

function showManageRoles() {
    const modal = document.getElementById('rolesModal');
    if (modal) modal.style.display = 'flex';
}

async function uploadBeat() {
    if (!adminManager) {
        alert('Admin manager not initialized');
        return;
    }
    await adminManager.uploadBeat();
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    window.addEventListener('click', (e) => {
        if (e.target.classList && e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        }
    });
    
    cartManager.onUpdate(() => {
        updateNavbar();
    });
}

// ============================================
// UTILITIES
// ============================================

function closeModal() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
    });
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

window.showNotification = function(message, type = 'info') {
    let notification = document.getElementById('globalNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'globalNotification';
        notification.className = 'global-notification';
        document.body.appendChild(notification);
    }
    
    notification.textContent = message;
    notification.className = `global-notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
};

// ============================================
// PROFILE PAGE
// ============================================

async function loadProfilePage() {
    const container = document.querySelector('.container');
    if (!container) return;
    
    const user = authManager.getUser();
    if (!user) {
        container.innerHTML = '<div class="profile-card"><h2>Please login to view profile</h2><button class="btn" onclick="authManager.showLoginModal()">LOGIN</button></div>';
        return;
    }
    
    container.innerHTML = `
        <div class="profile-card">
            <img id="profilePhoto" class="profile-photo-large" src="${user.photo_url || '/uploads/photos/default-avatar.png'}">
            <button class="btn" onclick="document.getElementById('photoInput').click()">CHANGE PHOTO</button>
            <input type="file" id="photoInput" accept="image/*" style="display: none" onchange="uploadPhoto(this)">
            
            <div class="form-group">
                <label>USERNAME</label>
                <input type="text" id="profileUsername" class="form-input" value="${escapeHtml(user.username)}">
            </div>
            
            <div class="form-group">
                <label>EMAIL</label>
                <input type="email" id="profileEmail" class="form-input" value="${escapeHtml(user.email)}">
            </div>
            
            <button class="btn" onclick="updateProfile()">SAVE CHANGES</button>
            
            <div id="adminPanelBtn" style="margin-top: 20px; ${authManager.isAdmin() ? 'display: block;' : 'display: none;'}">
                <button class="btn" onclick="window.location.href='/admin.html'">ADMIN PANEL</button>
            </div>
        </div>
    `;
}

async function updateProfile() {
    const username = document.getElementById('profileUsername').value;
    const email = document.getElementById('profileEmail').value;
    
    try {
        const response = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, email })
        });
        
        const data = await response.json();
        if (data.success) {
            alert('✅ Profile updated!');
            location.reload();
        } else {
            alert('❌ Error: ' + (data.error || 'Update failed'));
        }
    } catch (error) {
        console.error('Profile update error:', error);
        alert('❌ Network error');
    }
}

async function uploadPhoto(input) {
    const file = input.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('photo', file);
    
    try {
        const response = await fetch('/api/users/profile/photo', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        const data = await response.json();
        if (data.success) {
            alert('✅ Photo updated!');
            location.reload();
        } else {
            alert('❌ Error: ' + (data.error || 'Upload failed'));
        }
    } catch (error) {
        console.error('Photo upload error:', error);
        alert('❌ Network error');
    }
}

// Ленивая загрузка изображений
function lazyLoadImages() {
    const covers = document.querySelectorAll('.beat-cover');
    covers.forEach(cover => {
        const src = cover.dataset.src;
        if (src && !cover.classList.contains('loaded')) {
            const img = new Image();
            img.onload = () => {
                cover.style.backgroundImage = `url(${src})`;
                cover.classList.add('loaded');
            };
            img.onerror = () => {
                cover.classList.add('loaded');
                cover.style.background = 'linear-gradient(135deg, rgba(100,100,150,0.3), rgba(50,50,80,0.5))';
            };
            img.src = src;
        }
    });
}

// ============================================
// ЯЗЫКОВОЙ ПЕРЕКЛЮЧАТЕЛЬ
// ============================================

const translations = {
    en: {
        home: 'HOME', shop: 'SHOP', cart: 'CART', profile: 'PROFILE',
        login: 'LOGIN', register: 'REGISTER', logout: 'LOGOUT', admin: 'ADMIN',
        buyLicense: 'BUY LICENSE', chat: 'CHAT', addToCart: 'ADD TO CART',
        loginToBuy: 'LOGIN TO BUY', noBeats: 'No beats available',
        yourCart: 'YOUR CART', emptyCart: 'YOUR CART IS EMPTY',
        continueShopping: 'CONTINUE SHOPPING', emailPlaceholder: 'EMAIL',
        passwordPlaceholder: 'PASSWORD', usernamePlaceholder: 'USERNAME',
        forgotPassword: 'Forgot Password?', rememberMe: 'Remember me',
        close: 'CLOSE', back: 'BACK', resetPassword: 'RESET PASSWORD',
        sendResetLink: 'SEND RESET LINK', uploadNewBeat: 'UPLOAD NEW BEAT',
        beatTitle: 'BEAT TITLE', price: 'PRICE (USD)', audioFile: 'AUDIO FILE (MP3, WAV, M4A)',
        coverImage: 'COVER IMAGE (optional)', coverSize: 'Recommended size: 500x500px',
        cancel: 'CANCEL', statistics: 'STATISTICS', manageRoles: 'MANAGE ROLES',
        adminPanel: 'ADMIN PANEL', yesReset: 'YES, RESET ALL',
        typeMessage: 'Type your message...', send: 'Send'
    },
    ru: {
        home: 'ГЛАВНАЯ', shop: 'МАГАЗИН', cart: 'КОРЗИНА', profile: 'ПРОФИЛЬ',
        login: 'ВОЙТИ', register: 'РЕГИСТРАЦИЯ', logout: 'ВЫЙТИ', admin: 'АДМИН',
        buyLicense: 'КУПИТЬ ЛИЦЕНЗИЮ', chat: 'ЧАТ', addToCart: 'В КОРЗИНУ',
        loginToBuy: 'ВОЙДИТЕ ДЛЯ ПОКУПКИ', noBeats: 'Нет доступных битов',
        yourCart: 'ВАША КОРЗИНА', emptyCart: 'КОРЗИНА ПУСТА',
        continueShopping: 'ПРОДОЛЖИТЬ ПОКУПКИ', emailPlaceholder: 'EMAIL',
        passwordPlaceholder: 'ПАРОЛЬ', usernamePlaceholder: 'ИМЯ ПОЛЬЗОВАТЕЛЯ',
        forgotPassword: 'Забыли пароль?', rememberMe: 'Запомнить меня',
        close: 'ЗАКРЫТЬ', back: 'НАЗАД', resetPassword: 'СБРОС ПАРОЛЯ',
        sendResetLink: 'ОТПРАВИТЬ ССЫЛКУ', uploadNewBeat: 'ЗАГРУЗИТЬ БИТ',
        beatTitle: 'НАЗВАНИЕ БИТА', price: 'ЦЕНА (USD)', audioFile: 'АУДИО ФАЙЛ (MP3, WAV, M4A)',
        coverImage: 'ОБЛОЖКА (необязательно)', coverSize: 'Рекомендуемый размер: 500x500px',
        cancel: 'ОТМЕНА', statistics: 'СТАТИСТИКА', manageRoles: 'УПРАВЛЕНИЕ РОЛЯМИ',
        adminPanel: 'ПАНЕЛЬ АДМИНИСТРАТОРА', yesReset: 'ДА, СБРОСИТЬ ВСЁ',
        typeMessage: 'Введите сообщение...', send: 'Отправить'
    }
};

let currentLang = localStorage.getItem('language') || 'en';

function translate(key) {
    return translations[currentLang][key] || key;
}

function changeLanguage(lang) {
    if (translations[lang]) {
        currentLang = lang;
        localStorage.setItem('language', lang);
        
        // Обновляем все элементы с data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (el.tagName === 'INPUT' && el.placeholder) {
                el.placeholder = translate(key);
            } else {
                el.textContent = translate(key);
            }
        });
        
        // Обновляем навигацию
        updateNavbar();
    }
}

// Инициализация перевода при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // Переводим все элементы
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (el.tagName === 'INPUT' && el.placeholder) {
            el.placeholder = translate(key);
        } else {
            el.textContent = translate(key);
        }
    });
    
    // Устанавливаем навигацию
    updateNavbar();
});

// Принудительное обновление навигации при смене языка
function forceUpdateLanguage(lang) {
    console.log('Switching to:', lang);
    currentLang = lang;
    localStorage.setItem('language', lang);
    
    // Обновляем все элементы с data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (el.tagName === 'INPUT' && el.placeholder) {
            el.placeholder = translations[lang][key] || key;
        } else {
            el.textContent = translations[lang][key] || key;
        }
    });
    
    // Принудительно обновляем навигацию
    const navbar = document.getElementById('navbar');
    if (navbar) {
        const user = authManager.getUser();
        const cartCount = cartManager.getCount();
        
        if (user) {
            navbar.innerHTML = `
                <div class="navbar">
                    <div class="nav-left">
                        <button class="nav-btn" onclick="window.location.href='/'">${translations[lang].home || 'HOME'}</button>
                        <span class="separator">|</span>
                        <span class="logo">BEATS MARKET</span>
                    </div>
                    <div class="nav-center">
                        <button class="license-btn" onclick="window.location.href='/license'">${translations[lang].buyLicense || 'BUY LICENSE'}</button>
                    </div>
                    <div class="nav-right">
                        <div class="language-switcher">
                            <button class="lang-btn ${lang === 'en' ? 'active' : ''}" onclick="forceUpdateLanguage('en')">EN</button>
                            <button class="lang-btn ${lang === 'ru' ? 'active' : ''}" onclick="forceUpdateLanguage('ru')">RU</button>
                        </div>
                        <button class="nav-btn" onclick="window.location.href='/chat'">💬 ${translations[lang].chat || 'CHAT'}</button>
                        <button class="nav-btn" onclick="window.location.href='/cart'">
                            ${translations[lang].cart || 'CART'}<span class="cart-badge" id="cartCount">${cartCount}</span>
                        </button>
                        ${authManager.isAdmin() ? 
                            `<button class="nav-btn" onclick="window.location.href='/admin.html'">${translations[lang].admin || 'ADMIN'}</button>` : ''}
                        <button class="nav-btn" onclick="window.location.href='/profile'">${sanitizeInput(user.username)}</button>
                        <button class="nav-btn" onclick="authManager.logout()">${translations[lang].logout || 'LOGOUT'}</button>
                    </div>
                </div>
            `;
        } else {
            navbar.innerHTML = `
                <div class="navbar">
                    <div class="nav-left">
                        <button class="nav-btn" onclick="window.location.href='/'">${translations[lang].home || 'HOME'}</button>
                        <span class="separator">|</span>
                        <span class="logo">BEATS MARKET</span>
                    </div>
                    <div class="nav-center">
                        <button class="license-btn" onclick="window.location.href='/license'">${translations[lang].buyLicense || 'BUY LICENSE'}</button>
                    </div>
                    <div class="nav-right">
                        <div class="language-switcher">
                            <button class="lang-btn ${lang === 'en' ? 'active' : ''}" onclick="forceUpdateLanguage('en')">EN</button>
                            <button class="lang-btn ${lang === 'ru' ? 'active' : ''}" onclick="forceUpdateLanguage('ru')">RU</button>
                        </div>
                        <button class="nav-btn" onclick="window.location.href='/chat'">💬 ${translations[lang].chat || 'CHAT'}</button>
                        <button class="nav-btn" onclick="authManager.showLoginModal()">${translations[lang].login || 'LOGIN'}</button>
                        <button class="nav-btn" onclick="authManager.showRegisterModal()">${translations[lang].register || 'REGISTER'}</button>
                    </div>
                </div>
            `;
        }
    }
    
    // Обновляем активные кнопки языка
    document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.textContent === lang.toUpperCase()) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ============================================
// ПРИНУДИТЕЛЬНАЯ АДАПТАЦИЯ ДЛЯ МОБИЛЬНЫХ
// ============================================

function forceMobileLayout() {
    const width = window.innerWidth;
    const grid = document.querySelector('.beats-grid');
    
    if (!grid) return;
    
    // Для телефонов (ширина до 768px)
    if (width <= 768) {
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        grid.style.gap = '0.6rem';
        grid.style.removeProperty('grid-template-rows');
        console.log('📱 Принудительно установлено 3 колонки, ширина:', width);
    }
    
    // Для очень маленьких (до 480px)
    if (width <= 480) {
        grid.style.gap = '0.4rem';
    }
    
    // Для десктопа (ширина больше 768px) — возвращаем стандарт
    if (width > 768) {
        grid.style.gridTemplateColumns = '';
        grid.style.gap = '';
    }
}

// Вызываем при загрузке
document.addEventListener('DOMContentLoaded', () => {
    forceMobileLayout();
});

// Вызываем при изменении размера окна
window.addEventListener('resize', () => {
    forceMobileLayout();
});

// ============================================
// EXPORTS
// ============================================

window.addToCart = addToCart;
window.closeModal = closeModal;
window.showUploadModal = showUploadModal;
window.showStatistics = showStatistics;
window.showManageRoles = showManageRoles;
window.uploadBeat = uploadBeat;
window.toggleFavorite = toggleFavorite;
window.loadBeats = loadBeats;
window.updateProfile = updateProfile;
window.uploadPhoto = uploadPhoto;
window.translate = translate;
window.changeLanguage = changeLanguage;
