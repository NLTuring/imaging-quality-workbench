import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const fixture = fileURLToPath(new URL('../../../assets/demo-chest.png', import.meta.url));

async function openLab(page: Page) {
  await page.goto('/#hologram');
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByTestId('render-stats')).toContainText('FPS');
}
async function scan(page: Page) {
  await page.getByLabel('上传影像并扫描', { exact: true }).setInputFiles(fixture);
  await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage', '4');
}
async function sceneState(page: Page) {
  return page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => /\/(@react-three_fiber|@react-three\/fiber)/.test(name));
    if (!url) throw new Error('R3F module has not loaded');
    const { _roots } = await import(/* @vite-ignore */ url);
    const canvas = document.querySelector('canvas')!;
    const { scene, camera, controls, gl } = _roots.get(canvas).store.getState();
    const rect = canvas.getBoundingClientRect();
    const lesions: { x: number; y: number }[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((mesh: any) => {
      if (mesh.isMesh && mesh.geometry.type === 'IcosahedronGeometry') {
        const point = mesh.getWorldPosition(mesh.position.clone()).project(camera);
        lesions.push({ x: rect.left + (point.x + 1) * rect.width / 2, y: rect.top + (1 - point.y) * rect.height / 2 });
      }
    });
    return { lesions, position: camera.position.toArray(), target: controls.target.toArray(), geometries: gl.info.memory.geometries, textures: gl.info.memory.textures };
  });
}

test('a visible 3D lesion can be clicked through its transparent organ shell', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await openLab(page); await scan(page);
  await page.getByRole('button', { name: '进入解剖模式', exact: true }).click();
  await page.getByLabel('器官展开', { exact: true }).fill('0.8');
  await expect.poll(async () => (await sceneState(page)).lesions.length).toBeGreaterThan(0);
  const point = (await sceneState(page)).lesions[0]; await page.mouse.click(point.x, point.y);
  await expect(page.locator('[data-testid="discover-lesion"].is-found')).toHaveCount(1, {timeout:3000});
});

test('orbit rotation, wheel zoom, right-button pan and reset change the actual camera', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await openLab(page); await scan(page);
  const original = await sceneState(page); const rect = (await page.locator('canvas').boundingBox())!;
  const x = rect.x + rect.width * 0.7, y = rect.y + rect.height * 0.55;
  await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x+80,y+30,{steps:6}); await page.mouse.up();
  await expect.poll(async()=> (await sceneState(page)).position).not.toEqual(original.position);
  const rotated = await sceneState(page); await page.mouse.wheel(0,-250);
  await expect.poll(async()=> (await sceneState(page)).position).not.toEqual(rotated.position);
  await page.mouse.down({button:'right'}); await page.mouse.move(x+20,y+80,{steps:6}); await page.mouse.up({button:'right'});
  await expect.poll(async()=> (await sceneState(page)).target).not.toEqual(original.target);
  await page.getByRole('button',{name:'重置视角',exact:true}).click();
  await expect.poll(async()=> (await sceneState(page)).position.map((n:number)=>n.toFixed(3))).toEqual(original.position.map((n:number)=>n.toFixed(3)));
});

