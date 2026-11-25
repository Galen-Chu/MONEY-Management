/**
 * 通知管理領域(P6 批次一,純函式):刷卡消費通知(簡訊文字)→ 待確認交易草稿。
 * 「必經確認」慣例:解析只產生草稿,入帳一律經 TxnSheet → ledger.validateTxn 單一來源;
 * 「忽略」直接丟棄。iOS 不開放第三方 App 讀簡訊匣 → 唯一入口為「貼上解析」(剪貼簿)。
 * 解析為啟發式(非 AI):金額/卡號末四碼/日期/商家/寄件方;關鍵字以碼點常數組成
 * (String.fromCodePoint)——原始碼維持純 ASCII,同 \u 轉義滿足 CJK 閘門。
 */
import { todayKey } from './ledger';
import type { CategoryKey } from './categories';

export type NotificationSource = 'sms' | 'email';

export interface NotificationDraft {
  id: string;
  source: NotificationSource;
  /** 原始通知文字(完整保留,供重複貼上比對) */
  rawText: string;
  amountCents: number | null;
  /** YYYY-MM-DD(MM/DD 制式,年以 asOf 推斷;未來日期回推一年) */
  date: string | null;
  merchant: string | null;
  /** 寄件方(【XX銀行】標籤;商家辨識失敗時的顯示 fallback) */
  sender: string | null;
  cardLast4: string | null;
  createdAt: number;
}

/** 解析產物(NotificationDraft 減 id/source/rawText/createdAt) */
export interface DraftParse {
  amountCents: number | null;
  date: string | null;
  merchant: string | null;
  sender: string | null;
  cardLast4: string | null;
}

export type ParseErrorCode = 'empty' | 'noAmount';

export type ParseResult = { ok: true; parsed: DraftParse } | { ok: false; code: ParseErrorCode };

// —— 解析關鍵字(碼點常數機械組成;行尾註解標注實字便於審閱) ——
const cp = String.fromCodePoint;
const KW_NTD = cp(0x65b0, 0x53f0, 0x5e63); // 新台幣
const KW_YUAN = cp(0x5143); // 元
const KW_SPEND = cp(0x6d88, 0x8cbb); // 消費
const KW_SWIPE = cp(0x5237, 0x5361); // 刷卡
const KW_TXNWORD = cp(0x4ea4, 0x6613); // 交易
const KW_SHOPNAME = cp(0x5546, 0x5e97, 0x540d, 0x7a31); // 商店名稱
const KW_AMOUNTWORD = cp(0x91d1, 0x984d); // 金額
const KW_AT = cp(0x5728); // 在
const KW_AT2 = cp(0x65bc); // 於
const KW_LAST = cp(0x672b); // 末
const KW_FOUR = cp(0x56db); // 四
const KW_CODE = cp(0x78bc); // 碼
const KW_CARDNO = cp(0x5361, 0x865f); // 卡號
const KW_BUY = cp(0x8cfc, 0x7269); // 購物
const BR_L = cp(0x3010); // 【
const BR_R = cp(0x3011); // 】
const COMMA_F = cp(0xff0c); // ，
const PAUSE_M = cp(0x3001); // 、
const COLON_F = cp(0xff1a); // ：

const NUM = String.raw`\d[\d,]*(?:\.\d+)?`;

