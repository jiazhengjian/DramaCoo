/**
 * Horizontal layout contract. Uses only local UI fixtures; every API request is
 * intercepted and non-GET requests are rejected. No model or user data is used.
 *
 * Run from frontend: node scripts/layout-audit.mjs
 * Optional: UI_BASE_URL, UI_BROWSER_CHANNEL, LAYOUT_WIDTHS=390,1512,
 * LAYOUT_ROUTES=home,character_design, LAYOUT_LENGTHS=short,long,
 * LAYOUT_SIDEBARS=open,closed, LAYOUT_REPORT=/tmp/layout-results.json.
 * Optional representative screenshots: LAYOUT_SCREENSHOTS_DIR=/tmp/layout-shots.
 * Screenshot filters: LAYOUT_SCREENSHOT_WIDTHS=390,1512,
 * LAYOUT_SCREENSHOT_ROUTES=home,projects,character_design,
 * LAYOUT_SCREENSHOT_SIDEBARS=open, LAYOUT_SCREENSHOT_LENGTHS=short,long,
 * LAYOUT_SCREENSHOT_PHASES=top,bottom (also supports dialog). Use * for all.
 */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const base = process.env.UI_BASE_URL || 'http://127.0.0.1:3004';
const reportPath = process.env.LAYOUT_REPORT || '/tmp/DramaCoo-layout-audit/results.json';
const widths = (process.env.LAYOUT_WIDTHS || '320,390,768,1024,1512,1920').split(',').map(Number);
const sidebarStates = (process.env.LAYOUT_SIDEBARS || 'open,closed').split(',').map(value => value === 'open');
const lengths = (process.env.LAYOUT_LENGTHS || 'short,long').split(',');
const selectedRoutes = process.env.LAYOUT_ROUTES?.split(',');
const screenshotsDir = process.env.LAYOUT_SCREENSHOTS_DIR;
const screenshotFilters = {
  widths: (process.env.LAYOUT_SCREENSHOT_WIDTHS || '390,1512').split(','),
  routes: (process.env.LAYOUT_SCREENSHOT_ROUTES || 'home,projects,character_design').split(','),
  sidebars: (process.env.LAYOUT_SCREENSHOT_SIDEBARS || 'open').split(','),
  lengths: (process.env.LAYOUT_SCREENSHOT_LENGTHS || 'short,long').split(','),
  phases: (process.env.LAYOUT_SCREENSHOT_PHASES || 'top,bottom').split(','),
};
const stageIds = ['script_generation', 'character_design', 'storyboard', 'reference_generation', 'video_generation', 'post_production'];
const stageNames = ['剧本', '资产图', '分镜脚本', '分镜图', '分镜视频', '视频合成'];
const sampleImage = '/ui/inspiration-ink.png';
const sampleVideo = '/ui-fixture.mp4';
const routes = [
  { name: 'home', url: '/', ready: '.xyq-composer' },
  { name: 'projects', url: '/projects', ready: '.xyq-page-header' },
  { name: 'library', url: '/library', ready: '.xyq-page-header' },
  { name: 'sandbox', url: '/sandbox', ready: '.xyq-page-header' },
  { name: 'action_transfer', url: '/pipelines/action-transfer', ready: '.xyq-page-header' },
  { name: 'settings', url: '/settings', ready: '.xyq-page-header' },
  { name: 'standard', url: '/pipelines/standard', ready: '.xyq-page-header' },
  { name: 'digital_human', url: '/pipelines/digital-human', ready: '.xyq-page-header' },
  ...stageIds.map(name => ({ name, url: `/?session=layout-fixture&stage=${name}`, ready: '.xyq-stage-content', stage: true })),
].filter(route => !selectedRoutes || selectedRoutes.includes(route.name));

