/**
 * 備份檔案 IO(web 實作):瀏覽器下載(blob+anchor)與選檔(input file)。
 * native 實作見 backup-io.native.ts——Metro 按平台自動選檔(同 db.ts 模式)。
 */
import { backupFileName } from '../domain/backup';

/** 匯出:觸發瀏覽器下載;成功回 true */
export async function shareBackupFile(text: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** 選檔並讀為文字;取消/失敗回 null */
export async function pickBackupFile(): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) {
        resolve(null);
        return;
      }
      f.text()
        .then((t) => resolve(t))
        .catch(() => resolve(null));
    };
    input.click();
  });
}
