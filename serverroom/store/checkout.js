document.addEventListener('DOMContentLoaded', () => {
    const cartService = new CartService();
    cartService.updateCartCount();

    const checkoutForm = document.getElementById('checkout-form');
    checkoutForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const orderData = {
            name: document.getElementById('name').value,
            address: document.getElementById('address').value,
            city: document.getElementById('city').value,
            state: document.getElementById('state').value,
            zip: document.getElementById('zip').value,
            shippingMethod: document.getElementById('shipping-method').value,
            cardNumber: document.getElementById('card-number').value,
            expiry: document.getElementById('expiry').value,
            cvv: document.getElementById('cvv').value,
            cart: cartService.getCart(),
            timestamp: Date.now()
        };

        const orderDataString = JSON.stringify(orderData);
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(orderDataString));
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const orderId = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        sessionStorage.setItem('orderId', orderId);
        sessionStorage.setItem('orderSummary', JSON.stringify(orderData.cart));

        cartService.clearCart();
        window.location.href = 'confirmation.html';
    });
});