/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */
// import {NavigationContainer} from '@react-navigation/native';
import StackNavigator from './navigators/AppNavigators';
import { createContext, useEffect, useState, useRef } from 'react';
import { Provider } from 'react-redux';
import { store } from './redux/store';
import {
  View,
  TouchableOpacity,
  Animated,
  ScrollView,
  Platform,
  BackHandler
} from 'react-native';
import { Text, ThemeProvider, useTheme } from './theme';
import { PolicyParagraphs } from './screens/components/PolicyContent';
import { compareVersion, openStore } from './utils/appInfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import VersionCheck from 'react-native-version-check';
import {
  APPEAR_FILE,
  migrateUserFiles,
  readUserJson,
  userFileExists,
  writeUserJson,
} from './storage/userFiles';
import { SubscriptionProvider } from './subscription/SubscriptionContext';
import { syncSuggestCache } from './screens/suggestCache';
import { ensureDefaultLaws } from './utils/defaultLaws';
const BoxInHomeScreen = createContext();
// const InfoDownloaded = createContext(); //
const RefOfHome = createContext(); //
// const RefOfSearchLaw = createContext(); //
// const RefOfSearchContent = createContext(); //

import Toast, { BaseToast } from 'react-native-toast-message';

const toastConfig = {
  success: props => (
    <BaseToast
      text1={props.text1} // 👈 Quan trọng
      text2={props.text2} // 👈 Quan trọng
      style={{
        borderLeftColor: '#4CAF50',
        backgroundColor: '#000000ff',
        borderRadius: 12,
        padding: 0,
        height: 40,
        // paddingVertical: 5,
        width: '70%',
        opacity: 0.7,
      }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
      }}
      // text2Style={{
      //   color: 'white',
      //   fontSize: 14,
      //   marginTop: 2
      // }}
    />
  ),
  copyToast: props => <ToastCustom {...props} />,
};

import Ionicons from '@react-native-vector-icons/ionicons';

const ToastCustom = ({ text1, text2 }) => {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 5,
        paddingLeft: 10,
        paddingRight: 10,
        backgroundColor: 'rgba(0,0,0,0.85)',
        // opacity: 0.9,
        borderRadius: 14,
      }}
    >
      <Ionicons
        name="copy-outline"
        size={22}
        color="#fff"
        style={{ marginRight: 10 }}
      />
      <View>
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>{text1}</Text>
        {text2 ? <Text style={{ color: '#fff' }}>{text2}</Text> : null}
      </View>
    </View>
  );
};

// Endpoint cấu hình cập nhật (Mongo LawMachine.AppConfig, _id='update') —
// thay việc gọi Store qua react-native-version-check để quyết định update.
const APP_CONFIG_URL =
  'https://us-central1-project2-197c0.cloudfunctions.net/appConfig';
const REPORT_VERSION_URL =
  'https://us-central1-project2-197c0.cloudfunctions.net/reportLatestVersion';

