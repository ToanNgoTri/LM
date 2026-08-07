/**
 * HomeReorderable — BẢN THỬ NGHIỆM của Home.js dùng react-native-reorderable-list.
 *
 * Mục đích: đo xem cuộn trên Android có mượt không khi danh sách được
 * VIRTUALIZED (FlatList thật) thay vì render toàn bộ item.
 *
 * Chỉ dùng API của thư viện + RN mặc định. KHÔNG có cơ chế tự chế nào:
 *   - không lớp đo chiều cao ẩn (thư viện tự đo)
 *   - không key remount danh sách
 *   - không vòng lặp scrollTo trên UI thread
 *   - không GestureHandlerRootView lồng (App.js đã có ở root)
 *   - không tự dựng lại thứ tự từ bảng vị trí (dùng reorderItems của lib)
 *
 * Phần header, ô tìm kiếm và logic lọc được COPY NGUYÊN VĂN từ Home.js
 * để phép so sánh A/B chỉ có đúng một biến số: cách render danh sách.
 */

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
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Dirs, FileSystem } from 'react-native-file-access';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ReorderableList, {
  reorderItems,
  useReorderableDrag,
  useIsActive,
} from 'react-native-reorderable-list';
import { useTabBarHeight } from '../hooks/useTabBarHeight';

const ITEM_HEIGHT = 110; // chỉ là chiều cao TỐI THIỂU của card
const GAP = 8;

