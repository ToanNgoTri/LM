import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Trả về paddingBottom cần thiết để content không bị tab bar che
 * Dùng trong tất cả các screen bên trong Tab.Navigator
 *
 * Ví dụ:
 *   const tabBarHeight = useTabBarHeight();
 *   <ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight }}>
 *   hoặc
 *   <View style={{ flex:1, paddingBottom: tabBarHeight }}>
 */
export const useTabBarHeight = () => {
  const insets = useSafeAreaInsets();

  // Tab bar (AppNavigators.js) có position:absolute, bottom:-5 (thò xuống dưới
  // mép màn hình 5px) và height = tabHeight. Phần THỰC SỰ che nội dung = tabHeight - 5.
  //   tabHeight: iOS = insets.bottom + 30, Android = 48 + insets.bottom
  // -> chừa đúng phần bị che để item cuối sát tab bar, không dư cũng không bị che.
  if (Platform.OS === 'ios') {
    return 25 + insets.bottom;
  } else {
    return 43 + insets.bottom;
  }
};