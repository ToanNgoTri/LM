// ── Text / TextInput có nhân cỡ chữ toàn app (fontScale) ───────────────────
// Thay thế trực tiếp cho Text/TextInput của react-native:
//   import { Text, TextInput } from '../theme';
// - fontSize/lineHeight trong style được nhân fontScale.
// - Text gốc (không lồng) không có fontSize -> dùng 14 * fontScale (14 là mặc
//   định của RN). Text lồng bên trong không có fontSize thì kế thừa cha, nên
//   không bị nhân hai lần.
// - noScale: giữ nguyên cỡ chữ (nội dung văn bản ở Detail5 có cỡ chữ riêng).
//   Text lồng bên trong kế thừa noScale của cha.
import { createContext, forwardRef, useContext } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
} from 'react-native';
import { useTheme } from './ThemeContext';

const RN_DEFAULT_FONT_SIZE = 14;

// null = không nằm trong Text nào; { noScale } = đang lồng trong Text.
const TextParent = createContext(null);

function scaleStyle(style, scale, isRoot) {
  const flat = StyleSheet.flatten(style) || {};
  const patch = {};
  if (flat.fontSize != null) patch.fontSize = flat.fontSize * scale;
  else if (isRoot) patch.fontSize = RN_DEFAULT_FONT_SIZE * scale;
  if (flat.lineHeight != null) patch.lineHeight = flat.lineHeight * scale;
  return Object.keys(patch).length ? [style, patch] : style;
}

export const Text = forwardRef(function Text({ style, noScale, ...props }, ref) {
  const { fontScale } = useTheme();
  const parent = useContext(TextParent);
  const skip = noScale ?? parent?.noScale ?? false;
  const finalStyle =
    skip || fontScale === 1 ? style : scaleStyle(style, fontScale, !parent);

  const el = <RNText ref={ref} style={finalStyle} {...props} />;
  if (parent && parent.noScale === skip) return el;
  return (
    <TextParent.Provider value={skip ? NO_SCALE : SCALE}>{el}</TextParent.Provider>
  );
});

const SCALE = { noScale: false };
const NO_SCALE = { noScale: true };

export const TextInput = forwardRef(function TextInput(
  { style, noScale, ...props },
  ref,
) {
  const { fontScale } = useTheme();
  const finalStyle =
    noScale || fontScale === 1 ? style : scaleStyle(style, fontScale, true);
  return <RNTextInput ref={ref} style={finalStyle} {...props} />;
});
