/**
 * CSV 檔案 IO(web 實作):input file 選檔讀文字(UTF-8)。
 * native 實作見 csv-io.native.ts——Metro 按平台自動選檔(同 db.ts 模式)。
 */
export async function pickCsvFile(): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,text/csv,text/plain';
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
