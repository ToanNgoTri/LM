import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Chiều cao phần nội dung (icon + label) của thanh tab, CHƯA tính safe-area.
 * Dùng chung với CustomTabBar trong navigators/AppNavigators.js để chỉ có
 * MỘT nguồn sự thật về kích thước tab bar.
 */
export const TAB_CONTENT_HEIGHT = 48;

/** Độ dày viền đen của thanh tab (vẽ phía TRÊN phần nội dung). */
export const TAB_BAR_BORDER_WIDTH = 2;

/** Chiều cao phần nội dung của thanh chức năng trong màn đọc văn bản (Detail5). */
export const FUNCTION_TAB_CONTENT_HEIGHT = 44;

// insets.bottom từ ngưỡng này trở lên = thanh điều hướng 3 NÚT (~48dp):
// hệ thống vẽ nút đặc ở đó nên phải chừa đủ, không được cắt bớt.
const NAV_BUTTONS_INSET = 40;
// Chế độ VUỐT chỉ có thanh pill mỏng (~4dp) nằm giữa vùng inset (~16-24dp).
// Chừa trọn inset làm thanh bị "hụt" một dải trắng ở dưới -> nội dung trông
// lệch lên trên. Chỉ cần chừa chừng này là pill vẫn thoáng mà thanh cân đối.
const GESTURE_INSET = 12;

/**
 * Phần safe-area dưới mà một thanh ghim đáy cần chừa.
 * - 3 nút  -> chừa trọn insets.bottom (nếu không icon sẽ nằm dưới nút hệ thống)
 * - Vuốt   -> chừa GESTURE_INSET, đủ thoáng pill mà không dư dải trắng
 */
export const useBottomBarInset = () => {
  const insets = useSafeAreaInsets();
  if (insets.bottom >= NAV_BUTTONS_INSET) return insets.bottom;
  return Math.min(insets.bottom, GESTURE_INSET);
};

/**
 * Trả về paddingBottom cần thiết để content không bị tab bar che.
 * Dùng trong tất cả các screen bên trong Tab.Navigator.
 *
 * Ví dụ:
 *   const tabBarHeight = useTabBarHeight();
 *   <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight }}>
 */
export const useTabBarHeight = () =>
  TAB_CONTENT_HEIGHT + TAB_BAR_BORDER_WIDTH + useBottomBarInset();

/** Chiều cao thật của thanh chức năng màn đọc văn bản (Detail5). */
export const useFunctionTabHeight = () =>
  FUNCTION_TAB_CONTENT_HEIGHT + useBottomBarInset();