// The same schema as scripts/ui-audit.mjs, with repeated fixture items for long pages.
function makeArtifacts(long) {
  const count = long ? 18 : 1;
  const repeat = factory => Array.from({ length: count }, (_, index) => factory(index + 1));
  const episodes = repeat(index => ({ act_number: index, act_title: `启程 ${index}`, content: long ? '旅人循着河流寻找故乡。'.repeat(35) : '清晨，旅人离开渡口。' }));
  return {
    script_generation: {
      title: '山水之间 · 布局验证', logline: '旅人循着河流，寻找故乡。', genre: ['治愈'], overall_style: '水墨', episodes,
      characters: [{ name: '旅人', character_id: 'hero', role: '主角', description: '背着行囊的年轻旅人', personality: ['温柔'] }],
      settings: [{ name: '山谷', description: '薄雾笼罩的清晨山谷' }],
      scenes: repeat(index => ({ scene_number: index, location: '山谷', characters: ['旅人'], plot: '旅人乘一叶扁舟驶向晨雾。' })),
    },
    character_design: {
      characters: repeat(index => ({ id: `hero_${index}`, name: `旅人 ${index}`, description: '背着行囊的年轻旅人', status: 'done', selected: sampleImage, versions: [sampleImage] })),
      settings: [{ id: 'valley', name: '山谷', description: '薄雾笼罩的山谷', status: 'done', selected: sampleImage, versions: [sampleImage] }], props: [],
    },
    storyboard: {
      episodes: repeat(index => ({ episode_number: index, episode_title: `启程 ${index}`, segments: [{ segment_id: `segment_${index}`, segment_number: index, episode_number: index, location: '山谷', characters: ['旅人'], total_duration: 5, shots: [{ shot_number: 1, shot_type: '远景', duration: 5, content: '扁舟缓缓穿过山谷。' }] }] })),
    },
    reference_generation: {
      scenes: repeat(index => ({ id: `frame_${index}`, name: `场景${index}-镜头1`, segment_id: `segment_${index}`, segment_number: index, scene_number: index, episode_number: index, description: '水墨山谷中的扁舟', prompt: '水墨山谷中的扁舟', status: 'done', selected: sampleImage, versions: [sampleImage] })),
    },
    video_generation: {
      clips: repeat(index => ({ id: `frame_${index}`, name: `场景${index}-镜头1`, segment_id: `segment_${index}`, segment_number: index, scene_number: index, episode_number: index, description: '扁舟经过山谷（布局测试视频）', duration: 1, status: 'done', selected: sampleVideo, versions: [sampleVideo] })),
    },
    post_production: { final_videos: repeat(index => ({ name: `启程 ${index}`, path: sampleVideo, episode: index })) },
  };
}
const shortArtifacts = makeArtifacts(false);
const longArtifacts = makeArtifacts(true);
const project = { id: 'layout-fixture', title: '山水之间 · 布局验证', idea: '山水之间', style: '水墨', status: 'draft', cover_image: sampleImage, updated_at: '2026-09-24T08:00:00', archived: false };
const asset = { id: 1, project_id: null, asset_type: 'character', name: '水墨山谷 · 布局样例', media_type: 'image', file_path: sampleImage, thumb_path: sampleImage, file_size: 1024, source: 'upload', created_at: '2026-09-24T08:00:00' };
const interceptedWrites = [];
const externalRequests = [];
const pageErrors = [];
const cases = [];
let scenario = { stage: '', length: 'short' };

function record(checks, name, condition, details = {}) {
  checks.push({ name, passed: Boolean(condition), ...details });
}

