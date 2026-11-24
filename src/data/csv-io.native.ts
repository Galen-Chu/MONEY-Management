/**
 * CSV 檔案 IO(native 實作):expo-document-picker 選檔 + expo-file-system 新 API 讀文字。
 * web 實作見 csv-io.ts——Metro 按平台自動選檔。
 */
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';

/** 選 CSV/TXT 檔並讀為文字(UTF-8);取消/失敗回 null */
export async function pickCsvFile(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/plain', 'public.comma-separated-values-text', '*/*'],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (res.canceled) return null;
  const asset = res.assets[0];
  if (!asset) return null;
  try {
    return await new File(asset.uri).text();
  } catch {
    return null;
  }
}
