import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Image,
  KeyboardAvoidingView,
  ActivityIndicator,
  Pressable,
  Vibration,
  Platform,
} from 'react-native';
import { Dirs, FileSystem } from 'react-native-file-access';
import React, { useState, useEffect, useRef } from 'react';
import { useRoute, useNavigation } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';

import Ionicons from '@react-native-vector-icons/ionicons';
// import {ModalStatus} from '../App';
import { useSelector, useDispatch } from 'react-redux';
import { useNetInfo } from '@react-native-community/netinfo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
let TopUnitCount; // là đơn vị lớn nhất vd là 'phần thứ' hoặc chươn

let sumChapterArray = []; // array mà mỗi phần tử là 'phần thứ...' có tổng bn chương
sumChapterArray[0] = 0;
let sumChapterPrevious; // sum cộng dồn các phần trư của các chương trong luật có phần thứ

let eachSectionWithChapter = [];
//lineHeight trong lines phải luôn nhỏ hơn trong highlight và View Hightlight

/* ------------------------------------------------------------------ */
/* Đọc/ghi danh sách Điều đã ghi nhớ theo <screen> (dùng chung)        */
/* ------------------------------------------------------------------ */
async function loadBookmarksFile(screen) {
  if (await FileSystem.exists(Dirs.CacheDir + '/bookmarks.txt', 'utf8')) {
    const file = await FileSystem.readFile(
      Dirs.CacheDir + '/bookmarks.txt',
      'utf8',
    );
    if (file) {
      const all = JSON.parse(file);
      return all[screen] || [];
    }
  }
  return [];
}

async function saveBookmarksFile(screen, listBookmark) {
  let all = {};
  if (await FileSystem.exists(Dirs.CacheDir + '/bookmarks.txt', 'utf8')) {
    const file = await FileSystem.readFile(
      Dirs.CacheDir + '/bookmarks.txt',
      'utf8',
    );
    if (file) all = JSON.parse(file);
  }
  if (listBookmark.length === 0) {
    delete all[screen];
  } else {
    all[screen] = listBookmark;
  }
  await FileSystem.writeFile(
    Dirs.CacheDir + '/bookmarks.txt',
    JSON.stringify(all),
    'utf8',
  );
}

