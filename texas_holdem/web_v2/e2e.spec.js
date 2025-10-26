const { test, expect } = require('@playwright/test');

test('basic game flow', async ({ page }) => {
  await page.goto('http://localhost:5000/web_v2/');

  // Check that the initial game state is loaded
  await expect(page.locator('#pot-amount')).toContainText('0');
  await expect(page.locator('#community-card-container')).toBeEmpty();
  await expect(page.locator('#players')).not.toBeEmpty();

  // Perform a bet
  await page.click('#bet-btn');
  await expect(page.locator('#pot-amount')).not.toContainText('0');

  // Go to the next round
  await page.click('#next-round-btn');
  await expect(page.locator('#community-card-container')).not.toBeEmpty();
});
