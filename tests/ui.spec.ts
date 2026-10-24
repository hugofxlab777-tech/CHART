import { expect, test } from '@playwright/test';

test.describe('Three.js Game UI Designer Tests', () => {
  test('validates responsive HUD, phase banner, audio, modals and game over overlay', async ({ page }, testInfo) => {
    test.setTimeout(180000);
    const isMobile = testInfo.project.name === 'mobile';

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await page.waitForFunction(() => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) > 5);

    // 1. Header elements
    const brand = page.locator('.brand-cluster');
    await expect(brand).toBeVisible();

    const trumpPill = page.locator('#trump-card-text');
    await expect(trumpPill).toBeVisible();
    const trumpText = await trumpPill.innerText();
    expect(trumpText.length).toBeGreaterThan(0);

    const deckCounter = page.locator('#deck-counter');
    await expect(deckCounter).toBeVisible();
    const count = parseInt(await deckCounter.innerText(), 10);
    expect(count).toBeGreaterThanOrEqual(0);

    // 2. Phase Banner & Opponents
    const phaseBanner = page.locator('#phase-banner');
    await expect(phaseBanner).toBeVisible();
    const phaseBadge = page.locator('#phase-badge');
    await expect(phaseBadge).toBeVisible();

    const opponentStrip = page.locator('#opponent-strip');
    await expect(opponentStrip).toBeVisible();

    // 3. Audio toggle
    const btnAudio = page.locator('#btn-audio');
    await expect(btnAudio).toBeVisible();
    await btnAudio.click({ force: true });
    await expect(page.locator('#audio-icon')).toHaveText('🔇');
    await btnAudio.click({ force: true });
    await expect(page.locator('#audio-icon')).toHaveText('🔊');

    // 4. Action Dock & Teacher hint
    const actionDock = page.locator('#action-controls');
    await expect(actionDock).toBeVisible();
    const btnHint = page.locator('#btn-hint');
    await expect(btnHint).toBeVisible();

    const hintBox = await btnHint.boundingBox();
    expect(hintBox?.height).toBeGreaterThanOrEqual(40);

    await btnHint.click({ force: true });
    const statusLine = page.locator('#status-line');
    await expect(statusLine).toBeVisible();
    const statusText = await statusLine.innerText();
    expect(statusText.length).toBeGreaterThan(0);

    // 5. Rules Modal open & close
    const btnRules = page.locator('#btn-rules');
    await btnRules.click({ force: true });
    const rulesModal = page.locator('#teacher-modal');
    await expect(rulesModal).toBeVisible();
    await page.locator('#btn-close-rules').click({ force: true });
    await expect(rulesModal).toHaveClass(/hidden/);

    // 5b. DURAK_CUSTOM_GAME_SETUP Wizard Modal test
    const btnSetup = page.locator('#btn-setup');
    await expect(btnSetup).toBeVisible();
    await btnSetup.click({ force: true });
    const setupModal = page.locator('#setup-modal');
    await expect(setupModal).toBeVisible();

    // Verify Tab navigation
    const customTabBtn = page.locator('.setup-tab-btn[data-tab="custom"]');
    await expect(customTabBtn).toBeVisible();
    await customTabBtn.click({ force: true });

    // Select Ace beats everything custom rule
    const aceRuleCard = page.locator('.custom-rule-card[data-rule-id="ace_beats_everything"]');
    await expect(aceRuleCard).toBeVisible();
    await aceRuleCard.locator('.rule-checkbox').check({ force: true });

    // Switch to JSON tab and check output
    const jsonTabBtn = page.locator('.setup-tab-btn[data-tab="json"]');
    await jsonTabBtn.click({ force: true });
    const jsonEditor = page.locator('#setup-json-editor');
    await expect(jsonEditor).toBeVisible();
    const configContent = await jsonEditor.inputValue();
    expect(configContent).toContain('"validated": true');
    expect(configContent).toContain('ace_beats_everything');

    // Click "Pradedam žaidimą?" to start game with custom configuration
    const btnStartConfigured = page.locator('#btn-start-configured-game');
    await expect(btnStartConfigured).toBeVisible();
    await btnStartConfigured.click({ force: true });
    await expect(setupModal).toHaveClass(/hidden/);

    // 6. Capture gameplay screenshot
    const gameplayScreenshotPath = `artifacts/ui-${testInfo.project.name}-gameplay.png`;
    const gameplayScreenshot = await page.screenshot({ path: gameplayScreenshotPath, fullPage: true });
    await testInfo.attach(`${testInfo.project.name}-gameplay`, {
      body: gameplayScreenshot,
      contentType: 'image/png',
    });

    // 7. Game Over Milestone Overlay
    await page.evaluate(async () => {
      window.__THREE_GAME_TEST_HOOKS__?.setState('complete');
    });

    const gameoverModal = page.locator('#gameover-modal');
    await expect(gameoverModal).toBeVisible();
    await expect(page.locator('#gameover-title')).toBeVisible();

    // Test Inspect Table action (minimizes modal to floating pill)
    const btnInspect = page.locator('#btn-gameover-inspect');
    await btnInspect.click({ force: true });
    await expect(gameoverModal).toHaveClass(/hidden/);

    const floatingPill = page.locator('#btn-reopen-gameover');
    await expect(floatingPill).toBeVisible();

    // Reopen modal from floating pill
    await floatingPill.click({ force: true });
    await expect(gameoverModal).not.toHaveClass(/hidden/);

    // Capture game-over screenshot
    const gameoverScreenshotPath = `artifacts/ui-${testInfo.project.name}-gameover.png`;
    const gameoverScreenshot = await page.screenshot({ path: gameoverScreenshotPath, fullPage: true });
    await testInfo.attach(`${testInfo.project.name}-gameover`, {
      body: gameoverScreenshot,
      contentType: 'image/png',
    });

    // 8. Responsive layout & overflow checks
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    if (isMobile) {
      // Ensure all action buttons meet minimum touch target size >= 40px
      const btnActions = page.locator('.btn-action:visible');
      const actionCount = await btnActions.count();
      for (let i = 0; i < actionCount; i++) {
        const box = await btnActions.nth(i).boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(40);
        }
      }
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
