import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.EDU_UX_PORT || 4182);
const dbPath = path.join(root, 'storage', 'ux-edu-libai.sqlite');
const screenshotDir = path.join(root, 'artifacts', 'ux-checks');
const sessionKey = 'enter-dream-libai-edu-session';

for (const suffix of ['', '-shm', '-wal']) {
  const file = `${dbPath}${suffix}`;
  if (existsSync(file)) rmSync(file, { force: true });
}
if (existsSync(screenshotDir)) rmSync(screenshotDir, { recursive: true, force: true });
mkdirSync(screenshotDir, { recursive: true });

const child = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    EDU_PORT: String(port),
    EDU_DB_PATH: 'storage/ux-edu-libai.sqlite',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  output += chunk.toString();
});

try {
  await waitForHealth(port);
  const poems = await apiGet('/api/edu/poems');
  const first = poems.poems[0];
  assert(first?.id && first?.lesson_id, 'seeded poem has lesson');
  const studentSession = await login({ userId: 'student-demo' });
  const teacherSession = await login({ role: 'teacher' });
  const adminSession = await login({ role: 'admin' });

  const browser = await chromium.launch();
  const findings = [];
  try {
    await checkRoute(browser, studentSession, '/', 'redirect-home', ['入梦李白教育版', '进入教材目录'], findings);
    await checkRoute(browser, studentSession, '/edu/catalog', 'desktop-catalog', ['教材目录', first.title], findings);
    await checkRoute(browser, studentSession, `/edu/poems/${first.id}`, 'desktop-poem', ['学习目标', '问诗人'], findings);
    await checkRoute(browser, studentSession, `/edu/learn/${first.lesson_id}`, 'desktop-learn', ['360°诗境', '问诗人'], findings);
    await checkRoute(browser, studentSession, '/edu/graph', 'desktop-graph', ['诗词星图', '主题'], findings);
    await checkRoute(browser, studentSession, '/edu/profile', 'desktop-profile', ['我的学习记录', '待复习'], findings);
    await checkRoute(browser, teacherSession, '/edu/teacher', 'desktop-teacher', ['教师工作台', '创建班级'], findings);
    await checkRoute(browser, adminSession, '/edu/admin/content/poems', 'desktop-admin', ['内容管理后台', '诗词管理'], findings);
    await checkRoute(browser, studentSession, '/edu', 'mobile-home', ['入梦李白教育版', '开始入梦学习'], findings, { width: 390, height: 844 });
  } finally {
    await browser.close();
  }
  if (findings.length) {
    throw new Error(`UX check failed:\n${findings.map((item) => `- ${item}`).join('\n')}`);
  }
  console.log(JSON.stringify({
    ok: true,
    screenshots: screenshotDir,
    checkedRoutes: 9,
    firstPoem: first.title,
  }, null, 2));
} finally {
  child.kill('SIGTERM');
}

async function checkRoute(browser, session, route, name, expectedTexts, findings, viewport = { width: 1440, height: 950 }) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, { key: sessionKey, value: session });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message);
  });
  try {
    const response = await page.goto(`http://127.0.0.1:${port}${route}`, { waitUntil: 'networkidle' });
    if (!response?.ok()) findings.push(`${name}: page response ${response?.status() || 'missing'}`);
    await page.waitForSelector('.edu-app', { timeout: 8_000 });
    const text = await page.locator('body').innerText();
    for (const expected of expectedTexts) {
      if (!text.includes(expected)) findings.push(`${name}: missing text ${expected}`);
    }
    if (text.includes('加载失败') || text.includes('请求失败')) findings.push(`${name}: visible error text`);
    if (name.includes('learn')) {
      await page.waitForSelector('.panorama-stage__viewer .pnlm-ui', { timeout: 10_000 });
      const hotspots = await page.locator('.dream-hotspot').count();
      if (hotspots < 1) findings.push(`${name}: panorama hotspots missing`);
      if (hotspots > 0) {
        await page.keyboard.press('1');
        await page.waitForTimeout(650);
        await page.keyboard.press('Space');
        await page.waitForSelector('.world-question-panel', { timeout: 5_000 });
        const panelText = await page.locator('.world-question-panel').innerText();
        if (!panelText.includes('记录理解')) findings.push(`${name}: in-world question panel missing`);
      }
    }
    if (consoleErrors.length) findings.push(`${name}: console errors ${consoleErrors.join(' | ')}`);
    await page.screenshot({ path: path.join(screenshotDir, `${name}.png`), fullPage: true });
  } finally {
    await context.close();
  }
}

async function waitForHealth(targetPort) {
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    try {
      const response = await fetch(`http://127.0.0.1:${targetPort}/api/edu/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  throw new Error(`教育版服务启动超时:\n${output}`);
}

async function apiGet(pathname) {
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${pathname}: ${payload.error || response.status}`);
  return payload;
}

async function login(body) {
  const response = await fetch(`http://127.0.0.1:${port}/api/edu/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`login: ${payload.error || response.status}`);
  return payload.session;
}

function assert(value, label) {
  if (!value) throw new Error(`UX check failed: ${label}`);
}