/* ------------------------------------------------------------------ */
/* Panel trượt bên phải: Mục lục (article) HOẶC danh sách Ghi nhớ.     */
/* Tách riêng để state gõ-tìm (inputSearchArtical) và ghi-nhớ chỉ      */
/* render lại panel này, KHÔNG render lại toàn bộ thân văn bản.        */
/* ------------------------------------------------------------------ */
function SidePanel({
  mode, // 'article' | 'bookmark'
  positions, // positionYArrArtical: [{ "Điều...": y }]
  transX,
  Opacity,
  widthDevice,
  insets,
  screen,
  onClose, // đóng panel (có animation)
  onSelect, // (yArray) => cuộn tới vị trí
}) {
  const [inputSearchArtical, setInputSearchArtical] = useState('');
  const [bookmarks, setBookmarks] = useState([]);
  const bookmarksRef = useRef([]);
  const textInputArticle = useRef(null);

  useEffect(() => {
    loadBookmarksFile(screen).then(listBookmark => {
      bookmarksRef.current = listBookmark;
      setBookmarks(listBookmark);
    });
  }, [screen]);

  function toggleBookmark(title) {
    const cur = bookmarksRef.current;
    const next = cur.includes(title)
      ? cur.filter(t => t !== title)
      : [...cur, title];
    bookmarksRef.current = next;
    setBookmarks(next);
    saveBookmarksFile(screen, next);
    Vibration.vibrate(20);
  }

  const SearchArticalResult = positions.filter(item => {
    let abc = inputSearchArtical;
    abc = inputSearchArtical.replace(/\(/gim, '\\(');
    abc = abc.replace(/\)/gim, '\\)');
    return Object.keys(item)[0].match(new RegExp(abc, 'igm'));
  });

  const dataList = (
    mode === 'bookmark'
      ? positions.filter(o => bookmarks.includes(Object.keys(o)[0]))
      : SearchArticalResult || positions
  ).filter(k => Object.keys(k)[0] !== ' ');

  const renderItem = ({ item }) => {
    const title = Object.keys(item)[0];
    const isMarked = bookmarks.includes(title);
    return (
      <View
        style={{
          ...styles.listItem,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={() => onSelect(Object.values(item))}
        >
          <Text style={styles.listItemText}>{title}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => toggleBookmark(title)}
          style={{
            paddingLeft: 8,
            paddingRight: 4,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons
            name={isMarked ? 'star' : 'star-outline'}
            style={{ fontSize: 20, color: isMarked ? '#FFB300' : 'gray' }}
          ></Ionicons>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      <Animated.View
        style={{
          backgroundColor: 'rgb(245,245,247)',
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
          onPress={onClose}
        ></TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={{
          ...styles.listArticle,
          width: (widthDevice / 100) * 60,
          transform: [{ translateX: transX }],
          marginBottom:
            Platform.OS === 'ios' ? 15 + insets.bottom : 35 + insets.bottom,
          marginTop: insets.top + 50,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: 'black',
            height: 50,
          }}
        >
          <TextInput
            ref={textInputArticle}
            onChangeText={text => setInputSearchArtical(text)}
            selectTextOnFocus={true}
            value={inputSearchArtical}
            style={{
              paddingLeft: 10,
              paddingRight: 10,
              color: 'white',
              width: '85%',
              alignItems: 'center',
            }}
            placeholder=" Nhập từ điều luật ..."
            placeholderTextColor={'gray'}
          ></TextInput>
          <TouchableOpacity
            onPress={() => {
              setInputSearchArtical('');
              textInputArticle.current.focus();
            }}
            style={{
              width: '15%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {inputSearchArtical && (
              <Text
                style={{
                  height: 20,
                  width: 20,
                  color: 'white',
                  textAlign: 'center',
                  verticalAlign: 'middle',
                  backgroundColor: 'gray',
                  borderRadius: 25,
                }}
              >
                X
              </Text>
            )}
          </TouchableOpacity>
        </View>
        <FlatList
          style={{ flex: 1 }}
          data={dataList}
          keyExtractor={(item, i) => `${i}SearchArtical`}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={<View style={{ height: 7 }} />}
          renderItem={renderItem}
          initialNumToRender={15}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews={true}
        />
      </Animated.View>
    </>
  );
}

export function Detail5() {
  const [tittleArray, setTittleArray] = useState([]); // đây là 'phần thứ...' hoặc chương (nói chung là section cao nhất)

  const [tittleArray2, setTittleArray2] = useState([]); // nếu có 'phần thứ...' thì đây sẽ là chương

  const [positionYArr, setPositionYArr] = useState([]); // tập hợp pos Y Search
  const [positionYArrArtical, setPositionYArrArtical] = useState([]);
  const [showArticle, setShowArticle] = useState(false);

  const currentYRef = useRef(0); // vị trí scroll hiện tại; chỉ đọc trong callback đo -> dùng ref để KHÔNG re-render mỗi khung hình cuộn


  const [currentSearchPoint, setCurrentSearchPoint] = useState(1); // thứ tự kết quả search đang trỏ tới

  const [modalStatus, setModalStatus] = useState(false);

  const [selectedDieuId, setSelectedDieuId] = useState('none'); // mã điều đang chọn (duy nhất theo vị trí)

  const [selectedClauses, setSelectedClauses] = useState([]); // các khoản đang chọn: [{ idx, text }]

  // ref phản ánh lựa chọn hiện tại -> tránh đọc state cũ (stale) khi nhấn nhanh nhiều khoản
  const selectedRef = useRef({ dieuId: 'none', clauses: [] });

  const [exists, setExists] = useState(false);

  const [panelMode, setPanelMode] = useState('article'); // 'article' | 'bookmark'

  const dispatch = useDispatch();

  const route = useRoute();

  const navigation = useNavigation();

  const netInfo = useNetInfo();
  let internetConnected = netInfo.isConnected;

  async function StoreInternal() {
    async function k() {
      if (await FileSystem.exists(Dirs.CacheDir + '/downloaded.txt', 'utf8')) {
        const FileInfoString = await FileSystem.readFile(
          Dirs.CacheDir + '/downloaded.txt',
          'utf8',
        );
        return JSON.parse(FileInfoString);
      }
    }

    let m = await k();
    if (m) {
      const FileDownloaded = await FileSystem.readFile(
        Dirs.CacheDir + '/downloaded.txt',
        'utf8',
      );
      let contentObject = JSON.parse(FileDownloaded);
      contentObject[route.params.screen] = { Content: Content, Info: Info };
      // contentObject[route.params.screen] = {'Info':Info};

      const addContent = await FileSystem.writeFile(
        Dirs.CacheDir + '/downloaded.txt',
        JSON.stringify(contentObject),
        'utf8',
      );

      const FileOrder = await FileSystem.readFile(
        Dirs.CacheDir + '/order.txt',
        'utf8',
      );

      let orderArray = JSON.parse(FileOrder);
      orderArray[orderArray.length] = { [route.params.screen]: Info };
      console.log(orderArray, 'orderArray');

      const addOrder = await FileSystem.writeFile(
        Dirs.CacheDir + '/order.txt',
        JSON.stringify(orderArray),
        'utf8',
      );
    } else {
      const addContent = await FileSystem.writeFile(
        Dirs.CacheDir + '/downloaded.txt',
        JSON.stringify({
          [route.params.screen]: { Content: Content, Info: Info },
        }),
        'utf8',
      );

      const addInfo = await FileSystem.writeFile(
        Dirs.CacheDir + '/order.txt',
        JSON.stringify([{ [route.params.screen]: Info }]),
        'utf8',
      );
    }
  }

  async function DeleteInternal() {
    const FileInfoStringContent = await FileSystem.readFile(
      Dirs.CacheDir + '/downloaded.txt',
      'utf8',
    );
    let contentObject = JSON.parse(FileInfoStringContent);
    delete contentObject[route.params.screen];

    const addContent = await FileSystem.writeFile(
      Dirs.CacheDir + '/downloaded.txt',
      JSON.stringify(contentObject),
      'utf8',
    );

    const FileOrder = await FileSystem.readFile(
      Dirs.CacheDir + '/order.txt',
      'utf8',
    );
    let orderArray = JSON.parse(FileOrder);
    const NewOrderArray = orderArray.filter(
      item => Object.keys(item)[0] !== route.params.screen,
    );

    const addInfo = await FileSystem.writeFile(
      Dirs.CacheDir + '/order.txt',
      JSON.stringify(NewOrderArray),
      'utf8',
    );

    // dọn luôn danh sách ghi nhớ của luật này
    if (await FileSystem.exists(Dirs.CacheDir + '/bookmarks.txt', 'utf8')) {
      const FileBookmarks = await FileSystem.readFile(
        Dirs.CacheDir + '/bookmarks.txt',
        'utf8',
      );
      if (FileBookmarks) {
        let allBookmarks = JSON.parse(FileBookmarks);
        delete allBookmarks[route.params.screen];
        await FileSystem.writeFile(
          Dirs.CacheDir + '/bookmarks.txt',
          JSON.stringify(allBookmarks),
          'utf8',
        );
      }
    }
  }

  const animatedForNavi = useRef(new Animated.Value(0)).current;

  const insets = useSafeAreaInsets(); // lất chiều cao để manu top iphone

  const list = useRef(null);
  const textInputFind = useRef(null);
  const [valueInput, setValueInput] = useState('');
  const [find, setFind] = useState(); // hiển thị trường tìm kiếm

  const [input, setInput] = useState(route.params ? route.params.input : '');

  const [go, setGo] = useState(false); // tạo thay đổi layout để View highlight có thể lấy đúng vị trí Y

  const [Content, setContent] = useState([]);
  const [Info, setInfo] = useState({});

  const { width, height } = Dimensions.get('window');

  const [widthDevice, setWidthDevice] = useState(width);
  const [heightDevice, setHeightDevice] = useState(height);

  // Đăng ký listener MỘT lần (trước đây gọi ngay trong thân render -> mỗi lần
  // render lại thêm một listener mới, không gỡ -> rò rỉ + re-render dồn).
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWidthDevice(window.width);
      setHeightDevice(window.height);
    });
    return () => sub?.remove();
  }, []);

  function pushToSearch() {
    if (!go) {
      setPositionYArr([]);
      setGo(true);
      if (input) {
        if (input.match(/(\w+|\(|\)|\.|\+|\-|\,|\&|\?|\;|\!|\/)/gim)) {
          let inputSearchLawReg = input;

          inputSearchLawReg = input.replace(/\(/gim, '\\(');

          inputSearchLawReg = inputSearchLawReg.replace(/\)/gim, '\\)');

          inputSearchLawReg = inputSearchLawReg.replace(/\./gim, '\\.');

          inputSearchLawReg = inputSearchLawReg.replace(/\+/gim, '\\+');

          // if(input.match(/\//img)){
          //   inputSearchLawReg = inputSearchLawReg.replace(/\//img,'\\/')
          // }

          inputSearchLawReg = inputSearchLawReg.replace(/\\/gim, '.');

          setValueInput(inputSearchLawReg);
        } else {
          Alert.alert('Thông báo', 'Vui lòng nhập từ khóa hợp lệ');
        }
        // setSearchCount(searchResultCount);

        setCurrentSearchPoint(1);
        Keyboard.dismiss();
      } else {
        Alert.alert('Thông báo', 'Vui lòng nhập từ khóa hợp lệ');
      }
    } else if (go && positionYArr.length) {
      list.current.scrollTo({
        y: positionYArr[0], //- 57
      });
      setCurrentSearchPoint(1);
    }
  }
  // const ModalVisibleStatus = useContext(ModalStatus);

  const { loading } = useSelector(state => state['read']);
  // console.log('loading',loading);

  // const {info3} = useSelector(state => state['stackscreen']);

  async function callOneLaw() {
    // dùng để khi qua screen related Law khác khi quay về vẫn còn
    let info = await fetch(
      `https://us-central1-project2-197c0.cloudfunctions.net/callOneLaw`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ screen: route.params.screen }),
      },
    );

    let respond = await info.json();
    return respond;
  }

  useEffect(() => {
    callOneLaw().then(res => {
      setContent(res.content);
      setInfo(res.info);
      // setContent([]);
      // setInfo([]);
    });
  }, [loading]);

  useEffect(() => {
    if (!exists) {
    }
  }, [exists]);

  async function getContentExist() {
    if (await FileSystem.exists(Dirs.CacheDir + '/downloaded.txt', 'utf8')) {
      const FileDownloaded = await FileSystem.readFile(
        Dirs.CacheDir + '/downloaded.txt',
        'utf8',
      );
      // const FileInfoStringInfo = await FileSystem.readFile(
      //   Dirs.CacheDir + '/Info.txt',
      //   'utf8',
      // );
      if (FileDownloaded) {
        return {
          // _id: route.params.screen,
          all: JSON.parse(FileDownloaded),
          // info: JSON.parse(FileDownloaded.Info),
        };
        // f = JSON.parse(FileInfoStringInfo)
      }
    }
  }

  useEffect(() => {
    getContentExist().then(cont => {
      // console.log('cont',cont);

      if (cont && Object.keys(cont.all).includes(route.params.screen)) {
        setInfo(cont.all[route.params.screen].Info);
        setContent(cont.all[route.params.screen].Content);
      } else {
        setExists(true);
        dispatch({ type: 'read', lawName: route.params.screen });
      }
    });

    Animated.timing(animatedForNavi, {
      toValue: find ? 80 : 0,
      duration: 600,
      useNativeDriver: false,
    }).start();

    if (route.params) {
      if (route.params.input) {
        setTimeout(() => {
          pushToSearch();
          Animated.timing(animatedForNavi, {
            toValue: !find ? 80 : 0,
            duration: 600,
            useNativeDriver: false,
          }).start();
          setFind(true);
        }, 500);
      }
    }

    return () => {
      eachSectionWithChapter = [];
    };
  }, []);

  function collapse(a) {
    // để collapse chương nếu không có mục 'phần thứ...' hoặc mục' phần thứ...' nếu có
    if (a == undefined) {
    } else if (tittleArray.includes(a)) {
      setTittleArray(tittleArray.filter(a1 => a1 !== a));
    } else {
      setTittleArray([...tittleArray, a]);
    }

    let contain = false;
    if (eachSectionWithChapter[a]) {
      for (let m = 0; m < eachSectionWithChapter[a].length; m++) {
        if (tittleArray2.includes(eachSectionWithChapter[a][m])) {
          contain = true;
        } else {
          contain = false;
          break;
        }
      }

      let tittleArray2Copy = tittleArray2;
      for (let m = 0; m < eachSectionWithChapter[a].length; m++) {
        if (!contain) {
          if (!tittleArray2.includes(eachSectionWithChapter[a][m])) {
            tittleArray2.push(eachSectionWithChapter[a][m]);
          }
        } else {
          tittleArray2Copy = tittleArray2Copy.filter(
            item => item != eachSectionWithChapter[a][m],
          );
          setTittleArray2(tittleArray2Copy);
        }
      }
    }
  }

  function collapse2(a) {
    // để collapse chương nếu có mục 'phần thứ...'
    if (a == undefined) {
    } else if (tittleArray2.includes(a)) {
      setTittleArray2(tittleArray2.filter(a1 => a1 !== a));
    } else {
      setTittleArray2([...tittleArray2, a]);
    }
    // setTittle(null);
  }

  let searchResultCount = 0;
  // let c = 0;
  function highlight(para, word, article) {
    // Chuẩn hóa đầu vào về chuỗi để tránh trả về object cho <Text>
    const raw = para && para[0];
    if (raw === undefined || raw === null) {
      return '';
    }

    let text;
    if (typeof raw === 'string') {
      text = raw;
    } else if (Array.isArray(raw)) {
      text = raw.join(' ');
    } else if (typeof raw === 'object') {
      const firstKey = Object.keys(raw)[0];
      text = typeof firstKey === 'string' ? firstKey : JSON.stringify(raw);
    } else {
      text = String(raw);
    }

    // đôi khi Điều ... không có khoản (nội dung chính trong điều) thì điều này giúp không load ['']
    if (word.match(/(\w+|\(|\)|\.|\+|\-|\,|\&|\?|\;|\!|\/)/gim)) {
      let inputRexgex = text.match(new RegExp(String(word), 'igmu'));
      // let inputRexgex = text.match(new RegExp('hội', 'igmu'));
      if (inputRexgex) {
        searchResultCount += inputRexgex.length;
        let searchedPara = text
          .split(new RegExp(String(word), 'igmu'))
          // .split(new RegExp('hội', 'igmu'))
          .reduce((prev, current, i) => {
            if (!i) {
              return [
                <Text
                  style={{
                    ...(article ? { ...styles.dieu } : {}),
                    lineHeight: 23,
                  }}
                  key={`${i}xa`}
                >
                  {current}
                </Text>,
              ];
            }

            function setPositionYSearch({ y }) {
              positionYArr.push(y + currentYRef.current - heightDevice / 3);

              positionYArr.sort((a, b) => {
                if (a > b) {
                  return 1;
                } else {
                  if (a < b) return -1;
                }
              });

              if (go) {
                setTimeout(() => {
                  list.current.scrollTo({
                    y: positionYArr[0], //- 57
                  });
                }, 500);
              }
            }

            return prev.concat(
              <React.Fragment key={`${i}htth`}>
                <View
                  style={{
                    height: go ? 9 : 1,
                  }}
                >
                  <View
                    key={`${i}img`}
                    style={{
                      height: go ? 9 : 1,
                    }}
                    onLayout={event => {
                      event.target.measure(
                        (x, y, width, height, pageX, pageY) => {
                          if (go) {
                            setPositionYSearch({
                              y: y + pageY,
                            });
                          }
                        },
                      );
                    }}
                  ></View>
                </View>
                <Text
                  style={
                    searchResultCount - inputRexgex.length + i - 1 <
                      currentSearchPoint &&
                    searchResultCount - inputRexgex.length + i >=
                      currentSearchPoint
                      ? {
                          ...(article ? { ...styles.dieu } : {}),
                          ...styles.highlight1,
                        }
                      : {
                          ...(article ? { ...styles.dieu } : {}),
                          ...styles.highlight,
                        }
                  }
                  key={`${i}gmi`}
                >
                  {inputRexgex[i - 1]}
                </Text>
              </React.Fragment>,
              <Text
                key={`${i}vvv`}
                style={{
                  ...(article ? { ...styles.dieu } : {}),
                  lineHeight: 23,
                }}
              >
                {current}
              </Text>,
            );
          }, []);
        return (
          <View>
            <Text style={{ textAlign: 'justify' }}>{searchedPara}</Text>
          </View>
        );
      } else {
        return <Text>{text}</Text>;
      }
    } else {
      return <Text>{text}</Text>;
    }
  }

  // console.log(positionYArrArtical);
  function setPositionYArtical({ y, key3 }) {
    const value = y + currentYRef.current - insets.top + 15;

    setPositionYArrArtical(prev => {
      const index = prev.findIndex(obj => Object.keys(obj)[0] === key3);

      // đã tồn tại → cập nhật
      // value là vị trí TUYỆT ĐỐI trong nội dung cuộn (pageY + scroll offset),
      // nên chỉ cập nhật chính item này. KHÔNG được dời các item phía sau theo
      // delta: mỗi item tự đo lại vị trí tuyệt đối của mình khi onLayout chạy.
      // Việc dời theo delta trước đây làm sai vị trí của các item ở phần đang
      // mở khi một phần khác được thu gọn/mở lại.
      if (index !== -1) {
        const newArr = [...prev];
        newArr[index] = { [key3]: value };
        return newArr;
      }

      // chưa tồn tại → thêm mới
      return [...prev, { [key3]: value }];
    });
  }

  // Lưu node gốc của từng điều theo tiêu đề để có thể ĐO LẠI vị trí bất cứ lúc
  // nào (onLayout chỉ tự chạy khi layout của điều so với cha nó đổi — mở/thu gọn
  // một phần khác KHÔNG kích hoạt onLayout cho các điều bên dưới).
  const articleNodes = useRef({});

  function measureArticle(node, key3) {
    if (!node || !node.measure) return;
    articleNodes.current[key3] = node;
    node.measure((x, y, width, height, pageX, pageY) => {
      setPositionYArtical({ y: y + pageY, key3 });
    });
  }

  // Đo lại vị trí TẤT CẢ các điều — gọi khi panel mở (lúc này mọi phần đều đã
  // bung ra và layout ổn định) để mọi vị trí đều khớp trạng thái expand hiện tại.
  function remeasureAllArticles() {
    Object.keys(articleNodes.current).forEach(key3 => {
      const node = articleNodes.current[key3];
      if (node && node.measure) {
        node.measure((x, y, width, height, pageX, pageY) => {
          setPositionYArtical({ y: y + pageY, key3 });
        });
      }
    });
  }

  // Khi mở panel (article/bookmark), toàn bộ nội dung được ép bung ra
  // (showArticle || ...). Chờ layout bung xong rồi đo lại toàn bộ vị trí điều.
  useEffect(() => {
    if (showArticle) {
      const t = setTimeout(remeasureAllArticles, 300);
      return () => clearTimeout(t);
    }
  }, [showArticle]);

  TopUnitCount = Content && Object.keys(Content).length;

  function Shrink() {
    for (let b = 0; b <= TopUnitCount - 1; b++) {
      if (tittleArray == []) {
        setTittleArray([b]);
      } else {
        setTittleArray(oldArray => [...oldArray, b]);
      }
    }

    let sumChapter = sumChapterArray.reduce((total, currentValue) => {
      // tổng chapter nếu có phần thứ
      if (currentValue) {
        return total + currentValue;
      }
    });

    for (let b = 0; b <= sumChapter - 1; b++) {
      if (tittleArray2 == []) {
        setTittleArray2([b]);
      } else {
        setTittleArray2(oldArray => [...oldArray, b + 1]);
      }
    }
  }

  useEffect(() => {
    setGo(false);
  }, [input]);

  useEffect(() => {
    // setPositionYArr([]);
  }, [go]);

  useEffect(() => {
    if (!loading && route.params.input) {
      pushToSearch();
    }
  }, [loading]);

  useEffect(() => {
    if (currentSearchPoint != 0 && searchResultCount) {
      list.current.scrollTo({
        y: positionYArr[currentSearchPoint - 1], //- 57
      });
    }
  }, [currentSearchPoint]);


  let transY = animatedForNavi.interpolate({
    inputRange: [-100, 0, 80, 90, 100],
    outputRange: [
      0,
      0,
      Platform.OS === 'ios' ? -25 - insets.bottom : -45 - insets.bottom,
      0,
      0,
    ],
  });

  let transX = animatedForNavi.interpolate({
    inputRange: [-100, 0],
    outputRange: [0, (widthDevice / 100) * 60],
  });

  let Opacity = animatedForNavi.interpolate({
    inputRange: [-100, 0],
    outputRange: [0.7, 0],
  });

  let MagginBottom = animatedForNavi.interpolate({
    inputRange: [-100, 0, 80, 90, 100],
    outputRange: [
      50 + insets.bottom / 2,
      50 + insets.bottom / 2,
      90 + insets.bottom / 2,
      10,
      10,
    ],
  });

  useEffect(() => {
    if (find == true) {
      setTittleArray([]);
      setTittleArray2([]);
      Shrink();
    }
    Keyboard.dismiss();
  }, [find]);

  const showToast = content => {
    Toast.show({
      type: 'copyToast',
      text1: `Đã sao chép`,
      visibilityTime: 1500, // thời gian hiển thị
      autoHide: true,
      topOffset: 50 + insets.top, // tránh colliding với gesture bottom });
    });
  };

  // đưa nội dung điều (có thể là chuỗi / mảng / object) về chuỗi
  function toPlainText(raw) {
    if (raw === undefined || raw === null) return '';
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) return raw.join(' ');
    if (typeof raw === 'object') {
      const k = Object.keys(raw)[0];
      return typeof k === 'string' ? k : JSON.stringify(raw);
    }
    return String(raw);
  }

  // tách nội dung điều thành từng khoản theo dòng bắt đầu bằng "số."
  function splitClauses(text) {
    if (typeof text !== 'string' || !text.trim()) return null;
    const lines = text.split('\n');
    const clauses = [];
    let cur = null;
    for (const line of lines) {
      if (/^\s*\d+\.(\s|$)/.test(line)) {
        if (cur !== null) clauses.push(cur);
        cur = line;
      } else {
        cur = cur === null ? line : cur + '\n' + line;
      }
    }
    if (cur !== null) clauses.push(cur);
    return clauses.length > 1 ? clauses : null; // chỉ tách khi có nhiều hơn 1 khoản
  }

  // tách nội dung điều thành mảng khoản (dùng chung cho hiển thị và copy -> luôn khớp index)
  function getClauses(rawContent) {
    const text = toPlainText(rawContent);
    return splitClauses(text) || [text];
  }

  // đọc số khoản ở đầu chuỗi ("3. ..." -> 3); không đánh số (chapeau) -> -1 (lên đầu)
  function clauseNumber(text) {
    const m = String(text).match(/^\s*(\d+)\./);
    return m ? parseInt(m[1], 10) : -1;
  }

  // áp dụng lựa chọn: copy = tên điều + text các khoản đang chọn
  // sắp xếp theo SỐ KHOẢN in trong văn bản (không theo vị trí mảng)
  function applySelection(dieuId, title, items) {
    const sorted = [...items].sort((a, b) => {
      const na = clauseNumber(a.text);
      const nb = clauseNumber(b.text);
      if (na !== nb) return na - nb;
      return a.idx - b.idx;
    });
    const dId = sorted.length ? dieuId : 'none';
    // cập nhật ref trước (đồng bộ) để lần nhấn kế tiếp đọc đúng
    selectedRef.current = { dieuId: dId, clauses: sorted };
    setSelectedDieuId(dId);
    setSelectedClauses(sorted);
    if (sorted.length) {
      const body = sorted.map(c => c.text).join('\n');
      Clipboard.setString(`${title}\n${body}`);
      showToast();
      Vibration.vibrate(20);
    }
  }

  // TAP / LONG-PRESS: chọn hoặc bỏ chọn khoản này (cộng dồn trong cùng điều)
  function toggleClause(dieuId, title, idx, clauseText) {
    const cur = selectedRef.current;
    // đang chọn ở điều khác -> chỉ bỏ chọn (không chọn khoản vừa nhấn)
    if (cur.clauses.length && dieuId !== cur.dieuId) {
      applySelection(dieuId, title, []);
      return;
    }
    const base = dieuId === cur.dieuId ? cur.clauses : [];
    const exists = base.some(c => c.idx === idx);
    const next = exists
      ? base.filter(c => c.idx !== idx)
      : [...base, { idx, text: clauseText }];
    applySelection(dieuId, title, next);
  }

  // tap vào tiêu đề điều -> bật/tắt chọn cả điều (đang có chọn thì xóa hết -> dùng để reset)
  function selectWholeDieu(dieuId, title, clauses) {
    const cur = selectedRef.current;
    if (dieuId === cur.dieuId && cur.clauses.length) {
      applySelection(dieuId, title, []); // đang chọn -> xóa hết
    } else {
      applySelection(
        dieuId,
        title,
        clauses.map((text, idx) => ({ idx, text })),
      );
    }
  }

  // đang trong chế độ chọn (đã có ít nhất 1 khoản được chọn)
  function hasSelection() {
    return selectedRef.current.clauses.length > 0;
  }

  // PRESS thường: chỉ chọn thêm / bỏ chọn khi ĐÃ vào chế độ chọn (long-press trước)
  function pressClause(dieuId, title, idx, clauseText) {
    if (!hasSelection()) return;
    toggleClause(dieuId, title, idx, clauseText);
  }
  function pressDieu(dieuId, title, clauses) {
    if (!hasSelection()) return;
    selectWholeDieu(dieuId, title, clauses);
  }

  // khoản này có đang được chọn không
  function isClauseSelected(dieuId, idx) {
    return selectedDieuId === dieuId && selectedClauses.some(c => c.idx === idx);
  }

  // điều này có đang được chọn không (có ít nhất 1 khoản được chọn)
  function isDieuSelected(dieuId) {
    return selectedDieuId === dieuId && selectedClauses.length > 0;
  }

  // render nội dung điều: mỗi khoản là 1 vùng nhấn riêng
  // nhấn nhẹ (tap) = chọn/bỏ chọn; giữ (long-press) cũng cho kết quả như vậy
  function renderClauses(clauses, dieuTitle, dieuId) {
    return clauses.map((clause, idx) => (
      <Pressable
        key={`kh${idx}`}
        onLongPress={() => toggleClause(dieuId, dieuTitle, idx, clause)}
        onPress={() => pressClause(dieuId, dieuTitle, idx, clause)}
        style={isClauseSelected(dieuId, idx) ? styles.copiedBg : null}
      >
        <Text style={styles.lines}>
          {highlight([clause], valueInput, false)}
        </Text>
      </Pressable>
    ));
  }

  const a = (key, i, key1, i1a, t) => {
    onlyArticle = false;
    return Object.keys(key)[0] != '0' ? (
      <View
        style={
          showArticle ||
          find ||
          ((t == undefined
            ? tittleArray.includes(i)
            : tittleArray2.includes(t)) &&
            styles.content)
        }
      >
        {key[key1].map((key2, i2) => {
          const title = Object.keys(key2)[0];
          const clauses = getClauses(Object.values(key2)[0]);
          const dieuId = `a-${i}-${i1a === undefined ? 't' : i1a}-${i2}`;
          return (
            <View key={`${i2}a1`}>
              <Animated.View
                style={{
                  paddingVertical: 4,
                  // opacity: fadeAnimation,
                  // borderRadius: 4,
                }}
                onLayout={event =>
                  measureArticle(event.target, Object.keys(key2)[0])
                }
              >
                {Object.keys(key2) == ' ' || (
                  <Pressable
                    onLongPress={() => selectWholeDieu(dieuId, title, clauses)}
                    onPress={() => pressDieu(dieuId, title, clauses)}
                  >
                    <Text
                      selectable={true}
                      style={[
                        styles.dieu,
                        isDieuSelected(dieuId) ? styles.copiedBg : null,
                      ]}
                    >
                      {highlight(Object.keys(key2), valueInput, true)}
                    </Text>
                  </Pressable>
                )}

                {renderClauses(clauses, title, dieuId)}
              </Animated.View>
            </View>
          );
        })}
      </View>
    ) : (
      <View key={`${i}a3`}></View>
    );
  };

  const b = (keyA, i, keyB) => {
    // phần nếu có mục 'phần' trong văn bản
    onlyArticle = false;

    return (
      <View
      // key={`${i}b`}
      >
        {keyA[keyB].map((keyC, iC) => {
          // keyC ra object là từng chương hoặc ra điều luôn

          let chapterOrdinal = 0;
          if (Object.keys(keyC)[0].match(/(^Chương.*$|^(V|I|X)*\.)/gim)) {
            //nếu có chương

            sumChapterArray[i + 1] = keyA[keyB].length ? keyA[keyB].length : 0;
            sumChapterPrevious = sumChapterArray
              .slice(0, i + 1)
              .reduce((total, currentValue) => {
                if (currentValue) {
                  return total + currentValue;
                }
              });

            chapterOrdinal = sumChapterPrevious + iC + 1;
            if (!eachSectionWithChapter[i]) {
              eachSectionWithChapter[i] = [chapterOrdinal];
            } else if (!eachSectionWithChapter[i].includes(chapterOrdinal)) {
              eachSectionWithChapter[i].push(chapterOrdinal);
            }
            return (
              <React.Fragment key={`${iC}b1`}>
                <TouchableOpacity // đây là chương
                  onPress={() => {
                    collapse2(chapterOrdinal);
                  }}
                >
                  <Text
                    selectable={true}
                    style={{
                      fontSize: 14,
                      color: 'white',
                      fontWeight: 'bold',
                      padding: 4,
                      textAlign: 'center',
                      backgroundColor: '#66CCFF',
                      marginBottom: 1,
                    }}
                  >
                    {Object.keys(keyC)[0].toUpperCase()}
                  </Text>
                </TouchableOpacity>

                {a(keyC, i, Object.keys(keyC)[0], iC, chapterOrdinal)}
              </React.Fragment>
            );
          } else {
            //nếu không có chương
            return (
              <View
                key={`${iC}b2`}
                style={
                  showArticle ||
                  find ||
                  (tittleArray.includes(i) && styles.content) //////////////////////////////////////////////////////////////////
                }
              >
                <View
                  onLayout={event =>
                    measureArticle(event.target, Object.keys(keyC)[0])
                  }
                  // style={go ? {width: '100%'} : {width: '99%'}}
                >
                  {(() => {
                    const bTitle = Object.keys(keyC)[0];
                    const bClauses = getClauses(Object.values(keyC)[0]);
                    const bDieuId = `b-${i}-${iC}`;
                    return (
                      <>
                        <Pressable
                          onLongPress={() =>
                            selectWholeDieu(bDieuId, bTitle, bClauses)
                          }
                          onPress={() => pressDieu(bDieuId, bTitle, bClauses)}
                        >
                          <Text
                            selectable={true}
                            style={[
                              styles.dieu,
                              isDieuSelected(bDieuId) ? styles.copiedBg : null,
                            ]}
                          >
                            {highlight(Object.keys(keyC), valueInput, true)}
                          </Text>
                        </Pressable>
                        {renderClauses(bClauses, bTitle, bDieuId)}
                      </>
                    );
                  })()}
                </View>
              </View>
            );
          }
        })}
      </View>
    );
  };

  let onlyArticle = true; // dùng để hiển thị collapse và expand
  const c = (key, i, ObjKeys) => {
    // phần nếu chỉ có Điều ...
    // onlyArticle = true;
    const title = Object.keys(key)[0];
    const clauses = getClauses(key[ObjKeys]);
    const dieuId = `c-${i}`;

    return Object.keys(key)[0] != '0' ? (
      <View key={`${i}c`}>
        <View key={`${i}cInner`}>
          <Animated.View
            style={{
              paddingVertical: 4,
              // opacity: fadeAnimation,
              // borderRadius: 4,
            }}
            onLayout={event => measureArticle(event.target, ObjKeys)}
          >
            <Pressable
              onLongPress={() => selectWholeDieu(dieuId, title, clauses)}
              onPress={() => pressDieu(dieuId, title, clauses)}
            >
              <Text
                selectable={true}
                style={[
                  styles.dieu,
                  isDieuSelected(dieuId) ? styles.copiedBg : null,
                ]}
              >
                {highlight([ObjKeys], valueInput, true)}
              </Text>
            </Pressable>
            {renderClauses(clauses, title, dieuId)}
          </Animated.View>
        </View>
      </View>
    ) : (
      <View key={`${i}c1`}></View>
    );
  };

  // const d = (key, i, ObjKeys) => {
  //   // cho hướng dẫn Công văn của VKS, TANDTC
  //   console.log('d');
  //   const title = Object.keys(key)[0];
  //   const content = Object.values(key)[0];
  //   const fullText = `${title}\n${content}`; // hoặc `${title}: ${content}`
  //   console.log('tile', title);

  //   return Object.keys(key)[0] != '0' ? (
  //     <Pressable
  //       key={`${i}c`}
  //       onLongPress={() => {
  //         Clipboard.setString(fullText);
  //         console.log('Copied:', fullText);
  //         setCopied(title);
  //         showToast();
  //         Vibration.vibrate(20);
  //       }}
  //     >
  //       <Animated.View
  //         style={{
  //           paddingVertical: 4,
  //           backgroundColor: copied == title ? '#d1daa8ff' : 'transparent',
  //         }}
  //         onLayout={event => {
  //           event.target.measure((x, y, width, height, pageX, pageY) => {
  //             setPositionYArtical({
  //               y: y + pageY,
  //               key3: ObjKeys,
  //             });
  //           });
  //         }}
  //       >
  //         <Text style={styles.lines}>
  //         {highlight([fullText], valueInput, false)}
  //         </Text>
  //       </Animated.View>
  //     </Pressable>
  //   ) : (
  //     <View key={`${i}c1`}></View>
  //   );
  // };

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      {loading && (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            opacity: 0.7,
            backgroundColor: 'black',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
            // height:heightDevice
          }}
        >
          <Text
            style={{
              color: 'white',
              marginBottom: 15,
              fontWeight: 'bold',
            }}
          >
            Xin vui lòng đợi trong giây lát ...
          </Text>
          <ActivityIndicator size="large" color="white"></ActivityIndicator>
        </View>
      )}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={
          Platform.OS === 'ios' ? -insets.bottom - 15 : -insets.bottom - 35
        }
      >
        <View style={{ flex: 1, position: 'relative' }}>
          <View
            style={{
              top: 0,
              backgroundColor: 'green',
              height: insets.top,
              position: 'absolute',
              width: widthDevice,
              zIndex: 101,
            }}
          ></View>
          <View
            style={{
              display: 'flex',
              flexDirection: 'row',
              top: insets.top,
              width: widthDevice,
              backgroundColor: 'green',
              position: 'relative',
              height: 50,
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingRight: 17,
              paddingLeft: 17,
              opacity: 1,
              zIndex: 100,
            }}
          >
            <TouchableOpacity
              onPressIn={() => {
                navigation.goBack();
              }}
            >
              <Ionicons
                name="chevron-back-outline"
                style={styles.IconInfo}
              ></Ionicons>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: 'yellow',
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderRadius: 30,
              }}
              onPressIn={() => {
                navigation.popToTop();
                console.log(2);
              }}
            >
              <Image
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'yellow',
                }}
                source={require('../assets/t.png')}
              ></Image>
            </TouchableOpacity>
            <View style={{ alignItems: 'center' }}>
              <TouchableOpacity
                style={styles.iconInfoContainer}
                onPressIn={() => {
                  setModalStatus(true);
                  // ModalVisibleStatus.updateModalStatus(true);
                }}
              >
                <Ionicons
                  name="document-text-outline"
                  style={styles.IconInfo}
                ></Ionicons>
              </TouchableOpacity>
            </View>
          </View>

          {Boolean(Content.length) && (
            <>
              <Animated.View
                style={{ marginBottom: MagginBottom, marginTop: insets.top }}
              >
                <ScrollView
                  onScroll={event => {
                    {
                      const { y } = event.nativeEvent.contentOffset;
                      currentYRef.current = y;
                    }
                  }}
                  ref={list}
                  showsVerticalScrollIndicator={true}
                  //   scrollEventThrottle={100}   // nếu thêm cái này thì từ tìm được lần thứ 2 trở đi sẽ không đúng vị trí nữa
                >
                  <Text key={'abc'} style={styles.titleText}>
                    {Info && Info['lawNameDisplay']}
                  </Text>
                  {Content &&
                    Content.map((key, i) => {
                      if (i + 1 == Content.length) {
                        // dispatch(noLoading())
                      }
                      // console.log('key',key);

                      return (
                        <View key={`${i}Main`}>
                          {(Object.keys(key)[0].match(
                            /^(phần thứ .*)|^chương .*/gim,
                          ) ||
                            Object.keys(key)[0].match(
                              /^(V|I|X|A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z)*\./,
                            )) && (
                            <TouchableOpacity
                              // key={`${i}qq`}
                              style={styles.chapter}
                              onPress={() => {
                                collapse(i);
                                // setTittle(i);
                              }}
                            >
                              <Text
                                // key={`${i}bb`}
                                style={{
                                  fontSize: 18,
                                  color: 'black',
                                  fontWeight: 'bold',
                                  padding: 9,
                                  textAlign: 'center',
                                }}
                              >
                                {Object.keys(key)[0].toUpperCase()}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {Object.keys(key)[0].match(/^phần thứ .*/gim) ||
                          Object.keys(key)[0].match(/^(A|B|C|D|E|F|G|H)\./)
                            ? b(key, i, Object.keys(key)[0])
                            : Object.keys(key)[0].match(
                                /(^chương .*|^(V|I|X)*\.)/gim,
                              )
                            ? a(key, i, Object.keys(key)[0])
                            : c(key, i, Object.keys(key)[0])}
                        </View>
                      );
                    })}
                  <View style={{ height: 40 + insets.bottom / 2 }}></View>
                </ScrollView>
              </Animated.View>
            </>
          )}
          <>
            {showArticle && (
              <SidePanel
                mode={panelMode}
                positions={positionYArrArtical}
                transX={transX}
                Opacity={Opacity}
                widthDevice={widthDevice}
                insets={insets}
                screen={route.params.screen}
                onClose={() => {
                  Keyboard.dismiss();
                  setTimeout(() => {
                    setShowArticle(false);
                  }, 600);
                  Animated.timing(animatedForNavi, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: false,
                  }).start();
                }}
                onSelect={y => {
                  Keyboard.dismiss();
                  setShowArticle(false);
                  list.current.scrollTo({ y: y - 55 });
                  Animated.timing(animatedForNavi, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: false,
                  }).start();
                }}
              />
            )}
          </>
          <View
            style={{
              ...styles.functionTab,
              paddingBottom:
                Platform.OS === 'ios' ? insets.bottom / 2 : 3 + insets.bottom,
              height:
                Platform.OS === 'ios' ? 15 + insets.bottom : 35 + insets.bottom,
              bottom: 0,
            }}
          >
            {!onlyArticle && (
              <TouchableOpacity
                style={styles.tab}
                onPress={() => {
                  setFind(false);

                  let timeOut = setTimeout(() => {
                    setShowArticle(false);
                    return () => {};
                  }, 600);

                  // đang thu gọn TOÀN BỘ -> mở ra; còn lại (đang mở hết hoặc mở
                  // một phần) -> thu gọn toàn bộ.
                  const isFullyCollapsed =
                    TopUnitCount > 0 && tittleArray.length >= TopUnitCount;
                  if (isFullyCollapsed) {
                    setTittleArray([]);
                    setTittleArray2([]);
                  } else {
                    setTittleArray([]);
                    Shrink();
                  }

                  Animated.timing(animatedForNavi, {
                    toValue: 0,
                    // toValue:100,
                    duration: 600,
                    useNativeDriver: false,
                  }).start();
                }}
              >
                <Ionicons
                  name={
                    TopUnitCount > 0 && tittleArray.length >= TopUnitCount
                      ? 'chevron-expand-outline'
                      : 'chevron-collapse-outline'
                  }
                  style={styles.innerTab}
                ></Ionicons>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.tab}
              onPress={() => {
                if (list.current) {
                  list.current.scrollTo({ y: 0 });
                  let timeOut = setTimeout(() => {
                    setShowArticle(false);
                    return () => {};
                  }, 600);
                }
              }}
            >
              <Ionicons
                name="arrow-up-outline"
                style={styles.innerTab}
              ></Ionicons>
            </TouchableOpacity>

            <TouchableOpacity
              // style={find ? styles.ActiveTab : styles.tab}
              style={styles.tab}
              onPress={() => {
                setFind(!find);
                let timeOut = setTimeout(() => {
                  setShowArticle(false);
                  return () => {};
                }, 600);
                Animated.timing(animatedForNavi, {
                  toValue: !find ? 80 : 0,
                  duration: 600,
                  useNativeDriver: false,
                }).start();

                setTittleArray([]);
                setTittleArray2([]);
                // Shrink();
                setGo(false);
              }}
            >
              {/* <Text style={styles.innerTab}>Find</Text> */}
              <Ionicons
                name="search-outline"
                style={find ? styles.ActiveInner : styles.innerTab}
              ></Ionicons>
            </TouchableOpacity>
            <TouchableOpacity
              // style={showArticle && !find ? styles.ActiveTab : styles.tab}
              style={styles.tab}
              onPress={() => {
                if (list.current) {
                  // đang mở đúng chế độ 'article' -> đóng; ngược lại -> mở chế độ article
                  const willClose = showArticle && panelMode === 'article';
                  if (willClose) {
                    let timeOut = setTimeout(() => {
                      setShowArticle(false);
                      return () => {};
                    }, 600);
                  } else {
                    setPanelMode('article');
                    setShowArticle(true);
                  }
                  setFind(false);
                  Keyboard.dismiss();
                  Animated.timing(animatedForNavi, {
                    toValue: willClose ? 0 : -100,
                    duration: 600,
                    useNativeDriver: false,
                  }).start();

                  setTittleArray([]);
                  setTittleArray2([]);
                }
              }}
            >
              <Ionicons
                name="menu-outline"
                style={
                  showArticle && panelMode === 'article'
                    ? styles.ActiveInner
                    : styles.innerTab
                }
              ></Ionicons>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => {
                if (list.current) {
                  // đang mở đúng chế độ 'bookmark' -> đóng; ngược lại -> mở chế độ ghi nhớ
                  const willClose = showArticle && panelMode === 'bookmark';
                  if (willClose) {
                    let timeOut = setTimeout(() => {
                      setShowArticle(false);
                      return () => {};
                    }, 600);
                  } else {
                    setPanelMode('bookmark');
                    setShowArticle(true);
                  }
                  setFind(false);
                  Keyboard.dismiss();
                  Animated.timing(animatedForNavi, {
                    toValue: willClose ? 0 : -100,
                    duration: 600,
                    useNativeDriver: false,
                  }).start();

                  setTittleArray([]);
                  setTittleArray2([]);
                }
              }}
            >
              <Ionicons
                name={
                  showArticle && panelMode === 'bookmark' ? 'star' : 'star-outline'
                }
                style={
                  showArticle && panelMode === 'bookmark'
                    ? styles.ActiveInner
                    : styles.innerTab
                }
              ></Ionicons>
            </TouchableOpacity>
          </View>

          <Animated.View
            style={{
              ...styles.findArea,
              width: widthDevice,
              transform: [{ translateY: transY }],
            }}
          >
            <View
              // distance={10}
              // startColor={'gray'}
              // sides={'top'}
              style={{ ...styles.searchView, width: widthDevice }}
            >
              {/* <View style={styles.searchView}> */}

              <View
                style={{
                  flexDirection: 'row',
                  minWidth: 98,
                  width: '20%',
                  justifyContent: 'space-around',
                  height: '100%',
                  alignItems: 'center',
                  alignContent: 'center',
                }}
              >
                <TouchableOpacity
                  style={styles.tabSearch}
                  onPress={() => {
                    currentSearchPoint == 1
                      ? setCurrentSearchPoint(positionYArr.length)
                      : setCurrentSearchPoint(currentSearchPoint - 1);

                    if (currentSearchPoint == searchResultCount) {
                      list.current.scrollTo({
                        y: positionYArr[currentSearchPoint - 1],
                      });
                    }
                  }}
                >
                  <Ionicons
                    name="caret-up-outline"
                    style={{
                      paddingLeft: 15,
                      paddingRight: 15,
                      fontSize: 18,
                      color: '#888888',
                      // textAlign: 'center',
                      // fontWeight: 'bold',
                      // fontSize: 25,
                    }}
                  ></Ionicons>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tabSearch}
                  onPress={() => {
                    currentSearchPoint == positionYArr.length
                      ? setCurrentSearchPoint(1)
                      : setCurrentSearchPoint(currentSearchPoint + 1);
                    if (currentSearchPoint == searchResultCount) {
                      list.current.scrollTo({
                        y: positionYArr[currentSearchPoint - 1],
                      });
                    }
                  }}
                >
                  <Ionicons
                    name="caret-down-outline"
                    style={{
                      paddingLeft: 15,
                      paddingRight: 15,
                      fontSize: 18,
                      color: '#888888',
                      // textAlign: 'center',
                      // fontWeight: 'bold',
                      // fontSize: 25,
                    }}
                  ></Ionicons>
                </TouchableOpacity>
              </View>

              <View style={styles.inputArea}>
                <View style={{ flexDirection: 'row', width: '89%' }}>
                  <TextInput
                    ref={textInputFind}
                    selectTextOnFocus={true}
                    style={{
                      width: '90%',
                      color: 'black',
                      height: 35,
                      fontSize: 13,
                      padding: 0,
                      paddingLeft: 10,
                    }}
                    onChangeText={text => setInput(text)}
                    autoFocus={false}
                    value={input}
                    placeholder=" Vui lòng nhập từ khóa ..."
                    placeholderTextColor={'gray'}
                    onSubmitEditing={() => pushToSearch()}
                  ></TextInput>
                  <TouchableOpacity
                    style={{
                      color: 'white',
                      fontSize: 16,
                      flex: 1,
                      flexDirection: 'row',
                      justifyContent: 'space-evenly',
                      right: 0,
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      setInput('');
                      textInputFind.current.focus();
                    }}
                  >
                    {input && (
                      <Ionicons
                        name="close-circle-outline"
                        style={{
                          color: 'black',
                          fontSize: 20,
                          textAlign: 'center',
                          width: '100%',
                          height: 20,
                        }}
                      ></Ionicons>
                    )}
                  </TouchableOpacity>
                </View>
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignContent: 'center',
                    padding: 0,
                    left: 0,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: 'black',
                      fontSize: 8,
                      textAlign: 'center',
                      // minWidth:18
                    }}
                  >
                    {searchResultCount
                      ? `${currentSearchPoint}`
                      : searchResultCount}
                  </Text>
                  <Text
                    style={{
                      color: 'black',
                      fontSize: 8,
                      textAlign: 'center',
                      borderTopColor: 'gray',
                      borderTopWidth: 1,
                      // minWidth:18,
                    }}
                  >
                    {searchResultCount
                      ? `${searchResultCount}`
                      : searchResultCount}
                  </Text>
                </View>
              </View>
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  flexDirection: 'row',
                }}
              >
                <TouchableOpacity
                  style={styles.searchBtb}
                  onPress={() => {
                    pushToSearch();
                  }}
                >
                  <Ionicons
                    name="return-down-forward-outline"
                    style={{
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: 18,
                    }}
                  ></Ionicons>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          <Modal
            presentationStyle="pageSheet"
            animationType="slide"
            visible={modalStatus}
            onRequestClose={() => setModalStatus(false)}
            style={{}}
          >
            <ScrollView
              style={{
                backgroundColor: '#EEEFE4',
                paddingTop: Platform.OS === 'ios' ? 0 : insets.top,
              }}
            >
              <View style={{ paddingBottom: 30 }}>
                <View
                  style={{
                    // marginTop:20,
                    backgroundColor: 'white', // #CCCCCC
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    height: 60,
                    borderColor: '#2F4F4F',
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setModalStatus(false);
                    }}
                    style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 60,
                      width: 60,
                      // borderWidth:4,
                      borderColor: 'black',
                      // borderRadius:10,
                      // backgroundColor:'white',
                    }}
                  >
                    <Ionicons
                      name="close-outline"
                      style={{
                        color: 'black',
                        fontSize: 30,
                        textAlign: 'center',
                        // width: '100%',
                        fontWeight: 'bold',
                      }}
                    ></Ionicons>
                  </TouchableOpacity>
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: 'white',
                      alignItems: 'center',
                      flex: 1,
                      justifyContent: 'flex-end',
                    }}
                  >
                    {exists && (
                      <TouchableOpacity
                        onPress={() => {
                          if (!loading) {
                            StoreInternal();
                            setExists(false);
                          }
                        }}
                        style={{
                          alignItems: 'center',
                          width: 70,
                          height: 60,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons
                          name="save-outline"
                          style={{
                            color: '#009933',
                            fontSize: 25,
                            textAlign: 'center',
                            width: '100%',
                            fontWeight: 'bold',
                          }}
                        ></Ionicons>
                      </TouchableOpacity>
                    )}
                    {!exists && (
                      <TouchableOpacity
                        onPress={async () => {
                          Alert.alert(
                            'Thông báo',
                            'Bạn có muốn xóa văn bản ra khỏi bộ nhớ không?',
                            [
                              {
                                text: 'Thoát',
                                style: 'cancel',
                              },
                              {
                                text: 'Xoá',
                                onPress: () => {
                                  if (!loading) {
                                    DeleteInternal();
                                    setExists(true);
                                  }
                                },
                              },
                            ],
                          );
                        }}
                        style={{
                          // backgroundColor: '#00CC33',
                          // padding: 20,
                          alignItems: 'center',
                          width: 70,
                          height: 60,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons
                          name="trash-outline"
                          style={{
                            color: 'red',
                            fontSize: 25,
                            textAlign: 'center',
                            fontWeight: 'bold',
                          }}
                        ></Ionicons>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View
                  style={{
                    padding: 20,
                    paddingTop: 30,
                    paddingBottom: 20,
                    // backgroundColor: 'blue',
                  }}
                >
                  <Text
                    style={{
                      textAlign: 'center',
                      fontSize: 23,
                      fontWeight: 'bold',
                      color: 'black',
                    }}
                  >
                    THÔNG TIN CHI TIẾT
                  </Text>
                </View>
                <View
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    paddingTop: 10,
                    justifyContent: 'space-evenly',
                    alignItems: 'center',
                    // backgroundColor: 'green',
                    paddingLeft: '5%',
                    paddingRight: '5%',
                  }}
                >
                  <View
                    style={{ ...styles.ModalInfoContainer, borderTopWidth: 2 }}
                  >
                    <View style={{ width: '40%', justifyContent: 'center' }}>
                      <Text style={styles.ModalInfoTitle}>Tên gọi:</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ ...styles.ModalInfoContent }}>
                        {Info && Info['lawNameDisplay']}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.ModalInfoContainer}>
                    <View style={{ width: '40%', justifyContent: 'center' }}>
                      <Text style={styles.ModalInfoTitle}>
                        Trích yếu nội dung:
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          ...styles.ModalInfoContent,
                          textAlign: 'justify',
                        }}
                      >
                        {Info && Info['lawDescription']}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.ModalInfoContainer}>
                    <View style={{ width: '40%' }}>
                      <Text style={styles.ModalInfoTitle}>Ngày ký:</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ModalInfoContent}>
                        {Info &&
                          new Date(Info['lawDaySign']).toLocaleDateString(
                            'vi-VN',
                          )}
                      </Text>
                    </View>
                  </View>
                  {Info['lawDayActive'] && (
                    <View style={styles.ModalInfoContainer}>
                      <View style={{ width: '40%' }}>
                        <Text style={styles.ModalInfoTitle}>
                          Ngày có hiệu lực:
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ModalInfoContent}>
                          {Info &&
                            new Date(Info['lawDayActive']).toLocaleDateString(
                              'vi-VN',
                            )}
                        </Text>
                      </View>
                    </View>
                  )}

                  {Info['lawNumber'] && (
                    <View style={styles.ModalInfoContainer}>
                      <View style={{ width: '40%' }}>
                        <Text style={styles.ModalInfoTitle}>Số văn bản:</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ModalInfoContent}>
                          {Info && !Info['lawNumber'].match(/^0001\\HP/gim)
                            ? Info['lawNumber']
                            : ''}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.ModalInfoContainer}>
                    <View style={{ width: '40%' }}>
                      <Text style={styles.ModalInfoTitle}>Tên người ký:</Text>
                    </View>
                    <View
                      style={{ flex: 1, paddingBottom: 10, paddingTop: 10 }}
                    >
                      {Info && !Array.isArray(Info['nameSign']) ? (
                        <Text style={styles.ModalInfoContent}>
                          {Info['nameSign']}
                        </Text>
                      ) : (
                        Info['nameSign'] &&
                        Info['nameSign'].map((key, i) => (
                          <View key={`${i}nameSign`}>
                            <Text
                              style={{ ...styles.ModalInfoContentLawRelated }}
                            >
                              {`- ${key}`}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>

                  <View style={styles.ModalInfoContainer}>
                    <View style={{ width: '40%' }}>
                      <Text style={styles.ModalInfoTitle}>
                        Chức vụ người ký:
                      </Text>
                    </View>
                    <View
                      style={{ flex: 1, paddingBottom: 10, paddingTop: 10 }}
                    >
                      {Info && !Array.isArray(Info['roleSign']) ? (
                        <Text style={styles.ModalInfoContent}>
                          {Info['roleSign']}
                        </Text>
                      ) : (
                        Info['roleSign'] &&
                        Info['roleSign'].map((key, i) => (
                          <View key={`${i}roleSign`}>
                            <Text
                              style={{ ...styles.ModalInfoContentLawRelated }}
                            >
                              {`- ${key}`}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                  <View style={{ ...styles.ModalInfoContainer }}>
                    <View style={{ width: '40%' }}>
                      <Text style={{ ...styles.ModalInfoTitle }}>
                        Cơ quan ban hành:
                      </Text>
                    </View>
                    <View
                      style={{ flex: 1, paddingBottom: 10, paddingTop: 10 }}
                    >
                      {Info && !Array.isArray(Info['unitPublish']) ? (
                        <Text style={styles.ModalInfoContent}>
                          {Info['unitPublish']}
                        </Text>
                      ) : (
                        Info['unitPublish'] &&
                        Info['unitPublish'].map((key, i) => (
                          <View key={`${i}unitPublish`}>
                            <Text
                              style={{ ...styles.ModalInfoContentLawRelated }}
                            >
                              {`- ${key}`}
                            </Text>
                          </View>
                        ))
                      )}
                    </View>
                  </View>
                  {Info && Object.keys(Info).includes('lawRelated') && (
                    <View
                      style={{
                        ...styles.ModalInfoContainer,
                        borderBottomWidth: 2,
                        flexDirection: 'column',
                        //  width: '100%'
                      }}
                    >
                      <View style={{ width: '100%' }}>
                        <Text
                          style={{
                            ...styles.ModalInfoTitle,
                            textAlign: 'center',
                            paddingBottom: 0,
                          }}
                        >
                          Văn bản liên quan:
                        </Text>
                      </View>
                      <View
                        style={{
                          paddingBottom: 10,
                          paddingTop: 10,
                          flexDirection: 'column',
                          width: '100%',
                          paddingRight: 10,
                          paddingLeft: 10,
                        }}
                      >
                        {Info &&
                          Object.keys(Info['lawRelated']).map((key, i) => {
                            if (Info['lawRelated'][key]) {
                              let nameLaw = Info['lawRelated'][key];
                              return (
                                <TouchableOpacity
                                  // style={{backgroundColor:'red'}}
                                  key={`${i}lawRelated`}
                                  onPress={() => {
                                    if (internetConnected) {
                                      navigation.push(`accessLaw`, {
                                        screen: key,
                                      });
                                      setModalStatus(false);
                                    }
                                  }}
                                >
                                  <Text
                                    style={{
                                      ...styles.ModalInfoContentLawRelated,
                                      textAlign: 'justify',
                                      fontWeight: 600,
                                      fontStyle: 'italic',
                                      // backgroundColor:'blue',
                                      lineHeight: 22,
                                      paddingLeft: 0,
                                    }}
                                  >
                                    - {nameLaw}
                                  </Text>
                                </TouchableOpacity>
                              );
                            }
                          })}
                      </View>
                    </View>
                  )}
                  <TouchableOpacity
                    onPress={async () => {
                      setModalStatus(false);
                    }}
                    style={{
                      padding: 5,
                      marginTop: 30,
                      backgroundColor: 'white', //#778899
                      // backgroundColor: '#00CC33',
                      alignItems: 'center',
                      width: 100,
                      height: 35,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 10,
                      // borderColor:'#555555',
                      // borderWidth:1,

                      shadowColor: 'gray',
                      shadowOpacity: 1,
                      shadowOffset: {
                        width: 1,
                        height: 1,
                      },
                      shadowRadius: 4,
                      elevation: 2,
                    }}
                  >
                    <Text
                      style={{
                        // backgroundColor: 'red',
                        // paddingLeft: 10,
                        // paddingRight: 5,
                        fontSize: 15,
                        color: 'black',
                        fontWeight: 'bold',
                      }}
                    >
                      Đóng
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  titleText: {
    fontSize: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 5,
    textAlign: 'center',
    paddingLeft: 10,
    paddingRight: 10,
    color: 'rgb(68,68,68)',
    // backgroundColor:'rgb(230,230,230)',
    fontWeight: 'bold',
  },
  chapter: {
    // height: 60,
    justifyContent: 'center',
    backgroundColor: '#F9CC76',
    color: 'black',
    alignItems: 'center',
    marginBottom: 1,
  },
  dieu: {
    fontWeight: 'bold',
    textAlign: 'justify',
    marginTop: 10,
    paddingLeft: 10,
    paddingRight: 10,
    lineHeight: 22,
    // backgroundColor:'blue',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'black',
  },
  lines: {
    textAlign: 'justify',
    paddingLeft: 10,
    paddingRight: 10,
    paddingBottom: 0,
    fontSize: 14,
    color: 'black',
    lineHeight: 23,
  },
  highlight: {
    color: 'black',
    backgroundColor: 'yellow',
    lineHeight: 23,
  },
  highlight1: {
    color: 'black',
    backgroundColor: 'orange',
    lineHeight: 23,
  },
  content: {
    height: 0,
  },
  copiedBg: {
    backgroundColor: '#d1daa8ff',
  },
  functionTab: {
    position: 'absolute',
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-around',
    bottom: 0,
    backgroundColor: 'white', // #00CD66
    paddingTop: 3,
    zIndex: 10,
    borderTopWidth: 2,
    borderTopColor: 'black',
    alignItems: 'center',
  },
  tab: {
    // backgroundColor: 'red',
    borderRadius: 30,
    width: '15%',
    height: 40,
    textAlign: 'center',
    justifyContent: 'center',
    display: 'flex',
    alignItems: 'center',
  },
  innerTab: {
    color: 'black',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
  ActiveInner: {
    color: '#00CD66',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 18,
  },
  findArea: {
    display: 'flex',
    flexDirection: 'column',
    bottom: -11,
    position: 'absolute',
    right: 0,
    left: 0,
    borderTopWidth: 0.4,
    borderTopColor: 'gray',
  },
  searchView: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'black', //#FAEBD7
    overflow: 'hidden',
    margin: 0,
    paddingTop: 1.5,
    paddingBottom: 1.5,
  },
  tabSearch: {
    display: 'flex',
    // width: 55,
    height: '100%',
    // borderRadius: 30,
    // backgroundColor: '#777777',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputArea: {
    width: '58%',
    backgroundColor: '#F5F5F5',
    color: 'white',
    padding: 0,
    alignItems: 'center',
    // paddingLeft: 5,
    // paddingRight: 5,
    fontSize: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 10,
    // borderWidth:1
  },
  searchBtb: {
    backgroundColor: '#008080',
    color: 'white',
    borderRadius: 30,
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    textAlign: 'center',
    justifyContent: 'center',
    marginLeft: 20,
    marginRight: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
  listArticle: {
    position: 'absolute',
    width: '55%',
    top: 0,
    bottom: 0,
    backgroundColor: 'white',
    display: 'flex',
    right: 0,
    zindex: 9,
  },
  listItem: {
    display: 'flex',
    paddingBottom: 8,
    paddingTop: 10,

    borderBottomWidth: 1,
    borderBottomColor: 'rgb(245,245,247)',
  },
  listItemText: {
    color: 'black',
    textAlign: 'justify',
    marginRight: 5,
    marginLeft: 5,
  },
  ModalInfoContainer: {
    display: 'flex',
    flexDirection: 'row',
    paddingLeft: '2%',
    paddingRight: '2%',
    flexWrap: 'wrap',
    borderWidth: 2,
    // paddingTop: 10,
    // borderBottomWidth: 1,
    borderTopWidth: 2,
    borderBottomWidth: 0,
    marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',
    width: '95%',
    // paddingBottom:10
  },
  ModalInfoTitle: {
    paddingBottom: 10,
    paddingTop: 10,
    // flex: 1,
    fontWeight: 'bold',
    fontSize: 15,
    color: 'black',
    paddingRight: 5,
    top: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ModalInfoContent: {
    paddingBottom: 10,
    paddingTop: 10,
    flex: 1,
    color: 'black',
    fontSize: 14,
    paddingLeft: '4%',
    // backgroundColor:'yellow',
    textAlignVertical: 'center',
  },
  ModalInfoContentLawRelated: {
    paddingBottom: 5,
    paddingTop: 5,
    flex: 1,
    color: 'black',
    fontSize: 14,
    paddingLeft: '4%',
  },
  IconInfo: {
    fontSize: 30,
    display: 'flex',
    color: 'white',
  },
});