function parseCents(raw: string): number | null {
  const v = Math.round(parseFloat(raw.replace(/,/g, '')) * 100);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** 金額:依序嘗試 NT$/新台幣/金額/消費 定錨(先強後弱,避免誤抓卡號或日期) */
function amountOf(text: string): number | null {
  const patterns = [
    `NT\\$\\s*(${NUM})`,
    `${KW_NTD}\\s*(${NUM})\\s*${KW_YUAN}?`,
    `${KW_AMOUNTWORD}\\s*[:${COLON_F}]?\\s*(?:NT\\$)?\\s*(${NUM})`,
    `${KW_SPEND}\\s*(${NUM})\\s*${KW_YUAN}`,
  ];
  for (const p of patterns) {
    const m = new RegExp(p, 'i').exec(text);
    if (m?.[1]) {
      const cents = parseCents(m[1]);
      if (cents != null) return cents;
    }
  }
  return null;
}

/** 卡號末四碼:「末[4四]?碼」或「卡號」後的 4 位數字(整卡明碼不匹配) */
function last4Of(text: string): string | null {
  const patterns = [
    `${KW_LAST}\\s*[4${KW_FOUR}]?\\s*${KW_CODE}\\D{0,6}?(\\d{4})(?!\\d)`,
    `${KW_CARDNO}\\D{0,4}?(\\d{4})(?!\\d)`,
  ];
  for (const p of patterns) {
    const m = new RegExp(p).exec(text);
    if (m?.[1]) return m[1];
  }
  return null;
}

function isoOf(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 日期:優先西元 YYYY/MM/DD;否則 MM/DD(年以 asOf 推斷,未來 → 回推一年) */
function dateOf(text: string, asOf: string): string | null {
  const full = /(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(text);
  if (full) return isoOf(Number(full[1]), Number(full[2]), Number(full[3]));
  const md = /(?:^|\D)(\d{1,2})\/(\d{1,2})(?!\d)/.exec(text);
  if (!md) return null;
  const m = Number(md[1]);
  const d = Number(md[2]);
  const y = Number(asOf.slice(0, 4));
  const thisYear = isoOf(y, m, d);
  if (thisYear && thisYear <= asOf) return thisYear;
  return isoOf(y - 1, m, d) ?? thisYear;
}

/** 商家:優先「在/於 X 消費|刷卡|交易|購物」,fallback「商店名稱:X」。
 *  量詞採貪婪——回溯至「最後一個」動詞定錨,商家名內含「購物」等詞(蝦皮購物)不會被截斷。 */
function merchantOf(text: string): string | null {
  const stop = `[^,${COMMA_F}${PAUSE_M};\\s]`;
  const end = `${KW_SPEND}|${KW_SWIPE}|${KW_TXNWORD}|${KW_BUY}`;
  const anchored = new RegExp(`(?:${KW_AT}|${KW_AT2})\\s*(${stop}{1,24})\\s*(?:${end})`).exec(text);
  if (anchored?.[1]) return anchored[1];
  const shop = new RegExp(`${KW_SHOPNAME}\\s*[:${COLON_F}]\\s*(${stop}{1,24})`).exec(text);
  return shop?.[1] ?? null;
}

/** 寄件方:開頭【XX】標籤(銀行名) */
function senderOf(text: string): string | null {
  const m = new RegExp(`^\\s*${BR_L}([^${BR_R}]{1,20})${BR_R}`).exec(text);
  return m?.[1]?.trim() || null;
}

/** 解析通知文字;無法辨識金額即失敗(其餘欄位盡力而為,可為 null) */
export function parseNotification(text: string, asOf: string = todayKey()): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, code: 'empty' };
  const amountCents = amountOf(trimmed);
  if (amountCents == null) return { ok: false, code: 'noAmount' };
  return {
    ok: true,
    parsed: {
      amountCents,
      date: dateOf(trimmed, asOf),
      merchant: merchantOf(trimmed),
      sender: senderOf(trimmed),
      cardLast4: last4Of(trimmed),
    },
  };
}

/** 草稿 → TxnSheet 預填(分類預設 other——與 CSV 匯入同一慣例,確認前可改) */
export interface DraftPreset {
  date: string;
  amountCents: number;
  note: string;
  category: CategoryKey | null;
}

export function draftPreset(draft: NotificationDraft): DraftPreset {
  return {
    date: draft.date ?? todayKey(),
    amountCents: draft.amountCents ?? 0,
    note: (draft.merchant ?? draft.sender ?? '').trim(),
    category: 'other',
  };
}
