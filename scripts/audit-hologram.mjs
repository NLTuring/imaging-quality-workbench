import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Reproducible browser audit; all images in this run are the bundled synthetic sample.
const rendererMode = process.env.HL_RENDERER === 'software' ? 'software' : 'native';
const baseURL = process.env.HL_BASE_URL || 'http://127.0.0.1:5173';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.resolve('artifacts/hologram/audit', `${rendererMode}-${stamp}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', args: rendererMode === 'software' ? ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [], failedResources = [], fpsSamples = [], layouts = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('404')) errors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) failedResources.push({ status: response.status(), url: response.url() }); });
const capture = name => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
try {
  await page.goto(`${baseURL}/#hologram`);
  await expect(page.getByTestId('render-stats')).toContainText('FPS');
  const renderer = await page.locator('canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2'), info = gl.getExtension('WEBGL_debug_renderer_info');
    return { name: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), canvas: [canvas.width, canvas.height], dpr: devicePixelRatio, viewport: [innerWidth, innerHeight] };
  });
  await page.getByTestId('hologram-lab').evaluate(lab => {
    window.__auditStages = [{ stage: lab.dataset.stage, ms: performance.now() }];
    new MutationObserver(() => window.__auditStages.push({ stage: lab.dataset.stage, ms: performance.now() })).observe(lab, { attributes: true, attributeFilter: ['data-stage'] });
  });
  await capture('stage-0');
  await page.getByRole('button', { name: '载入演示影像', exact: true }).click();
  await page.getByRole('button', { name: '开始扫描', exact: true }).click();
  await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage', '2'); await capture('stage-2');
  await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage', '4'); await capture('stage-4');
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    fpsSamples.push({ hud: await page.getByTestId('render-stats').innerText(), quality: await page.getByTestId('hologram-lab').getAttribute('data-quality') });
  }
  if (rendererMode === 'native') for (const [width, height] of [[1920,1080],[1366,768],[1024,768],[390,844],[320,740]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect.poll(async () => {
      const viewport = await page.locator('canvas').boundingBox();
      const label = await page.locator('.hl-organ-label').boundingBox();
      return label.x + label.width <= viewport.x + viewport.width + 1;
    }).toBe(true);
    const dimensions = await page.locator('canvas').boundingBox();
    const label = await page.locator('.hl-organ-label').boundingBox();
    layouts.push({ width, height, canvas: dimensions, labelRight: label.x + label.width, horizontalOverflow: false });
    await capture(`layout-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '进入解剖模式', exact: true }).click();
  await page.getByLabel('切片深度', { exact: true }).fill('0.5'); await page.waitForTimeout(200); await capture('stage-5-slice');
  await page.getByLabel('切片深度', { exact: true }).fill('0');
  await page.getByLabel('器官展开', { exact: true }).fill('0.8'); await page.waitForTimeout(800); await capture('stage-5-explode');
  for (const button of await page.getByTestId('discover-lesion').all()) await button.click();
  await expect(page.getByTestId('completion-summary')).toBeVisible(); await page.waitForTimeout(650); await capture('stage-5-complete');
  const stages = await page.evaluate(() => window.__auditStages);
  expect(errors).toEqual([]);
  const report = { capturedAt: new Date().toISOString(), baseURL, browser: browser.version(), rendererMode, renderer, fpsSamples, stages, layouts, errors, failedResources, output };
  await writeFile(path.join(output, 'audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