/* ------------------------------------------------------------------ */
/* Phần hiển thị thuần của một card — không hook, dùng chung cho cả hai */
/* danh sách (kéo-thả và tìm kiếm).                                    */
/* ------------------------------------------------------------------ */
const CardBody = memo(function CardBody({
  item,
  isActive,
  onPress,
  onLongPress,
}) {
  const law = Object.values(item)[0];
  const isHienPhap = law && law['lawNameDisplay'].match(/^(Hiến)/gim);
  const isHeader =
    law && law['lawNameDisplay'].match(/^(luật|bộ luật|hiến)/gim);

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      style={{
        minHeight: ITEM_HEIGHT,
        marginBottom: GAP,
        justifyContent: 'center',
        paddingVertical: 12,
        backgroundColor: isHienPhap ? '#da251dff' : 'green',
        // Hiệu ứng nhấc lên khi đang kéo (tương đương shadow của bản cũ)
        elevation: isActive ? 8 : 0,
        shadowColor: 'black',
        shadowOpacity: isActive ? 0.2 : 0,
        shadowRadius: 10,
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

/* Card trong danh sách kéo-thả: nhấn giữ 250ms để bắt đầu kéo. */
function DraggableLawCard({ item, onPress }) {
  const drag = useReorderableDrag();
  const isActive = useIsActive();

  return (
    <CardBody
      item={item}
      isActive={isActive}
      onPress={onPress}
      onLongPress={drag}
    />
  );
}

/* Card trong danh sách kết quả tìm kiếm: không kéo được. */
function SearchLawCard({ item, onPress }) {
  return <CardBody item={item} isActive={false} onPress={onPress} />;
}

export default function HomeReorderable({}) {
  const navigation = useNavigation();

  const [Info, setInfo] = useState([]);
  const [data, setData] = useState([]);

  const [inputSearchLaw, setInputSearchLaw] = useState('');
  const [showBackground, setShowBackground] = useState(false);
  const [textInputFocus, setTextInputFocus] = useState(false);

  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();

  const textInput = useRef(null);
  const listRef = useRef(null);
  const searchListRef = useRef(null);

  const isSearching = !!inputSearchLaw;

  // Phải phòng thủ: lúc thả, ReorderableListCore.markCells() gọi keyExtractor
  // với data[i] từ một closure có thể đã cũ -> item = undefined. Thư viện có
  // sẵn dự phòng `|| i.toString()` cho giá trị falsy, nhưng Object.keys(undefined)
  // thì NÉM lỗi trước khi tới được dự phòng đó.
  const keyExtractor = useCallback(
    (item, index) => (item ? Object.keys(item)[0] : String(index)),
    [],
  );

  // Nhấn lần 2 vào bottom tab "Đã tải xuống" -> cuộn lên đầu.
  // ReorderableList forward ref về FlatList nên scrollToOffset dùng được
  // trực tiếp, không cần worklet scrollTo tự chế.
  useEffect(() => {
    global.HomeRef = {
      scrollToOffset: opts => {
        const target = searchListRef.current ?? listRef.current;
        target?.scrollToOffset(opts ?? { offset: 0, animated: true });
      },
    };
    return () => {
      global.HomeRef = null;
    };
  }, []);

  /* ---- Lọc tìm kiếm: COPY NGUYÊN VĂN từ Home.js, không sửa gì ---- */
  useEffect(() => {
    if (inputSearchLaw && Object.keys(Info).length) {
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
    }
  }, [inputSearchLaw]);

  async function getContentExist() {
    if (await FileSystem.exists(Dirs.CacheDir + '/order.txt', 'utf8')) {
      setShowBackground(false);

      const FileOrder = await FileSystem.readFile(
        Dirs.CacheDir + '/order.txt',
        'utf8',
      );

      if (FileOrder) {
        return { order: JSON.parse(FileOrder) };
      }
      // File có nhưng rỗng: bản gốc rơi vào đây và return undefined -> nổ ở .then
      return { order: [] };
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

        if (cont) {
          setInfo(cont.order);
          setData(cont.order);
        } else {
          setInfo([]);
          setData([]);
        }
      });
    });

    return listener;
  }, []);

  async function saveOrder(next) {
    await FileSystem.writeFile(
      Dirs.CacheDir + '/order.txt',
      JSON.stringify(next),
      'utf8',
    );
  }

  // Thư viện đã tự lo phần dựng lại thứ tự — chỉ cần áp reorderItems và ghi file.
  // Giữ data mới nhất trong ref để không phải đặt tác dụng phụ (ghi file,
  // setInfo) vào bên trong updater của setData — updater phải thuần khiết.
  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const handleReorder = useCallback(({ from, to }) => {
    const cur = dataRef.current;

    // ===== LOG TẠM — xoá sau khi tìm ra nguyên nhân reorder sai =====
    const nameAt = i => {
      const it = cur[i];
      return it ? Object.values(it)[0]['lawNameDisplay'].slice(0, 40) : '<<UNDEFINED>>';
    };
    console.log(
      `[REORDER] from=${from} to=${to} len=${cur.length}\n` +
        `   item[from] = ${nameAt(from)}\n` +
        `   item[to]   = ${nameAt(to)}`,
    );
    // ================================================================

    const next = reorderItems(cur, from, to);
    dataRef.current = next;
    setData(next);
    setInfo(next);
    saveOrder(next);
  }, []);

  const renderDraggableItem = useCallback(
    ({ item }) => (
      <DraggableLawCard
        item={item}
        onPress={() =>
          navigation.navigate('accessLaw', { screen: Object.keys(item)[0] })
        }
      />
    ),
    [navigation],
  );

  const renderSearchItem = useCallback(
    ({ item }) => (
      <SearchLawCard
        item={item}
        onPress={() =>
          navigation.navigate('accessLaw', { screen: Object.keys(item)[0] })
        }
      />
    ),
    [navigation],
  );

  function NoneOfResult() {
    return (
      <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
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
          style={{ backgroundColor: 'green', height: insets.top, width: '150%' }}
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
              style={{ color: 'green', fontSize: 25 }}
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
            style={{ width: '10%', display: 'flex', justifyContent: 'center' }}
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
        <FlatList
          ref={searchListRef}
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderSearchItem}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={() => Keyboard.dismiss()}
          contentContainerStyle={{ paddingBottom: tabBarHeight }}
        />
      ) : (
        <ReorderableList
          ref={listRef}
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderDraggableItem}
          onReorder={handleReorder}
          shouldUpdateActiveItem
          contentContainerStyle={{ paddingBottom: tabBarHeight }}
        />
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
