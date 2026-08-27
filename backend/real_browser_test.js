import puppeteer from 'puppeteer-core';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { generateAccessToken } from './src/utils/token.utils.js';

dotenv.config({ path: '.env' });

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WORKSPACE_ID = '6a83663e2022fc4f8ed8fa0d';
const USER_ID = '6a5fc4cabfd266e6a43400fb';
const FRONTEND_URL = `http://localhost:5173/study/${WORKSPACE_ID}`;

async function resetDbStatus(status) {
  console.log(`[DB Setup] Setting status to ${status}...`);
  const conn = await mongoose.connect(process.env.MONGODB_URI);
  await mongoose.connection.db.collection('workshopintelligences').updateOne(
    { workspaceId: new mongoose.Types.ObjectId(WORKSPACE_ID) },
    {
      $set: {
        status,
        processedResourceCount: 0,
        error: status === 'FAILED' ? 'Simulated stale extraction failure.' : null,
        'resources.$[].status': status === 'FAILED' ? 'FAILED' : 'PENDING',
        'resources.$[].error': status === 'FAILED' ? 'Simulated failure.' : null
      }
    }
  );
  await mongoose.disconnect();
  console.log('[DB Setup] Complete.');
}

async function runTests() {
  console.log('Generating JWT Access Token for test session...');
  const token = generateAccessToken({ id: USER_ID });
  
  // ==========================================
  // TEST A: Existing FAILED state
  // ==========================================
  console.log('\n--- STARTING TEST A: Existing FAILED state ---');
  await resetDbStatus('FAILED');

  let browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  let page = await browser.newPage();
  
  // Set auth cookie
  await page.setCookie({
    name: 'accessToken',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false
  });

  const consoleLogs = [];
  const networkRequests = [];

  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[Console] ${text}`);
    console.log(`[Browser Console] ${text}`);
  });

  page.on('request', req => {
    const url = req.url();
    if (url.includes('/intelligence')) {
      const entry = `${req.method()} ${url}`;
      networkRequests.push(entry);
      console.log(`[Browser Network] ${entry}`);
    }
  });

  console.log('Navigating to workspace study mode...');
  await page.goto(FRONTEND_URL, { waitUntil: 'networkidle2' });

  console.log('Waiting for elements to load...');
  await page.waitForSelector('.tab-btn', { timeout: 15000 });

  console.log('Switching to Mind Map (mindmap) tab...');
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.tab-btn'));
    const mindmapBtn = buttons.find(b => b.textContent.toLowerCase().includes('mindmap') || b.textContent.toLowerCase().includes('mind map'));
    if (mindmapBtn) mindmapBtn.click();
  });

  console.log('Observing network requests for 15 seconds to check for duplicate/polling GETs...');
  const getCountStartA = networkRequests.filter(r => r.startsWith('GET') && r.includes('/intelligence') && !r.includes('/graph') && !r.includes('/insights')).length;
  await new Promise(r => setTimeout(r, 15000));
  const getCountEndA = networkRequests.filter(r => r.startsWith('GET') && r.includes('/intelligence') && !r.includes('/graph') && !r.includes('/insights')).length;

  console.log('\n--- TEST A Request & Log Assertions ---');
  const postRequests = networkRequests.filter(r => r.startsWith('POST'));
  console.log(`Total POST requests: ${postRequests.length}`);
  console.log(`GET requests at start of observe: ${getCountStartA}, at end: ${getCountEndA}`);

  if (postRequests.length > 0) {
    throw new Error('TEST A FAILED: A generation POST request occurred automatically on load!');
  }
  if (getCountEndA > getCountStartA) {
    throw new Error(`TEST A FAILED: Polling was active after FAILED status was received! (GET count grew from ${getCountStartA} to ${getCountEndA})`);
  }
  console.log('✔ TEST A Passed.');

  // ==========================================
  // TEST C: Rapid double click
  // ==========================================
  console.log('\n--- STARTING TEST C: Rapid double click ---');
  
  // Reset logs for Test C
  consoleLogs.length = 0;
  networkRequests.length = 0;

  console.log('Locating Retry button and clicking rapidly twice...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const retryBtn = btns.find(b => b.textContent.toLowerCase().includes('retry'));
    if (retryBtn) {
      retryBtn.click();
      retryBtn.click(); // Double click
    } else {
      console.log('Retry button not found in DOM!');
    }
  });

  // Wait 5 seconds to capture clicks
  await new Promise(r => setTimeout(r, 5000));

  console.log('\n--- TEST C Assertions ---');
  const acceptedClicks = consoleLogs.filter(l => l.includes('retry click accepted'));
  const ignoredClicks = consoleLogs.filter(l => l.includes('retry click ignored'));
  const postGenCount = networkRequests.filter(r => r.includes('/extract') && r.startsWith('POST')).length;

  console.log(`Accepted clicks logged: ${acceptedClicks.length}`);
  console.log(`Ignored clicks logged: ${ignoredClicks.length}`);
  console.log(`POST extract requests: ${postGenCount}`);

  if (acceptedClicks.length !== 1 || ignoredClicks.length === 0) {
    throw new Error(`TEST C FAILED: Expected exactly 1 accepted click and at least 1 ignored click. Got accepted=${acceptedClicks.length}, ignored=${ignoredClicks.length}`);
  }
  console.log('✔ TEST C Passed.');

  // ==========================================
  // TEST B: Retry Flow
  // ==========================================
  console.log('\n--- STARTING TEST B: Retry Flow ---');
  console.log('Waiting for extraction to proceed. Monitoring logs until status transitions to terminal...');
  
  // Wait up to 90 seconds for terminal state to be reached in the background
  let isDone = false;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const terminalLogs = consoleLogs.filter(l => l.includes('terminal state='));
    if (terminalLogs.length > 0) {
      console.log(`Detected terminal state transition: ${terminalLogs[0]}`);
      isDone = true;
      break;
    }
  }

  if (!isDone) {
    console.log('Warning: Timeout waiting for real background extraction to finish. Proceeding to assertions.');
  }

  // Observe for 15 additional seconds after terminal state to verify NO extra GETs are scheduled
  console.log('Observing for 15 seconds after terminal detection to confirm zero additional requests...');
  const netCountBeforeObserve = networkRequests.length;
  await new Promise(r => setTimeout(r, 15000));

  const newNetRequests = networkRequests.slice(netCountBeforeObserve).filter(r => r.startsWith('GET') && r.includes('/intelligence') && !r.includes('/graph') && !r.includes('/insights'));
  console.log(`New requests scheduled after terminal state: ${newNetRequests.length}`);
  if (newNetRequests.length > 0) {
    throw new Error(`TEST B FAILED: GET requests were scheduled after terminal state was reached: ${newNetRequests.join(', ')}`);
  }
  console.log('✔ TEST B Passed: Polling stopped permanently after terminal state.');

  // ==========================================
  // TEST D: Refresh while PROCESSING
  // ==========================================
  console.log('\n--- STARTING TEST D: Refresh while PROCESSING ---');
  await resetDbStatus('PROCESSING');
  
  consoleLogs.length = 0;
  networkRequests.length = 0;

  console.log('Reloading page with status set to PROCESSING...');
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.tab-btn', { timeout: 15000 });

  // Switch to mindmap
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.tab-btn'));
    const mindmapBtn = buttons.find(b => b.textContent.toLowerCase().includes('mindmap') || b.textContent.toLowerCase().includes('mind map'));
    if (mindmapBtn) mindmapBtn.click();
  });

  console.log('Waiting 10 seconds to observe polling...');
  await new Promise(r => setTimeout(r, 10000));

  const postCountD = networkRequests.filter(r => r.startsWith('POST')).length;
  const getCountD = networkRequests.filter(r => r.startsWith('GET') && r.includes('/intelligence') && !r.includes('/graph') && !r.includes('/insights')).length;
  console.log(`POST requests after refresh (should be 0): ${postCountD}`);
  console.log(`GET requests after refresh (should be > 1 due to active polling): ${getCountD}`);

  if (postCountD > 0) {
    throw new Error('TEST D FAILED: A generation POST request was triggered by page refresh initialization!');
  }
  if (getCountD <= 1) {
    throw new Error('TEST D FAILED: Polling was not resumed when status was PROCESSING!');
  }
  console.log('✔ TEST D Passed.');

  // ==========================================
  // TEST E: Refresh after FAILED
  // ==========================================
  console.log('\n--- STARTING TEST E: Refresh after FAILED ---');
  await resetDbStatus('FAILED');

  consoleLogs.length = 0;
  networkRequests.length = 0;

  console.log('Reloading page with status set to FAILED...');
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForSelector('.tab-btn', { timeout: 15000 });

  // Switch to mindmap
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('.tab-btn'));
    const mindmapBtn = buttons.find(b => b.textContent.toLowerCase().includes('mindmap') || b.textContent.toLowerCase().includes('mind map'));
    if (mindmapBtn) mindmapBtn.click();
  });

  console.log('Observing requests for 15 seconds to verify no active polling loop...');
  const getCountStartE = networkRequests.filter(r => r.startsWith('GET') && r.includes('/intelligence') && !r.includes('/graph') && !r.includes('/insights')).length;
  await new Promise(r => setTimeout(r, 15000));
  const getCountEndE = networkRequests.filter(r => r.startsWith('GET') && r.includes('/intelligence') && !r.includes('/graph') && !r.includes('/insights')).length;

  console.log(`POST requests after refresh (should be 0): ${networkRequests.filter(r => r.startsWith('POST')).length}`);
  console.log(`GET requests at start of observe: ${getCountStartE}, at end: ${getCountEndE}`);

  if (networkRequests.filter(r => r.startsWith('POST')).length > 0) {
    throw new Error('TEST E FAILED: A generation POST request occurred on load!');
  }
  if (getCountEndE > getCountStartE) {
    throw new Error(`TEST E FAILED: Polling continues in a loop after page reload! (GET count grew from ${getCountStartE} to ${getCountEndE})`);
  }
  console.log('✔ TEST E Passed.');

  await browser.close();
  console.log('\n====================================================');
  console.log('ALL REAL BROWSER INTEGRATION LIFECYCLE TESTS PASSED!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ LIFECYCLE TESTS FAILED:', err);
  process.exit(1);
});
