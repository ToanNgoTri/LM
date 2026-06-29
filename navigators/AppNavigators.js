import { NavigationContainer } from '@react-navigation/native';
import { useDispatch } from 'react-redux';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { useEffect, useContext, useRef, useState, useInsertionEffect } from 'react';
import Home from '../screens/Home';
import { Detail1 } from '../screens/Detail1';
import { Detail2 } from '../screens/Detail2';
import { AIChatScreen } from '../screens/chatAI';
import { Detail5 } from '../screens/Detail5';
import { useNetInfo } from '@react-native-community/netinfo';
import { RefOfHome } from '../App';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';

// ─────────────────────────────────────────────────────────────
// SearchStack
// Giữ native-stack (touch hoạt động bình thường). State filter của
// hai màn (từ khóa, checkbox cơ quan, khoảng ngày) được lưu ở Redux
// (slice filterUI) nên không bị mất khi chuyển qua lại giữa Detail1/Detail2.
// ─────────────────────────────────────────────────────────────
const SearchStackNav = createNativeStackNavigator();
function SearchStack() {
  return (
    <SearchStackNav.Navigator screenOptions={{ headerShown: false, animation: 'none' }}>
      <SearchStackNav.Screen name="SearchLaw" component={Detail2} />
      <SearchStackNav.Screen name="Search" component={Detail1} />
    </SearchStackNav.Navigator>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab config
// ─────────────────────────────────────────────────────────────
const TAB_ITEMS = [
  { name: 'Home',        label: 'Đã tải xuống', iconActive: 'home',     iconInactive: 'home-outline'     },
  { name: 'SearchStack', label: 'Tìm kiếm',     iconActive: 'search',   iconInactive: 'search-outline'   },
  { name: 'AIChat',      label: 'Chat AI',       iconActive: 'sparkles', iconInactive: 'sparkles-outline' },
];

// ─────────────────────────────────────────────────────────────
// TabItem
// ─────────────────────────────────────────────────────────────
function TabItem({ tabIndex, currentIdx, label, iconActive, iconInactive, onPress, tabWidth, tabHeight, anim }) {
  const isActive = currentIdx === tabIndex;
  const insets = useSafeAreaInsets();
  const ribbonScaleX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' });
  const iconScale    = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2], extrapolate: 'clamp' });
  const labelOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0], extrapolate: 'clamp' });
  const labelScale   = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.5], extrapolate: 'clamp' });

  // ✅ Khi active: icon nhảy xuống ~8px để bù khoảng label biến mất
  const iconTranslateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 4], extrapolate: 'clamp' });

  return (
    <TouchableOpacity
      style={{ width: tabWidth, height: tabHeight, alignItems: 'center', justifyContent: 'center',transform: [{ translateY: -insets.bottom/4 }], // ✅ nhích cả item lên 4px
  }}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Icon + ribbon dịch xuống khi active */}
      <Animated.View style={{
        alignItems: 'center',
        transform: [{ scale: iconScale }, { translateY: iconTranslateY }],
      }}>
        <Animated.View
          style={{
            width: 70, height: 29, borderRadius: 10,
            backgroundColor: '#996600',
            position: 'absolute', alignSelf: 'center',
            transform: [{ scaleX: ribbonScaleX }],
          }}
        />
        <Ionicons
          name={isActive ? iconActive : iconInactive}
          style={isActive ? styles.IconActive : styles.IconInActive}
        />
      </Animated.View>

      {/* Label fade + scale tại chỗ */}
      <Animated.Text
        style={{
          color: 'black', fontSize: 11, fontWeight: 'bold', marginTop: 2,
          opacity: labelOpacity,
          transform: [{ scale: labelScale }],
        }}
      >
        {label}
      </Animated.Text>
    </TouchableOpacity>
  );
}
// ─────────────────────────────────────────────────────────────
// CustomTabBar — tách riêng để dùng useEffect theo state.index
// ─────────────────────────────────────────────────────────────
function CustomTabBar({ navigation, state, anims, animateTo, tabHeight, tabWidth, HomeScreen }) {
  const idx = state.index;

  // sync animation khi swipe hoặc nhấn
  useEffect(() => {
    animateTo(idx);
  }, [idx]);

    const insets     = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        bottom: Platform.OS === 'ios' ? -5: -5,
        position: 'absolute',
        width: '100%',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        height: tabHeight,
        borderTopRightRadius: 15,
        borderTopLeftRadius: 15,
        backgroundColor: '#F8BD2D',
      }}
    >
      {TAB_ITEMS.map((item, i) => (
        <TabItem
          key={item.name}
          tabIndex={i}
          currentIdx={idx}
          label={item.label}
          iconActive={item.iconActive}
          iconInactive={item.iconInactive}
          tabWidth={tabWidth}
          tabHeight={tabHeight}
          anim={anims[i]}
          onPress={() => {
            if (idx === i) {
              if (i === 0 && HomeScreen?.homeRef) HomeScreen.homeRef.scrollToOffset({ offset: 0 });
              if (i === 1 && global.SearchLawRef) global.SearchLawRef.scrollToOffset({ offset: 0 });
              if (i === 2 && global.SearchContentRef) global.SearchContentRef.scrollToOffset({ offset: 0 });
              return;
            }
            animateTo(i);
            navigation.navigate(item.name);
          }}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab Navigator
// ─────────────────────────────────────────────────────────────
const Tab = createMaterialTopTabNavigator();

const AppNavigators = () => {
  const insets     = useSafeAreaInsets();
  const HomeScreen = useContext(RefOfHome);
  const { width }  = Dimensions.get('window');
  const [widthDevice, setWidthDevice] = useState(width);

  // Mỗi tab có Animated.Value riêng: 0 = inactive, 1 = active
  const anims = useRef(TAB_ITEMS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window: { width: w } }) => setWidthDevice(w));
    return () => sub?.remove();
  }, []);

  const tabHeight = Platform.OS === 'ios' ? insets.bottom+30 : 48 + insets.bottom;
  const tabWidth  = widthDevice / 3 - 30;

  const animateTo = (idx) => {
    Animated.parallel(
      anims.map((anim, i) =>
        Animated.timing(anim, {
          toValue: i === idx ? 1 : 0,
          duration: 220,
          useNativeDriver: true,
        })
      )
    ).start();
  };

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        backBehavior="none"
        tabBar={(props) => (
          <CustomTabBar
            {...props}
            anims={anims}
            animateTo={animateTo}
            tabHeight={tabHeight}
            tabWidth={tabWidth}
            HomeScreen={HomeScreen}
          />
        )}
        tabBarPosition="bottom"
        screenOptions={{
          swipeEnabled:false,
          animationEnabled: false,
          lazy: false,
          tabBarIndicatorStyle: { display: 'none' },
          tabBarPressColor: 'transparent',
        }}
      >
        <Tab.Screen
          name="Home"
          component={Home}
          options={{ header: () => null, tabBarLabel: () => null   }}
        />
        <Tab.Screen
          name="SearchStack"
          component={SearchStack}
          options={{ header: () => null, tabBarLabel: () => null}}
        />
        <Tab.Screen
          name="AIChat"
          component={AIChatScreen}
          options={{ header: () => null, tabBarLabel: () => null}}
        />
      </Tab.Navigator>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// Root Stack
// ─────────────────────────────────────────────────────────────
const Stack = createNativeStackNavigator();

const StackNavigator = () => {
  const netInfo  = useNetInfo();
  const dispatch = useDispatch();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: 'green' },
          headerBlurEffect: 'extraLight',
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="HomeStack"
          component={AppNavigators}
          options={{ header: () => null }}
        />
        <Stack.Screen
          name="accessLaw"
          component={Detail5}
          options={{
            header: () => null,
            animation: 'simple_push',
            animationTypeForReplace: 'push',
            headerTitleAlign: 'center',
          }}
        />
        <Stack.Screen
          name="SearchContent"
          component={Detail1}
          options={{ header: () => null, animation: 'simple_push' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  IconActive:   { fontSize: 24, color: 'white', padding: 0, margin: 0, lineHeight: 28 },
  IconInActive: { fontSize: 24, color: 'black', padding: 0, lineHeight: 23 },
  IconInfo:     { fontSize: 30, color: 'white' },
  iconInfoContainer: { height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 25 },
});

export default StackNavigator;