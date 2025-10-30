const { test, expect } = require('@playwright/test');

test('page loads', async ({ page }) => {
  await page.goto('http://localhost:5000/');
  await expect(page).toHaveTitle("Texas Hold'em");
});
