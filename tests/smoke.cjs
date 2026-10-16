'use strict';
// 두 버전을 실제 브라우저(Chromium)로 열어 기본 동작을 확인한다.
// 사용: node tests/smoke.cjs   (Playwright 필요. 브라우저 경로는 PW_CHROMIUM, 없으면 Playwright 기본값)
// 확인하는 것:
//  1. 폰(360·390px)·가로 폰·데스크톱에서 가로로 넘치지 않고, 118칸과 제출·족힌트·패스 버튼이 화면 안에 있다.
//  2. 입력창 글자는 16px 이상(iPhone이 입력할 때 화면을 확대하지 않게), 캐릭터가 입력창을 가리지 않는다.
//  3. 정답 뒤 Enter를 두 번 눌러도 한 번만 센다(전에는 원소 하나가 사라졌다).
//  4. aluminium·caesium·sulphur는 정답, wolfram은 오답.
//  5. 한 판을 끝까지 하면 기록이 남고, 약점 복습과 디버그 클리어는 기록을 바꾸지 않는다.
//  6. 제자리 춤(장별 위치), 세 번 틀린 뒤 따라 쓰기, 이름 듣기(끄면 안 읽음), 새로고침 뒤 이어하기·끝내면 저장 지움.
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
  // 제자리 춤: 장마다 위치를 따로 잰다(초기 버전 그림은 간격이 고르지 않다)
  for (const file of ['periodic-girl.html', 'periodic-sweden.html']) {
    await p.goto(url(file));
    await p.waitForFunction(() => Array.isArray(SPRITE_POS), null, {timeout: 15000}).catch(() => {});
    const pos = await p.evaluate(() => SPRITE_POS);
    ok(Array.isArray(pos) && pos.length === 8, `${file}: 장별 위치가 없다`);
    if (file === 'periodic-girl.html') ok(pos.some((x, k) => Math.abs(x - k / 7 * 100) > 1), '초기 버전: 장별 위치가 같은 간격 그대로다');
  }
  // 정답 따라 쓰기 + 이름 듣기(음성은 가짜로 바꿔 무엇을 읽었는지 본다)
  await start(2);
  await p.evaluate(() => { window._said = []; speechSynthesis.speak = u => window._said.push(u.text); speechSynthesis.cancel = () => {}; soundOn = true; });
  const num = await p.evaluate(() => state.current), name = await p.evaluate(() => getEl(state.current)[2]);
  for (let i = 0; i < 3; i++) { await p.fill('#answer', 'xxx'); await p.press('#answer', 'Enter'); }
  ok(await p.evaluate(() => state.copyMode), '세 번 틀린 뒤 따라 쓰기로 가지 않았다');
  ok(await p.evaluate(n => window._said.includes(n), name), '정답이 나올 때 이름을 읽지 않았다');
  await p.fill('#answer', 'zzz'); await p.press('#answer', 'Enter'); await p.waitForTimeout(800);
  ok(await p.evaluate(n => state.copyMode && state.current === n && state.missCount === 3, num), '따라 쓰기에서 틀리면 그 문제에 머물러야 하고 오답으로 세지 않아야 한다');
  await p.fill('#answer', name.toLowerCase()); await p.press('#answer', 'Enter'); await p.waitForTimeout(800);
  ok(await p.evaluate(n => !state.copyMode && state.current !== n && state.retryNeeds[n] === 2, num), '따라 쓰기를 맞게 쳤는데 넘어가지 않았다');
  const next = await p.evaluate(() => getEl(state.current)[2]);
  await p.evaluate(() => { window._said = []; soundOn = false; });
  await p.fill('#answer', next); await p.press('#answer', 'Enter'); await p.waitForTimeout(800);
  ok(await p.evaluate(() => window._said.length === 0), '발음을 꺼도 읽었다');
  // 이어하기: 새로고침해도 그 판, 경과 시간부터
  const snap = await p.evaluate(() => ({solved: state.solved.size, cur: state.current, el: elapsedSec(), ok: state.okCount}));
  await p.reload(); await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!document.getElementById('resumeBtn')), '새로고침 뒤 이어하기 단추가 없다');
  await p.evaluate(() => document.getElementById('resumeBtn').click()); await p.waitForTimeout(300);
  const back = await p.evaluate(() => ({solved: state.solved.size, cur: state.current, el: elapsedSec(), ok: state.okCount}));
  ok(back.solved === snap.solved && back.cur === snap.cur && back.ok === snap.ok && back.el >= snap.el, `이어하기가 판을 되살리지 못했다 ${JSON.stringify([snap, back])}`);
  await p.evaluate(() => { ELEMENTS.forEach(e => state.solved.add(e[0])); state.remaining = []; state.retryNeeds = {}; state.rowQueue.length = state.currentRowIdx + 1; nextQuestion(); });
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => localStorage.getItem('zerotwo_save_v1') === null), '판을 끝냈는데 이어하기 저장이 남았다');
  ok(errs.length === 0, `동작 검사 오류: ${errs.join(' / ')}`);
  await b.close();
  } catch (e) { fail.push('검사 중단: ' + e.message.split('\n')[0]); }
  if (fail.length) { console.log('FAIL\n- ' + fail.join('\n- ')); process.exit(1); }
  console.log('PASS 두 버전 × 화면 4개 배치, Enter 두 번, 철자 변형, 완주·복습·디버그 기록, 제자리 춤, 따라 쓰기, 이름 듣기, 이어하기');
})();
