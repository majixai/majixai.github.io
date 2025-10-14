document.addEventListener('DOMContentLoaded', () => {
    const orderId = sessionStorage.getItem('orderId');
    const orderSummary = JSON.parse(sessionStorage.getItem('orderSummary'));

    if (orderId && orderSummary) {
        document.getElementById('order-id').textContent = orderId;

        const orderSummaryEl = document.getElementById('order-summary');
        orderSummaryEl.innerHTML = orderSummary.map(item => `
            <div class="card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between">
                        <div>
                            <h5>${item.name}</h5>
                            <p>Quantity: ${item.quantity}</p>
                        </div>
                        <div>
                            <p>$${(item.price * item.quantity).toFixed(2)}</p>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    } else {
        document.querySelector('.container').innerHTML = '<h1>No order found.</h1>';
    }

    const cartService = new CartService();
    cartService.updateCartCount();
});