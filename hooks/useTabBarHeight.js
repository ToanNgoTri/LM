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

  if (Platform.OS === 'ios') {
    // Tab bar height 67 (đúng với code navigator của bạn)
    return 20 +insets.bottom; // iOS: 67 + insets.bottom (để tránh bị che khi có home indicator)
  } else {
    // Android: 48 + insets.bottom (khớp với navigator)
    return 37 + insets.bottom ;
  }
};