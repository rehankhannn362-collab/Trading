import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

// Start Chrome with remote debugging
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9222;
const chromeProcess = spawn(chromePath, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=1600,900',
  'http://localhost:5173'
]);

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getWsUrl() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const json = await res.json();
      return json.webSocketDebuggerUrl;
    } catch (e) {
      await wait(200);
    }
  }
  throw new Error('Chrome did not start');
}

async function run() {
  try {
    const wsUrl = await getWsUrl();
    console.log('Connected to Chrome CDP:', wsUrl);

    // Get list of targets (pages)
    const targetsRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page');
    console.log('Page Target URL:', pageTarget.url);

    // Connect WebSocket to page
    const ws = new globalThis.WebSocket(pageTarget.webSocketDebuggerUrl);

    let id = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
      const msgId = id++;
      const handler = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

    await new Promise(r => ws.addEventListener('open', r));
    console.log('WS connected to page');

    // Enable Runtime and Console
    await send('Runtime.enable');
    await send('Console.enable');

    ws.addEventListener('message', (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.method === 'Runtime.consoleAPICalled') {
        console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
      }
    });

    // Wait 4 seconds for page to render and ticks to arrive
    await wait(4000);

    // Evaluate in page: submit a limit buy order slightly below mark price
    const orderRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          // Find price and quantity inputs
          const inputs = Array.from(document.querySelectorAll('input'));
          const priceInput = inputs.find(i => i.placeholder === '0.00' || i.value === '65000' || i.type === 'number');
          const qtyInput = inputs.find(i => i.placeholder?.includes('Min:'));

          // Read current mark price
          const markPriceEl = document.querySelector('[class*="text-2xl"]');
          const markPrice = markPriceEl ? parseFloat(markPriceEl.innerText.replace(/[^0-9.]/g, '')) : 65800;
          const limitPrice = Math.floor(markPrice - 10);

          function setReactInput(input, val) {
            const proto = window.HTMLInputElement.prototype;
            const desc = Object.getOwnPropertyDescriptor(proto, 'value');
            desc.set.call(input, val);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }

          if (priceInput) {
            setReactInput(priceInput, limitPrice.toString());
          }
          if (qtyInput) {
            setReactInput(qtyInput, '0.05');
          }

          await new Promise(r => setTimeout(r, 200));

          // Click Buy button
          const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('BUY / LONG'));
          if (submitBtn) {
            submitBtn.click();
            return { placed: true, limitPrice, markPrice };
          }
          return { placed: false };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Order Placement Result:', orderRes.result.value);

    // Wait 2 seconds
    await wait(2000);

    // Place a Market Buy order to create an open position
    const marketOrderRes = await send('Runtime.evaluate', {
      expression: `
        (async () => {
          // Switch to Market tab
          const marketTabBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === 'Market');
          if (marketTabBtn) marketTabBtn.click();

          await new Promise(r => setTimeout(r, 200));

          const inputs = Array.from(document.querySelectorAll('input'));
          const qtyInput = inputs.find(i => i.placeholder?.includes('Min:'));

          function setReactInput(input, val) {
            const proto = window.HTMLInputElement.prototype;
            const desc = Object.getOwnPropertyDescriptor(proto, 'value');
            desc.set.call(input, val);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }

          if (qtyInput) {
            setReactInput(qtyInput, '0.02');
          }

          await new Promise(r => setTimeout(r, 200));

          const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('BUY / LONG'));
          if (submitBtn) {
            submitBtn.click();
            return { marketOrderPlaced: true };
          }
          return { marketOrderPlaced: false };
        })()
      `,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Market Order Placement:', marketOrderRes.result.value);

    // Wait 3 seconds for position to update and chart lines to render
    await wait(3000);

    // Switch to SOL/USDT to verify SOL chart rendering
    const switchMarketRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const buttons = Array.from(document.querySelectorAll('header button'));
          const solBtn = buttons.find(b => b.innerText.includes('SOL'));
          if (solBtn) {
            solBtn.click();
            return { switched: true, text: solBtn.innerText };
          }
          return { switched: false, buttons: buttons.map(b => b.innerText) };
        })()
      `,
      returnByValue: true
    });
    console.log('Switch to SOL/USDT:', switchMarketRes.result.value);

    // Wait 3 seconds for SOL chart to load
    await wait(3000);

    const solScreenshot = await send('Page.captureScreenshot', { format: 'png' });
    const solOutPath = 'C:\\Users\\shirin\\.gemini\\antigravity\\brain\\2bdf69fe-5852-4c8a-9cfb-4d4b45d534b5\\live_screenshot_sol.png';
    fs.writeFileSync(solOutPath, Buffer.from(solScreenshot.data, 'base64'));
    console.log('SOL Screenshot saved to:', solOutPath);

    ws.close();
  } catch (err) {
    console.error('Error running test:', err);
  } finally {
    chromeProcess.kill();
    process.exit(0);
  }
}

run();
