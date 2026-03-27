// ============================================
// CART MODULE - COMPLETE VERSION
// ============================================

class CartManager {
    constructor() {
        // Core properties
        this.items = [];
        this.total = 0;
        this.itemCount = 0;
        this.currentUser = null;
        this.isLoaded = false;
        this.lastUpdated = null;
        
        // Discount properties
        this.discountCode = null;
        this.discountAmount = 0;
        this.discountType = 'percentage'; // 'percentage' or 'fixed'
        this.shippingCost = 0;
        this.taxRate = 0.1; // 10% tax
        this.taxAmount = 0;
        
        // UI elements
        this.cartBadge = null;
        this.cartSidebar = null;
        
        // Callbacks
        this.onUpdateCallbacks = [];
        this.onCheckoutCallbacks = [];
        
        // Available discount codes
        this.validDiscounts = {
            'WELCOME10': { type: 'percentage', value: 10, description: '10% off your first purchase' },
            'BEATS20': { type: 'percentage', value: 20, description: '20% off all beats' },
            'SUMMER50': { type: 'fixed', value: 50, description: '$50 off' },
            'FREESHIP': { type: 'percentage', value: 0, description: 'Free shipping' }
        };
        
        // Load saved cart
        this.loadSavedCart();
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    setUser(user) {
        this.currentUser = user;
        if (user) {
            this.loadCart();
        } else {
            this.loadSavedCart();
        }
    }
    
    loadSavedCart() {
        try {
            const saved = localStorage.getItem('beats_market_cart');
            if (saved) {
                const cartData = JSON.parse(saved);
                this.items = cartData.items || [];
                this.calculateAll();
                this.updateUI();
            }
        } catch (e) {
            console.error('Error loading saved cart:', e);
        }
    }
    
    saveCart() {
        try {
            localStorage.setItem('beats_market_cart', JSON.stringify({
                items: this.items,
                lastUpdated: new Date().toISOString()
            }));
        } catch (e) {
            console.error('Error saving cart:', e);
        }
    }
    
    async loadCart() {
        if (!this.currentUser) {
            this.loadSavedCart();
            return false;
        }
        
        try {
            const response = await fetch('/api/cart', {
                credentials: 'include'
            });
            
            if (response.ok) {
                this.items = await response.json();
                this.calculateAll();
                this.isLoaded = true;
                this.lastUpdated = new Date();
                this.updateUI();
                this.saveCart();
                return true;
            }
        } catch (error) {
            console.error('Error loading cart:', error);
        }
        
        return false;
    }
    
    // ============================================
    // CALCULATIONS
    // ============================================
    
    calculateAll() {
        this.calculateSubtotal();
        this.calculateTax();
        this.calculateDiscount();
        this.calculateTotal();
        this.itemCount = this.items.length;
        return this.total;
    }
    
    calculateSubtotal() {
        this.subtotal = this.items.reduce((sum, item) => sum + (item.price || 0), 0);
        return this.subtotal;
    }
    
    calculateTax() {
        this.taxAmount = this.subtotal * this.taxRate;
        return this.taxAmount;
    }
    
    calculateDiscount() {
        if (!this.discountCode) {
            this.discountAmount = 0;
            return 0;
        }
        
        const discount = this.validDiscounts[this.discountCode];
        if (!discount) {
            this.discountAmount = 0;
            return 0;
        }
        
        if (discount.type === 'percentage') {
            this.discountAmount = this.subtotal * (discount.value / 100);
        } else {
            this.discountAmount = Math.min(discount.value, this.subtotal);
        }
        
        return this.discountAmount;
    }
    
    calculateTotal() {
        this.total = this.subtotal + this.taxAmount + this.shippingCost - this.discountAmount;
        this.total = Math.max(0, this.total);
        return this.total;
    }
    
    // ============================================
    // CART OPERATIONS
    // ============================================
    
    async addItem(beatId, beatTitle, beatPrice, beatData = {}) {
        if (!this.currentUser) {
            this.addToLocalCart(beatId, beatTitle, beatPrice, beatData);
            return true;
        }
        
        try {
            const response = await fetch('/api/cart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ beatId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                await this.loadCart();
                this.showNotification('✅ Added to cart!', 'success');
                this.triggerCallbacks('update', this.getSummary());
                return true;
            } else {
                this.showNotification(data.error || 'Failed to add to cart', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            this.showNotification('Error adding to cart', 'error');
            return false;
        }
    }
    
    addToLocalCart(beatId, beatTitle, beatPrice, beatData) {
        // Check if already in cart
        if (this.items.some(item => item.id === beatId)) {
            this.showNotification('Item already in cart', 'warning');
            return false;
        }
        
        this.items.push({
            id: beatId,
            title: beatTitle,
            price: beatPrice,
            ...beatData,
            added_at: new Date().toISOString()
        });
        
        this.calculateAll();
        this.updateUI();
        this.saveCart();
        this.showNotification('✅ Added to cart!', 'success');
        this.triggerCallbacks('update', this.getSummary());
        return true;
    }
    
    async removeItem(cartId, beatId) {
        if (!this.currentUser) {
            this.removeFromLocalCart(beatId);
            return true;
        }
        
        try {
            const response = await fetch(`/api/cart/${cartId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                await this.loadCart();
                this.showNotification('✅ Removed from cart', 'success');
                this.triggerCallbacks('update', this.getSummary());
                return true;
            } else {
                this.showNotification(data.error || 'Failed to remove', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error removing from cart:', error);
            this.showNotification('Error removing from cart', 'error');
            return false;
        }
    }
    
    removeFromLocalCart(beatId) {
        this.items = this.items.filter(item => item.id !== beatId);
        this.calculateAll();
        this.updateUI();
        this.saveCart();
        this.showNotification('✅ Removed from cart', 'success');
        this.triggerCallbacks('update', this.getSummary());
    }
    
    async updateQuantity(cartId, beatId, quantity) {
        if (quantity <= 0) {
            return this.removeItem(cartId, beatId);
        }
        
        // For now, we don't support quantity per item since beats are unique
        // This method is for future expansion
        this.showNotification('Quantity update not supported', 'info');
        return false;
    }
    
    async clearCart() {
        if (!this.currentUser) {
            this.clearLocalCart();
            return true;
        }
        
        try {
            const response = await fetch('/api/cart', {
                method: 'DELETE',
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                await this.loadCart();
                this.showNotification('Cart cleared', 'success');
                this.triggerCallbacks('update', this.getSummary());
                return true;
            } else {
                this.showNotification(data.error || 'Failed to clear cart', 'error');
                return false;
            }
        } catch (error) {
            console.error('Error clearing cart:', error);
            this.showNotification('Error clearing cart', 'error');
            return false;
        }
    }
    
    clearLocalCart() {
        this.items = [];
        this.calculateAll();
        this.updateUI();
        this.saveCart();
        this.showNotification('Cart cleared', 'success');
        this.triggerCallbacks('update', this.getSummary());
    }
    
    // ============================================
    // DISCOUNT CODES
    // ============================================
    
    applyDiscountCode(code) {
        code = code.toUpperCase().trim();
        
        if (!this.validDiscounts[code]) {
            this.showNotification('Invalid discount code', 'error');
            return false;
        }
        
        this.discountCode = code;
        this.calculateAll();
        this.updateUI();
        this.showNotification(`Discount code applied: ${this.validDiscounts[code].description}`, 'success');
        this.triggerCallbacks('update', this.getSummary());
        return true;
    }
    
    removeDiscountCode() {
        this.discountCode = null;
        this.discountAmount = 0;
        this.calculateAll();
        this.updateUI();
        this.showNotification('Discount code removed', 'info');
        this.triggerCallbacks('update', this.getSummary());
    }
    
    // ============================================
    // CHECKOUT
    // ============================================
    
    async checkout(paymentMethod) {
        if (this.items.length === 0) {
            this.showNotification('Your cart is empty', 'warning');
            return false;
        }
        
        if (!this.currentUser) {
            this.showNotification('Please login to checkout', 'warning');
            if (typeof authManager !== 'undefined') {
                authManager.showLoginModal();
            }
            return false;
        }
        
        const beatIds = this.items.map(item => item.id);
        
        try {
            const response = await fetch('/api/purchase', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ 
                    beatIds, 
                    paymentMethod,
                    discountCode: this.discountCode,
                    subtotal: this.subtotal,
                    tax: this.taxAmount,
                    total: this.total
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('✅ Payment successful! Thank you for your purchase!', 'success');
                await this.loadCart();
                this.triggerCallbacks('checkout', data);
                return true;
            } else {
                this.showNotification(data.error || 'Payment failed', 'error');
                return false;
            }
        } catch (error) {
            console.error('Checkout error:', error);
            this.showNotification('Payment error', 'error');
            return false;
        }
    }
    
    // ============================================
    // GETTERS
    // ============================================
    
    getItems() {
        return [...this.items];
    }
    
    getCount() {
        return this.itemCount;
    }
    
    getSubtotal() {
        return this.subtotal;
    }
    
    getTax() {
        return this.taxAmount;
    }
    
    getDiscount() {
        return this.discountAmount;
    }
    
    getTotal() {
        return this.total;
    }
    
    getSummary() {
        return {
            count: this.itemCount,
            subtotal: this.subtotal,
            tax: this.taxAmount,
            discount: this.discountAmount,
            total: this.total,
            discountCode: this.discountCode,
            items: this.items
        };
    }
    
    // ============================================
    // UI METHODS
    // ============================================
    
    updateUI() {
        // Update cart badge
        const badges = document.querySelectorAll('#cartCount');
        badges.forEach(badge => {
            if (badge) badge.textContent = this.itemCount;
        });
        
        // Update mini cart if open
        if (this.cartSidebar && this.cartSidebar.style.display === 'flex') {
            this.renderMiniCart();
        }
    }
    
    async renderCartPage(container) {
        if (!container) return;
        
        if (!this.currentUser && this.items.length === 0) {
            container.innerHTML = `
                <div class="cart-page">
                    <h2>YOUR CART IS EMPTY</h2>
                    <p>Please login to view your saved cart or continue shopping</p>
                    <div class="cart-actions">
                        <button class="btn" onclick="authManager.showLoginModal()">LOGIN</button>
                        <button class="btn btn-secondary" onclick="window.location.href='/shop'">CONTINUE SHOPPING</button>
                    </div>
                </div>
            `;
            return;
        }
        
        await this.loadCart();
        
        if (this.items.length === 0) {
            container.innerHTML = `
                <div class="cart-page">
                    <h2>YOUR CART IS EMPTY</h2>
                    <button class="btn" onclick="window.location.href='/shop'">CONTINUE SHOPPING</button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="cart-page">
                <h2>YOUR CART <span class="cart-count">(${this.itemCount} items)</span></h2>
                
                <div class="cart-layout">
                    <div class="cart-items-section">
                        <div class="cart-items-header">
                            <div>ITEM</div>
                            <div>PRICE</div>
                            <div></div>
                        </div>
                        <div class="cart-items-list">
                            ${this.items.map(item => `
                                <div class="cart-item" data-id="${item.id}" data-cart-id="${item.cart_id}">
                                    <div class="cart-item-info">
                                        <div class="cart-item-cover">
                                            <div class="beat-cover-small"></div>
                                        </div>
                                        <div class="cart-item-details">
                                            <div class="cart-item-title">${this.escapeHtml(item.title)}</div>
                                            <div class="cart-item-artist">Beats Market</div>
                                        </div>
                                    </div>
                                    <div class="cart-item-price">$${item.price.toFixed(2)} USD</div>
                                    <div class="cart-item-actions">
                                        <button class="cart-remove-btn" onclick="cartManager.removeItem(${item.cart_id}, ${item.id})">
                                            <span>✕</span>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="cart-summary-section">
                        <h3>ORDER SUMMARY</h3>
                        <div class="summary-row">
                            <span>Subtotal</span>
                            <span>$${this.subtotal.toFixed(2)} USD</span>
                        </div>
                        <div class="summary-row">
                            <span>Tax (10%)</span>
                            <span>$${this.taxAmount.toFixed(2)} USD</span>
                        </div>
                        ${this.discountAmount > 0 ? `
                            <div class="summary-row discount">
                                <span>Discount</span>
                                <span> -$${this.discountAmount.toFixed(2)} USD</span>
                            </div>
                        ` : ''}
                        <div class="summary-row total">
                            <span>TOTAL</span>
                            <span>$${this.total.toFixed(2)} USD</span>
                        </div>
                        
                        <div class="discount-section">
                            <input type="text" id="discountCode" class="form-input" placeholder="Discount code" 
                                   value="${this.discountCode || ''}">
                            <button class="btn btn-secondary" onclick="cartManager.applyDiscountCodeFromInput()">APPLY</button>
                            ${this.discountCode ? `<button class="btn-link" onclick="cartManager.removeDiscountCode()">Remove</button>` : ''}
                        </div>
                        
                        <div class="payment-section">
                            <h4>PAYMENT METHOD</h4>
                            <div class="payment-methods">
                                <button class="payment-btn" onclick="cartManager.checkout('card')">
                                    💳 CREDIT CARD
                                </button>
                                <button class="payment-btn" onclick="cartManager.checkout('paypal')">
                                    💰 PAYPAL
                                </button>
                                <button class="payment-btn" onclick="cartManager.checkout('crypto')">
                                    ₿ CRYPTO
                                </button>
                            </div>
                        </div>
                        
                        <button class="btn btn-secondary" onclick="window.location.href='/shop'" style="width: 100%; margin-top: 1rem;">
                            ← CONTINUE SHOPPING
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    applyDiscountCodeFromInput() {
        const input = document.getElementById('discountCode');
        if (input) {
            this.applyDiscountCode(input.value);
            input.value = this.discountCode || '';
        }
    }
    
    async renderMiniCart() {
        // For future implementation - floating cart sidebar
        // This will be implemented when needed
    }
    
    // ============================================
    // NOTIFICATIONS
    // ============================================
    
    showNotification(message, type = 'info') {
        // Check if notification system exists
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }
        
        // Fallback to alert
        if (type === 'error') {
            alert('❌ ' + message);
        } else if (type === 'success') {
            alert('✅ ' + message);
        } else {
            alert(message);
        }
    }
    
    // ============================================
    // CALLBACKS
    // ============================================
    
    onUpdate(callback) {
        this.onUpdateCallbacks.push(callback);
    }
    
    onCheckout(callback) {
        this.onCheckoutCallbacks.push(callback);
    }
    
    triggerCallbacks(event, data) {
        if (event === 'update') {
            this.onUpdateCallbacks.forEach(cb => cb(data));
        } else if (event === 'checkout') {
            this.onCheckoutCallbacks.forEach(cb => cb(data));
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
const cartManager = new CartManager();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CartManager;
}