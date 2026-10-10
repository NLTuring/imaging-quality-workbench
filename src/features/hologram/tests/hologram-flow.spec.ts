import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test('uploaded pixels pass through scan, inspection, exposed discovery and reset', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: '全息解剖台', exact: true }).click({ timeout: 5000 });
  const lab = page.getByTestId('hologram-lab');
  await page.getByLabel('上传影像并扫描', { exact: true }).setInputFiles(fileURLToPath(new URL('../../../assets/demo-chest.png', import.meta.url)));
  await expect(lab).toHaveAttribute('data-stage', '4', { timeout: 30000 });
  await expect(page.getByTestId('image-contrast')).not.toHaveText('—');
  await page.getByRole('button', { name: '进入解剖模式', exact: true }).click();
  await expect(lab).toHaveAttribute('data-stage', '5');
  const findings = page.getByTestId('discover-lesion');
  expect(await findings.count()).toBeGreaterThan(0);
  await expect(findings.first()).toBeDisabled();
  await page.getByLabel('器官展开').fill('0.75');
  for (const button of await findings.all()) await button.click();
  await expect(page.getByTestId('completion-summary')).toBeVisible();
  await page.getByRole('button', { name: '重新扫描', exact: true }).click();
  await expect(lab).toHaveAttribute('data-stage', '0');
  expect(errors).toEqual([]);
});

test('opens a separate lab and can return without modifying report storage', async ({ page }) => {
  await page.goto('/');
  const before = await page.evaluate(() => localStorage.getItem('imaging-quality-v1'));
  await page.getByRole('button', { name: '全息解剖台', exact: true }).click({ timeout: 5000 });
  await expect(page.getByRole('heading', { name: '全息医学影像解剖台' })).toBeVisible();
  await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage', '0');
  await expect(page.getByText('程序化演示 · 非临床使用', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '返回工作台', exact: true }).click();
  await expect(page.getByRole('heading', { name: '今日质量现场' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('imaging-quality-v1'))).toBe(before);
});