async function nextPaint(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function setSidebar(page, open, width) {
  const current = await page.locator('.xyq-shell').getAttribute('data-sidebar-open') === 'true';
  if (current !== open) {
    if (width < 768 && open) await page.locator('.xyq-mobile-menu').getByRole('button', { name: '展开侧边栏', exact: true }).click();
    else await page.locator('.xyq-sidebar').getByRole('button', { name: open ? '展开侧边栏' : '收起侧边栏', exact: true }).click();
  }
  await page.waitForFunction(({ open, width }) => {
    const sidebar = document.querySelector('.xyq-sidebar');
    if (!sidebar) return false;
    const rect = sidebar.getBoundingClientRect();
    return width < 768 ? Math.abs(rect.left - (open ? 0 : -240)) < 0.1 : Math.abs(rect.width - (open ? 240 : 64)) < 0.1;
  }, { open, width });
  await nextPaint(page);
}

async function measure(page) {
  return page.evaluate(() => {
    const main = document.querySelector('.xyq-main');
    const rect = main.getBoundingClientRect();
    const number = value => parseFloat(value) || 0;
    const round = value => Math.round(value * 100) / 100;
    const gutter = innerWidth >= 1024 ? 40 : innerWidth >= 768 ? 24 : 16;
    // clientLeft/clientWidth exclude borders and the reserved scrollbar gutter.
    const innerLeft = rect.left + main.clientLeft;
    const innerRight = innerLeft + main.clientWidth;
    const innerTop = rect.top + main.clientTop;
    const innerBottom = innerTop + main.clientHeight;
    const selectors = {
      page: ['.xyq-page', 'content'],
      home: ['.xyq-home-main', 'content'],
      composer: ['.xyq-composer', 'border'],
      inspiration: ['.xyq-inspiration', 'border'],
      topbar: ['.xyq-topbar', 'content'],
      stage: ['.xyq-stage-content', 'content'],
      footer: ['.xyq-stage-actions', 'content'],
    };
    const rails = {};
    for (const [name, [selector, mode]] of Object.entries(selectors)) {
      const element = document.querySelector(selector);
      if (!element || getComputedStyle(element).display === 'none') continue;
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const left = mode === 'border' ? bounds.left : bounds.left + element.clientLeft + number(style.paddingLeft);
      const right = mode === 'border' ? bounds.right : bounds.left + element.clientLeft + element.clientWidth - number(style.paddingRight);
      rails[name] = {
        selector, mode, left: round(left), right: round(right),
        leftError: round(left - (innerLeft + gutter)), rightError: round(right - (innerRight - gutter)),
        x: round(bounds.left), width: round(bounds.width), height: round(bounds.height), top: round(bounds.top), bottom: round(bounds.bottom),
        lastContentBottom: (() => {
          const last = Array.from(element.children).filter(child => child.getClientRects().length && getComputedStyle(child).display !== 'none').at(-1);
          return last ? round(last.getBoundingClientRect().bottom) : null;
        })(),
        paddingLeft: number(style.paddingLeft), paddingRight: number(style.paddingRight),
        scrollbarWidth: round(element.offsetWidth - element.clientWidth - number(style.borderLeftWidth) - number(style.borderRightWidth)),
        verticalOverflow: element.scrollHeight > element.clientHeight + 1,
        overflowY: style.overflowY, position: style.position,
      };
    }
    const style = getComputedStyle(main);
    return {
      width: innerWidth, height: innerHeight, gutter,
      sidebarOpen: document.querySelector('.xyq-shell').getAttribute('data-sidebar-open') === 'true',
      dialogOpen: Boolean(document.querySelector('.ui-dialog-backdrop')),
      main: { left: round(rect.left), width: round(rect.width), innerLeft: round(innerLeft), innerRight: round(innerRight), innerTop: round(innerTop), innerBottom: round(innerBottom), clientLeft: main.clientLeft, clientWidth: main.clientWidth, clientHeight: main.clientHeight, scrollWidth: main.scrollWidth, scrollHeight: main.scrollHeight, scrollTop: round(main.scrollTop), scrollPaddingTop: number(style.scrollPaddingTop), scrollPaddingBottom: number(style.scrollPaddingBottom), overflowY: style.overflowY, scrollbarGutter: style.scrollbarGutter, scrollbarWidth: round(main.offsetWidth - main.clientWidth - number(style.borderLeftWidth) - number(style.borderRightWidth)) },
      document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, clientHeight: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight },
      rails,
    };
  });
}

function checkScrollMode(checks, snapshot, phase) {
  const drawerLocked = snapshot.width < 768 && snapshot.sidebarOpen;
  const expected = drawerLocked || snapshot.dialogOpen ? 'hidden' : 'auto';
  record(checks, `${phase}: correct scroll lock state`, snapshot.main.overflowY === expected, { expected, actual: snapshot.main.overflowY, drawerLocked, dialogOpen: snapshot.dialogOpen });
}

