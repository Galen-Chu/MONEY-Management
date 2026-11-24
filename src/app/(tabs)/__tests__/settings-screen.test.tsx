/** 設定分頁渲染測試(RNTL):備份區塊(匯出/還原鈕、兩段式確認)。
 * 平台檔案 IO 以 mock 取代——不觸發瀏覽器下載/選檔。 */
import { render, fireEvent } from '@testing-library/react-native';

import i18n from '../../../i18n';
import SettingsScreen from '../settings';
import { __resetForTest as resetLoanStore } from '../../../state/loanStore';
import { __resetForTest as resetLedgerStore } from '../../../state/ledgerStore';
import { pickBackupFile } from '../../../data/backup-io';

void i18n;

jest.mock('../../../data/backup-io', () => ({
  shareBackupFile: jest.fn().mockResolvedValue(true),
  pickBackupFile: jest.fn().mockResolvedValue(null),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    resetLedgerStore();
    resetLoanStore();
  });

  it('備份區塊:標題/說明/匯出與還原鈕', async () => {
    const { getByText } = await render(<SettingsScreen />);
    expect(getByText('備份')).toBeTruthy();
    expect(getByText('匯出')).toBeTruthy();
    expect(getByText('還原')).toBeTruthy();
  });

  it('點匯出 → 成功訊息(mock IO)', async () => {
    const { getByText, findByText } = await render(<SettingsScreen />);
    await fireEvent.press(getByText('匯出'));
    expect(await findByText('已匯出')).toBeTruthy();
  });

  it('還原兩段式確認:第一次點 → 提示再確認,不觸發選檔', async () => {
    jest.useFakeTimers();
    try {
      const { getByText } = await render(<SettingsScreen />);
      await fireEvent.press(getByText('還原'));
      expect(getByText('再點一次確認還原')).toBeTruthy();
      expect(pickBackupFile).not.toHaveBeenCalled();
      jest.runAllTimers(); // 收掉 4 秒確認計時器,避免測試結束後殘留控制代碼
    } finally {
      jest.useRealTimers();
    }
  });
});
