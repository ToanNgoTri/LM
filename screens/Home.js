import {
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  Keyboard,
  Animated,
  ScrollView,
  Linking,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useState, useEffect, useRef, useContext } from 'react';
import { RefOfHome,
  // BoxInHomeScreen
 } from '../App';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Dirs, FileSystem } from 'react-native-file-access';
// import {useScrollToTop} from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DraggableFlatList, {
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import VersionCheck from 'react-native-version-check';

export default function Home({}) {
  const navigation = useNavigation();

  const [updateStatus, SetUpdateStatus] = useState(false);
  const [Info, setInfo] = useState(false);

  const [heightNotification, setHeightNotification] = useState(0)
  console.log('heightNotification',heightNotification);
  
  const [inputSearchLaw, setInputSearchLaw] = useState('');
  // const [searchLawResult, setSearchLawResult] = useState([]);
  const [showPolicy, setShowPolicy] = useState(false);
  const [showBackground, setShowBackground] = useState(false);
  const [textInputFocus, setTextInputFocus] = useState(false);

  const insets = useSafeAreaInsets(); // lất chiều cao để menu top iphone

  const ScrollViewToScroll = useRef(null);
  const textInput = useRef(null);

  // const ScrollViewToScroll = useRef(null);

  // const BoxInHomeScreenStatus = useContext(BoxInHomeScreen);

  const HomeScreen = useContext(RefOfHome);

  useEffect(() => {
    if (ScrollViewToScroll.current) {
      HomeScreen.updateHomeRef(ScrollViewToScroll.current);
    }
  });

  const Render = ({ item, i, drag, isActive }) => {
    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={inputSearchLaw ? null : drag}
          disabled={isActive}
          key={i}
          style={{
            paddingBottom: 10,
            paddingTop: 10,
            justifyContent: 'center',
            backgroundColor:
              Object.values(item)[0] &&
              Object.values(item)[0]['lawNameDisplay'].match(/^(Hiến)/gim)
                ? '#da251dff'
                : 'green',
            marginBottom: 6,
            opacity: isActive ? 0.5 : 1,
          }}
          onPress={() =>
            navigation.navigate(`accessLaw`, { screen: Object.keys(item)[0] })
          }
        >
          <View style={styles.item}>
            <Text
              style={{
                ...styles.itemDisplay,
                color:
                  Object.values(item)[0] &&
                  Object.values(item)[0]['lawNameDisplay'].match(/^(Hiến)/gim)
                    ? 'yellow'
                    : 'white',
              }}
            >
              {/* {Info[item] && Info[item]['lawNameDisplay']} */}
              {Object.values(item)[0]['lawNameDisplay']}
            </Text>
            {Object.values(item)[0] &&
              !Object.values(item)[0]['lawNameDisplay'].match(
                /^(luật|bộ luật|hiến)/gim,
              ) && (
                <Text style={{ ...styles.itemDescription }}>
                  {/* {Info[item] && Info[item]['lawDescription']} */}
                  {'   '}
                  {Object.values(item)[0] &&
                    Object.values(item)[0]['lawDescription']}
                </Text>
              )}
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  useEffect(() => {
    // console.log('Object.keys(Info)', Object.keys(Info).length);
    // console.log('inputSearchLaw', inputSearchLaw);

    if (inputSearchLaw && Object.keys(Info).length) {
      // console.log(1);

      setData(
        Info &&
          Info.filter(item => {
            if (
              inputSearchLaw.match(/(\w+|\(|\)|\.|\+|\-|\,|\&|\?|\;|\!|\s?)/gim)
            ) {
              let inputSearchLawReg = inputSearchLaw;
              if (inputSearchLaw.match(/\(/gim)) {
                inputSearchLawReg = inputSearchLaw.replace(/\(/gim, '\\(');
              }

              if (inputSearchLaw.match(/\)/gim)) {
                inputSearchLawReg = inputSearchLawReg.replace(/\)/gim, '\\)');
              }
              if (inputSearchLaw.match(/\//gim)) {
                inputSearchLawReg = inputSearchLawReg.replace(/\//gim, '.');
              }
              if (inputSearchLaw.match(/\\/gim)) {
                inputSearchLawReg = inputSearchLawReg.replace(/\\/gim, '.');
              }
              if (inputSearchLaw.match(/\./gim)) {
                inputSearchLawReg = inputSearchLawReg.replace(/\./gim, '\\.');
              }
              if (inputSearchLaw.match(/\+/gim)) {
                inputSearchLawReg = inputSearchLawReg.replace(/\+/gim, '\\+');
              }
              if (inputSearchLaw.match(/\?/gim)) {
                inputSearchLawReg = inputSearchLawReg.replace(/\?/gim, '\\?');
              }

              return (
                Object.values(item)[0]['lawNameDisplay'].match(
                  new RegExp(inputSearchLawReg, 'igm'),
                ) ||
                Object.values(item)[0]['lawDescription'].match(
                  new RegExp(inputSearchLawReg, 'igm'),
                ) ||
                Object.values(item)[0]['lawNumber'].match(
                  new RegExp(inputSearchLawReg, 'igm'),
                )
              );
            }
          }),
      );

      // DeleteInternal()
    }
  }, [inputSearchLaw]);

  async function getPolicyAppear() {
    if (await FileSystem.exists(Dirs.CacheDir + '/Appear.txt', 'utf8')) {
      return false;
    } else {
      return true;
    }
  }

  //   async function DeleteInternal() {
  //   console.log('delete');

  //   const addInfo = await FileSystem.unlink(
  //     Dirs.CacheDir + '/Appear.txt'
  //   );

  // }

  async function getContentExist() {
    if (await FileSystem.exists(Dirs.CacheDir + '/order.txt', 'utf8')) {
      setShowBackground(false);

      // const FileInfoStringDownloaded = await FileSystem.readFile(
      //   Dirs.CacheDir + '/downloaded.txt',
      //   'utf8',
      // );
      const FileOrder = await FileSystem.readFile(
        Dirs.CacheDir + '/order.txt',
        'utf8',
      );
      // console.log('FileOrder',FileOrder);

      if (FileOrder) {
        return {
          // content: JSON.parse(FileInfoStringDownloaded.Content),
          order: JSON.parse(FileOrder),
        };
      }
    } else {
      setShowBackground(true);
      return { order: {} };
    }
  }

  async function exitUpdate() {
    const latestVersion = await VersionCheck.getLatestVersion();

    if (await FileSystem.exists(Dirs.CacheDir + '/Appear.txt', 'utf8')) {
      const fileAppear = await FileSystem.readFile(
        Dirs.CacheDir + '/Appear.txt',
        'utf8',
      );

      let contentAppear = JSON.parse(fileAppear);

      contentAppear[latestVersion] = false;

      const addInfo = await FileSystem.writeFile(
        Dirs.CacheDir + '/Appear.txt',
        JSON.stringify(contentAppear),
        'utf8',
      );
    }
  }

  async function acceptUpdate() {
    const latestVersion = await VersionCheck.getLatestVersion();

    if (await FileSystem.exists(Dirs.CacheDir + '/Appear.txt', 'utf8')) {
      const fileAppear = await FileSystem.readFile(
        Dirs.CacheDir + '/Appear.txt',
        'utf8',
      );

      let contentAppear = JSON.parse(fileAppear);

      contentAppear[latestVersion] = true;

      const addInfo = await FileSystem.writeFile(
        Dirs.CacheDir + '/Appear.txt',
        JSON.stringify(contentAppear),
        'utf8',
      );
    }
  }

  const checkForUpdate = async () => {
    // Lấy phiên bản hiện tại của ứng dụng
    const currentVersion = VersionCheck.getCurrentVersion();

    // Kiểm tra phiên bản mới nhất trên Google Play Store
    const latestVersion = await VersionCheck.getLatestVersion({
      packageName: 'com.lawmachine',
    });

    if (await FileSystem.exists(Dirs.CacheDir + '/Appear.txt', 'utf8')) {
      const fileAppear = await FileSystem.readFile(
        Dirs.CacheDir + '/Appear.txt',
        'utf8',
      );

      let contentAppear = JSON.parse(fileAppear);
      console.log('Number(latestVersion)', Number(latestVersion));
      console.log('Number(currentVersion)', Number(currentVersion));

      if (Number(latestVersion) > Number(currentVersion)) {
        if (!contentAppear[latestVersion]) {
          SetUpdateStatus(true);
        }
      }

      // SetUpdateStatus(true);
    }
  };

  useEffect(() => {
    const listener = navigation.addListener('focus', () => {
      setInputSearchLaw('');

      getContentExist().then(cont => {
        if (!Object.keys(cont.order).length) {
          setShowBackground(true);
        } else {
          setShowBackground(false);
        }

        // console.log('cont',cont);
        if (cont) {
          setInfo(cont.order);

          // let c = []
          // cont.order.map( (item)=>{
          //   c.push(Object.keys(item)[0])
          // })
          setData(cont.order);
        } else {
          setInfo({});
          setData([]);
        }
      });
    });

    getPolicyAppear().then(status => setShowPolicy(status));

    checkForUpdate();
  }, []);

  // useEffect(() => {
  //   BoxInHomeScreenStatus.updateShowBoxInHomeScreen(updateStatus || showPolicy);
  // }, [updateStatus, showPolicy]);

  const animated = useRef(new Animated.Value(0)).current;

  let Opacity = animated.interpolate({
    inputRange: [0, 100],
    outputRange: [0.5, 0],
  });

  let Scale = animated.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
  });

  const [data, setData] = useState([]);

  async function sortedData(data) {
    const addInfo = await FileSystem.writeFile(
      Dirs.CacheDir + '/order.txt',
      JSON.stringify(data),
      'utf8',
    );

    // console.log('new data',data );
  }

  // console.log('Info',Info);

  function NoneOfResult() {
    return (
      <TouchableWithoutFeedback
        style={{ backgroundColor: 'red' }}
        onPress={() => Keyboard.dismiss()}
      >
        <View
          style={{
            paddingBottom: 100,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            backgroundColor: '#EEEFE4',
          }}
        >
          <Text style={{ fontSize: 40, textAlign: 'center', color: 'gray' }}>
            {' '}
            {Info.length ? '' : 'Chưa có văn bản tải xuống'}
          </Text>
        </View>
      </TouchableWithoutFeedback>
    );
  }

  // console.log('Info.length',Info.length);

  return (
    <>
      <View
        style={{
          flexDirection: 'column',
          // height: 50,
          paddingLeft: 10,
          paddingRight: 10,
          display: 'flex',
          alignItems: 'center',
          // backgroundColor:'#EEEFE4',
          justifyContent: 'space-between',
          // backgroundColor: 'red',
          flexDirection: 'column',
        }}
      >
        <View
          style={{
            backgroundColor: 'green',
            height: insets.top,
            width: '150%',
          }}
        ></View>
        <View style={{ flexDirection: 'row' }}>
          <View
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons
              name="logo-buffer"
              style={{
                color: 'green',
                fontSize: 25,
              }}
            ></Ionicons>
          </View>
          <TextInput
            onChangeText={text => {
              setInputSearchLaw(text);
            }}
            ref={textInput}
            onSubmitEditing={() => Keyboard.dismiss()}
            value={inputSearchLaw}
            style={inputSearchLaw ? styles.inputSearchArea : styles.placeholder}
            placeholder="Nhập tên, Số văn bản, Trích yếu . . ."
            placeholderTextColor={'gray'}
            onTouchEnd={() => {
              if (textInputFocus) {
                textInput.current.blur();
                setTextInputFocus(false);
              } else {
                setTextInputFocus(true);
                textInput.current.focus();
              }
            }}
            onFocus={() => setTextInputFocus(true)}
            onBlur={() => setTextInputFocus(false)}
          ></TextInput>
          <TouchableOpacity
            onPress={() => {
              setInputSearchLaw('');
              Keyboard.dismiss();
              setData(Info);
            }}
            style={{
              width: '10%',
              display: 'flex',
              // backgroundColor:'red',
              justifyContent: 'center',
            }}
          >
            {inputSearchLaw && (
              <Ionicons
                name="close-circle-outline"
                style={{
                  color: 'black',
                  fontSize: 25,
                  justifyContent: 'center',
                  textAlign: 'right',
                  // backgroundColor:'black',
                  paddingRight: 10,
                }}
              ></Ionicons>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {showBackground ? (
        <NoneOfResult />
      ) : !data.length ? (
        <NoneOfResult />
      ) : (
        <View>
          <DraggableFlatList
            ref={ScrollViewToScroll}
            onScrollBeginDrag={() => Keyboard.dismiss()}
            data={data}
            renderItem={Render}
            keyExtractor={item => Object.keys(item)[0]}
            onDragEnd={({ data }) => {
              setData(data);
              sortedData(data);
            }}
            autoscrollThreshold={200}
            ListFooterComponent={() => (
              <View
                style={{
                  height: 94 + insets.bottom / 2 + insets.top,
                  width: '100%',
                }}
              ></View>
            )}
          />
        </View>
      )}

      {(showPolicy || updateStatus) && (  
        // {(true) && (

        <>
          <Animated.View
            style={{
              backgroundColor: 'black',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              display: 'flex',
              position: 'absolute',
              opacity: Opacity,
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

              top:'50%',
              maxHeight:updateStatus ? 500 : '75%',

              right: 50,
              left: 50,
              backgroundColor: 'white',
              display: 'flex',
              borderRadius: 20,
              transform: [{ scale: Scale},{translateY:-heightNotification/2 }],
              overflow: 'hidden',
              shadowColor: 'black',
              shadowOpacity: 1,
              shadowOffset: {
                width: 10,
                height: 10,
              },
              shadowRadius: 4,
              elevation: 20,
            }}
          >
            {!updateStatus ? ( // updateStatus
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ marginBottom: 20, marginTop: 30 }}>
                  <Text
                    style={{
                      fontWeight: 'bold',
                      fontSize: 30,
                      textAlign: 'center',
                    }}
                  >
                    Lời mở đầu{' '}
                  </Text>
                </View>

                <View style={{}}>
                  <Text
                    style={{
                      fontWeight: 600,
                      paddingLeft: 20,
                      paddingRight: 20,
                      textAlign: 'justify',
                      lineHeight: 23,
                    }}
                  >
                    {'  '}Các thông tin, nội dung và dịch vụ mà Thư viện Luật
                    cung cấp chỉ mang tính chất tham khảo, với mục đích đem lại
                    cho người sử dụng những thông tin tổng quát về các quy định
                    của pháp luật qua từng thời kỳ. Thêm vào đó, việc thay đổi,
                    bổ sung các quy định luật pháp là điều không tránh khỏi ở
                    mỗi giai đoạn phát triển, bởi vậy, mọi trường hợp người sử
                    dụng muốn vận dụng các quy định pháp luật vào từng trường
                    hợp cụ thể, nhất thiết phải tham khảo ý kiến của các cơ quan
                    nhà nước có thẩm quyền hoặc của các chuyên gia tư vấn pháp
                    lý về việc áp dụng các quy định này.
                  </Text>
                </View>
                <View style={{}}>
                  <Text
                    style={{
                      fontWeight: 600,
                      paddingLeft: 20,
                      paddingRight: 20,
                      textAlign: 'justify',
                      lineHeight: 23,
                    }}
                  >
                    {'  '}Mặc dù đã cố gắng hạn chế những sai sót trong quá
                    trình nhập liệu và đăng tải, các thông tin, nội dung văn bản
                    pháp luật do Thư viện Luật cung cấp không tránh khỏi những
                    khiếm khuyết hay sai sót do lỗi đánh máy, trình bày, hay
                    tính đúng sai về hiệu lực pháp lý của văn bản. Việc người sử
                    dụng chấp nhận sử dụng dịch vụ của Thư viện Luật ngay từ lần
                    đầu tiên cũng đồng nghĩa với việc chấp nhận những khiếm
                    khuyết này, cũng như không làm nảy sinh bất cứ trách nhiệm
                    pháp lý nào của Thư viện Luật với người sử dụng khi xảy ra
                    thiệt hại (nếu có) từ việc vận dụng các nội dung, thông tin
                    mà Thư viện Luật cung cấp
                  </Text>
                </View>
                <View style={{paddingBottom:10}}>
                  <Text
                    style={{
                      fontWeight: 600,
                      paddingLeft: 20,
                      paddingRight: 20,
                      textAlign: 'justify',
                      lineHeight: 23,
                    }}
                  >
                    {'   '}Đây là ứng dụng tra cứu Luật của tập thể Pixel Places
                    Game xây dựng và phát triển. Ứng dụng không đại diện cho bất
                    kỳ cơ quan nào thuộc Chính phủ. Cuối cùng, xin chân thành
                    cảm ơn tất cả các bạn và người dùng ứng dụng đã tin tưởng và
                    ủng hộ chúng tôi !
                  </Text>
                </View>
              </ScrollView>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} >
                <View style={{ marginBottom: 10, marginTop: 20 }}>
                  <Text
                    style={{
                      fontWeight: 'bold',
                      fontSize: 30,
                      textAlign: 'center',
                    }}
                  >
                    Thông báo{' '}
                  </Text>
                </View>

                <View style={{paddingBottom:10}}>
                  <Text
                    style={{
                      fontWeight: 600,
                      paddingLeft: 10,
                      paddingRight: 10,
                      textAlign: 'justify',
                      // lineHeight:23,
                      fontSize: 18,
                      textAlign: 'center',
                    }}
                  >
                    Thư viện Luật đã có phiên bản mới. Bạn có thể cập nhật để sử
                    dụng những tiện ích mới.
                  </Text>
                </View>
              </ScrollView>
            )}

            {!updateStatus ? (
              <TouchableOpacity
                style={{
                  backgroundColor: 'green',
                }}
                onPress={async () => {
                  let timeOut = setTimeout(() => {
                    setShowPolicy(false);
                    return () => {};
                  }, 300);

                  const currentVersion = VersionCheck.getCurrentVersion();

                  const addContent = await FileSystem.writeFile(
                    Dirs.CacheDir + '/Appear.txt',
                    JSON.stringify({ [currentVersion]: false }),
                    'utf8',
                  );

                  Animated.timing(animated, {
                    toValue: showPolicy || updateStatus ? 100 : 0,
                    // toValue:100,
                    duration: 300,
                    useNativeDriver: false,
                  }).start();
                }}
              >
                <Text
                  style={{
                    paddingBottom: 10,
                    paddingTop: 10,
                    textAlign: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 16,
                  }}
                >
                  Chấp nhận chính sách và tiếp tục
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flexDirection: 'row', width: '100%' }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: 'green',
                    width: '50%',
                  }}
                  onPress={async () => {
                    let timeOut = setTimeout(() => {
                      setShowPolicy(false);
                      SetUpdateStatus(false);
                      return () => {};
                    }, 300);
                    exitUpdate();

                    Animated.timing(animated, {
                      toValue: showPolicy || updateStatus ? 100 : 0,
                      // toValue:100,
                      duration: 300,
                      useNativeDriver: false,
                    }).start();

                    if (Platform.OS == 'ios') {
                      Linking.openURL(
                        'https://apps.apple.com/vn/app/th%C6%B0-vi%E1%BB%87n-lu%E1%BA%ADt/id6741737005?l=vi',
                      ).catch(err => console.error('Error opening URL: ', err));
                    } else {
                      Linking.openURL(
                        'https://play.google.com/store/apps/details?id=com.lawmachine&pcampaignid=web_share',
                      ).catch(err => console.error('Error opening URL: ', err));
                    }
                  }}
                >
                  <Text
                    style={{
                      paddingBottom: 10,
                      paddingTop: 10,
                      textAlign: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: 16,
                    }}
                  >
                    Cập nhật
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    backgroundColor: 'green',
                    width: '50%',
                    borderLeftColor: 'white',
                    borderLeftWidth: 1,
                  }}
                  onPress={async () => {
                    let timeOut = setTimeout(() => {
                      setShowPolicy(false);
                      SetUpdateStatus(false);
                      return () => {};
                    }, 300);

                    acceptUpdate();
                    Animated.timing(animated, {
                      toValue: showPolicy || updateStatus ? 100 : 0,
                      duration: 300,
                      useNativeDriver: false,
                    }).start();
                  }}
                >
                  <Text
                    style={{
                      paddingBottom: 10,
                      paddingTop: 10,
                      textAlign: 'center',
                      color: 'white',
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
    </>
  );
}

const styles = StyleSheet.create({
  item: {
    minHeight: 100,
    display: 'flex',
    justifyContent: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    flexDirection: 'column',
    // backgroundColor:'yellow',
    alignItems: 'center',
  },
  itemDisplay: {
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    fontSize: 17,
    marginBottom: 2,
  },
  itemDescription: {
    color: '#EEEEEE',
    textAlign: 'justify',
    fontSize: 15,
  },
  inputSearchArea: {
    paddingLeft: 10,
    paddingRight: 10,
    fontSize: 18,
    color: 'black',
    width: '85%',
    alignItems: 'center',
    height: 50,
  },
  placeholder: {
    fontSize: 15,
    paddingLeft: 10,
    paddingRight: 10,
    color: 'black',
    width: '85%',
    alignItems: 'center',
    height: 50,
  },
});