function checkStageVerticalPosition(checks, snapshot, phase) {
  const { topbar, footer } = snapshot.rails;
  const top = snapshot.main.innerTop;
  const bottom = Math.min(snapshot.main.innerBottom, snapshot.height);
  if (topbar) {
    record(checks, `${phase}: top scroll padding clears sticky header`, snapshot.main.scrollPaddingTop + 1 >= topbar.height, { padding: snapshot.main.scrollPaddingTop, headerHeight: topbar.height });
    record(checks, `${phase}: topbar pinned to scrollport top`, Math.abs(topbar.top - top) <= 1, { actual: topbar.top, expected: top, position: topbar.position });
    record(checks, `${phase}: topbar within viewport`, topbar.top >= -1 && topbar.bottom <= bottom + 1, { top: topbar.top, bottom: topbar.bottom, viewportBottom: bottom });
  }
  if (footer) {
    record(checks, `${phase}: bottom scroll padding clears sticky footer`, snapshot.main.scrollPaddingBottom + 1 >= footer.height, { padding: snapshot.main.scrollPaddingBottom, footerHeight: footer.height });
    record(checks, `${phase}: footer pinned to scrollport bottom`, Math.abs(footer.bottom - bottom) <= 1, { actual: footer.bottom, expected: bottom, position: footer.position });
    record(checks, `${phase}: footer within viewport`, footer.top >= top - 1 && footer.bottom <= bottom + 1, { top: footer.top, bottom: footer.bottom, viewportTop: top, viewportBottom: bottom });
    if (topbar) record(checks, `${phase}: header and footer do not overlap`, footer.top >= topbar.bottom - 1, { headerBottom: topbar.bottom, footerTop: footer.top });
  }
}

function checkRails(checks, snapshot, phase, required) {
  for (const name of required) record(checks, `${phase}: ${name} exists`, Boolean(snapshot.rails[name]));
  for (const [name, rail] of Object.entries(snapshot.rails)) {
    record(checks, `${phase}: ${name} left rail`, Math.abs(rail.leftError) <= 1, { actual: rail.left, expected: snapshot.main.innerLeft + snapshot.gutter, error: rail.leftError });
    record(checks, `${phase}: ${name} right rail`, Math.abs(rail.rightError) <= 1, { actual: rail.right, expected: snapshot.main.innerRight - snapshot.gutter, error: rail.rightError });
    if (name === 'stage' || name === 'home') record(checks, `${phase}: ${name} has no independent vertical scroll`, !(rail.verticalOverflow && ['auto', 'scroll'].includes(rail.overflowY)), { overflowY: rail.overflowY, scrollbarWidth: rail.scrollbarWidth });
  }
  record(checks, `${phase}: no document horizontal overflow`, snapshot.document.scrollWidth <= snapshot.document.clientWidth + 1, snapshot.document);
  record(checks, `${phase}: no main horizontal overflow`, snapshot.main.scrollWidth <= snapshot.main.clientWidth + 1, { scrollWidth: snapshot.main.scrollWidth, clientWidth: snapshot.main.clientWidth });
  checkScrollMode(checks, snapshot, phase);
  checkStageVerticalPosition(checks, snapshot, phase);
  record(checks, `${phase}: main reserves scrollbar gutter`, snapshot.main.scrollbarGutter.includes('stable'), { scrollbarGutter: snapshot.main.scrollbarGutter });
}

function checkNoShift(checks, before, after, phase) {
  record(checks, `${phase}: main client width unchanged`, Math.abs(after.main.clientWidth - before.main.clientWidth) <= 1, { before: before.main.clientWidth, after: after.main.clientWidth });
  record(checks, `${phase}: scrollbar reservation unchanged`, Math.abs(after.main.scrollbarWidth - before.main.scrollbarWidth) <= 1, { before: before.main.scrollbarWidth, after: after.main.scrollbarWidth });
  for (const [name, rail] of Object.entries(before.rails)) {
    const next = after.rails[name];
    record(checks, `${phase}: ${name} horizontal position unchanged`, next && Math.abs(next.left - rail.left) <= 1 && Math.abs(next.right - rail.right) <= 1, { before: [rail.left, rail.right], after: next ? [next.left, next.right] : null });
  }
}

