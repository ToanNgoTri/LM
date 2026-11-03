import {
  TouchableOpacity,
  View,
  Keyboard,
  TouchableWithoutFeedback,
  FlatList,
  DeviceEventEmitter,
  Modal,
  Pressable,
} from 'react-native';
import Toast from 'react-native-toast-message';
import {
  useState,
  useEffect,
  useRef,
  useContext,
  useCallback,
  useMemo,
  memo,
} from 'react';
import {
  RefOfHome,
  // BoxInHomeScreen
} from '../App';
import Ionicons from '@react-native-vector-icons/ionicons';
import {
  ORDER_FILE,
  LAW_COLORS_FILE,
  deleteDownloadedLaw,
  readUserJson,
  writeUserJson,
} from '../storage/userFiles';
import { DOWNLOADED_CHANGED } from '../utils/defaultLaws';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SortableItem } from 'react-native-reanimated-dnd';
import { SortableLawList } from './components/SortableLawList';
import {
  SwipeToDelete,
  closeOpenSwipe,
  swipeDragLock,
} from './components/SwipeToDelete';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { Text, TextInput, useTheme, useThemedStyles } from '../theme';

// Sortable chạy ở chế độ chiều cao ĐỘNG (enableDynamicHeights): mỗi card tự
// đo chiều cao thật qua onLayout nên text hiện đầy đủ, không bị cắt.
// ITEM_HEIGHT chỉ còn là chiều cao TỐI THIỂU của card + giá trị ước lượng ban đầu.
const ITEM_HEIGHT = 110;
const GAP = 8;
// style cố định (không tạo object mới mỗi render) để SortableLawList (memo)
// KHÔNG render lại khi Home đổi state lúc đang kéo (hiện thùng rác...).
const SORTABLE_STYLE = { flex: 1 };

/* ------------------------------------------------------------------ */
/* Thẻ hiển thị một văn bản (dùng chung cho cả list kéo & list tìm kiếm) */
/* ------------------------------------------------------------------ */
const NOOP = () => {};

// Bảng màu người dùng chọn cho từng card (chữ trắng đọc rõ trên mọi màu).
// null = màu mặc định (xanh thương hiệu; Hiến pháp vẫn đỏ).
const LAW_COLOR_CHOICES = [
  null,
  '#C62828', // đỏ
  '#E65100', // cam
  '#AD8B00', // vàng đậm
  '#2E7D32', // xanh lá đậm
  '#00838F', // xanh ngọc
  '#1565C0', // xanh dương
  '#283593', // chàm
  '#6A1B9A', // tím
  '#AD1457', // hồng
  '#5D4037', // nâu
  '#455A64', // xám xanh
];

// Chữ đã gõ ở ô tìm kiếm, giữ ở mức module để vẫn còn kể cả khi Home bị
// unmount (ví dụ hệ điều hành thu hồi màn hình nền) rồi dựng lại.
let lastHomeSearch = '';

// Lọc danh sách theo chữ gõ (tên hiển thị / trích yếu / số hiệu).
function filterLaws(list, query) {
  if (!Array.isArray(list)) return [];
  if (!query) return list;
  // Thoát mọi ký tự đặc biệt của regex; '/' và '\' coi như ký tự bất kỳ
  // (số hiệu "12/2024/QH15" gõ kiểu nào cũng khớp) như logic cũ.
  // Tách theo '/' '\' TRƯỚC rồi mới thoát từng đoạn, để không đụng vào
  // dấu '\' do bước thoát sinh ra.
  const pattern = query
    .split(/[/\\]/)
    .map(part => part.replace(/[.*+?^${}()|[\]]/g, '\\$&'))
    .join('.');
  let re;
  try {
    re = new RegExp(pattern, 'i');
  } catch (e) {
    return list;
  }
  return list.filter(item => {
    const law = Object.values(item)[0] || {};
    return (
      re.test(law.lawNameDisplay || '') ||
      re.test(law.lawDescription || '') ||
      re.test(law.lawNumber || '')
    );
  });
}

