import {
  Text,
  StyleSheet,
  TouchableOpacity,
  View,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  FlatList,
} from 'react-native';
import {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
  useMemo,
} from 'react';
import {
  RefOfHome,
  // BoxInHomeScreen
} from '../App';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Dirs, FileSystem } from 'react-native-file-access';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SortableItem } from 'react-native-reanimated-dnd';
import { SortableLawList } from './components/SortableLawList';
import { useTabBarHeight } from '../hooks/useTabBarHeight';

// Sortable chạy ở chế độ chiều cao ĐỘNG (enableDynamicHeights): mỗi card tự
// đo chiều cao thật qua onLayout nên text hiện đầy đủ, không bị cắt.
// ITEM_HEIGHT chỉ còn là chiều cao TỐI THIỂU của card + giá trị ước lượng ban đầu.
const ITEM_HEIGHT = 110;
const GAP = 8;

/* ------------------------------------------------------------------ */
/* Thẻ hiển thị một văn bản (dùng chung cho cả list kéo & list tìm kiếm) */
/* ------------------------------------------------------------------ */
function LawCard({ item, onPress }) {
  const law = Object.values(item)[0];
  const isHienPhap = law && law['lawNameDisplay'].match(/^(Hiến)/gim);
  const isHeader =
    law && law['lawNameDisplay'].match(/^(luật|bộ luật|hiến)/gim);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        minHeight: ITEM_HEIGHT,
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: isHienPhap ? '#da251dff' : 'green',
      }}
    >
      <View style={styles.item}>
        <Text
          style={{
            ...styles.itemDisplay,
            color: isHienPhap ? 'yellow' : 'white',
          }}
        >
          {law['lawNameDisplay']}
        </Text>
        {law && !isHeader && (
          <Text style={{ ...styles.itemDescription }}>
            {'   '}
            {law['lawDescription']}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function Home({}) {
  const navigation = useNavigation();

  const [Info, setInfo] = useState(false);

  const [inputSearchLaw, setInputSearchLaw] = useState('');
  const [showBackground, setShowBackground] = useState(false);
  const [textInputFocus, setTextInputFocus] = useState(false);

  const insets = useSafeAreaInsets(); // lất chiều cao để menu top iphone
  const tabBarHeight = useTabBarHeight();

  const textInput = useRef(null);

  const HomeScreen = useContext(RefOfHome);

  const [data, setData] = useState([]);

  // Giữ data mới nhất để dùng trong callback onDrop (tránh closure cũ)
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const isSearching = !!inputSearchLaw;

  // Sortable đọc trực tiếp `item.id` để dựng map vị trí, nên phải gắn id thật.
  // Giữ nguyên shape gốc { "<lawKey>": {...} } và thêm id = lawKey.
  const sortableData = useMemo(
    () =>
      Array.isArray(data)
        ? data.map(item => ({ ...item, id: Object.keys(item)[0] }))
        : [],    [data],
  );

  // ---- Đo chiều cao thật của từng card TRƯỚC khi đưa vào Sortable ----
  // Sortable (chế độ chiều cao động) định vị item theo `top` tuyệt đối và chỉ
  // áp lại vị trí khi biết chiều cao thật. Nhưng onLayout của item bên trong
  // Sortable (view position:absolute) KHÔNG kích hoạt lúc mount -> item xếp theo
  // ước lượng và đè nhau, chỉ giãn ra khi kéo (lúc đó mới relayout). Vì vậy ta
  // đo card ở một lớp ẩn (view luồng-bình-thường, onLayout chạy đáng tin), rồi
  // truyền chiều cao đã biết qua itemHeight dạng hàm -> vị trí đúng ngay từ đầu.
  const [cardHeights, setCardHeights] = useState({});
  const cardHeightsRef = useRef({});

  const handleMeasure = useCallback((id, h) => {
    const rounded = Math.round(h);
    if (cardHeightsRef.current[id] === rounded) return;
    cardHeightsRef.current = { ...cardHeightsRef.current, [id]: rounded };
    setCardHeights(cardHeightsRef.current);
  }, []);

  // Đã đo đủ mọi item hiện có chưa?
  const allMeasured = useMemo(
    () =>
      sortableData.length > 0 &&
      sortableData.every(it => cardHeights[it.id] != null),
    [sortableData, cardHeights],
  );

  // itemHeight dạng hàm: trả về chiều cao thật đã đo (gồm cả GAP ở paddingTop).
  // Đổi identity khi cardHeights đổi để Sortable nạp lại chiều cao.
  // Chiều cao đã đo gồm cả GAP (mỗi item có paddingBottom = GAP). Đồng đều mọi
  // item nên kéo-thả ổn định.
  const getItemHeight = useCallback(
    item => cardHeights[item.id] ?? ITEM_HEIGHT + GAP,
    [cardHeights],
  );

  const keyExtractor = useCallback(item => item.id, []);

  // Ref FlatList kết quả tìm kiếm & ref danh sách kéo-thả (SortableLawList).
  const searchListRef = useRef(null);
  const sortableRef = useRef(null);

  // Key để remount danh sách kéo-thả khi TẬP DỮ LIỆU đổi (thay cho cơ chế
  // key = dataHash của <Sortable> gốc): ghép chuỗi id theo đúng thứ tự. Kéo-thả
  // KHÔNG gọi setData nên không remount -> cuộn tay không bị ảnh hưởng.
  const sortableKey = useMemo(
    () => sortableData.map(it => it.id).join('|'),
    [sortableData],
  );

  // Expose global.HomeRef để nhấn lần 2 vào bottom tab "Đã tải xuống" cuộn lên đầu.
  // - Đang tìm kiếm     -> FlatList cuộn về đầu.
  // - Danh sách kéo-thả -> SortableLawList cuộn về đầu MƯỢT (animated).
  useEffect(() => {
    global.HomeRef = {
      scrollToOffset: opts => {
        if (searchListRef.current) {
          searchListRef.current.scrollToOffset(opts ?? { offset: 0 });
        } else {
          sortableRef.current?.scrollToOffset({ offset: 0 });
        }
      },
    };
    return () => {
      global.HomeRef = null;
    };
  }, []);

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

  async function getContentExist() {
    if (await FileSystem.exists(Dirs.CacheDir + '/order.txt', 'utf8')) {
      setShowBackground(false);

      const FileOrder = await FileSystem.readFile(
        Dirs.CacheDir + '/order.txt',
        'utf8',
      );
      // console.log('FileOrder',FileOrder);

      if (FileOrder) {
        return {
          order: JSON.parse(FileOrder),
        };
      }
    } else {
      setShowBackground(true);
      return { order: {} };
    }
  }

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
          setData(cont.order);
        } else {
          setInfo({});
          setData([]);
        }
      });
    });

    return listener;
  }, []);

  async function sortedData(data) {
    await FileSystem.writeFile(
      Dirs.CacheDir + '/order.txt',
      JSON.stringify(data),
      'utf8',
    );

    // console.log('new data',data );
  }

  // Lưu thứ tự mới khi thả item. allPositions: { id -> vị trí }
  const handleDrop = useCallback((itemId, position, allPositions) => {
    if (!allPositions) return;

    const cur = dataRef.current;
    const ordered = Object.entries(allPositions)
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => cur.find(it => Object.keys(it)[0] === key))
      .filter(Boolean);

    // Chỉ ghi khi tái dựng đủ phần tử (an toàn)
    if (ordered.length === cur.length) {
      // KHÔNG gọi setData -> nếu setData thì sortableData đổi, Sortable reset
      // và màn hình nhảy cuộn về đầu. Sortable đã tự giữ thứ tự đang hiển thị,
      // nên ở đây chỉ ghi file + đồng bộ master (Info) + dataRef.
      dataRef.current = ordered;
      setInfo(ordered);
      sortedData(ordered);
    }
  }, []);

  // renderItem cho danh sách kéo-thả (Sortable)
  const renderSortableItem = useCallback(
    props => {
      const { item, id } = props;
      return (
        <SortableItem {...props} key={id} data={item} onDrop={handleDrop}>
          {/* GAP ở paddingBottom (đồng đều mọi item -> kéo-thả ổn định):
              - item ĐẦU tự sát đỉnh (không có khoảng trống phía trên).
              - giữa các item luôn cách GAP.
              - item CUỐI dư GAP phía dưới, nhưng được giấu sau tab bar nhờ
                container nới marginBottom xuống GAP (xem bên dưới). */}
          <View style={{ paddingBottom: GAP }}>
            <LawCard
              item={item}
              onPress={() =>
                navigation.navigate('accessLaw', { screen: id })
              }
            />
          </View>
        </SortableItem>
      );
    },
    [navigation, handleDrop],
  );

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
  // console.log('insets.bottom:', insets.bottom, 'tabBarHeight:', tabBarHeight);
  return (
    <>
      <View
        style={{
          flexDirection: 'column',
          paddingLeft: 10,
          paddingRight: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
                  paddingRight: 10,
                }}
              ></Ionicons>
            )}
          </TouchableOpacity>
        </View>
      </View>
      {showBackground || !data.length ? (
        <NoneOfResult />
      ) : isSearching ? (
        // Đang tìm kiếm: danh sách thường, KHÔNG kéo-thả
        <View style={{ flex: 1 }}>
          <FlatList
            ref={searchListRef}
            data={data}
            keyExtractor={item => Object.keys(item)[0]}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={() => Keyboard.dismiss()}
            ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
            renderItem={({ item }) => (
              <LawCard
                item={item}
                onPress={() =>
                  navigation.navigate('accessLaw', {
                    screen: Object.keys(item)[0],
                  })
                }
              />
            )}
            ListFooterComponent={
              <View style={{ height: tabBarHeight, width: '100%' }} />
            }
          />
        </View>
      ) : (
        // Bình thường: danh sách kéo-thả để sắp xếp
        // (App.js đã bọc GestureHandlerRootView ở root, không cần bọc lại)
        // marginBottom = tabBarHeight - GAP: cho viewport thò xuống đúng GAP vào
        // vùng tab bar che. Mỗi item có paddingBottom = GAP, nên khi cuộn tới cuối,
        // mép dưới card cuối nằm sát ĐỈNH tab bar, còn GAP dư (trong suốt) bị tab bar
        // che mất -> không thấy. Item cuối "sát tab bar", item đầu sát đỉnh.
        <View style={{ flex: 1, marginBottom: tabBarHeight - GAP }}>
          {/* Lớp đo ẩn: đo chiều cao thật của mọi card khi chưa đo đủ. Card nằm
              trong luồng layout bình thường nên onLayout chạy ngay khi mount.
              opacity:0 + pointerEvents none + zIndex -1 -> không thấy, không chặn chạm. */}
          {!allMeasured && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                opacity: 0,
                zIndex: -1,
              }}
            >
              {sortableData.map(item => (
                <View
                  key={item.id}
                  onLayout={e =>
                    handleMeasure(item.id, e.nativeEvent.layout.height)
                  }
                >
                  <View style={{ paddingBottom: GAP }}>
                    <LawCard item={item} onPress={() => {}} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Chỉ render Sortable khi đã biết chiều cao thật của mọi item -> định vị
              đúng ngay từ khung hình đầu (không đè nhau). itemHeight dạng HÀM đưa
              chiều cao đã đo vào; không dùng enableDynamicHeights (tránh cơ chế tự
              đo của thư viện vốn không kích hoạt onLayout lúc mount).
              useFlatList={false}: render hết item một lần (danh sách luật có hạn). */}
          {allMeasured && (
            <SortableLawList
              key={sortableKey}
              ref={sortableRef}
              data={sortableData}
              renderItem={renderSortableItem}
              itemKeyExtractor={keyExtractor}
              itemHeight={getItemHeight}
              estimatedItemHeight={ITEM_HEIGHT + GAP}
              style={{ flex: 1 }}
            />
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  item: {
    display: 'flex',
    justifyContent: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    flexDirection: 'column',
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
