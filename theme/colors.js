// ── Bảng màu theo ngữ nghĩa (không đặt tên theo màu) ───────────────────────
// Màn hình chỉ dùng các key dưới đây: colors.bg, colors.text...
// Bản sáng giữ nhận diện cũ của app (xanh lá + nền trắng); bản tối lấy từ
// bảng màu Chat AI cũ (#0D0D14 / #1A1A2E / #6C63FF).
// Màu dùng một lần ở một màn thì viết tại chỗ: isDark ? a : b.

export const light = {
  // Nền
  bg: '#FFFFFF', // nền màn hình
  bgAlt: '#F4F5F7', // nền phụ (vùng nhóm, nền danh sách)
  surface: '#FFFFFF', // sheet, modal, panel nổi
  card: '#FFFFFF',
  cardAlt: '#F2F2F2', // card phụ, ô được chọn nhạt
  // Chữ
  text: '#000000',
  textSecondary: '#333333',
  textMuted: '#808080',
  placeholder: '#808080',
  textInverse: '#FFFFFF', // chữ trên nền đảo (ví dụ nền đen ở bản sáng)
  // Viền
  border: '#CCCCCC',
  borderStrong: '#000000',
  divider: '#EEEEEE',
  // Thương hiệu
  primary: '#008000', // nền header/nút xanh lá
  primaryText: '#008000', // chữ/icon xanh lá đặt trên nền bg
  onPrimary: '#FFFFFF', // chữ/icon trên nền primary
  primarySoft: '#A9EBB8',
  accent: '#6C63FF', // tím (Chat AI, Premium)
  onAccent: '#FFFFFF',
  accentSoft: '#ECEBFF',
  // Trạng thái
  danger: '#E5484D',
  warning: '#F67C1A',
  success: '#26A69A',
  star: '#FFB300', // đánh dấu / bookmark
  link: '#0000FF',
  highlightBg: '#FFFF00', // tô từ khoá tìm kiếm
  highlightText: '#000000',
  // Khác
  overlay: 'rgba(0,0,0,0.5)',
  shadow: '#000000',
  inputBg: '#FFFFFF',
  statusBar: '#008000',
  statusBarStyle: 'light-content',
  // Thanh tab dưới
  tabBar: '#FFFFFF',
  tabBorder: '#000000',
  tabRibbon: '#A9EBB8',
  tabIconActive: '#070303',
  tabIconInactive: '#8A93A8',
  tabLabel: '#5B6478',
};

export const dark = {
  bg: '#0D0D14',
  bgAlt: '#13131F',
  surface: '#13131F',
  card: '#1A1A2E',
  cardAlt: '#252540',
  text: '#F0F0FA',
  textSecondary: '#D0D0E8',
  textMuted: '#8A8AA8',
  placeholder: '#6A6A88',
  textInverse: '#0D0D14',
  border: '#2E2E48',
  borderStrong: '#4A4A68',
  divider: '#252540',
  primary: '#14532D',
  primaryText: '#4ADE80',
  onPrimary: '#FFFFFF',
  primarySoft: '#1F3D2A',
  accent: '#6C63FF',
  onAccent: '#FFFFFF',
  accentSoft: '#1E1B3A',
  danger: '#FF6B6F',
  warning: '#FFA14A',
  success: '#22D3A0',
  star: '#FFC94D',
  link: '#66CCFF',
  highlightBg: '#7A6A00',
  highlightText: '#FFFFFF',
  overlay: 'rgba(0,0,0,0.7)',
  shadow: '#000000',
  inputBg: '#1A1A2E',
  statusBar: '#0D0D14',
  statusBarStyle: 'light-content',
  tabBar: '#13131F',
  tabBorder: '#2E2E48',
  tabRibbon: '#1F3D2A',
  tabIconActive: '#F0F0FA',
  tabIconInactive: '#6A6A88',
  tabLabel: '#8A8AA8',
};