// memo + onOpen ỔN ĐỊNH (thay cho onPress dạng arrow tạo mới ở mỗi lần render).
// Danh sách kéo-thả render TẤT CẢ card cùng lúc, nên mỗi lần Home re-render
// (gõ ô tìm kiếm, quay lại màn hình...) React phải dựng lại toàn bộ cây card
// nếu prop đổi identity. Giữ prop ổn định -> re-render gần như bằng 0.
const LawCard = memo(function LawCard({
  item,
  onOpen = NOOP,
  color = null, // màu người dùng chọn (null = mặc định; đổi bằng vuốt phải)
}) {
  const lawKey = Object.keys(item)[0];
  const law = item[lawKey];
  const isHienPhap = law && law['lawNameDisplay'].match(/^(Hiến)/gim);
  const isHeader =
    law && law['lawNameDisplay'].match(/^(luật|bộ luật|hiến)/gim);
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <TouchableOpacity
      onPress={() => onOpen(lawKey)}
      style={{
        minHeight: ITEM_HEIGHT,
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: color || (isHienPhap ? '#da251dff' : colors.primary),
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
});

/* Một hàng của danh sách kéo-thả: SortableItem (nhấn-giữ-kéo để sắp xếp) bọc
   SwipeToDelete (vuốt trái để xoá, vuốt phải để đổi màu). Tách component để mỗi hàng có ref cử chỉ
   vuốt riêng — SortableItem cần ref đó để nhận hai cử chỉ song song, nếu
   không pan nhấn-giữ của thư viện chặn mất cử chỉ vuốt. */
function SortableLawRow({
  itemProps,
  color,
  onOpen,
  onPickColor,
  onDelete,
  onDragStart,
  onDrop,
}) {
  const { item, id } = itemProps;
  const swipeRef = useRef(null);
  const handleDelete = useCallback(() => onDelete(id), [onDelete, id]);
  const handlePickColor = useCallback(() => onPickColor(id), [onPickColor, id]);
  return (
    <SortableItem
      {...itemProps}
      data={item}
      onDragStart={onDragStart}
      onDrop={onDrop}
      simultaneousWithGesture={swipeRef}
    >
      {/* GAP ở paddingBottom (đồng đều mọi item -> kéo-thả ổn định):
          - item ĐẦU tự sát đỉnh (không có khoảng trống phía trên).
          - giữa các item luôn cách GAP.
          - item CUỐI dư GAP phía dưới, nhưng được giấu sau tab bar nhờ
            container nới marginBottom xuống GAP (xem Home). */}
      <View style={{ paddingBottom: GAP }}>
        {/* holdBlockMs < 200ms (lúc pan nhấn-giữ-kéo của thư viện kích hoạt):
            chạm-giữ rồi mới kéo ngang là sắp xếp, không phải vuốt xoá. */}
        <SwipeToDelete
          gestureRef={swipeRef}
          holdBlockMs={180}
          onDelete={handleDelete}
          onSwipeRight={handlePickColor}
        >
          <LawCard item={item} onOpen={onOpen} color={color} />
        </SwipeToDelete>
      </View>
    </SortableItem>
  );
}

export default function Home({}) {
  const navigation = useNavigation();

  const [Info, setInfo] = useState(false);

  const [inputSearchLaw, setInputSearchLawState] = useState(lastHomeSearch);
  // Ref luôn giữ chữ đang gõ để callback 'focus' (closure cũ) đọc đúng.
  const searchRef = useRef(lastHomeSearch);
  const setInputSearchLaw = useCallback(text => {
    lastHomeSearch = text;
    searchRef.current = text;
    setInputSearchLawState(text);
  }, []);

  // Màu card theo từng văn bản: { lawKey: '#hex' }
  const [lawColors, setLawColors] = useState({});
  const [colorPickerKey, setColorPickerKey] = useState(null);
  useEffect(() => {
    readUserJson(LAW_COLORS_FILE, {}).then(c => {
      if (c && typeof c === 'object') setLawColors(c);
    });
  }, []);
  const openColorPicker = useCallback(lawKey => {
    Keyboard.dismiss();
    setColorPickerKey(lawKey);
  }, []);
  const chooseColor = useCallback(
    color => {
      const key = colorPickerKey;
      setColorPickerKey(null);
      if (!key) return;
      setLawColors(prev => {
        const next = { ...prev };
        if (color) next[key] = color;
        else delete next[key];
        writeUserJson(LAW_COLORS_FILE, next);
        return next;
      });
    },
    [colorPickerKey],
  );
  const [showBackground, setShowBackground] = useState(false);
  const [textInputFocus, setTextInputFocus] = useState(false);

  const insets = useSafeAreaInsets(); // lất chiều cao để menu top iphone
  const tabBarHeight = useTabBarHeight();
  const { colors, fontScale } = useTheme();
  const styles = useThemedStyles(makeStyles);

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

  // Đổi cỡ chữ toàn app -> card cao/thấp khác -> đo lại từ đầu.
  useEffect(() => {
    cardHeightsRef.current = {};
    setCardHeights({});
  }, [fontScale]);

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

  const openLaw = useCallback(
    lawKey => navigation.navigate('accessLaw', { screen: lawKey }),
    [navigation],
  );


  // Ref FlatList kết quả tìm kiếm & ref danh sách kéo-thả (SortableLawList).
  const searchListRef = useRef(null);
  const sortableRef = useRef(null);

  // Key để remount danh sách kéo-thả khi TẬP DỮ LIỆU đổi (thay cho cơ chế
  // key = dataHash của <Sortable> gốc). Kéo-thả KHÔNG gọi setData nên không
  // remount -> cuộn tay không bị ảnh hưởng.
  // Riêng lúc xoá bằng thùng rác thì KHÔNG remount (suppressRemountRef): remount
  // làm danh sách nhảy về đầu; useSortableListSmooth tự đồng bộ lại vị trí khi
  // tập id đổi nên các card còn lại trượt lên lấp chỗ trống.
  const keyStateRef = useRef({ ids: null, epoch: 0 });
  const suppressRemountRef = useRef(false);
  const sortableKey = useMemo(() => {
    const ids = sortableData.map(it => it.id).join('|');
    const k = keyStateRef.current;
    if (ids !== k.ids) {
      if (!suppressRemountRef.current) k.epoch += 1;
      suppressRemountRef.current = false;
      k.ids = ids;
    }
    return k.epoch + '#' + fontScale;
  }, [sortableData, fontScale]);

  // Chiều cao vùng nhìn thấy của danh sách: SortableLawList cần biết trước khi
  // mount (useSortable chốt containerHeight lúc mount để tính auto-scroll).
  const [listHeight, setListHeight] = useState(0);

  // Bắt đầu nhấn-giữ-kéo để sắp xếp -> đóng card nào đang vuốt mở.
  const handleDragStart = useCallback(() => {
    swipeDragLock.value = true; // đang kéo sắp xếp -> không nhận vuốt-xoá
    Keyboard.dismiss();
    closeOpenSwipe();
  }, []);

  // Danh sách gốc mới nhất (Info) cho callback xoá — closure có thể giữ bản cũ.
  const infoRef = useRef(Info);
  useEffect(() => {
    infoRef.current = Info;
  }, [Info]);

  // ---- Vuốt sang trái để xoá (components/SwipeToDelete) ----
  // Danh sách kéo-thả KHÔNG remount khi xoá (suppressRemountRef) để không nhảy
  // về đầu; các card còn lại tự trượt lên lấp chỗ trống.
  const deleteLaw = useCallback(
    itemId => {
      const base = Array.isArray(infoRef.current)
        ? infoRef.current
        : dataRef.current;
      const removed = base.find(it => Object.keys(it)[0] === itemId);
      const next = base.filter(it => Object.keys(it)[0] !== itemId);

      suppressRemountRef.current = true;
      infoRef.current = next;
      dataRef.current = next;
      setInfo(next);
      // Đang tìm kiếm thì vẫn giữ kết quả lọc, chỉ bỏ card vừa xoá.
      setData(filterLaws(next, searchRef.current));
      setLawColors(prev => {
        if (prev[itemId] === undefined) return prev;
        const c = { ...prev };
        delete c[itemId];
        return c;
      });

      // Xoá nội dung, ghi nhớ, màu; ghi lại thứ tự đang hiển thị.
      deleteDownloadedLaw(itemId).then(() => writeUserJson(ORDER_FILE, next));

      const name = removed && Object.values(removed)[0]?.lawNameDisplay;
      Toast.show({
        type: 'copyToast',
        text1: name ? `Đã xoá: ${name}` : 'Đã xoá văn bản',
        visibilityTime: 1800,
        autoHide: true,
        topOffset: 50 + insets.top,
      });
    },
    [insets.top],
  );

  // renderItem của FlatList tìm kiếm: giữ identity ổn định để FlatList không
  // phải render lại toàn bộ hàng mỗi lần Home re-render.
  const renderSearchItem = useCallback(
    ({ item }) => {
      const id = Object.keys(item)[0];
      return (
        <SwipeToDelete
          onDelete={() => deleteLaw(id)}
          onSwipeRight={() => openColorPicker(id)}
        >
          <LawCard
            item={item}
            onOpen={openLaw}
            color={lawColors[id] || null}
          />
        </SwipeToDelete>
      );
    },
    [openLaw, lawColors, openColorPicker, deleteLaw],
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

  // Gõ / xoá chữ -> lọc lại từ danh sách gốc (Info). Xoá hết chữ phải trả
  // lại đủ danh sách: nếu để data là tập đã lọc thì list kéo-thả chỉ hiện một
  // phần và thả item sẽ ghi đè order.txt bằng tập con (mất văn bản).
  useEffect(() => {
    if (!Array.isArray(Info)) return;
    setData(inputSearchLaw ? filterLaws(Info, inputSearchLaw) : Info);
  }, [inputSearchLaw]);

  async function getContentExist() {
    const order = await readUserJson(ORDER_FILE, null);
    if (order) {
      setShowBackground(false);
      return { order };
    }
    setShowBackground(true);
    return { order: {} };
  }

  useEffect(() => {
    const reload = () =>
      getContentExist().then(cont => {
        if (!Object.keys(cont.order).length) {
          setShowBackground(true);
        } else {
          setShowBackground(false);
        }

        // console.log('cont',cont);
        if (cont) {
          setInfo(cont.order);
          // Giữ nguyên chữ đang tìm khi quay lại từ màn nghiên cứu.
          setData(filterLaws(cont.order, searchRef.current));
        } else {
          setInfo({});
          setData([]);
        }
      });

    const listener = navigation.addListener('focus', () => {
      reload();
    });
    // Văn bản tải sẵn (utils/defaultLaws) tải xong khi Home đang mở.
    const sub = DeviceEventEmitter.addListener(DOWNLOADED_CHANGED, reload);

    return () => {
      listener();
      sub.remove();
    };
  }, []);

  async function sortedData(data) {
    await writeUserJson(ORDER_FILE, data);

    // console.log('new data',data );
  }

  // Lưu thứ tự mới khi thả item. allPositions: { id -> vị trí }
  const handleDrop = useCallback((itemId, position, allPositions) => {
    swipeDragLock.value = false;
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
    props => (
      <SortableLawRow
        key={props.id}
        itemProps={props}
        color={lawColors[props.id] || null}
        onOpen={openLaw}
        onPickColor={openColorPicker}
        onDelete={deleteLaw}
        onDragStart={handleDragStart}
        onDrop={handleDrop}
      />
    ),
    [
      openLaw,
      handleDrop,
      handleDragStart,
      deleteLaw,
      lawColors,
      openColorPicker,
    ],
  );

  function NoneOfResult() {
    return (
      <TouchableWithoutFeedback
        style={{ backgroundColor: 'red' }}
        onPress={() => Keyboard.dismiss()}
      >
        <View
          style={{
            // Căn giữa theo phần màn hình KHÔNG bị tab bar che
            paddingBottom: tabBarHeight,
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            backgroundColor: colors.bgAlt,
          }}
        >
          <Text style={{ fontSize: 40, textAlign: 'center', color: colors.textMuted }}>
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
            backgroundColor: colors.primary,
            height: insets.top,
            width: '150%',
          }}
        ></View>
        <View style={{ flexDirection: 'row' }}>
          {/* Mở màn Cài đặt: giao diện, cỡ chữ, gói đăng ký, chính sách, phiên bản */}
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons
              name="settings-outline"
              style={{
                color: colors.primaryText,
                fontSize: 25,
              }}
            ></Ionicons>
          </TouchableOpacity>
          <TextInput
            onChangeText={text => {
              setInputSearchLaw(text);
            }}
            ref={textInput}
            onSubmitEditing={() => Keyboard.dismiss()}
            value={inputSearchLaw}
            style={inputSearchLaw ? styles.inputSearchArea : styles.placeholder}
            placeholder="Nhập tên, Số văn bản, Trích yếu . . ."
            placeholderTextColor={colors.placeholder}
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
                  color: colors.text,
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
            renderItem={renderSearchItem}
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
        <View
          style={{ flex: 1, marginBottom: tabBarHeight - GAP }}
          onLayout={e => {
            const h = e.nativeEvent.layout.height;
            // Chỉ lấy lần đầu: đổi về sau (bàn phím...) mà truyền tiếp thì cũng
            // không có tác dụng vì useSortable chốt giá trị lúc mount.
            if (h > 0) setListHeight(prev => prev || Math.round(h));
          }}
        >
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
                    <LawCard item={item} />
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
          {allMeasured && listHeight > 0 && (
            <SortableLawList
              key={sortableKey}
              ref={sortableRef}
              data={sortableData}
              renderItem={renderSortableItem}
              itemKeyExtractor={keyExtractor}
              itemHeight={getItemHeight}
              estimatedItemHeight={ITEM_HEIGHT + GAP}
              containerHeight={listHeight}
              style={SORTABLE_STYLE}
            />
          )}

        </View>
      )}
      <Modal
        visible={!!colorPickerKey}
        transparent
        animationType="fade"
        onRequestClose={() => setColorPickerKey(null)}
      >
        <Pressable
          style={styles.pickerOverlay}
          onPress={() => setColorPickerKey(null)}
        >
          <Pressable style={styles.pickerBox} onPress={NOOP}>
            <Text style={styles.pickerTitle}>Chọn màu cho văn bản</Text>
            <View style={styles.pickerGrid}>
              {LAW_COLOR_CHOICES.map(c => {
                const selected = (lawColors[colorPickerKey] || null) === c;
                return (
                  <TouchableOpacity
                    key={c || 'default'}
                    onPress={() => chooseColor(c)}
                    style={[
                      styles.swatch,
                      { backgroundColor: c || colors.primary },
                      selected && styles.swatchSelected,
                    ]}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" style={styles.swatchIcon} />
                    ) : !c ? (
                      <Ionicons name="refresh" style={styles.swatchIcon} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.pickerHint}>
              Ô có biểu tượng ↻ là màu mặc định
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const makeStyles = c => ({
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
    color: c.onPrimary,
    textAlign: 'center',
    fontSize: 17,
    marginBottom: 2,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pickerBox: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 18,
    width: '100%',
    maxWidth: 360,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: c.text,
    textAlign: 'center',
    marginBottom: 14,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 24,
    margin: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: c.text,
  },
  swatchIcon: {
    fontSize: 22,
    color: '#FFFFFF',
  },
  pickerHint: {
    marginTop: 10,
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
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
    color: c.text,
    width: '85%',
    alignItems: 'center',
    height: 50,
  },
  placeholder: {
    fontSize: 15,
    paddingLeft: 10,
    paddingRight: 10,
    color: c.text,
    width: '85%',
    alignItems: 'center',
    height: 50,
  },
});