test('reset closes audio and releases image URLs and worker resources', async ({ page }) => {
  await page.addInitScript(() => {
    const state = { urls: new Set<string>(), workers:0, audioCreated:0, audioClosed:0 }; (window as any).__resources = state;
    const create=URL.createObjectURL.bind(URL), revoke=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=blob=>{const url=create(blob);state.urls.add(url);return url;};URL.revokeObjectURL=url=>{state.urls.delete(url);revoke(url);};
    const NativeWorker=Worker; window.Worker=class extends NativeWorker { live=true; constructor(...args:ConstructorParameters<typeof Worker>){super(...args);state.workers++;} terminate(){if(this.live){state.workers--;this.live=false;}super.terminate();} };
    const NativeAudio=AudioContext; window.AudioContext=class extends NativeAudio { constructor(...args:ConstructorParameters<typeof AudioContext>){super(...args);state.audioCreated++;} async close(){await super.close();state.audioClosed++;} };
  });
  await page.emulateMedia({ reducedMotion:'reduce' }); await openLab(page);
  expect(await page.evaluate(()=>(window as any).__resources.audioCreated)).toBe(0);
  await page.getByRole('button',{name:'开启声音',exact:true}).click(); await scan(page);
  await page.getByRole('button',{name:'重新扫描',exact:true}).click();
  await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage','0');
  await expect.poll(()=>page.evaluate(()=>{const r=(window as any).__resources;return {urls:r.urls.size,workers:r.workers,audioCreated:r.audioCreated,audioClosed:r.audioClosed};}),{timeout:3000}).toEqual({urls:0,workers:0,audioCreated:1,audioClosed:1});
  await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-audio','off');
});

test('PNG thumbnail drag and JPEG file drop stay local and preserve report storage',async({page})=>{
  const outgoing:string[]=[];page.on('request',request=>{if(!['GET','HEAD'].includes(request.method()))outgoing.push(`${request.method()} ${request.url()}`);});
  await page.emulateMedia({reducedMotion:'reduce'});await openLab(page);
  const before=await page.evaluate(()=>JSON.stringify(localStorage));expect(before).toContain('imaging-quality-v1');
  await page.getByRole('button',{name:'载入演示影像',exact:true}).click();
  const chip=page.getByTestId('image-chip');await expect(chip).toBeVisible();
  const a=(await chip.boundingBox())!,b=(await page.getByTestId('scanner-upload').boundingBox())!;
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:20});await page.mouse.up();
  await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage','4');
  await expect(page.locator('.hl-image-ghost')).not.toBeVisible();
  await page.getByRole('button',{name:'重新扫描',exact:true}).click();await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage','0');
  const transfer=await page.evaluateHandle(async()=>{
    const canvas=document.createElement('canvas');canvas.width=16;canvas.height=16;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#a0a0a0';ctx.fillRect(0,0,16,16);
    const blob=await new Promise<Blob>(resolve=>canvas.toBlob(blob=>resolve(blob!),'image/jpeg'));
    const dt=new DataTransfer();dt.items.add(new File([blob],'synthetic-gray.jpg',{type:'image/jpeg'}));return dt;
  });
  await page.locator('.hl-scene-wrap').dispatchEvent('drop',{dataTransfer:transfer});await transfer.dispose();
  await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage','4');
  await expect(page.getByTestId('image-contrast')).toHaveText('0.000');
  expect(outgoing).toEqual([]);expect(await page.evaluate(()=>JSON.stringify(localStorage))).toBe(before);
});

