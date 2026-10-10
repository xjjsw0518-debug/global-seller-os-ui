import { chromium } from 'file:///C:/Users/DELL/Documents/Codex/2026-09-30/task/qa/playwright-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
const out='C:/Users/DELL/Documents/Codex/2026-09-30/task-5';
const browser=await chromium.launch();
const results=[];
for (const width of [1440,1920,2560]) {
  const page=await browser.newPage({viewport:{width,height:1080}});
  const errors=[],unexpected=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:5173')&&!r.url().startsWith('ws://127.0.0.1:5173')&&!r.url().startsWith('blob:'))unexpected.push(r.url())});
  await page.goto('http://127.0.0.1:5173/infrastructure/workers',{waitUntil:'domcontentloaded'});
  const row=page.locator('tr').filter({hasText:'IDN-BTM-001'});
  await row.locator('.remote-link').click();
  await page.locator('.resource-drawer').waitFor();
  const statuses=await page.locator('.resource-drawer .drawer-grid').innerText();
  await page.screenshot({path:`${out}/w49-before-${width}.png`});
  results.push({width,statuses,errors,unexpected});
  await page.close();
}
await browser.close();
await fs.writeFile(`${out}/w49-before.json`,JSON.stringify({capturedAt:new Date().toISOString(),results},null,2));
console.log(JSON.stringify(results,null,2));
