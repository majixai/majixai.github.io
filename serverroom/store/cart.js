class CartRenderer {
    constructor(cartItemsContainer, cartTotalEl) {
        this.cartItemsContainer = cartItemsContainer;
        this.cartTotalEl = cartTotalEl;
        this.cartService = new CartService();
    }

    render() {
        const cart = this.cartService.getCart();
        if (cart.length === 0) {
            this.cartItemsContainer.innerHTML = '<p>Your cart is empty.</p>';
            this.cartTotalEl.textContent = '0.00';
            return;
        }

        this.cartItemsContainer.innerHTML = cart.map(item => `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <div>
                            <h5>${item.name} ${item.size ? `(${item.size})` : ''}</h5>
                            <p>$${Number(item.price).toFixed(2)}</p>
                        </div>
                        <div>
                            <input type="number" value="${item.quantity}" min="1" class="form-control quantity-input" data-id="${item.cartItemId}">
                            <button class="btn btn-danger btn-sm remove-btn" data-id="${item.cartItemId}">Remove</button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        this.cartTotalEl.textContent = total.toFixed(2);

        this.addEventListeners();
    }

    addEventListeners() {
        document.querySelectorAll('.quantity-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const quantity = parseInt(e.target.value);
                this.cartService.updateQuantity(id, quantity);
                this.render();
            });
        });

        document.querySelectorAll('.remove-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                this.cartService.removeProduct(id);
                this.render();
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const cartService = new CartService();
    cartService.updateCartCount();

    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalEl = document.getElementById('cart-total');
    const renderer = new CartRenderer(cartItemsContainer, cartTotalEl);
    renderer.render();
});
