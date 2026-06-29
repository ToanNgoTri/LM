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
import { Sortable, SortableItem } from 'react-native-reanimated-dnd';
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
          {/* GAP đặt ở paddingTop (không phải paddingBottom): vẫn nằm TRONG vùng
              onLayout đo nên Sortable tính đúng khoảng cách giữa các card, đồng
              thời item CUỐI không bị dư khoảng trống bên dưới -> sát tab bar. */}
          <View style={{ paddingTop: GAP }}>
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
        // Thu nhỏ viewport để list kết thúc ngay trên tab bar (không độn chiều
        // cao vùng cuộn -> không dư khoảng trống ở đáy). Sortable cuộn nội bộ
        // trong vùng này nên item cuối luôn nằm trên tab bar.
        <View style={{ flex: 1, marginBottom: tabBarHeight }}>
          <Sortable
            data={sortableData}
            renderItem={renderSortableItem}
            itemKeyExtractor={item => item.id}
            enableDynamicHeights
            estimatedItemHeight={ITEM_HEIGHT + GAP}
            // useFlatList={false}: render trong ScrollView (KHÔNG ảo hóa) nên MỌI
            // item mount và onLayout đo chiều cao thật ngay lần đầu -> không còn
            // đè nhau lúc mở. (FlatList ảo hóa khiến view position:absolute không
            // kích hoạt onLayout cho tới khi có relayout, vd khi kéo.)
            useFlatList={false}
            style={{ flex: 1 }}
          />
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
