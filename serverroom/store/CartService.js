(function(window) {
    const CART_KEY = 'jinxGenCart';

    class CartService {
        #getCart() {
            return JSON.parse(localStorage.getItem(CART_KEY)) || [];
        }

        #saveCart(cart) {
            localStorage.setItem(CART_KEY, JSON.stringify(cart));
            this.updateCartCount();
        }

        addProduct(product, options = {}) {
            const cart = this.#getCart();
            const { size = null, quantity = 1 } = options;

            // Create a unique ID for products with sizes
            const cartItemId = size ? `${product.id}-${size}` : product.id;

            const existingProduct = cart.find(item => item.cartItemId === cartItemId);

            if (existingProduct) {
                existingProduct.quantity += quantity;
            } else {
                cart.push({ ...product, size, quantity, cartItemId });
            }
            this.#saveCart(cart);
        }

        removeProduct(cartItemId) {
            let cart = this.#getCart();
            cart = cart.filter(item => item.cartItemId !== cartItemId);
            this.#saveCart(cart);
        }

        updateQuantity(cartItemId, quantity) {
            const cart = this.#getCart();
            const product = cart.find(item => item.cartItemId === cartItemId);
            if (product) {
                product.quantity = quantity;
            }
            this.#saveCart(cart);
        }

        clearCart() {
            this.#saveCart([]);
        }

        updateCartCount() {
            const cart = this.#getCart();
            const count = cart.reduce((sum, item) => sum + item.quantity, 0);
            const cartCountEl = document.getElementById('cart-count');
            if (cartCountEl) {
                cartCountEl.textContent = count;
            }
        }
    }

    const descriptor = Object.getOwnPropertyDescriptor(CartService.prototype, 'addProduct');
    const decoratedDescriptor = Logger(CartService.prototype, 'addProduct', descriptor);
    Object.defineProperty(CartService.prototype, 'addProduct', decoratedDescriptor);

    window.CartService = CartService;
})(window);
