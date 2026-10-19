// ── Theme toàn app: chế độ sáng/tối + cỡ chữ ───────────────────────────────
// Lưu trong SETTINGS_FILE (themeMode, fontScale). Trước khi đọc xong file thì
// dùng mặc định: theo hệ thống, cỡ chữ "Vừa".
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { StatusBar, StyleSheet, useColorScheme } from 'react-native';
import { light, dark } from './colors';
import { readUserSettings, updateUserSettings } from '../storage/userFiles';

export const THEME_MODES = [
  { key: 'system', label: 'Theo hệ thống', icon: 'phone-portrait-outline' },
  { key: 'light', label: 'Sáng', icon: 'sunny-outline' },
  { key: 'dark', label: 'Tối', icon: 'moon-outline' },
];

export const FONT_SCALES = [
  { key: 'small', label: 'Nhỏ', value: 0.9 },
  { key: 'normal', label: 'Vừa', value: 1 },
  { key: 'large', label: 'Lớn', value: 1.15 },
  { key: 'xlarge', label: 'Rất lớn', value: 1.3 },
];

const isValidScale = v => FONT_SCALES.some(s => s.value === v);

const ThemeContext = createContext({
  mode: 'system',
  isDark: false,
  colors: light,
  fontScale: 1,
  settingsLoaded: false,
  setMode: () => {},
  setFontScale: () => {},
});

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState('system');
  const [fontScale, setFontScaleState] = useState(1);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    readUserSettings().then(s => {
      if (THEME_MODES.some(m => m.key === s.themeMode)) setModeState(s.themeMode);
      if (isValidScale(s.fontScale)) setFontScaleState(s.fontScale);
      setSettingsLoaded(true);
    });
  }, []);

  const setMode = useCallback(m => {
    setModeState(m);
    updateUserSettings({ themeMode: m });
  }, []);

  const setFontScale = useCallback(v => {
    if (!isValidScale(v)) return;
    setFontScaleState(v);
    updateUserSettings({ fontScale: v });
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && system === 'dark');

  const value = useMemo(
    () => ({
      mode,
      isDark,
      colors: isDark ? dark : light,
      fontScale,
      settingsLoaded,
      setMode,
      setFontScale,
    }),
    [mode, isDark, fontScale, settingsLoaded, setMode, setFontScale],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={value.colors.statusBarStyle}
        backgroundColor={value.colors.statusBar}
      />
      {/* Chờ đọc xong settings (vài ms) rồi mới vẽ app: tránh loé sai theme
          và tránh Home phải đo lại card khi fontScale đổi ngay sau khi mở. */}
      {settingsLoaded ? children : null}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

/**
 * StyleSheet đổi theo theme. factory là hàm ở cấp module:
 *   const makeStyles = (c, isDark) => ({ box: { backgroundColor: c.bg } });
 *   const styles = useThemedStyles(makeStyles);
 */
export function useThemedStyles(factory) {
  const { colors, isDark } = useTheme();
  return useMemo(
    () => StyleSheet.create(factory(colors, isDark)),
    [factory, colors, isDark],
  );
}
