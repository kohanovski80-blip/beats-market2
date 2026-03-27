// ============================================
// ADMIN PANEL MODULE - COMPLETE VERSION
// ============================================

class AdminManager {
    constructor() {
        this.isAdmin = false;
        this.isCreator = false;
        this.data = {
            beats: [],
            users: [],
            stats: {},
            activities: [],
            purchases: []
        };
        this.currentTab = 'dashboard';
        this.isLoading = false;
        
        // Charts disabled
        
        // Callbacks
        this.onDataUpdateCallbacks = [];
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    async init() {
        if (!authManager || !authManager.isAdmin()) {
            window.location.href = '/';
            return false;
        }
        
        this.isAdmin = authManager.isAdmin();
        this.isCreator = authManager.isCreator();
        
        await this.loadAllData();
        this.setupEventListeners();
        this.renderAdminPanel();
        
        return true;
    }
    
    async loadAllData() {
        this.isLoading = true;
        this.showLoading();
        
        await Promise.all([
            this.loadBeats(),
            this.loadUsers(),
            this.loadStats(),
            this.loadActivities(),
            this.loadPurchases()
        ]);
        
        this.isLoading = false;
        this.hideLoading();
        this.triggerCallbacks('update', this.data);
    }
    
    async loadBeats() {
        try {
            const response = await fetch('/api/beats/all', {
                credentials: 'include'
            });
            if (response.ok) {
                this.data.beats = await response.json();
            }
        } catch (error) {
            console.error('Error loading beats:', error);
        }
    }
    
    async loadUsers() {
        try {
            const response = await fetch('/api/users', {
                credentials: 'include'
            });
            if (response.ok) {
                this.data.users = await response.json();
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }
    
    async loadStats() {
        try {
            const response = await fetch('/api/admin/dashboard', {
                credentials: 'include'
            });
            if (response.ok) {
                this.data.stats = await response.json();
            }
            
            const purchasesResponse = await fetch('/api/purchase/stats', {
                credentials: 'include'
            });
            if (purchasesResponse.ok) {
                const purchaseStats = await purchasesResponse.json();
                this.data.stats = { ...this.data.stats, ...purchaseStats };
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    async loadActivities() {
        try {
            const response = await fetch('/api/activity?limit=50', {
                credentials: 'include'
            });
            if (response.ok) {
                this.data.activities = await response.json();
            }
        } catch (error) {
            console.error('Error loading activities:', error);
        }
    }
    
    async loadPurchases() {
        try {
            const response = await fetch('/api/purchase/history', {
                credentials: 'include'
            });
            if (response.ok) {
                this.data.purchases = await response.json();
            }
        } catch (error) {
            console.error('Error loading purchases:', error);
        }
    }
    
    // ============================================
    // RENDER METHODS
    // ============================================
    
    renderAdminPanel() {
    const container = document.getElementById('adminContent');
    if (!container) return;
    
    container.innerHTML = `
        <div class="admin-tabs">
            <button class="tab-btn ${this.currentTab === 'dashboard' ? 'active' : ''}" onclick="adminManager.switchTab('dashboard')">
                📊 DASHBOARD
            </button>
            <button class="tab-btn ${this.currentTab === 'beats' ? 'active' : ''}" onclick="adminManager.switchTab('beats')">
                🎵 BEATS
            </button>
            <button class="tab-btn ${this.currentTab === 'users' ? 'active' : ''}" onclick="adminManager.switchTab('users')">
                👥 USERS
            </button>
            <button class="tab-btn ${this.currentTab === 'purchases' ? 'active' : ''}" onclick="adminManager.switchTab('purchases')">
                💰 SALES
            </button>
            <button class="tab-btn ${this.currentTab === 'activities' ? 'active' : ''}" onclick="adminManager.switchTab('activities')">
                📋 ACTIVITY
            </button>
            ${this.isCreator ? `
                <button class="tab-btn ${this.currentTab === 'roles' ? 'active' : ''}" onclick="adminManager.switchTab('roles')">
                    👑 ROLES
                </button>
            ` : ''}
        </div>
        
        <div class="admin-content">
            ${this.renderCurrentTab()}
        </div>
    `;
    
    // Инициализируем графики только если переключились на dashboard И они ещё не инициализированы
    if (this.currentTab === 'dashboard') {
    // Графики отключены
    console.log('Dashboard loaded');
}
}
    
    renderCurrentTab() {
        switch (this.currentTab) {
            case 'dashboard':
                return this.renderDashboard();
            case 'beats':
                return this.renderBeatsTab();
            case 'users':
                return this.renderUsersTab();
            case 'purchases':
                return this.renderPurchasesTab();
            case 'activities':
                return this.renderActivitiesTab();
            case 'roles':
                return this.renderRolesTab();
            default:
                return this.renderDashboard();
        }
    }
    
    renderDashboard() {
    const stats = this.data.stats;
    
    return `
        <div class="dashboard-stats">
            <div class="stat-card">
                <div class="stat-icon">🎵</div>
                <div class="stat-info">
                    <div class="stat-value">${stats.totalBeats || 0}</div>
                    <div class="stat-label">Total Beats</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">💰</div>
                <div class="stat-info">
                    <div class="stat-value">$${(stats.totalRevenue || 0).toFixed(2)}</div>
                    <div class="stat-label">Revenue</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-info">
                    <div class="stat-value">${stats.totalUsers || 0}</div>
                    <div class="stat-label">Users</div>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📦</div>
                <div class="stat-info">
                    <div class="stat-value">${stats.totalPurchases || 0}</div>
                    <div class="stat-label">Sales</div>
                </div>
            </div>
        </div>
        
        <div class="dashboard-quick-actions">
            <h3>Quick Actions</h3>
            <div class="action-buttons">
                <button class="btn" onclick="adminManager.showUploadBeatModal()">
                    📤 Upload New Beat
                </button>
                <button class="btn" onclick="window.location.href='/shop'">
                    🛒 View Store
                </button>
                ${this.isCreator ? `
                    <button class="btn" onclick="adminManager.exportData()">
                        📥 Export Data
                    </button>
                    <button class="btn btn-danger" onclick="adminManager.showResetStatsModal()">
                        🔄 Reset Statistics
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}
    
    renderBeatsTab() {
        const beats = this.data.beats;
        
        return `
            <div class="admin-header">
                <h2>🎵 Manage Beats</h2>
                <button class="btn btn-primary" onclick="adminManager.showUploadBeatModal()">
                    + UPLOAD NEW BEAT
                </button>
            </div>
            
            <div class="beats-filters">
                <input type="text" id="beatSearch" placeholder="Search beats..." class="form-input" onkeyup="adminManager.filterBeats()">
                <select id="beatStatus" onchange="adminManager.filterBeats()" class="form-select">
                    <option value="all">All Beats</option>
                    <option value="available">Available</option>
                    <option value="sold">Sold</option>
                </select>
            </div>
            
            <div class="beats-table-container">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Title</th>
                            <th>Price</th>
                            <th>Status</th>
                            <th>Sales</th>
                            <th>Plays</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="beatsTableBody">
                        ${beats.map(beat => `
                            <tr data-beat-id="${beat.id}" data-status="${beat.purchased ? 'sold' : 'available'}">
                                <td>${beat.id}</td>
                                <td>${this.escapeHtml(beat.title)}</td>
                                <td>$${beat.price}</td>
                                <td>
                                    <span class="status-badge ${beat.purchased ? 'status-sold' : 'status-available'}">
                                        ${beat.purchased ? 'SOLD' : 'AVAILABLE'}
                                    </span>
                                </td>
                                <td>${beat.sales_count || 0}</td>
                                <td>${beat.play_count || 0}</td>
                                <td>${new Date(beat.created_at).toLocaleDateString()}</td>
                                <td class="actions">
                                    <button class="action-btn edit" onclick="adminManager.editBeat(${beat.id})">✏️</button>
                                    ${!beat.purchased ? `<button class="action-btn delete" onclick="adminManager.deleteBeat(${beat.id})">🗑️</button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${beats.length === 0 ? '<p class="text-center">No beats found</p>' : ''}
        `;
    }
    
    renderUsersTab() {
        const users = this.data.users;
        
        return `
            <div class="admin-header">
                <h2>👥 Manage Users</h2>
            </div>
            
            <div class="users-filters">
                <input type="text" id="userSearch" placeholder="Search users..." class="form-input" onkeyup="adminManager.filterUsers()">
            </div>
            
            <div class="users-table-container">
                <table class="admin-table">
                    <thead>
                         <tr>
                            <th>ID</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Joined</th>
                            <th>Last Login</th>
                            <th>Actions</th>
                         </tr>
                    </thead>
                    <tbody id="usersTableBody">
                        ${users.map(user => `
                            <tr data-user-id="${user.id}" data-username="${user.username.toLowerCase()}">
                                <td>${user.id}</td>
                                <td>${this.escapeHtml(user.username)}</td>
                                <td>${this.escapeHtml(user.email)}</td>
                                <td>
                                    <span class="role-badge role-${user.role}">
                                        ${user.role.toUpperCase()}
                                    </span>
                                </td>
                                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                                <td>${user.last_login ? new Date(user.last_login).toLocaleDateString() : '-'}</td>
                                <td class="actions">
                                    <button class="action-btn view" onclick="adminManager.viewUser(${user.id})">👁️</button>
                                    ${this.isCreator && user.id !== authManager.getUserId() ? `
                                        <button class="action-btn edit" onclick="adminManager.editUserRole(${user.id}, '${user.role}')">👑</button>
                                        <button class="action-btn delete" onclick="adminManager.deleteUser(${user.id})">🗑️</button>
                                    ` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    renderPurchasesTab() {
        const purchases = this.data.purchases;
        
        return `
            <div class="admin-header">
                <h2>💰 Sales History</h2>
            </div>
            
            <div class="purchases-table-container">
                <table class="admin-table">
                    <thead>
                         <tr>
                            <th>ID</th>
                            <th>Beat</th>
                            <th>Buyer</th>
                            <th>Price</th>
                            <th>Date</th>
                         </tr>
                    </thead>
                    <tbody>
                        ${purchases.map(purchase => `
                            <tr>
                                <td>${purchase.id}</td>
                                <td>${this.escapeHtml(purchase.title)}</td>
                                <td>User #${purchase.user_id}</td>
                                <td>$${purchase.price}</td>
                                <td>${new Date(purchase.purchased_at).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${purchases.length === 0 ? '<p class="text-center">No purchases yet</p>' : ''}
        `;
    }
    
    renderActivitiesTab() {
        const activities = this.data.activities;
        
        return `
            <div class="admin-header">
                <h2>📋 Activity Log</h2>
            </div>
            
            <div class="activities-list">
                ${activities.map(activity => `
                    <div class="activity-item">
                        <div class="activity-time">${new Date(activity.created_at).toLocaleString()}</div>
                        <div class="activity-user">${activity.username || 'System'}</div>
                        <div class="activity-action">${this.escapeHtml(activity.action)}</div>
                        ${activity.details ? `<div class="activity-details">${this.escapeHtml(activity.details)}</div>` : ''}
                    </div>
                `).join('')}
            </div>
            ${activities.length === 0 ? '<p class="text-center">No activity yet</p>' : ''}
        `;
    }
    
    renderRolesTab() {
        if (!this.isCreator) return '';
        
        const users = this.data.users;
        
        return `
            <div class="admin-header">
                <h2>👑 Manage User Roles</h2>
            </div>
            
            <div class="roles-table-container">
                <table class="admin-table">
                    <thead>
                         <tr>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Current Role</th>
                            <th>Change Role</th>
                         </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td>${this.escapeHtml(user.username)}</td>
                                <td>${this.escapeHtml(user.email)}</td>
                                <td>
                                    <span class="role-badge role-${user.role}">
                                        ${user.role.toUpperCase()}
                                    </span>
                                </td>
                                <td>
                                    ${user.id !== authManager.getUserId() ? `
                                        <select onchange="adminManager.changeRole(${user.id}, this.value)" class="role-select">
                                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                                            <option value="creator" ${user.role === 'creator' ? 'selected' : ''}>Creator</option>
                                        </select>
                                    ` : '<span class="text-muted">You</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
 // ============================================
// CHARTS (отключены)
// ============================================

initCharts() {
    // Графики отключены для стабильности
    console.log('📊 Charts disabled');
}

destroyCharts() {
    // Графики отключены
}
    
    // ============================================
    // ACTIONS
    // ============================================
    
    showUploadBeatModal() {
        const modal = document.getElementById('adminModal');
        if (modal) {
            document.getElementById('beatTitle').value = '';
            document.getElementById('beatPrice').value = '';
            document.getElementById('beatAudio').value = '';
            if (document.getElementById('beatCover')) document.getElementById('beatCover').value = '';
            if (document.getElementById('beatDescription')) document.getElementById('beatDescription').value = '';
            if (document.getElementById('beatTags')) document.getElementById('beatTags').value = '';
            if (document.getElementById('beatBpm')) document.getElementById('beatBpm').value = '';
            if (document.getElementById('beatKey')) document.getElementById('beatKey').value = '';
            modal.style.display = 'flex';
        }
    }
    
    async uploadBeat() {
        const title = document.getElementById('beatTitle').value.trim();
        const price = document.getElementById('beatPrice').value;
        const audio = document.getElementById('beatAudio').files[0];
        const cover = document.getElementById('beatCover')?.files[0];
        const description = document.getElementById('beatDescription')?.value || '';
        const tags = document.getElementById('beatTags')?.value || '';
        const bpm = document.getElementById('beatBpm')?.value || '';
        const key = document.getElementById('beatKey')?.value || '';
        
        if (!title || !price || !audio) {
            alert('Please fill all required fields');
            return;
        }
        
        const formData = new FormData();
        formData.append('title', title);
        formData.append('price', price);
        formData.append('audio', audio);
        if (cover) formData.append('cover', cover);
        formData.append('description', description);
        formData.append('tags', tags);
        formData.append('bpm', bpm);
        formData.append('key', key);
        
        try {
            const response = await fetch('/api/beats', {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('✅ Beat uploaded successfully!');
                document.getElementById('adminModal').style.display = 'none';
                await this.loadBeats();
                if (this.currentTab === 'beats') {
                    this.renderAdminPanel();
                }
            } else {
                alert('❌ Error: ' + (data.error || 'Upload failed'));
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('❌ Error uploading beat');
        }
    }
    
    async deleteBeat(beatId) {
        if (!confirm('Are you sure you want to delete this beat? This action cannot be undone.')) return;
        
        try {
            const response = await fetch(`/api/beats/${beatId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('✅ Beat deleted successfully');
                await this.loadBeats();
                if (this.currentTab === 'beats') {
                    this.renderAdminPanel();
                }
            } else {
                alert('❌ Error: ' + (data.error || 'Delete failed'));
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('❌ Error deleting beat');
        }
    }
    
    async changeRole(userId, role) {
        try {
            const response = await fetch(`/api/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ role })
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('✅ Role changed successfully');
                await this.loadUsers();
                if (this.currentTab === 'roles') {
                    this.renderAdminPanel();
                }
            } else {
                alert('❌ Error: ' + (data.error || 'Change failed'));
            }
        } catch (error) {
            console.error('Role change error:', error);
            alert('❌ Error changing role');
        }
    }
    
    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This will delete all their data.')) return;
        
        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                alert('✅ User deleted successfully');
                await this.loadUsers();
                if (this.currentTab === 'users') {
                    this.renderAdminPanel();
                }
            } else {
                alert('❌ Error: ' + (data.error || 'Delete failed'));
            }
        } catch (error) {
            console.error('Delete error:', error);
            alert('❌ Error deleting user');
        }
    }
    
    exportData() {
        const data = JSON.stringify(this.data, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `beats_market_export_${new Date().toISOString()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert('✅ Data exported successfully');
    }
    
    // ============================================
    // RESET STATISTICS
    // ============================================
    
    showResetStatsModal() {
        const modal = document.getElementById('resetStatsModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }
    
async resetStatistics() {
    const confirmFirst = confirm('⚠️ WARNING: This will permanently delete ALL statistics, purchase history, and activity logs. This cannot be undone!\n\nAre you ABSOLUTELY sure?');
    
    if (!confirmFirst) return;
    
    const userInput = prompt('Type "RESET" to confirm:');
    
    if (!userInput || userInput.toUpperCase() !== 'RESET') {
        alert('Reset cancelled. You must type "RESET" exactly.');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/reset-stats', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('✅ Statistics reset successfully!');
            closeModal();
            await this.loadAllData();
            this.renderAdminPanel();
        } else {
            alert('❌ Error: ' + (data.error || 'Reset failed'));
        }
    } catch (error) {
        console.error('Reset stats error:', error);
        alert('❌ Error resetting statistics');
    }
}
    
    // ============================================
    // FILTERS
    // ============================================
    
    filterBeats() {
        const search = document.getElementById('beatSearch')?.value.toLowerCase() || '';
        const status = document.getElementById('beatStatus')?.value || 'all';
        
        const rows = document.querySelectorAll('#beatsTableBody tr');
        rows.forEach(row => {
            const title = row.cells[1]?.textContent.toLowerCase() || '';
            const beatStatus = row.dataset.status;
            
            let match = true;
            if (search && !title.includes(search)) match = false;
            if (status !== 'all' && beatStatus !== status) match = false;
            
            row.style.display = match ? '' : 'none';
        });
    }
    
    filterUsers() {
        const search = document.getElementById('userSearch')?.value.toLowerCase() || '';
        
        const rows = document.querySelectorAll('#usersTableBody tr');
        rows.forEach(row => {
            const username = row.dataset.username || '';
            const match = !search || username.includes(search);
            row.style.display = match ? '' : 'none';
        });
    }
    
    // ============================================
    // UI UTILITIES
    // ============================================
    
    switchTab(tab) {
        this.currentTab = tab;
        this.renderAdminPanel();
    }
    
    showLoading() {
        const container = document.getElementById('adminContent');
        if (container && this.isLoading) {
            container.innerHTML = '<div class="loading-spinner">Loading admin panel...</div>';
        }
    }
    
    hideLoading() {
        // Loading removed when render is called
    }
    
    setupEventListeners() {
        window.addEventListener('click', (e) => {
            if (e.target.classList && e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }
    
    // ============================================
    // PLACEHOLDER METHODS
    // ============================================
    
    editBeat(beatId) {
        alert(`Edit beat ${beatId} - Feature coming soon`);
    }
    
    viewUser(userId) {
        alert(`View user ${userId} - Feature coming soon`);
    }
    
    editUserRole(userId, currentRole) {
        alert(`Edit role for user ${userId} - Use the roles tab for full management`);
    }
    
    // ============================================
    // CALLBACKS
    // ============================================
    
    onDataUpdate(callback) {
        this.onDataUpdateCallbacks.push(callback);
    }
    
    triggerCallbacks(event, data) {
        if (event === 'update') {
            this.onDataUpdateCallbacks.forEach(cb => cb(data));
        }
    }
    
    // ============================================
    // UTILITIES
    // ============================================
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Create global instance
const adminManager = new AdminManager();

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const checkInterval = setInterval(async () => {
        if (typeof authManager !== 'undefined' && authManager.currentUser !== undefined) {
            clearInterval(checkInterval);
            await adminManager.init();
        }
    }, 100);
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminManager;
}