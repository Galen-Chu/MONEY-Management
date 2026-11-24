/**
 * 備份檔案 IO(native 實作):expo-file-system 新 API(File/Paths)寫入快取
 * + expo-sharing 系統分享;還原走 expo-document-picker 選檔後讀文字。
 * web 實作見 backup-io.ts——Metro 按平台自動選檔。
 */
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { backupFileName } from '../domain/backup';

/** 匯出:寫入快取檔後開系統分享面板(另存/存到「檔案」);成功回 true */
export async function shareBackupFile(text: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  const file = new File(Paths.cache, backupFileName());
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
  return true;
}

/** 選檔並讀為文字;取消/失敗回 null */
export async function pickBackupFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (!asset) return null;
  return await new File(asset.uri).text();
}
