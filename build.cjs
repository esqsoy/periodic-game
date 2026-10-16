'use strict';
// 두 버전(초기·개선) HTML을 원본 하나에서 만든다.
// 원본: src/game.html(공통 코드) + src/versions.json(버전별 스프라이트·춤 설정) + src/sprites/*.png
// 사용: node build.cjs          → periodic-girl.html, periodic-sweden.html을 다시 쓴다
//       node build.cjs --check  → 두 HTML이 원본과 같은지만 본다(다르면 종료 코드 1)
// 생성된 HTML만 고치면 다음 빌드에서 사라진다. 고칠 때는 src/를 고치고 빌드한다.
const fs = require('node:fs'), path = require('node:path');
const ROOT = __dirname, SRC = path.join(ROOT, 'src');
const check = process.argv.includes('--check');
const tpl = fs.readFileSync(path.join(SRC, 'game.html'), 'utf8');
const versions = JSON.parse(fs.readFileSync(path.join(SRC, 'versions.json'), 'utf8'));
let stale = 0;
for (const v of versions) {
  const png = fs.readFileSync(path.join(SRC, v.sprite));
  const out = tpl
    .replace('{{SPRITE_NOTE}}', () => v.spriteNote)
    .replace('{{SPRITE_DATA_URI}}', () => 'data:image/png;base64,' + png.toString('base64'))
    .replace('{{DANCE_SETTINGS}}', () => v.danceSettings);
  if (out.includes('{{')) throw new Error(`${v.file}: 채우지 못한 자리표시가 남았다`);
  const dest = path.join(ROOT, v.file);
  const cur = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : null;
  if (check) {
    if (cur !== out) { stale++; console.log(`다름: ${v.file} (node build.cjs로 다시 만든다)`); }
    else console.log(`같음: ${v.file}`);
  } else {
    if (cur !== out) fs.writeFileSync(dest, out);
    console.log(`${cur === out ? '그대로' : '새로 씀'}: ${v.file}`);
  }
}
if (check && stale) process.exit(1);
