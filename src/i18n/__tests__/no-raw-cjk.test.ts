/**
 * 加強掃描:src 原始碼(剝除註解後)不得出現寫死的 CJK 字面。
 * 檔頭中文註解為專案慣例——先剝除區塊/行註解再掃描。
 * 例外:locales/、__tests__/。
 */
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../..');
const CJK = /[一-鿿]/;
const SKIP_DIR = new Set(['__tests__', 'locales', 'node_modules']);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return SKIP_DIR.has(e.name) ? [] : walk(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

/** 剝除區塊註解與行註解(行註解僅在行首/空白後,避免誤刪 URL 字串中的 //) */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1');
}

describe('原始碼不得寫死 CJK 字串', () => {
  it('掃描通過(若發現違規,請改走 i18n key)', () => {
    const offenders = walk(SRC).filter((p) => CJK.test(stripComments(fs.readFileSync(p, 'utf8'))));
    expect(offenders).toEqual([]);
  });
});