function AppContent() {
  const { colors } = useTheme();
  const [updateStatus, SetUpdateStatus] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  // latestVersion lấy từ appConfig, dùng lại trong nút Thoát/Chấp nhận (không gọi Store).
  const latestVersionRef = useRef('0');
  const [showPolicy, setShowPolicy] = useState(false);
  const [heightNotification, setHeightNotification] = useState(0);

  const [showBoxInHomeScreen, setShowBoxInHomeScreen] = useState(false);
  const updateShowBoxInHomeScreen = data => {
    setShowBoxInHomeScreen(data);
  };

  // const insets = useSafeAreaInsets();

  async function getPolicyAppear() {
    return !(await userFileExists(APPEAR_FILE));
  }

  async function exitUpdate() {
    const latestVersion = latestVersionRef.current;

    const contentAppear = await readUserJson(APPEAR_FILE, null);
    if (contentAppear) {
      contentAppear[latestVersion] = false;
      await writeUserJson(APPEAR_FILE, contentAppear);
    }
  }

  async function acceptUpdate() {
    const latestVersion = latestVersionRef.current;

    const contentAppear = await readUserJson(APPEAR_FILE, null);
    if (contentAppear) {
      contentAppear[latestVersion] = true;
      await writeUserJson(APPEAR_FILE, contentAppear);
    }
  }

  const checkForUpdate = async () => {
    try {
      // Phiên bản hiện tại đọc từ chính app.
      const currentVersion = VersionCheck.getCurrentVersion();
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';

      // Version mới nhất đọc từ Store theo nền tảng (iOS: iTunes; Android: Play).
      let storeVersion = '';
      try {
        storeVersion = String((await VersionCheck.getLatestVersion()) || '');
      } catch (e) {
        console.log('getLatestVersion error', e);
      }

      // Đồng bộ số này lên config Mongo (fire-and-forget, lỗi bỏ qua).
      // Backend chỉ ghi khi version cao hơn giá trị đang lưu.
      if (storeVersion) {
        fetch(REPORT_VERSION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ platform, version: storeVersion }),
        }).catch(() => {});
      }

      // Cấu hình từ backend: cờ force/should (BẠN quyết định) + mốc version đã lưu.
      const res = await fetch(APP_CONFIG_URL, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const cfg = await res.json();

      const configVersion = String(
        (platform === 'ios' ? cfg?.latestVersioniOS : cfg?.latestVersionAndroid) || '',
      );

      // So sánh dùng số Store vừa đọc; nếu Store trả rỗng thì dùng mốc trong config.
      const latestVersion = storeVersion || configVersion;
      latestVersionRef.current = latestVersion;

      // Không biết được bản mới nhất -> KHÔNG chặn (tránh khóa nhầm người dùng).
      if (!latestVersion) return;

      // Chỉ nhắc/chặn khi app đang CŨ hơn bản mới nhất.
      const outdated = compareVersion(currentVersion, latestVersion) < 0;
      if (!outdated) return;

      // forceUpdate: chặn cứng — không cho thoát, không phụ thuộc Appear.txt.
      if (cfg?.forceUpdate === true) {
        setForceUpdate(true);
        SetUpdateStatus(true);
        return;
      }

      // shouldUpdate: nhắc mềm — vẫn tôn trọng lựa chọn "đã tắt" theo từng phiên bản.
      if (cfg?.shouldUpdate === true) {
        const contentAppear = await readUserJson(APPEAR_FILE, null);
        const dismissed = !!(contentAppear && contentAppear[latestVersion]);
        if (!dismissed) SetUpdateStatus(true);
      }
    } catch (e) {
      // Lỗi mạng/parse không được chặn app.
      console.log('checkForUpdate error', e);
    }
  };

  useEffect(() => {
    // Chuyển dữ liệu người dùng từ CacheDir (bị HĐH xoá định kỳ) sang
    // DocumentDir. Mọi hàm đọc/ghi trong storage/userFiles đều chờ bước này.
    migrateUserFiles();

    getPolicyAppear().then(status => setShowPolicy(status));

    checkForUpdate();

    // Đồng bộ cache gợi ý ngay khi mở app (chạy nền, không chặn UI).
    // Nhờ vậy lawRelated ở Detail5 luôn có tên mới nhất để tra.
    syncSuggestCache();

    // Người dùng mới cài: tự tải văn bản mặc định (DefaultLaws) vào "Đã tải xuống".
    ensureDefaultLaws();
  }, []);

  // Khi force update: chặn nút back cứng (Android) để không thoát được app.
  useEffect(() => {
    if (!forceUpdate) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [forceUpdate]);

  const [homeRef, setHomeRef] = useState('');
  const updateHomeRef = data => {
    setHomeRef(data);
  };

  const animated = useRef(new Animated.Value(0)).current;

  let Opacity = animated.interpolate({
    inputRange: [0, 100],
    outputRange: [0.5, 0],
  });

  let Scale = animated.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
  });

  //  console.log('bottom',insets)
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
   <SafeAreaView  style={{ flex: 1 }} edges={[Platform.OS === 'ios' ? null : null]}>
        <Provider store={store}>
          <SubscriptionProvider>
          <BoxInHomeScreen.Provider
            value={{ showBoxInHomeScreen, updateShowBoxInHomeScreen }}
          >
            <RefOfHome.Provider value={{ homeRef, updateHomeRef }}>
              {(showPolicy || updateStatus) && ( 

                <>
                  <Animated.View
                    style={{
                      backgroundColor: colors.shadow,
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      display: 'flex',
                      position: 'absolute',
                      opacity: Opacity,
                      zIndex: 100,
                    }}
                  >
                    <TouchableOpacity //overlay
                      style={{
                        left: 0,
                        right: 0,
                        top: 0,
                        bottom: 0,
                        display: 'flex',
                        position: 'absolute',
                        zIndex: 100,
                      }}
                    ></TouchableOpacity>
                  </Animated.View>

                  <Animated.View
                    onLayout={event => {
                      event.target.measure(
                        (x, y, width, height, pageX, pageY) => {
                          setHeightNotification(height);
                        },
                      );
                    }}
                    style={{
                      position: 'absolute',
                      // top: updateStatus ? 200 : 80,
                      // bottom: updateStatus ? 300 : 60,
                      // minHeight: updateStatus ? 210 : 500,
                      zIndex: 100,

                      top: '50%',
                      maxHeight: updateStatus ? 500 : '75%',

                      right: 50,
                      left: 50,
                      backgroundColor: colors.surface,
                      display: 'flex',
                      borderRadius: 20,
                      transform: [
                        { scale: Scale },
                        { translateY: -heightNotification / 2 },
                      ],
                      overflow: 'hidden',
                      shadowColor: colors.shadow,
                      shadowOpacity: 1,
                      shadowOffset: {
                        width: 10,
                        height: 10,
                      },
                      shadowRadius: 4,
                      elevation: 20,
                    }}
                  >
                    {!updateStatus ? (
                      /* ================= POLICY ================= */
                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 20 }}
                      >
                        {/* Header */}
                        <View
                          style={{
                            alignItems: 'center',
                            marginTop: 24,
                            marginBottom: 16,
                            zIndex: 100,
                          }}
                        >
                          <Ionicons
                            name="document-text-outline"
                            size={48}
                            color={colors.primaryText}
                          />
                          <Text
                            style={{
                              fontSize: 26,
                              fontWeight: 'bold',
                              color: colors.text,
                              marginTop: 10,
                            }}
                          >
                            Lời mở đầu
                          </Text>
                        </View>

                        <PolicyParagraphs />
                      </ScrollView>
                    ) : (
                      /* ================= UPDATE ================= */
                      <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 20 }}
                      >
                        {/* Header */}
                        <View
                          style={{
                            alignItems: 'center',
                            marginTop: 28,
                            marginBottom: 16,
                            zIndex: 100,
                          }}
                        >
                          <Ionicons
                            name="cloud-download-outline"
                            size={56}
                            color={colors.primaryText}
                          />
                          <Text
                            style={{
                              fontSize: 26,
                              fontWeight: 'bold',
                              color: colors.text,
                              marginTop: 12,
                            }}
                          >
                            Cập nhật mới
                          </Text>
                        </View>

                        {/* Content */}
                        <Text
                          style={{
                            fontSize: 16,
                            lineHeight: 22,
                            color: colors.textSecondary,
                            textAlign: 'center',
                            paddingHorizontal: 24,
                          }}
                        >
                          Sổ Tay Luật đã có phiên bản mới với nhiều cải tiến và
                          tính năng hữu ích. Bạn nên cập nhật để có trải nghiệm
                          tốt nhất.
                        </Text>
                      </ScrollView>
                    )}

                    {!updateStatus ? (
                      <TouchableOpacity
                        style={{
                          backgroundColor: colors.primary,
                        }}
                        onPress={async () => {
                          let timeOut = setTimeout(() => {
                            setShowPolicy(false);
                            return () => {};
                          }, 100);

                          const currentVersion =
                            VersionCheck.getCurrentVersion();

                          await writeUserJson(APPEAR_FILE, {
                            [currentVersion]: false,
                          });

                          Animated.timing(animated, {
                            toValue: showPolicy || updateStatus ? 100 : 0,
                            // toValue:100,
                            duration: 100,
                            useNativeDriver: false,
                          }).start();
                        }}
                      >
                        <Text
                          style={{
                            paddingBottom: 10,
                            paddingTop: 10,
                            textAlign: 'center',
                            color: colors.onPrimary,
                            fontWeight: 'bold',
                            fontSize: 16,
                          }}
                        >
                          Chấp nhận chính sách và tiếp tục
                        </Text>
                      </TouchableOpacity>
                    ) : forceUpdate ? (
                      /* ===== FORCE: chỉ có nút Cập nhật, KHÔNG cho thoát ===== */
                      <TouchableOpacity
                        style={{ backgroundColor: colors.primary, width: '100%' }}
                        onPress={() => openStore()}
                      >
                        <Text
                          style={{
                            paddingBottom: 10,
                            paddingTop: 10,
                            textAlign: 'center',
                            color: colors.onPrimary,
                            fontWeight: 'bold',
                            fontSize: 16,
                          }}
                        >
                          Cập nhật ngay để tiếp tục
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ flexDirection: 'row', width: '100%' }}>
                        <TouchableOpacity
                          style={{
                            backgroundColor: colors.primary,
                            width: '50%',
                          }}
                          onPress={async () => {
                            let timeOut = setTimeout(() => {
                              setShowPolicy(false);
                              SetUpdateStatus(false);
                              return () => {};
                            }, 100);
                            exitUpdate();

                            Animated.timing(animated, {
                              toValue: showPolicy || updateStatus ? 100 : 0,
                              // toValue:100,
                              duration: 100,
                              useNativeDriver: false,
                            }).start();

                            openStore();
                          }}
                        >
                          <Text
                            style={{
                              paddingBottom: 10,
                              paddingTop: 10,
                              textAlign: 'center',
                              color: colors.onPrimary,
                              fontWeight: 'bold',
                              fontSize: 16,
                            }}
                          >
                            Cập nhật
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{
                            backgroundColor: colors.primary,
                            width: '50%',
                            borderLeftColor: colors.onPrimary,
                            borderLeftWidth: 1,
                          }}
                          onPress={async () => {
                            let timeOut = setTimeout(() => {
                              setShowPolicy(false);
                              SetUpdateStatus(false);
                              return () => {};
                            }, 100);

                            acceptUpdate();
                            Animated.timing(animated, {
                              toValue: showPolicy || updateStatus ? 100 : 0,
                              duration: 100,
                              useNativeDriver: false,
                            }).start();
                          }}
                        >
                          <Text
                            style={{
                              paddingBottom: 10,
                              paddingTop: 10,
                              textAlign: 'center',
                              color: colors.onPrimary,
                              fontWeight: 'bold',
                              fontSize: 16,
                            }}
                          >
                            Thoát
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Animated.View>
                </>
              )}
              <View
              style={{
                flex: 1,
                display: 'flex',
                // paddingBottom: Platform.OS == 'ios' ? insets.bottom/2:insets.bottom,
                // paddingTop: insets.top,
              }}
            >

              <StackNavigator />
              </View>
            </RefOfHome.Provider>
          </BoxInHomeScreen.Provider>
          </SubscriptionProvider>
        </Provider>
        <Toast config={toastConfig} />
      </SafeAreaView>
         {/* <View
        style={{
          height: Platform.OS === 'ios' ? insets.bottom * 3 / 2 : insets.bottom *2,
          width: '100%',
          // height:100,
          backgroundColor: 'black',
          position: 'absolute',
          bottom:Platform.OS === 'ios' ?-insets.bottom:-insets.bottom ,
          left:0,
          zIndex:1,
        }}
        >
        </View> */}

    </GestureHandlerRootView>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
export { BoxInHomeScreen, RefOfHome };
