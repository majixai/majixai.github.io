from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch()
    try:
        context = browser.new_context()
        page = context.new_page()

        page.goto('http://localhost:8000')

        # Wait for the product grid to be populated
        page.wait_for_selector('.product-card')

        # Test autocomplete
        page.fill('#search', 'smart')
        page.click('text=AuraGlow Smart Mirror')

        # Add to cart
        page.wait_for_selector('#product-detail')
        expect(page.locator('#product-detail h2')).to_have_text('AuraGlow Smart Mirror')
        page.click('button:text("Add to Cart")')

        # Go to cart
        page.goto('http://localhost:8000/cart.html')
        page.wait_for_selector('#cart-items .card')
        expect(page.locator('#cart-items .card')).to_have_count(1)
        expect(page.locator('#cart-items h5')).to_have_text('AuraGlow Smart Mirror')

        # Checkout
        page.click('a:text("Checkout")')
        page.wait_for_selector('#checkout-form')
        page.fill('#name', 'Jules Verne')
        page.fill('#address', '123 Submarine St')
        page.fill('#city', 'Nautilus')
        page.fill('#state', 'Ocean')
        page.fill('#zip', '12345')
        page.fill('#card-number', '1234567812345678')
        page.fill('#expiry', '12/25')
        page.fill('#cvv', '123')
        page.click('button:text("Place Order")')

        # Confirmation
        page.wait_for_selector('#order-id')
        expect(page.locator('#order-id')).not_to_be_empty()
        page.screenshot(path="jules-scratch/verification/verification.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)