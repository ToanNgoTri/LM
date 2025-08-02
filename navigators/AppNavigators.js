import { NavigationContainer } from '@react-navigation/native';
// import {TouchableOpacity} from 'react-native-gesture-handler'
import { useSelector, useDispatch } from 'react-redux';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
// import database from '@react-native-firebase/database';
import { useEffect, useContext, useRef, useState } from 'react';
import Home from '../screens/Home';
import { Detail1 } from '../screens/Detail1';
import { Detail2 } from '../screens/Detail2';
// import Detail4 from '../screens/Detail4';
import { Detail5 } from '../screens/Detail5';
import { useNetInfo } from '@react-native-community/netinfo';
import {
  RefOfHome,
  // BoxInHomeScreen
} from '../App';
import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

const Tab = createMaterialTopTabNavigator();

const AppNavigators = () => {
  const insets = useSafeAreaInsets(); // lất chiều cao để manu top iphone
  // const BoxInHomeScreenStatus = useContext(BoxInHomeScreen);
  // const SearchLawScreen = useContext(RefOfSearchLaw);
  const HomeScreen = useContext(RefOfHome);
  // const SearchContentScreen = useContext(RefOfSearchContent);

  const { width, height } = Dimensions.get('window');
  const [widthDevice, setWidthDevice] = useState(width);
  Dimensions.addEventListener('change', ({ window: { width, height } }) => {
    heightDevice = height;
    setWidthDevice(width);
  });

  // const [lastedScreenIndex, setLastedScreenIndex] = useState(0);

  const animatedForHomeTab = useRef(new Animated.Value(60)).current;

  let homeTabRibbon = animatedForHomeTab.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 70],
  });

  let homeTabTitleHeight = animatedForHomeTab.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
  });

  let homeTabIconSize = animatedForHomeTab.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 1.2],
  });

  const animatedForSearchLaw = useRef(new Animated.Value(0)).current;

  let searchLawRibbon = animatedForSearchLaw.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 70],
  });

  let searchLawTabTitleHeight = animatedForSearchLaw.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
  });

  let searchLawTabIconSize = animatedForSearchLaw.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 1.2],
  });

  const animatedForSearchContent = useRef(new Animated.Value(0)).current;

  let searchContentRibbon = animatedForSearchContent.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 70],
  });

  let searchContentTabTitleHeight = animatedForSearchContent.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 0],
  });

  let searchContentTabIconSize = animatedForSearchContent.interpolate({
    inputRange: [0, 60],
    outputRange: [1, 1.2],
  });

  const animated = useRef(new Animated.Value(0)).current;

  // let translateY = animated.interpolate({
  //   inputRange: [0, 100],
  //   outputRange: [0, 100],
  // });

  let Opacity = animated.interpolate({
    inputRange: [0, 100],
    outputRange: [0.5, 0],
  });

  // useEffect(() => {
  //   Animated.timing(animated, {
  //     toValue: BoxInHomeScreenStatus.showBoxInHomeScreen ? 0 : 100,
  //     // toValue:100,
  //     duration: 200,
  //     useNativeDriver: false,
  //   }).start();
  // }, [BoxInHomeScreenStatus.showBoxInHomeScreen]);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        backBehavior="none"
        tabBar={({ navigation, state, descriptors, position }) => {
          if (
            state.index == position._a._value &&
            state.index == 0 &&
            HomeScreen.homeRef
          ) {
            HomeScreen.homeRef.scrollToOffset({ offset: 0 });
          } else if (
            state.index == position._a._value &&
            state.index == 1 &&
            global.SearchLawRef
          ) {
            global.SearchLawRef.scrollToOffset({ offset: 0 });
          } else if (
            state.index == position._a._value &&
            state.index == 2 &&
            global.SearchContentRef
          ) {
            global.SearchContentRef.scrollToOffset({ offset: 0 });
          }

          return (
            <View
              style={{
                flexDirection: 'row',
                bottom: -10,
                position: 'absolute',
                backgroundColor: 'white',
                width: '100%',
                justifyContent: 'space-around',
                alignItems: 'center',
                height: 60 + insets.bottom / 2,
                borderTopRightRadius: 15,
                borderTopLeftRadius: 15,
                display: 'flex',
                backgroundColor: '#F8BD2D',
                alignContent: 'center',
                overflow: 'hidden',
              }}
            >
              <Animated.View
                style={{
                  alignItems: 'center',
                  minWidth: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  justifyContent: 'center',
                  position: 'relative',
                  height: 44,
                  bottom: 7 + insets.bottom / 6,
                  transform: [{ scale: homeTabIconSize }, { translateX: 7 }],
                }}
              >
                <TouchableOpacity
                  style={{
                    width: widthDevice / 3,
                    height: 100,
                    // backgroundColor: 'red',
                    justifyContent: 'center',
                    display: 'flex',
                  }}
                  onPress={() => {
                    navigation.navigate('Home');

                    Animated.timing(animatedForHomeTab, {
                      toValue: 60,
                      // toValue:100,
                      duration: 300,
                      useNativeDriver: false,
                    }).start();

                    Animated.timing(animatedForSearchLaw, {
                      toValue: 0,
                      // toValue:100,
                      duration: 300,
                      useNativeDriver: false,
                    }).start();

                    Animated.timing(animatedForSearchContent, {
                      toValue: 0,
                      // toValue:100,
                      duration: 300,
                      useNativeDriver: false,
                    }).start();
                  }}
                >
                  {state.index == 0 ? (
                    <View
                      style={{
                        alignItems: 'center',
                        // transform: [{translateY: -2}],
                      }}
                    >
                      <Animated.View
                        style={{
                          width: homeTabRibbon,
                          height: 29,
                          borderRadius: 10,
                          backgroundColor: '#996600', //rgba(39,64,139,.7)
                          position: 'absolute',
                        }}
                      ></Animated.View>
                      <Ionicons
                        name="home"
                        style={styles.IconActive}
                      ></Ionicons>
                    </View>
                  ) : (
                    <View
                      style={{ justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Ionicons
                        name="home-outline"
                        style={styles.IconInActive}
                      ></Ionicons>
                    </View>
                  )}
                  <Animated.View
                    style={{
                      // height:homeTabTitleHeight,
                      transform: [{ scale: homeTabTitleHeight }],
                      justifyContent: 'center',
                      // backgroundColor:'yellow',
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        ...(state.index == 0
                          ? styles.TextActive
                          : styles.TextInActive),
                        fontSize: 12.5,
                        fontWeight: 'bold',
                        display: state.index == 0 ? 'none' : 'flex',
                        lineHeight: 14,
                        bottom: -2,
                      }}
                    >
                      Đã tải xuống
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View
                style={{
                  alignItems: 'center',
                  minWidth: 100,
                  // backgroundColor: 'red',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  justifyContent: 'center',
                  position: 'relative',
                  height: 44,
                  bottom: 7 + insets.bottom / 6,
                  transform: [{ scale: searchLawTabIconSize }],
                }}
              >
                <TouchableOpacity
                  style={{
                    width: widthDevice / 3,
                    height: 100,
                    // backgroundColor: 'yellow',
                    justifyContent: 'center',
                    display: 'flex',
                  }}
                  onPress={() => {
                    navigation.navigate('SearchLaw');
                    Animated.timing(animatedForHomeTab, {
                      toValue: 0,
                      // toValue:100,
                      duration: 300,
                      useNativeDriver: false,
                    }).start();

                    Animated.timing(animatedForSearchLaw, {
                      toValue: 60,
                      // toValue:100,
                      duration: 300,
                      useNativeDriver: false,
                    }).start();

                    Animated.timing(animatedForSearchContent, {
                      toValue: 0,
                      // toValue:100,
                      duration: 300,
                      useNativeDriver: false,
                    }).start();
                  }}
                >
                  {state.index == 1 ? (
                    <View
                      style={{
                        alignItems: 'center',
                        // transform: [{translateY: -2}],
                      }}
                    >
                      <Animated.View
                        style={{
                          width: searchLawRibbon,
                          height: 29,
                          borderRadius: 10,
                          backgroundColor: '#996600',
                          position: 'absolute',
                        }}
                      ></Animated.View>

                      <Ionicons
                        name="albums"
                        style={styles.IconActive}
                      ></Ionicons>
                    </View>
                  ) : (
                    <View
                      style={{ justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Ionicons
                        name="albums-outline"
                        style={styles.IconInActive}
                      ></Ionicons>
                    </View>
                  )}
                  <Animated.View
                    style={{
                      // height:homeTabTitleHeight,
                      // backgroundColor:'yellow',
                      padding: 0,
                      transform: [{ scale: searchLawTabTitleHeight }],
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        ...(state.index == 1
                          ? styles.TextActive
                          : styles.TextInActive),
                        fontSize: 12.5,
                        fontWeight: 'bold',
                        display: state.index == 1 ? 'none' : 'flex',
                        lineHeight: 14,
                        bottom: -2,
                      }}
                    >
                      Tìm văn bản
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View
                style={{
                  alignItems: 'center',
                  minWidth: 100,
                  bottom: 7 + insets.bottom / 6,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  justifyContent: 'center',
                  position: 'relative',
                  height: 44,
                  transform: [
                    { scale: searchContentTabIconSize },
                    { translateX: -7 },
                  ],
                }}
              >
                <TouchableOpacity
                  style={{
                    width: widthDevice / 3,
                    height: 100,
                    // backgroundColor: 'red',
                    justifyContent: 'center',
                    display: 'flex',
                  }}
                  onPress={() => {
                    navigation.navigate('Search');
                    Animated.timing(animatedForHomeTab, {
                      toValue: 0,
                      // toValue:100,
                      duration: 300,
                      useNativeDriver: false,
                    }).start();

                    Animated.timing(animatedForSearchLaw, {
                      toValue: 0,
                      // toValue:100,
                      duration: 300,
                      useNativeDriver: false,
                    }).start();

                    Animated.timing(animatedForSearchContent, {
                      toValue: 60,
                      // toValue:100,
                      duration: 300,
                      useNativeDriver: false,
                    }).start();
                  }}
                >
                  {state.index == 2 ? (
                    <View
                      style={{
                        alignItems: 'center',
                        // transform: [{translateY: -2}],
                      }}
                    >
                      <Animated.View
                        style={{
                          width: searchContentRibbon,
                          height: 29,
                          borderRadius: 10,
                          backgroundColor: '#996600',
                          position: 'absolute',
                        }}
                      ></Animated.View>

                      <Ionicons
                        name="search"
                        style={styles.IconActive}
                      ></Ionicons>
                    </View>
                  ) : (
                    <View
                      style={{ justifyContent: 'center', alignItems: 'center' }}
                    >
                      <Ionicons
                        name="search-outline"
                        style={styles.IconInActive}
                      ></Ionicons>
                    </View>
                  )}
                  <Animated.View
                    style={{
                      // height:homeTabTitleHeight,
                      // backgroundColor:'yellow',
                      padding: 0,
                      transform: [{ scale: searchContentTabTitleHeight }],
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        ...(state.index == 2
                          ? styles.TextActive
                          : styles.TextInActive),
                        fontSize: 12.5,
                        fontWeight: 'bold',
                        display: state.index == 2 ? 'none' : 'flex',
                        lineHeight: 14,
                        bottom: -2,
                      }}
                    >
                      Tìm nội dung
                    </Text>
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            </View>
          );
        }}
        tabBarPosition="bottom"
        screenOptions={({ route }) => ({
          tabBarPressColor: '#FFCC66',
          animationEnabled: false,
          animation: 'shift',
          swipeEnabled: false,
          lazy: false,
          tabBarIndicatorStyle: {
            display: 'none',
          },
        })}
      >
        <Tab.Screen
          name="Home"
          component={Home}
          options={{
            header: () => null,
            tabBarLabel: () => {
              return null;
            },
          }}
          listeners={{
            tabPress: props => {},
          }}
        />

        <Tab.Screen
          name="SearchLaw"
          component={Detail2}
          options={{
            header: () => null,
            // tabBarIcon: ({focused, color, size}) => {
            //   return (
            //     // <View style={{alignItems: 'center', top: -5, minWidth: 100}}>
            //     //   <Animated.View
            //     //     style={{
            //     //       width: searchLawRibbon,
            //     //       height: 25,
            //     //       borderRadius: 10,
            //     //       backgroundColor: 'rgba(39,64,139,.6)',
            //     //       position: 'absolute',
            //     //     }}></Animated.View>
            //     //   <Ionicons
            //     //     name="albums-outline"
            //     //     style={
            //     //       true ? styles.IconActive : styles.IconInActive
            //     //     }></Ionicons>
            //     //   <Text
            //     //     style={{
            //     //       ...(true ? styles.IconActive : styles.IconInActive),
            //     //       fontSize: 13,
            //     //       fontWeight: 'bold',
            //     //     }}>
            //     //     Tìm văn bản
            //     //   </Text>
            //     // </View>

            //     <Animated.View
            //       style={{
            //         alignItems: 'center',
            //         minWidth: 100,
            //         // backgroundColor: 'red',
            //         display: 'flex',
            //         flexDirection: 'column',
            //         overflow: 'hidden',
            //         justifyContent: 'center',
            //         position: 'relative',
            //         height: 44,
            //         top: -8,
            //         transform: [{scale: searchLawTabIconSize}],
            //       }}>
            //       {true ? (
            //         <View>
            //           <Animated.View
            //             style={{
            //               width: searchLawRibbon,
            //               height: 29,
            //               borderRadius: 10,
            //               backgroundColor: 'rgba(39,64,139,.6)',
            //               position: 'absolute',
            //               transform: [{translateX: -16}],
            //             }}></Animated.View>

            //           <Ionicons
            //             name="albums"
            //             style={styles.IconActive}></Ionicons>
            //         </View>
            //       ) : (
            //         <Ionicons
            //           name="albums-outline"
            //           style={styles.IconInActive}></Ionicons>
            //       )}
            //       <Animated.View
            //         style={{
            //           // height:homeTabTitleHeight,
            //           // backgroundColor:'yellow',
            //           padding: 0,
            //           transform: [{scale: searchLawTabTitleHeight}],
            //         }}>
            //         <Text
            //           style={{
            //             ...(true ? styles.TextActive : styles.TextInActive),
            //             fontSize: 13,
            //             fontWeight: 'bold',
            //             display: true ? 'none' : 'flex',
            //           }}>
            //           Tìm văn bản
            //         </Text>
            //       </Animated.View>
            //     </Animated.View>
            //   );
            // },
            tabBarLabel: () => {
              return null;
            },
          }}
          listeners={{
            tabPress: props => {},
          }}
        />
        <Tab.Screen
          name="Search"
          component={Detail1}
          options={{
            header: () => null,
            tabBarLabel: () => {
              return null;
            },
          }}
          listeners={{
            tabPress: props => {},
          }}
        />
      </Tab.Navigator>
    </View>
  );
};

const Stack = createNativeStackNavigator();

const StackNavigator = () => {
  // const ModalVisibleStatus = useContext(ModalStatus);

  const netInfo = useNetInfo();
  let internetConnected = netInfo.isConnected;

  const dispatch = useDispatch();

  useEffect(() => {
    if (internetConnected) {
      // dispatch({type: 'stackscreen'})
    }

    // callAllSearchLaw().then(res=>inf.updateInfo(res))
  }, [internetConnected]);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          // headerShadowVisible:true,

          headerStyle: {
            backgroundColor: 'green',
          },
          headerBlurEffect: 'extraLight',
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="HomeStack"
          component={AppNavigators}
          options={{
            // animationEnabled: false,
            header: () => null,
            // headerStyle:{backgroundColor:'red'}
          }}
        />

        <Stack.Screen
          name={`accessLaw`}
          component={Detail5}
          options={({ navigation }) => ({
            // header:()=>{      <View style={{height: (Platform.OS === 'ios') ? 10 : 0,backgroundColor:'yellow',position:'relative'}}>
            // </View>
            // },
            // headerStyle:{backgroundColor:'red',top:20},
            // headerLargeTitleShadowVisible:true,
            headerTitleAlign: 'center',
            animation: 'simple_push',
            animationTypeForReplace: 'push',
            header: () => null,

            // headerLeft: () => (
            //   <TouchableOpacity
            //     onPressIn={() => {
            //       navigation.goBack();
            //     }}
            //     >
            //     <Ionicons
            //       name="chevron-back-outline"
            //       style={styles.IconInfo}></Ionicons>
            //   </TouchableOpacity>
            // ),
            // headerTitle:()=> (
            //   <TouchableOpacity
            //   style={{
            //     backgroundColor: 'red',
            //     height: 40,
            //     alignItems: 'center',
            //     justifyContent: 'center',
            //     overflow: 'hidden',
            //     borderRadius: 30,
            //   }}
            //   onPressIn={() => {
            //     navigation.popToTop();
            //     console.log(2);
            //   }}
            //   >
            //   <Image style={{alignItems:'center',justifyContent:'center',backgroundColor:'red'}} source={require('../assets/t.png')}></Image>
            // </TouchableOpacity>

            // ),
            // headerRight: () => (
            //   <View style={{alignItems: 'center'}}>
            //     <TouchableOpacity
            //       style={styles.iconInfoContainer}
            //       // onPress={() => {
            //       //   // navigation.navigate('Search')
            //       //   ModalVisibleStatus.updateModalStatus(true);
            //       // }}
            //       onPressIn={() => {
            //         ModalVisibleStatus.updateModalStatus(true);
            //       }}
            //       >
            //       <Ionicons
            //         name="document-text-outline"
            //         style={styles.IconInfo}></Ionicons>
            //     </TouchableOpacity>
            //   </View>
            // ),
          })}
        />
        {/* ))} */}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  // tabItemActive: {
  //   // backgroundColor:'red',
  //   width: '100%',
  //   // right:0,
  //   // left:100,
  //   height: '104%',
  //   position: 'relative',
  //   display: 'flex',
  //   alignItems: 'center',
  //   justifyContent: 'center',
  //   borderTopColor: 'red',
  //   borderTopWidth: 4,
  //   overflow: 'hidden',
  // },
  tabItemInactive: {
    position: 'relative',
    // width: '100%',
    height: '102%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  IconActive: {
    fontSize: 26,
    color: 'white', // #FF3030
    padding: 0,
    margin: 0,
    lineHeight: 28,

    // transform:animatedValue
  },
  IconInActive: {
    fontSize: 24,
    color: 'black',
    padding: 0,
    lineHeight: 23,
    // backgroundColor:'yellow'
  },

  TextActive: {
    fontSize: 24,
    color: 'black', //#FF3030
    padding: 0,
    margin: 0,
    lineHeight: 10,

    // transform:animatedValue
  },
  TextInActive: {
    fontSize: 24,
    color: 'black',
    padding: 0,
    lineHeight: 10,
  },

  IconInfo: {
    fontSize: 30,
    display: 'flex',
    color: 'white',
  },
  iconInfoContainer: {
    // width: 50,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // backgroundColor: 'black',
    borderRadius: 25,
  },
});
export default StackNavigator;
