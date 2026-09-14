import assert from 'node:assert/strict';
import { resolve } from 'node:path';
export async function checkSessionRefresh({ page, errors, output, consoleWarnings }) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByText('Welcome home, alice.', { exact: true }).waitFor();
  const skip = page.getByRole('button', { name: 'Skip to my palace', exact: true }); if (await skip.isVisible()) await skip.click();
  await page.waitForFunction(() => window.__phase10.connected());
  const before = await page.evaluate(() => ({ ...window.__sessionMetrics }));
  for (let i = 0; i < 30; i++) { await page.evaluate(() => window.__phase10.refreshTransport()); await page.waitForTimeout(40); }
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => window.__sessionMetrics);
  assert.equal(after.sockets, before.sockets, 'render updates restarted the account socket');
  assert.equal(after.forced, 0, 'sockets bypassed the SDK token cache');
  assert.ok(after.reads - before.reads < 3, 'render updates caused authentication traffic');
  await page.evaluate(() => window.__phase10.setScreen('world'));
  await page.getByTestId('infinity-actions').scrollIntoViewIfNeeded();
  await page.getByTestId('infinity-actions').screenshot({ path: resolve(output, '01-celestial-actions.png') });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByTestId('infinity-actions').screenshot({ path: resolve(output, '02-celestial-actions-phone.png') });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const label of ['Explore sample stars', 'My shared lights', 'Refresh the sky']) {
    const rect = await page.getByRole('button', { name: label, exact: true }).boundingBox(); assert.ok(rect.height >= 44 && rect.height <= 48);
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(consoleWarnings.filter(message => /tintColor|pointerEvents/.test(message)), []);
  console.log('Session refresh checks passed: actual useSessionToken with an unstable Expo-shaped SDK wrapper, 30 parent renders without socket restart or forced refresh; compact celestial controls and no image/pointer deprecation warnings.');
}
