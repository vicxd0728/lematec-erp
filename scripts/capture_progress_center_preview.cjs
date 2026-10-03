const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const root = path.join(__dirname, '..');
const output = path.join(root, 'output');
const profile = path.join(output, `progress-cdp-profile-${process.pid}`);
const browser = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const child = spawn(browser, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForPort() {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100; attempt++) {
    if (fs.existsSync(portFile)) return Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
    await delay(100);
  }
  throw new Error('Chrome DevTools did not start');
}

async function main() {
  const port = await waitForPort();
  const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const page = pages.find(item => item.type === 'page');
  if (!page) throw new Error('No Chrome page target');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  };
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  await command('Page.enable');
  const url = pathToFileURL(path.join(output, 'progress-center-preview.html')).href;
  for (const [label, width, height] of [['desktop', 1440, 1600], ['mobile', 390, 2200]]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: label === 'mobile' });
    await command('Page.navigate', { url });
    await delay(500);
    const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const target = path.join(output, `progress-center-${label}-cdp.png`);
    fs.writeFileSync(target, Buffer.from(shot.data, 'base64'));
    console.log(target);
    await command('Runtime.evaluate', { expression: "document.querySelectorAll('.preview-section')[1].scrollIntoView()" });
    await delay(150);
    const supplyShot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const supplyTarget = path.join(output, `progress-center-supply-${label}-cdp.png`);
    fs.writeFileSync(supplyTarget, Buffer.from(supplyShot.data, 'base64'));
    console.log(supplyTarget);
  }
  socket.close();
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => child.kill());