async function checkDialog(page, width, sidebarOpen, checks, snapshots, capture) {
  const before = await measure(page);
  // Opening this shared confirmation is read-only. Always Escape; never confirm.
  if (width < 768 && !sidebarOpen) await setSidebar(page, true, width);
  await page.locator('.xyq-sidebar').getByRole('button', { name: '设置', exact: true }).click();
  await page.getByRole('dialog', { name: '设置菜单', exact: true }).getByRole('button', { name: '清空缓存', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '清空临时缓存？', exact: true });
  await dialog.waitFor();
  await nextPaint(page);
  const during = await measure(page);
  checkNoShift(checks, before, during, 'dialog open');
  checkScrollMode(checks, during, 'dialog open');
  const dialogInsets = await dialog.evaluate(element => {
    const style = getComputedStyle(element);
    return {
      scrollPaddingTop: parseFloat(style.scrollPaddingTop) || 0,
      scrollPaddingBottom: parseFloat(style.scrollPaddingBottom) || 0,
      headerHeight: element.querySelector('.ui-dialog-header')?.getBoundingClientRect().height || 0,
      footerHeight: element.querySelector('.ui-dialog-footer')?.getBoundingClientRect().height || 0,
    };
  });
  record(checks, 'dialog top scroll padding clears sticky header', dialogInsets.scrollPaddingTop + 1 >= dialogInsets.headerHeight, dialogInsets);
  record(checks, 'dialog bottom scroll padding clears sticky footer', dialogInsets.scrollPaddingBottom + 1 >= dialogInsets.footerHeight, dialogInsets);
  await capture('dialog');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  await setSidebar(page, sidebarOpen, width);
  const after = await measure(page);
  checkNoShift(checks, before, after, 'dialog close');
  checkScrollMode(checks, after, 'dialog close');
  snapshots.dialog = { before, during, after, insets: dialogInsets };
  // A mobile open-drawer scenario also verifies that closing restores scrolling.
  if (width < 768 && sidebarOpen) {
    await setSidebar(page, false, width);
    const drawerClosed = await measure(page);
    checkScrollMode(checks, drawerClosed, 'drawer close');
    checkNoShift(checks, before, drawerClosed, 'drawer close');
    await setSidebar(page, true, width);
    const drawerReopened = await measure(page);
    checkScrollMode(checks, drawerReopened, 'drawer reopen');
    checkNoShift(checks, drawerClosed, drawerReopened, 'drawer reopen');
    snapshots.drawer = { closed: drawerClosed, reopened: drawerReopened };
  }
}

async function captureScreenshot(page, item, phase) {
  const matches = (values, value) => values.includes('*') || values.includes(String(value));
  if (!screenshotsDir || !matches(screenshotFilters.widths, item.width) || !matches(screenshotFilters.routes, item.route) || !matches(screenshotFilters.sidebars, item.sidebarOpen ? 'open' : 'closed') || !matches(screenshotFilters.lengths, item.length) || !matches(screenshotFilters.phases, phase)) return;
  const filename = `${item.width}-${item.sidebarOpen ? 'open' : 'closed'}-${item.route}-${item.length}-${phase}.png`.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const destination = path.join(screenshotsDir, filename);
  await page.screenshot({ path: destination, fullPage: false, animations: 'disabled' });
  item.screenshots.push(destination);
}

