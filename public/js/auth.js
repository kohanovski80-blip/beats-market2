// ============================================
// AUTHENTICATION MODULE
// ============================================

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.onLoginCallbacks = [];
        this.onLogoutCallbacks = [];
    }
    
    async init() {
        await this.checkAuth();
        return this.currentUser;
    }
    
    async checkAuth() {
    try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await response.json();
        
        if (data.user) {
            this.currentUser = data.user;
            this.isAuthenticated = true;
            this.triggerCallbacks('login', this.currentUser);
            return true;
        } else {
            this.currentUser = null;
            this.isAuthenticated = false;
            return false;
        }
    } catch (error) {
        console.error('Auth check error:', error);
        return false;
    }
}
    
    async login(email, password, remember = false) {
        if (!email || !password) {
            return { success: false, error: 'Please enter email and password' };
        }
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password, remember })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentUser = data.user;
                this.isAuthenticated = true;
                
                if (remember) {
                    localStorage.setItem('rememberedUser', JSON.stringify({
                        email: email,
                        timestamp: Date.now()
                    }));
                } else {
                    localStorage.removeItem('rememberedUser');
                }
                
                this.triggerCallbacks('login', this.currentUser);
                return { success: true, user: this.currentUser };
            } else {
                return { success: false, error: data.error || 'Login failed' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error' };
        }
    }
    
    async register(username, email, password) {
        if (!username || !email || !password) {
            return { success: false, error: 'All fields are required' };
        }
        
        if (password.length < 6) {
            return { success: false, error: 'Password must be at least 6 characters' };
        }
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: 'Network error' };
        }
    }
    
    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (error) {
            console.error('Logout error:', error);
        }
        
        this.currentUser = null;
        this.isAuthenticated = false;
        localStorage.removeItem('rememberedUser');
        this.triggerCallbacks('logout');
        window.location.href = '/';
    }
    
    getUser() {
        return this.currentUser ? { ...this.currentUser } : null;
    }
    
    getUserId() {
        return this.currentUser?.id || null;
    }
    
    isAdmin() {
        const role = this.currentUser?.role;
        return role === 'admin' || role === 'creator';
    }
    
    isCreator() {
        return this.currentUser?.role === 'creator';
    }
    
    onLogin(callback) {
        this.onLoginCallbacks.push(callback);
    }
    
    onLogout(callback) {
        this.onLogoutCallbacks.push(callback);
    }
    
    triggerCallbacks(event, data) {
        if (event === 'login') {
            this.onLoginCallbacks.forEach(cb => cb(data));
        } else if (event === 'logout') {
            this.onLoginCallbacks.forEach(cb => cb());
        }
    }
    
    showLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => this.addRememberCheckbox(), 50);
        }
    }
    
    showRegisterModal() {
        const modal = document.getElementById('registerModal');
        if (modal) modal.style.display = 'flex';
    }
    
    addRememberCheckbox() {
        if (document.getElementById('rememberCheckbox')) return;
        const passwordInput = document.getElementById('loginPassword');
        if (passwordInput) {
            const div = document.createElement('div');
            div.className = 'remember-me';
            div.innerHTML = '<label><input type="checkbox" id="rememberCheckbox"> Remember me</label>';
            passwordInput.insertAdjacentElement('afterend', div);
        }
    }
}

// Функция проверки запомненного пользователя
function checkRememberedUser() {
    const remembered = localStorage.getItem('rememberedUser');
    if (remembered) {
        try {
            const data = JSON.parse(remembered);
            const daysOld = (Date.now() - data.timestamp) / (1000 * 60 * 60 * 24);
            if (daysOld < 7) {
                const emailInput = document.getElementById('loginEmail');
                const checkbox = document.getElementById('rememberCheckbox');
                if (emailInput) emailInput.value = data.email;
                if (checkbox) checkbox.checked = true;
            } else {
                localStorage.removeItem('rememberedUser');
            }
        } catch (e) {}
    }
}

// Создаём глобальный экземпляр
const authManager = new AuthManager();

// Вызываем проверку при загрузке
document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkRememberedUser === 'function') {
        checkRememberedUser();
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}