test('invalid files cannot start a scan and valid retry succeeds',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await openLab(page);
  await page.getByLabel('上传影像并扫描',{exact:true}).setInputFiles({name:'forged.png',mimeType:'image/png',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')});
  await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage','0');
  await scan(page);await expect(page.getByRole('alert')).toHaveCount(0);
});

test('skip does not discover lesions and cancelled timelines cannot resume stale stages',async({page})=>{
  await openLab(page);await page.getByLabel('上传影像并扫描',{exact:true}).setInputFiles(fixture);
  await page.getByRole('button',{name:'跳过动画',exact:true}).click();await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage','4');
  await page.getByRole('button',{name:'进入解剖模式',exact:true}).click();expect(await page.locator('.hl-finding.is-found').count()).toBe(0);
  await page.getByRole('button',{name:'重新扫描',exact:true}).click();await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage','0');
  await page.getByLabel('上传影像并扫描',{exact:true}).setInputFiles(fixture);
  await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage','2');await page.getByRole('button',{name:'取消扫描',exact:true}).click();
  await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage','0');
  await page.waitForTimeout(5600);await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage','0');
});

test('all four organs render, slice, explode and reset without growing GPU allocations',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404'))errors.push(message.text());});
  await openLab(page);await page.getByLabel('渲染质量',{exact:true}).selectOption('low');
  // Warm persistent scanner/DNA/sweep geometry before comparing per-run allocations.
  // Three uploads invisible shared geometry lazily, so cold-vs-warm counts are not a leak test.
  await scan(page);await page.getByRole('button',{name:'重新扫描',exact:true}).click();
  await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage','0');
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(250);
  const baseline=await sceneState(page);
  const samples=[];
  for(const organ of ['lungs','heart','liver','brain']){
    await page.getByLabel('观察器官',{exact:true}).selectOption(organ);await scan(page);
    await page.screenshot({path:`artifacts/hologram/audit/organ-${organ}.png`});
    await page.getByRole('button',{name:'进入解剖模式',exact:true}).click();await page.getByLabel('切片深度',{exact:true}).fill('0.55');
    await page.getByLabel('器官展开',{exact:true}).fill('0.8');await page.getByLabel('切片深度',{exact:true}).fill('1');
    await expect(page.getByTestId('discover-lesion').first()).toBeDisabled();
    await page.getByRole('button',{name:'重新扫描',exact:true}).click();await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-stage','0');
    await expect.poll(async()=>(await sceneState(page)).textures).toBeLessThanOrEqual(baseline.textures);
    await expect.poll(async()=>(await sceneState(page)).geometries).toBeLessThanOrEqual(baseline.geometries);
    samples.push({organ,...await sceneState(page)});
  }
  expect(errors).toEqual([]);await test.info().attach('gpu-allocations',{body:JSON.stringify({baseline,samples},null,2),contentType:'application/json'});
});

test('WebGL loss shows an honest fallback while local image statistics remain available',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await openLab(page);
  await page.locator('canvas').evaluate(canvas=>(canvas as HTMLCanvasElement).getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
  await expect(page.getByTestId('webgl-fallback')).toBeVisible();await scan(page);
  await expect(page.getByTestId('render-stats')).toHaveText('3D UNAVAILABLE');await expect(page.getByTestId('image-contrast')).not.toHaveText('—');
  await page.getByRole('button',{name:'返回工作台',exact:true}).click();await page.getByRole('button',{name:'全息解剖台',exact:true}).click();
  await expect(page.locator('canvas')).toBeVisible();await expect(page.getByTestId('webgl-fallback')).toHaveCount(0);
});

test.describe('touch layout',()=>{
  test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  test('narrow layout stays within viewport and controls offer 44px targets',async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});await openLab(page);await scan(page);
    const canvasRect=(await page.locator('canvas').boundingBox())!;
    const labelRect=(await page.locator('.hl-organ-label').boundingBox())!;
    expect(labelRect.x+labelRect.width).toBeLessThanOrEqual(canvasRect.x+canvasRect.width);
    const broken=await page.locator('.hl-toolbar').evaluate(element=>Array.from(element.querySelectorAll('button,label')).flatMap(el=>Array.from(el.childNodes).filter(node=>node.nodeType===Node.TEXT_NODE&&node.textContent?.trim()).filter(node=>{const range=document.createRange();range.selectNodeContents(node);return range.getClientRects().length>1;}).map(node=>node.textContent)));
    expect(broken).toEqual([]);
    await page.getByRole('button',{name:'进入解剖模式',exact:true}).click();
    await expect(page.getByTestId('hologram-lab')).toHaveAttribute('data-quality','low');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const short=await page.locator('.hl-lab button:visible:not(:disabled),.hl-lab select:visible:not(:disabled),.hl-lab input[type=range]:visible').evaluateAll(elements=>elements.filter(element=>element.getBoundingClientRect().height<44).map(element=>({label:element.textContent||element.getAttribute('aria-label'),height:element.getBoundingClientRect().height})));
    expect(short).toEqual([]);
    await page.screenshot({path:'artifacts/hologram/audit/mobile.png',fullPage:true});
  });
});
