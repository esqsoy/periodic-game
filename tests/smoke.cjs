'use strict';
// 두 버전을 실제 브라우저(Chromium)로 열어 기본 동작을 확인한다.
// 사용: node tests/smoke.cjs   (Playwright 필요. 브라우저 경로는 PW_CHROMIUM, 없으면 Playwright 기본값)
// 확인하는 것:
//  1. 폰(360·390px)·가로 폰·데스크톱에서 가로로 넘치지 않고, 118칸과 제출·족힌트·패스 버튼이 화면 안에 있다.
//  2. 입력창 글자는 16px 이상(iPhone이 입력할 때 화면을 확대하지 않게), 캐릭터가 입력창을 가리지 않는다.
//  3. 정답 뒤 Enter를 두 번 눌러도 한 번만 센다(전에는 원소 하나가 사라졌다).
//  4. aluminium·caesium·sulphur는 정답, wolfram은 오답.
//  5. 한 판을 끝까지 하면 기록이 남고, 약점 복습과 디버그 클리어는 기록을 바꾸지 않는다.
const path = require('node:path');
const {chromium} = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const url = f => 'file://' + path.join(ROOT, f);
const fail = [];
const ok = (cond, msg) => { if (!cond) fail.push(msg); };
(async () => {
  try {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? {executablePath: process.env.PW_CHROMIUM} : {});
  for (const file of ['periodic-girl.html', 'periodic-sweden.html']) {
    for (const [w, h] of [[360, 640], [390, 844], [844, 390], [1280, 800]]) {
      const p = await b.newPage({viewport: {width: w, height: h}});
      const errs = []; p.on('pageerror', e => errs.push(e.message));
      await p.goto(url(file)); await p.waitForTimeout(600);
      await p.click('.lvBtn[data-start="2"]'); await p.waitForTimeout(800);
      const m = await p.evaluate(() => {
        const vw = innerWidth, inView = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= -0.5 && r.right <= vw + 0.5; };
        const i = document.getElementById('answer'), r = i.getBoundingClientRect();
        return {
          scrollW: document.documentElement.scrollWidth, vw,
          cellsOut: [...document.querySelectorAll('.cell[data-num]')].filter(c => !inView(c)).length,
          btnsOut: ['submitBtn', 'groupBtn', 'skipBtn'].filter(id => !inView(document.getElementById(id))),
          font: parseFloat(getComputedStyle(i).fontSize),
          inputHit: document.elementFromPoint(r.left + 10, r.top + r.height / 2) === i,
        };
      });
      const tag = `${file} ${w}x${h}`;
      ok(m.scrollW <= m.vw, `${tag}: 가로로 넘친다(${m.scrollW}px)`);
      ok(m.cellsOut === 0, `${tag}: 화면 밖 칸 ${m.cellsOut}개`);
      ok(m.btnsOut.length === 0, `${tag}: 화면 밖 버튼 ${m.btnsOut}`);
      ok(m.font >= 16, `${tag}: 입력창 글자 ${m.font}px`);
      ok(m.inputHit, `${tag}: 입력창이 가려졌다`);
      ok(errs.length === 0, `${tag}: 오류 ${errs.join(' / ')}`);
      await p.close();
    }
  }
  const p = await b.newPage({viewport: {width: 1280, height: 800}});
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const start = async lv => { await p.goto(url('periodic-sweden.html')); await p.waitForTimeout(400); await p.click(`.lvBtn[data-start="${lv}"]`); await p.waitForTimeout(300); };
  await start(2);
  const before = await p.evaluate(() => state.remaining.length);
  await p.fill('#answer', await p.evaluate(() => getEl(state.current)[2]));
  await p.press('#answer', 'Enter'); await p.press('#answer', 'Enter'); await p.click('#skipBtn'); await p.waitForTimeout(900);
  const d = await p.evaluate(() => ({rem: state.remaining.length, ok: state.okCount, pass: state.passCount}));
  ok(d.ok === 1 && d.pass === 0 && d.rem === before - 1, `Enter 두 번: ${JSON.stringify(d)}`);
  for (const [n, g, want] of [[13, 'aluminium', true], [55, 'caesium', true], [16, 'sulphur', true], [74, 'wolfram', false]]) {
    await start(2);
    await p.evaluate(n => { state.current = n; }, n);
    await p.fill('#answer', g); await p.press('#answer', 'Enter');
    const right = await p.evaluate(() => state.okCount === 1);
    ok(right === want, `${g}: ${right ? '정답' : '오답'} 처리`);
  }
  await p.evaluate(() => localStorage.clear());
  await start(8);
  const play = async limit => {
    for (let i = 0, wrongs = 0; i < limit; i++) {
      const st = await p.evaluate(() => ({busy: state.busy, end: document.getElementById('endOverlay').style.display}));
      if (st.end === 'flex') return true;
      if (st.busy) { await p.waitForTimeout(100); continue; }
      const wrong = wrongs < 2 && i % 4 === 1; if (wrong) wrongs++;
      await p.fill('#answer', wrong ? 'xxx' : await p.evaluate(() => getEl(state.current)[2]));
      await p.press('#answer', 'Enter'); await p.waitForTimeout(80);
    }
    return false;
  };
  ok(await play(400), '란타넘족 한 판이 끝나지 않았다');
  ok(await p.evaluate(() => state.solved.size === 118 && localStorage.getItem('zerotwo_best_8') !== null), '완주 기록이 남지 않았다');
  await p.evaluate(() => document.getElementById('reviewBtn').click()); await p.waitForTimeout(300);
  ok(await play(200), '약점 복습이 끝나지 않았다');
  ok(await p.evaluate(() => localStorage.getItem('zerotwo_best_99') === null), '약점 복습이 기록을 남겼다');
  await p.evaluate(() => { document.getElementById('restartBtn').click(); document.querySelector('.lvBtn[data-start="2"]').click(); }); await p.waitForTimeout(200);
  await p.keyboard.press('Control+Shift+KeyW'); await p.waitForTimeout(200);
  ok(await p.evaluate(() => localStorage.getItem('zerotwo_best_2') === null), '디버그 클리어가 기록을 남겼다');
  ok(errs.length === 0, `동작 검사 오류: ${errs.join(' / ')}`);
  await b.close();
  } catch (e) { fail.push('검사 중단: ' + e.message.split('\n')[0]); }
  if (fail.length) { console.log('FAIL\n- ' + fail.join('\n- ')); process.exit(1); }
  console.log('PASS 두 버전 × 화면 4개 배치, Enter 두 번, 철자 변형, 완주·복습·디버그 기록');
})();
