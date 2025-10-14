(function(window) {
    const CART_KEY = 'jinxGenCart';

    class CartService {
        getCart() {
            return JSON.parse(localStorage.getItem(CART_KEY)) || [];
        }

        saveCart(cart) {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
            this.updateCartCount();
        }

        addProduct(product) {
            const cart = this.getCart();
            const existingProduct = cart.find(item => item.id === product.id);
            if (existingProduct) {
                existingProduct.quantity++;
            } else {
                cart.push({ ...product, quantity: 1 });
            }
            this.saveCart(cart);
            return cart;
        }

        removeProduct(productId) {
            let cart = this.getCart();
            cart = cart.filter(item => item.id !== productId);
            this.saveCart(cart);
            return cart;
        }

        updateQuantity(productId, quantity) {
            const cart = this.getCart();
            const product = cart.find(item => item.id === productId);
            if (product) {
                product.quantity = quantity;
            }
            this.saveCart(cart);
            return cart;
        }

        clearCart() {
            this.saveCart([]);
        }

        updateCartCount() {
            const cart = this.getCart();
            const count = cart.reduce((sum, item) => sum + item.quantity, 0);
            const cartCountEl = document.getElementById('cart-count');
            if (cartCountEl) {
                cartCountEl.textContent = count;
            }
        }
    }

    window.CartService = CartService;
})(window);