async function checkRunningControls(page) {
  const item = { width: 320, sidebarOpen: false, route: 'running_controls', length: 'long', checks: [], snapshots: {}, screenshots: [] };
  try {
    scenario = { stage: 'script_generation', length: 'long', status: 'running' };
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(`${base}/?session=layout-fixture&stage=script_generation`, { waitUntil: 'networkidle' });
    await page.locator('.xyq-topbar').getByRole('button', { name: '停止', exact: true }).waitFor();
    await setSidebar(page, false, 320);
    const top = await measure(page);
    item.snapshots.top = top;
    checkRails(item.checks, top, 'running top', ['topbar', 'stage', 'footer']);
    const controls = await page.locator('.xyq-topbar-controls').evaluate(element => ({
      clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
      items: Array.from(element.children).filter(child => child.getClientRects().length).map(child => {
        const rect = child.getBoundingClientRect();
        return { name: child.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      }),
    }));
    item.snapshots.controls = controls;
    record(item.checks, 'running header contains all four controls', controls.items.length === 4, { names: controls.items.map(control => control.name) });
    record(item.checks, 'running controls have no horizontal overflow', controls.scrollWidth <= controls.clientWidth + 1, controls);
    for (const control of controls.items) {
      record(item.checks, `running control ${control.name} stays within content rails`, control.left >= top.main.innerLeft + top.gutter - 1 && control.right <= top.main.innerRight - top.gutter + 1, { ...control, railLeft: top.main.innerLeft + top.gutter, railRight: top.main.innerRight - top.gutter });
      record(item.checks, `running control ${control.name} stays inside visible header`, control.top >= top.rails.topbar.top - 1 && control.bottom <= top.rails.topbar.bottom + 1, control);
    }
    for (let first = 0; first < controls.items.length; first += 1) {
      for (let second = first + 1; second < controls.items.length; second += 1) {
        const a = controls.items[first], b = controls.items[second];
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        record(item.checks, `running controls ${a.name}/${b.name} do not overlap`, overlapX <= 1 || overlapY <= 1, { overlapX, overlapY });
      }
    }
    await captureScreenshot(page, item, 'top');
    await page.locator('.xyq-main').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await nextPaint(page);
    const bottom = await measure(page);
    item.snapshots.bottom = bottom;
    checkRails(item.checks, bottom, 'running bottom', ['topbar', 'stage', 'footer']);
    checkNoShift(item.checks, top, bottom, 'running scroll');
    await captureScreenshot(page, item, 'bottom');
  } catch (error) {
    record(item.checks, 'running controls scenario completed', false, { message: error.message });
  }
  item.passed = item.checks.every(check => check.passed);
  cases.push(item);
  console.log(`${item.passed ? 'PASS' : 'FAIL'} 320px running header controls`);
}

async function checkClientNavigation(page, width) {
  const item = { width, sidebarOpen: width >= 768, route: 'client_navigation', length: 'long', checks: [], snapshots: {} };
  const captureScroll = async name => {
    const snapshot = await measure(page);
    item.snapshots[name] = snapshot;
    return snapshot.main.scrollTop;
  };
  const scrollToBottom = async name => {
    await page.locator('.xyq-main').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await nextPaint(page);
    const scrollTop = await captureScroll(name);
    record(item.checks, `${name}: source page is genuinely scrolled`, scrollTop > 1, { scrollTop });
  };
  const assertReset = async (name, documentToken) => {
    await page.waitForFunction(() => Math.abs(document.querySelector('.xyq-main')?.scrollTop || 0) <= 1);
    const scrollTop = await captureScroll(name);
    record(item.checks, `${name}: new route starts at top`, Math.abs(scrollTop) <= 1, { scrollTop });
    record(item.checks, `${name}: client navigation preserved the document`, await page.evaluate(() => window.__layoutAuditDocumentToken) === documentToken);
  };
  try {
    // Only this setup is a full navigation; every transition below uses real UI clicks.
    scenario = { stage: 'script_generation', length: 'long', projectCount: 40 };
    await page.setViewportSize({ width, height: 600 });
    await page.goto(`${base}/?session=layout-fixture&stage=script_generation`, { waitUntil: 'networkidle' });
    await page.locator('.xyq-stage-content').waitFor();
    await page.waitForFunction(() => document.querySelector('.xyq-shell')?.getAttribute('data-sidebar-ready') === 'true');
    await setSidebar(page, width >= 768, width);
    const documentToken = await page.evaluate(() => {
      window.__layoutAuditDocumentToken = crypto.randomUUID();
      return window.__layoutAuditDocumentToken;
    });
    await scrollToBottom('script before stage switch');
    scenario.stage = 'character_design';
    await page.getByRole('navigation', { name: '创作阶段', exact: true }).getByRole('button', { name: '资产图', exact: true }).click();
    await page.waitForURL(url => url.searchParams.get('stage') === 'character_design');
    await page.locator('.xyq-stage-content').getByRole('heading', { name: '资产图', exact: true }).waitFor();
    await assertReset('stage switch', documentToken);

    await scrollToBottom('characters before projects');
    if (width < 768) await setSidebar(page, true, width);
    await page.getByRole('navigation', { name: '创作功能', exact: true }).getByRole('link', { name: '项目库', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/projects');
    await page.locator('.ui-project-card').first().waitFor();
    await assertReset('sidebar to projects', documentToken);

    await scrollToBottom('projects before studio');
    if (width < 768) await setSidebar(page, true, width);
    await page.getByRole('navigation', { name: '创作功能', exact: true }).getByRole('link', { name: '工作室', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/' && !url.searchParams.has('session'));
    await page.locator('.xyq-composer').waitFor();
    await assertReset('sidebar to studio', documentToken);
  } catch (error) {
    record(item.checks, 'client navigation completed', false, { message: error.message });
  }
  item.passed = item.checks.every(check => check.passed);
  cases.push(item);
  console.log(`${item.passed ? 'PASS' : 'FAIL'} ${width}px client navigation scroll restoration`);
}

async function main() {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  if (screenshotsDir) await fs.mkdir(screenshotsDir, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.UI_BROWSER_CHANNEL || 'chrome', headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  const context = await browser.newContext({ viewport: { width: widths[0], height: 960 }, reducedMotion: 'reduce' });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname)) return route.continue();
    externalRequests.push(url.origin);
    return route.abort();
  });
  await context.route('**/ui-fixture.mp4', route => route.fulfill({ status: 200, contentType: 'video/mp4', path: path.resolve('scripts/fixtures/ui-video.mp4') }));
  await context.route('**/ui-fixture_poster.jpg', route => route.fulfill({ status: 200, contentType: 'image/png', path: path.resolve('public/ui/inspiration-ink.png') }));
  await context.route('**/api/**', route => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const reply = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (request.method() !== 'GET') {
      interceptedWrites.push({ method: request.method(), path: pathname });
      return reply({ error: { code: 'LAYOUT_READ_ONLY', message: 'Layout audit blocks all writes' } }, 500);
    }
    const artifacts = scenario.length === 'long' ? longArtifacts : shortArtifacts;
    if (pathname === '/api/sessions') return reply({ sessions: Array.from({ length: scenario.projectCount || 1 }, (_, index) => ({ ...project, id: index ? `layout-fixture-${index}` : project.id, title: `${project.title}${index ? ` ${index + 1}` : ''}` })) });
    if (pathname === '/api/library') return reply({ assets: [asset] });
    if (pathname === '/api/models') return reply({ models: [{ id: 'layout-fixture-model', label: '验证模型', provider: 'openai', model_type: url.searchParams.get('model_type') || 'video', api_contract_verified: true, ability_types: ['first_frame_i2v', 'start_end_frame_i2v', 'reference_to_video'] }] });
    if (pathname === '/api/config') return reply({ config: { models: { llm: 'layout-fixture-model', vlm: 'layout-fixture-model', image_t2i: 'layout-fixture-model', image_it2i: 'layout-fixture-model', video_first_frame: 'layout-fixture-model' }, generation: { video_ratio: '16:9', video_resolution: '720P' } } });
    if (pathname === '/api/sandbox/history') return reply({ success: true, records: [] });
    if (pathname === '/api/sandbox/tasks' || pathname === '/api/tasks') return reply({ tasks: [] });
    if (pathname === '/api/pipelines/standard/templates') return reply({ templates: [] });
    if (pathname === '/api/stages') return reply({ stages: stageIds.map((id, order) => ({ id, name: stageNames[order], order, description: '' })) });
    if (pathname.includes('/status')) return reply({ session_id: 'layout-fixture', current_stage: scenario.stage || stageIds[0], status: Object.fromEntries(stageIds.map(id => [id, id === scenario.stage ? (scenario.status || 'waiting') : 'pending'])), artifacts, meta: { idea: '山水之间', llm_model: 'layout-fixture-model', video_ratio: '16:9' }, error: null });
    if (pathname.includes('/artifact/')) return reply({ artifact: artifacts[pathname.split('/').at(-1)] || {} });
    return reply({});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    for (const width of widths) {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 960 });
      for (const sidebarOpen of sidebarStates) {
        for (const route of routes) {
          for (const length of route.stage ? lengths : ['short']) {
            scenario = { stage: route.stage ? route.name : '', length };
            const item = { width, sidebarOpen, route: route.name, length, checks: [], snapshots: {}, screenshots: [] };
            const capture = phase => captureScreenshot(page, item, phase);
            try {
              await page.goto(base + route.url, { waitUntil: 'networkidle' });
              await page.waitForFunction(() => document.querySelector('.xyq-shell')?.getAttribute('data-sidebar-ready') === 'true');
              await page.locator(route.ready).waitFor();
              await setSidebar(page, sidebarOpen, width);
              const required = route.stage ? ['topbar', 'stage', 'footer'] : route.name === 'home' ? ['home', 'composer', 'inspiration'] : ['page'];
              const start = await measure(page);
              item.snapshots.top = start;
              checkRails(item.checks, start, 'top', required);
              await capture('top');
              if (route.stage && length === 'long') record(item.checks, 'long fixture actually exceeds viewport', start.main.scrollHeight > start.main.clientHeight + 1, start.main);
              await page.locator('.xyq-main').evaluate(element => { element.scrollTop = element.scrollHeight; });
              await nextPaint(page);
              const bottom = await measure(page);
              item.snapshots.bottom = bottom;
              checkRails(item.checks, bottom, 'bottom', required);
              checkNoShift(item.checks, start, bottom, 'scroll top to bottom');
              record(item.checks, 'main bottom can be reached', Math.abs(bottom.main.scrollHeight - bottom.main.clientHeight - bottom.main.scrollTop) <= 1, { scrollTop: bottom.main.scrollTop, maxScrollTop: bottom.main.scrollHeight - bottom.main.clientHeight });
              if (route.stage && length === 'long') {
                const last = bottom.rails.stage?.lastContentBottom;
                const header = bottom.rails.topbar;
                const footer = bottom.rails.footer;
                record(item.checks, 'last stage content is visible above footer at bottom', last !== null && last !== undefined && header && footer && last >= header.bottom - 1 && last <= footer.top + 1, { lastContentBottom: last, headerBottom: header?.bottom, footerTop: footer?.top });
              }
              await capture('bottom');
              await checkDialog(page, width, sidebarOpen, item.checks, item.snapshots, capture);
            } catch (error) {
              record(item.checks, 'scenario completed', false, { message: error.message });
              await page.keyboard.press('Escape').catch(() => {});
            }
            item.passed = item.checks.every(check => check.passed);
            cases.push(item);
            const failures = item.checks.filter(check => !check.passed);
            console.log(`${item.passed ? 'PASS' : 'FAIL'} ${width}px ${sidebarOpen ? 'open' : 'closed'} ${route.name} ${length}${failures.length ? ` — ${failures.map(check => check.name).join('; ')}` : ''}`);
          }
        }
      }
    }
    const navigationWidths = [...new Set([widths.find(width => width >= 768) || 1512, widths.find(width => width < 768) || 390])];
    for (const width of navigationWidths) await checkClientNavigation(page, width);
    await checkRunningControls(page);
  } finally {
    await browser.close();
  }
  const summary = {
    date: new Date().toISOString(), base, fixtureOnly: true, tolerancePx: 1,
    viewportWidths: widths, sidebarStates, caseCount: cases.length,
    screenshotsDir: screenshotsDir || null, screenshotFilters: screenshotsDir ? screenshotFilters : null,
    passedCases: cases.filter(item => item.passed).length,
    assertionCount: cases.reduce((total, item) => total + item.checks.length, 0),
    failedAssertions: cases.flatMap(item => item.checks.filter(check => !check.passed).map(check => ({ width: item.width, sidebarOpen: item.sidebarOpen, route: item.route, length: item.length, ...check }))),
    interceptedWrites, externalRequests, pageErrors, cases,
  };
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2));
  const success = summary.failedAssertions.length === 0 && pageErrors.length === 0 && interceptedWrites.length === 0 && externalRequests.length === 0;
  console.log(JSON.stringify({ passed: success, passedCases: summary.passedCases, cases: summary.caseCount, assertions: summary.assertionCount, failedAssertions: summary.failedAssertions.length, interceptedWrites, externalRequests, pageErrors, report: reportPath }));
  if (!success) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
