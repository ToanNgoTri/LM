import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Keyboard,
  ActivityIndicator,
  Animated,
  FlatList,
  Easing,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { ScreenToggle } from './components/ScreenToggle';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState, useRef, memo, useCallback } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import CheckBox from 'react-native-check-box';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Dirs, FileSystem } from 'react-native-file-access';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { AGENCIES, parseDateInput, formatDateInput } from './filterUtils';
import { setFilterUI } from '../redux/fetchData';

// ── Gợi ý (suggest) theo lawDescription, dữ liệu cache ở client ───────────
const CF_BASE = 'https://us-central1-project2-197c0.cloudfunctions.net';
const SUGGEST_FILE = Dirs.CacheDir + '/suggestIndex.json'; // { count, items:[{i,d}] }
const SUGGEST_LIMIT = 8; // số dòng gợi ý tối đa
const SUGGEST_MIN_CHARS = 2; // gõ tối thiểu 2 ký tự mới gợi ý
const DESC_BATCH = 400; // số _id mỗi lần gọi getSuggestDescs (tránh $in quá lớn)

// Chuẩn hoá để so khớp GIỐNG thói quen gõ của người dùng:
//  - bỏ dấu, hạ chữ thường (không phân biệt dấu/hoa-thường);
//  - đổi MỌI ký tự không phải chữ/số thành space (dấu / - . , : ...) -> gõ
//    "80 2024 tt btc" khớp "80/2024/TT-BTC".
// Ánh xạ TỪNG ký tự 1->1 (không gộp space) để findMatchRange highlight đúng.
const normVi = s =>
  (s || '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

// Chuẩn hoá từ khoá NGƯỜI DÙNG gõ: như normVi + gộp khoảng trắng thừa & trim,
// nên "80  2024", "80/2024", "80 2024" đều thành "80 2024".
const normQuery = s => normVi(s).replace(/\s+/g, ' ').trim();

// Tìm vị trí [start, end) TRONG text gốc khớp với qNorm (đã bỏ dấu).
// Chuẩn hoá từng ký tự và ghi map norm-index -> original-index nên vẫn đúng
// kể cả khi 1 ký tự gốc nở ra / co lại sau normalize.
function findMatchRange(original, qNorm) {
  if (!original || !qNorm) return null;
  let norm = '';
  const map = []; // map[k] = chỉ số trong `original` của ký tự norm thứ k
  for (let i = 0; i < original.length; i++) {
    const nc = normVi(original[i]);
    for (let j = 0; j < nc.length; j++) {
      norm += nc[j];
      map.push(i);
    }
  }
  const pos = norm.indexOf(qNorm);
  if (pos < 0) return null;
  const start = map[pos];
  const end = map[pos + qNorm.length - 1] + 1;
  return [start, end];
}

async function cfPost(path, body) {
  const res = await fetch(`${CF_BASE}/${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

export function Detail2({}) {
  const { loading5, info5 } = useSelector(
    state => state['searchLawDescription'],
  );

  const { loading3, info3 } = useSelector(state => state['getlastedlaws']);

  const { loading4, result4 } = useSelector(state => state['getCountLaw']);

  // Đang tải -> vô hiệu hóa các nút filter và checkbox
  const loading = loading5 || loading3;

  const [warning, setWanring] = useState(false);

  const [paper, setPaper] = useState(0);

  const [SearchResult, setSearchResult] = useState(
    // info3 ? convertResult(info3.slice(0, 10)) : [],
    [],
  ); // đây Object là các luật, điểm, khoản có kết quả tìm kiếm
  // console.log('info3',info3);

  // console.log('SearchResult', SearchResult);
  const [showFilter, setShowFilter] = useState(false);

  const [choosenLaw, setChoosenLaw] = useState([]);
  // console.log('choosenLaw',choosenLaw.length);

  const [LawFilted, setLawFilted] = useState(false);
  // console.log('LawFilted',LawFilted);

  const [choosenKindLaw, setChoosenKindLaw] = useState([0, 1, 2, 3]);

  const [dotCount, setDotCount] = useState(1);

  // const [textInputFocus, setTextInputFocus] = useState(false);

  const navigation = useNavigation();

  const insets = useSafeAreaInsets(); // lất chiều cao để manu top iphone
  const tabBarHeight = useTabBarHeight();

  const textInput = useRef(null);
  // const textInputForFilter = useRef(null);

  const FlatListToScroll = useRef(null);

  // ── Suggest theo lawDescription (dữ liệu cache client) ──────────────────
  // suggestIndexRef: [{ i, d, norm }] đã chuẩn hoá 1 lần, để lọc mỗi phím.
  const suggestIndexRef = useRef([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const suggestTimer = useRef(null);
  // Dropdown render ở GỐC màn hình (full-screen) để nhận được touch trên Android
  // (con tràn ngoài bounds cha thì Android không giao touch). inputRowRef +
  // anchor: đo vị trí thật của ô input để đặt dropdown ngay dưới nó.
  const inputRowRef = useRef(null);
  const [anchor, setAnchor] = useState(null); // { x, y, w, h } theo toạ độ màn hình

  const dispatch = useDispatch();

  // Bộ lọc riêng của màn này (searchLaw) qua Redux -> không mất khi remount
  const filterUIState = useSelector(state => state['filterUI'].searchLaw);
  const input = filterUIState.input;
  const fromDate = filterUIState.dateFrom;
  const toDate = filterUIState.dateTo;
  const chosenAgencies = filterUIState.agencies;
  const valueInput = filterUIState.valueInput;

  const setInput = v =>
    dispatch(
      setFilterUI({
        screen: 'searchLaw',
        input: typeof v === 'function' ? v(input) : v,
      }),
    );
  const setValueInput = v =>
    dispatch(
      setFilterUI({
        screen: 'searchLaw',
        valueInput: typeof v === 'function' ? v(valueInput) : v,
      }),
    );
  const setFromDate = v =>
    dispatch(
      setFilterUI({
        screen: 'searchLaw',
        dateFrom: typeof v === 'function' ? v(fromDate) : v,
      }),
    );
  const setToDate = v =>
    dispatch(
      setFilterUI({
        screen: 'searchLaw',
        dateTo: typeof v === 'function' ? v(toDate) : v,
      }),
    );
  const setChosenAgencies = v =>
    dispatch(
      setFilterUI({
        screen: 'searchLaw',
        agencies: typeof v === 'function' ? v(chosenAgencies) : v,
      }),
    );

  // Giữ giá trị info5 mới nhất cho các callback bất đồng bộ (đọc file, đếm văn bản)
  // để chúng không ghi đè kết quả tìm kiếm đang hiển thị bằng danh sách 50 mặc định.
  const info5Ref = useRef(info5);
  useEffect(() => {
    info5Ref.current = info5;
  }, [info5]);

  const animated = useRef(new Animated.Value(0)).current;

  let Opacity = animated.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 0.5],
  });

  let Scale = animated.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
  });

  function toggleAgency(code) {
    setChosenAgencies(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code],
    );
  }

  // Tìm kiếm trên server theo khoảng ngày ký + cơ quan ban hành
  // (kết hợp với từ khóa đang nhập nếu có), không phải lọc kết quả cũ.
  function searchWithFilter() {
    Keyboard.dismiss();
    const from = parseDateInput(fromDate, false);
    const to = parseDateInput(toDate, true);
    const keyword = input || '';
    dispatch({
      type: 'searchLawDescription',
      input: keyword,
      dateFrom: from ? from.toISOString() : '',
      dateTo: to ? to.toISOString() : '',
      agencies: chosenAgencies,
    });
    setValueInput(keyword);
  }

  async function storeLastedLaw() {
    const addContent = await FileSystem.writeFile(
      Dirs.CacheDir + '/lastedLaw.txt',
      JSON.stringify({
        currentCountLaw: result4,
        lastedLaw: convertResult(info3.slice(0, 50)),
      }),
      'utf8',
    );
  }
  useEffect(() => {
    if (info3.length) {
      storeLastedLaw();
      // Không ghi đè khi đang có kết quả tìm kiếm (info5)
      if (!info5Ref.current) {
        setSearchResult(convertResult(info3.slice(0, 50)));
        setLawFilted(convertResult(info3.slice(0, 50)));
      }
      // console.log('info3',info3);
    }
  }, [info3]);

  function highlight(para, word, i2) {
    if (!para || !word) {
      return (
        <Text>
          {'   '}
          {para}
        </Text>
      );
    }

    const keywords = word
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // escape regex

    if (!keywords.length) {
      return (
        <Text>
          {'   '}
          {para}
        </Text>
      );
    }

    // tạo regex dạng: (trộm|cắp|tài|sản)
    const regex = new RegExp(`(${keywords.join('|')})`, 'giu');

    const parts = para.split(regex);

    const result = parts.map((part, index) => {
      const isMatch = regex.test(part);

      // reset regex vì test() với flag g sẽ bị lệch index
      regex.lastIndex = 0;

      if (isMatch) {
        return (
          <Text
            key={index}
            style={
              i2.match(/aa/)
                ? { ...styles.chapterText, backgroundColor: 'yellow' }
                : { backgroundColor: 'yellow' }
            }
          >
            {part}
          </Text>
        );
      }

      return (
        <Text
          key={index}
          style={i2.match(/aa/) ? { ...styles.chapterText } : {}}
        >
          {part}
        </Text>
      );
    });

    return (
      <View>
        <Text
          style={
            i2.match(/aa/) ? { textAlign: 'center' } : { textAlign: 'justify' }
          }
        >
          {'   '}
          {result}
        </Text>
      </View>
    );
  }
  function convertResult(info) {
    let lawObject = {};
    info.map((law, i) => {
      // lawObject[i] = {[law._id]:{'lawNameDisplay':law.info['lawNameDisplay'],'lawDescription':law.info['lawDescription'],'lawDaySign':law.info['lawDaySign']}}
      lawObject[law._id] = {
        lawNameDisplay: law.info['lawNameDisplay'],
        lawDescription: law.info['lawDescription'],
        lawDaySign: law.info['lawDaySign'],
        lawDayActive: law.info['lawDayActive'],
      };
    });
    return lawObject;
  }

  useEffect(() => {
    if (info5) {
      setSearchResult(convertResult(info5));
      setLawFilted(convertResult(info5));
      setChoosenKindLaw([0, 1, 2, 3]);
    }
  }, [info5]);

  useEffect(() => {
    setChoosenLaw(
      SearchResult && Object.keys(SearchResult).length
        ? Object.keys(SearchResult)
        : [],
    );
  }, [SearchResult]);

  useEffect(() => {
    setWanring(false);
  }, [input]);

  useEffect(() => {
    chooseDisplayKindLaw();
  }, [choosenKindLaw]);

  const netInfo = useNetInfo();
  let internetConnected = netInfo.isConnected;

  async function checkLastedLaw() {
    // Đang có kết quả tìm kiếm thì không tải danh sách 50 mặc định
    if (info5Ref.current) return;

    if (await FileSystem.exists(Dirs.CacheDir + '/lastedLaw.txt', 'utf8')) {
      const FileInfoStringContent = await FileSystem.readFile(
        Dirs.CacheDir + '/lastedLaw.txt',
        'utf8',
      );

      let contentLastedLaw = JSON.parse(FileInfoStringContent);

      if (info5Ref.current) return;

      if (contentLastedLaw['currentCountLaw'] == result4) {
        // console.log(1);

        setSearchResult(contentLastedLaw['lastedLaw']);
        setLawFilted(contentLastedLaw['lastedLaw']);
      } else {
        dispatch({ type: 'getlastedlaws' });
      }
    } else {
      dispatch({ type: 'getlastedlaws' });
    }
  }

  useEffect(() => {
    if (internetConnected == true && !info5) {
      dispatch({ type: 'getCountLaw' });
    }
  }, [internetConnected]);

  useEffect(() => {
    if (result4) {
      checkLastedLaw();
    }
  }, [result4]);

  useEffect(() => {
    if (!loading3) return;

    const interval = setInterval(() => {
      setDotCount(prev => (prev < 3 ? prev + 1 : 1));
    }, 500);

    return () => clearInterval(interval);
  }, [loading3]);

  const renderDots = '.'.repeat(dotCount);

  async function getContentExist() {
    if (await FileSystem.exists(Dirs.CacheDir + '/lastedLaw.txt', 'utf8')) {
      const FileOrder = await FileSystem.readFile(
        Dirs.CacheDir + '/lastedLaw.txt',
        'utf8',
      );

      if (FileOrder) {
        return JSON.parse(FileOrder);
      }
    } else {
      return JSON.parse('{"lastedLaw": null}');
    }
  }

  useEffect(() => {
    getContentExist().then(data => {
      // Không ghi đè khi đã có kết quả tìm kiếm
      if (info5Ref.current) return;
      setSearchResult(data['lastedLaw']);
      setLawFilted(data['lastedLaw']);
    });
  }, []);

  function chooseDisplayKindLaw() {
    // 0 là luật, 1 là nghị định, 2 là thông tư, 3 là khác
    // (văn bản khác: không phải Luật/Bộ luật/Nghị định/Thông tư)

    let newResult = {};
    // console.log('SearchResult',SearchResult)

    if (
      SearchResult &&
      Object.keys(SearchResult).length &&
      SearchResult['_id'] !== 'none'
    ) {
      Object.keys(SearchResult).map((law, i) => {
        const name = SearchResult[law]['lawNameDisplay'];
        const isOther = !name.match(
          new RegExp(`^(Luật|Bộ luật|Nghị định|Thông tư)`, 'img'),
        );

        let show = false;
        if (choosenKindLaw.includes(0) && name.match(/^(Luật|Bộ luật)/im)) {
          show = true;
        }
        if (choosenKindLaw.includes(1) && name.match(/^Nghị định/im)) {
          show = true;
        }
        if (choosenKindLaw.includes(2) && name.match(/^Thông tư/im)) {
          show = true;
        }
        if (choosenKindLaw.includes(3) && isOther) {
          show = true;
        }

        if (show) {
          newResult[law] = SearchResult[law];
        }
      });
      setLawFilted(newResult);
      setChoosenLaw(Object.keys(newResult));
    }
  }

  const NoneOfResutl = () => {
    return (
      <TouchableWithoutFeedback
        style={{ backgroundColor: 'red' }}
        onPress={() => Keyboard.dismiss()}
      >
        <View
          style={{
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: 90,
            paddingLeft: 30,
            paddingRight: 30,
          }}
        >
          <Text style={{ fontSize: 35, textAlign: 'center', color: 'gray' }}>
            Không có kết quả nào được tìm thấy
          </Text>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  // Nạp mảng { i, d, norm } vào bộ nhớ để lọc gợi ý.
  function buildIndex(items) {
    suggestIndexRef.current = (items || []).map(it => ({
      i: it.i,
      d: it.d,
      norm: normVi(it.d),
    }));
  }

  async function writeCache(cache) {
    try {
      await FileSystem.writeFile(SUGGEST_FILE, JSON.stringify(cache), 'utf8');
    } catch (e) {}
  }

  // Tải FULL (lần đầu / mất cache).
  async function fetchFull() {
    const r = await cfPost('getSuggestData', {});
    const cache = { count: r.count || 0, items: r.data || [] };
    await writeCache(cache);
    return cache;
  }

  // Đồng bộ delta: tải danh sách _id (nhẹ) -> tìm phần thiếu -> chỉ tải mô tả
  // của phần thiếu. Bỏ các _id đã bị xoá. Rẻ vì chỉ chạy khi count đổi.
  async function syncDelta(cache) {
    const r = await cfPost('getSuggestIds', {});
    const ids = r.ids || [];
    if (!ids.length) return cache; // lỗi mạng -> giữ cache cũ
    const idSet = new Set(ids);
    const have = new Map(cache.items.map(x => [x.i, x]));
    // Giữ lại phần chưa bị xoá.
    const items = cache.items.filter(x => idSet.has(x.i));
    const missing = ids.filter(id => !have.has(id));
    for (let k = 0; k < missing.length; k += DESC_BATCH) {
      const batch = missing.slice(k, k + DESC_BATCH);
      const descs = await cfPost('getSuggestDescs', { ids: batch });
      if (Array.isArray(descs)) items.push(...descs);
    }
    const next = { count: r.count || ids.length, items };
    await writeCache(next);
    return next;
  }

  // Mount: đọc cache -> nếu chưa có tải full; nếu có, gate bằng countAllLaw,
  // count đổi mới đồng bộ delta. Toàn bộ chạy nền, lỗi thì bỏ qua (suggest phụ).
  async function loadSuggestIndex() {
    try {
      let cache = null;
      if (await FileSystem.exists(SUGGEST_FILE)) {
        try {
          cache = JSON.parse(await FileSystem.readFile(SUGGEST_FILE, 'utf8'));
        } catch (e) {
          cache = null;
        }
      }
      if (!cache || !Array.isArray(cache.items) || !cache.items.length) {
        cache = await fetchFull();
      } else {
        buildIndex(cache.items); // dùng được ngay, đồng bộ chạy nền tiếp
        const serverCount = await cfPost('countAllLaw', {});
        if (typeof serverCount === 'number' && serverCount !== cache.count) {
          cache = await syncDelta(cache);
        }
      }
      buildIndex(cache.items);
    } catch (e) {}
  }

  useEffect(() => {
    loadSuggestIndex();
  }, []);


  // Lọc gợi ý (chạy sau debounce). Không phân biệt dấu/hoa-thường/phân cách.
  function runSuggest(text) {
    const q = normQuery(text);
    if (q.length < SUGGEST_MIN_CHARS) {
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }
    const idx = suggestIndexRef.current;
    const out = [];
    for (let k = 0; k < idx.length && out.length < SUGGEST_LIMIT; k++) {
      if (idx[k].norm.indexOf(q) !== -1) out.push(idx[k]);
    }
    setSuggestions(out);
    if (out.length) {
      // Đo vị trí ô input (toạ độ màn hình) để đặt dropdown ngay bên dưới.
      if (inputRowRef.current && inputRowRef.current.measureInWindow) {
        inputRowRef.current.measureInWindow((x, y, w, h) => {
          if (w) setAnchor({ x, y, w, h });
        });
      }
      setShowSuggest(true);
    } else {
      setShowSuggest(false);
    }
  }

  function onChangeSearchText(text) {
    setInput(text);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    suggestTimer.current = setTimeout(() => runSuggest(text), 200);
  }

  function hideSuggest() {
    setShowSuggest(false);
    setSuggestions([]);
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
  }

  function pressToSearch() {
    Keyboard.dismiss();
    hideSuggest();
    if (paper > 2) {
      setPaper(0);
    } else {
      setPaper(1);
    }
    if (FlatListToScroll.current) {
      FlatListToScroll.current.scrollToOffset({ offset: 0 });
    }
    if (!input || input.match(/^(\s)*$/) || input.match(/^\W+$/)) {
      setWanring(true);
    } else {
      dispatch({ type: 'searchLawDescription', input: input });
      setValueInput(input);
    }
    setChoosenKindLaw([0, 1, 2, 3]);
  }

  const renderItem = useCallback(
    data => (
      <Item
        id={data}
        // title={SearchResult[data]}
        valueInput={valueInput}
      />
    ),
    [SearchResult, valueInput],
  );

  const Item = memo(title => {
    let detailId = title.id.item;
    let i = title.id.index;

    const dateLawDaySign = new Date(SearchResult[detailId]['lawDaySign']);

    const formattedDateLawDaySign = dateLawDaySign.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const dateLawDayActive = new Date(SearchResult[detailId]['lawDayActive']);

    const formattedDateLawDayActive = dateLawDayActive.toLocaleDateString(
      'vi-VN',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      },
    );

    // console.log(typeof formattedDateLawDayActive );

    return (
      <TouchableOpacity
        key={i}
        style={{
          paddingBottom: 10,
          paddingTop: 10,
          justifyContent: 'center',
          backgroundColor:
            Object.keys(SearchResult).length >= 1 &&
            !SearchResult.hasOwnProperty('_id')
              ? i % 2
                ? 'white'
                : '#DDDDDD'
              : 'DDDDDD', // #F9CC76
          // marginBottom: 6,
        }}
        onPress={() => {
          // navigation.navigate(`${detailInfo._id}`)
          navigation.push(`accessLaw`, { screen: detailId });
        }}
      >
        <View style={styles.item}>
          <Text style={styles.chapterText} key={`${i}a`}>
            {highlight(
              SearchResult[detailId]['lawNameDisplay'],
              valueInput,
              `${i}aa`,
            )}
          </Text>
          <Text style={styles.descriptionText}>
            {highlight(
              SearchResult[detailId]['lawDescription'],
              valueInput,
              `${i}ab`,
            )}
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          {formattedDateLawDaySign !== 'Invalid Date' && (
            <Text
              style={{
                textAlign: 'left',
                paddingLeft: 20,
                fontStyle: 'italic',
                color: 'gray',
                fontSize: 12,
              }}
            >
              Ngày ký: {formattedDateLawDaySign}
            </Text>
          )}
          {formattedDateLawDayActive !== 'Invalid Date' && (
            <Text
              style={{
                textAlign: 'right',
                right: 0,
                paddingRight: 20,
                fontStyle: 'italic',
                color: 'gray',
                fontSize: 12,
                position: 'absolute',
              }}
            >
              Ngày hiệu lực: {formattedDateLawDayActive}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  });

  function loadMoreData() {
    if (paper < Math.ceil(Object.keys(SearchResult).length / 30)) {
      setPaper(paper + 1);
    }
  }

  function convertResultLoading(obj) {
    const first30Entries = Object.entries(obj).slice(0, paper * 30);

    // Chuyển lại array thành object
    const first30Obj = Object.fromEntries(first30Entries);

    return first30Obj;
  }

  return (
    <>
      {!internetConnected && (
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
          }}
        >
          <Text
            style={{
              color: 'white',
              marginBottom: 15,
              fontWeight: 'bold',
            }}
          >
            Vui lòng kiểm tra kết nối mạng ...
          </Text>
          <ActivityIndicator size="large" color="white"></ActivityIndicator>
        </View>
      )}

      <View
        style={{
          backgroundColor: 'green',
          paddingTop: insets.top + 5,
          borderBottomWidth: 1,
          borderBottomColor: 'black',
          zIndex: 20,
        }}
      >
                         <ScreenToggle active="searchlaw" />

        <View style={{ ...styles.inputContainer, height: 52, top: 5 }}>
          <View style={{ ...styles.containerBtb, paddingTop: 5 }}>
            <TouchableOpacity
              disabled={loading}
              style={{
                ...styles.inputBtb,
                backgroundColor: 'white',
                opacity: loading ? 0.5 : 1,
              }}
              onPress={() => {
                setShowFilter(true);
                Keyboard.dismiss();
                Animated.timing(animated, {
                  toValue: !showFilter ? 100 : 0,
                  // toValue:100,
                  duration: 500,
                  useNativeDriver: false,
                }).start();
              }}
            >
              <Ionicons
                name="funnel-outline"
                style={{ ...styles.inputBtbText, color: 'black' }}
              ></Ionicons>
              <View
                style={{
                  position: 'absolute',
                  height: 25,
                  width: 25,
                  backgroundColor: 'red',
                  borderRadius: 20,
                  right: -10,
                  bottom: -10,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    textAlign: 'center',
                    fontSize:
                      choosenLaw.length > 1000
                        ? 6
                        : choosenLaw.length > 100
                        ? 8
                        : 10,
                    fontWeight: 'bold',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  {choosenLaw.length}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: 'column',
              width: '60%',
              // backgroundColor:'red'
            }}
          >
            <View
              ref={inputRowRef}
              style={{
                position: 'relative',
                flexDirection: 'row',
                backgroundColor: 'white',
                // height: 50,
                borderRadius: 15,
                borderColor: warning ? '#FF4500' : 'none',
                borderWidth: warning ? 1 : 0,
              }}
            >
              <TextInput
                ref={textInput}
                style={{ ...styles.inputArea }}
                onChangeText={onChangeSearchText}
                value={input}
                selectTextOnFocus={true}
                placeholder="Nhập từ khóa..."
                placeholderTextColor={'gray'}
                onSubmitEditing={() => {
                  pressToSearch();
                }}
                onFocus={() => {
                  if (input && input.trim().length >= SUGGEST_MIN_CHARS) {
                    runSuggest(input);
                  }
                }}
              ></TextInput>
              <TouchableOpacity
                onPress={() => {
                  setInput('');
                  hideSuggest();
                  textInput.current.focus();
                }}
                style={{
                  width: '15%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  left: -3,
                  // backgroundColor:'yellow'
                }}
              >
                {input && (
                  <Ionicons
                    name="close-circle-outline"
                    style={{
                      color: 'black',
                      fontSize: 20,
                      paddingRight: 8,
                      // textAlign:'right'
                    }}
                  ></Ionicons>
                )}
              </TouchableOpacity>
            </View>
            {/* <Text
              style={{
                color: '#FF4500',
                fontSize: 12,
                textAlign: 'center',
                fontWeight: 'bold',
                lineHeight: 14,
              }}
            >
              {warning ? 'Vui lòng nhập từ khóa hợp lệ' : ' '}
            </Text> */}
          </View>
          <View style={{ ...styles.containerBtb, paddingTop: -5 }}>
            <TouchableOpacity
              disabled={loading5}
              style={{
                ...styles.inputBtb,
                borderRadius: 100,
                height: 40,
                borderWidth: 2,
                // borderColor: loading5 ? "black" : "#f67c1a",
                minWidth: 40,
                // backgroundColor: !input ? '#ddd' : 'black'
              }}
              onPress={() => {
                pressToSearch();
              }}
            >
              {loading5 ? (
                <ActivityIndicator
                  size="small"
                  color="#f67c1a"
                  // style={{ backgroundColor: 'blue' }}
                ></ActivityIndicator>
              ) : (
                <Ionicons
                  name="search-outline"
                  style={styles.inputBtbText}
                ></Ionicons>
              )}
            </TouchableOpacity>
          </View>
        </View>
        <View
          pointerEvents={loading ? 'none' : 'auto'}
          style={{
            justifyContent: 'space-evenly',
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            paddingBottom: 5,
            opacity: loading ? 0.5 : 1,
          }}
        >
          {['Luật/Bộ Luật', 'Nghị định', 'Thông tư', 'Khác'].map((option, i) => {
            return (
              <TouchableOpacity
                key={`${i}a`}
                onPress={() => {
                  if (choosenKindLaw.includes(i)) {
                    setChoosenKindLaw(choosenKindLaw.filter(a => a !== i));
                  } else {
                    setChoosenKindLaw([...choosenKindLaw, i]);
                  }
                }}
                style={{
                  justifyContent: 'center',
                  alignItems: 'center',
                  flexDirection: 'row',
                  // width:75
                }}
              >
                <CheckBox
                  onClick={() => {
                    if (choosenKindLaw.includes(i)) {
                      setChoosenKindLaw(choosenKindLaw.filter(a => a !== i));
                    } else {
                      setChoosenKindLaw([...choosenKindLaw, i]);
                    }

                    // chooseDisplayKindLaw()
                  }}
                  isChecked={choosenKindLaw.includes(i)}
                  style={{}}
                  uncheckedCheckBoxColor={'white'}
                  checkedCheckBoxColor={'white'}
                />
                <Text style={{ fontSize: 13, color: 'white' }}>{option}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

      </View>

      <View
        style={{
          marginTop: 0,
          flex: 1,
          backgroundColor: '#EEEFE4',
        }}
      >
        {loading5 && (
          <TouchableOpacity
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              opacity: 0.8,
              backgroundColor: 'black',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 10,
            }}
            onPress={() => Keyboard.dismiss()}
          >
            <View
              style={{
                top: '-9%',
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
          </TouchableOpacity>
        )}

        {loading3 && (
          <View
            style={{
              backgroundColor: 'black',
              alignItems: 'center',
              justifyContent: 'center',
              display: 'flex',
              paddingTop: 5,
              paddingBottom: 5,
            }}
          >
            <View
              style={{
                // backgroundColor: 'red',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: 'white',
                  // marginBottom: 15,
                  fontWeight: 'bold',
                  // backgroundColor: 'yellow',
                  textAlign: 'center',
                  display: 'flex',
                  marginLeft: 10,
                }}
              >
                Đang tải văn bản mới {renderDots}
              </Text>
            </View>
          </View>
        )}

        {(info5 != null && info5.length == 0) || !SearchResult ? (
          <NoneOfResutl style={{ backgroundColor: 'red' }} />
        ) : Object.keys(SearchResult).length || info3.length || info5 ? (
          <FlatList
            onScrollBeginDrag={() => {
              Keyboard.dismiss();
              hideSuggest();
            }}
            ref={ref => {
              global.SearchLawRef = ref;
              FlatListToScroll.current = ref;
            }}
            data={Object.keys(convertResultLoading(LawFilted))}
            renderItem={renderItem}
            onEndReached={distanceFromEnd => {
              if (!distanceFromEnd.distanceFromEnd) {
                loadMoreData();
              }
            }}
            onEndReachedThreshold={0}
            ListFooterComponent={
              paper < Math.ceil(Object.keys(LawFilted).length / 30) ? (
                <>
                  <ActivityIndicator color="black" />
                  <View
                    style={{
                      height: tabBarHeight,
                      width: 10,
                    }}
                  ></View>
                </>
              ) : (
                <View
                  style={{
                    height: tabBarHeight,
                    width: 10,
                  }}
                ></View>
              )
            }
          />
        ) : (
          <></>
        )}

        {/* Nút cuộn về đầu: mũi tên trong hình tròn, opacity < 1 */}
        {LawFilted && Object.keys(LawFilted).length > 0 && (
          <TouchableOpacity
            onPress={() =>
              FlatListToScroll.current?.scrollToOffset({
                offset: 0,
                animated: true,
              })
            }
            activeOpacity={0.8}
            style={{
              position: 'absolute',
              right: 16,
              bottom: tabBarHeight + 16,
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: 'gray',
              opacity: 0.6,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: 'black',
              shadowOpacity: 0.3,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            }}
          >
            <Ionicons name="arrow-up" style={{ color: 'white', fontSize: 26 }} />
          </TouchableOpacity>
        )}
      </View>
      {showFilter && (
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
              onPress={() => {
                let timeOut = setTimeout(() => {
                  setShowFilter(false);
                  return () => {};
                }, 500);
                setChoosenLaw(Object.keys(LawFilted));
                Animated.timing(animated, {
                  toValue: !showFilter ? 100 : 0,
                  easing: Easing.in,
                  duration: 300,
                  useNativeDriver: false,
                }).start();
              }}
            ></TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={{
              position: 'absolute',
              top: 80,
              bottom: 80,
              minHeight: 500,
              right: 50,
              left: 50,
              backgroundColor: 'white',
              display: 'flex',
              borderRadius: 20,
              transform: [{ scale: Scale }],
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
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: 'black',
                height: 50,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}
              >
                Nâng cao
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setFromDate('');
                  setToDate('');
                  setChosenAgencies([]);
                }}
                style={{
                  position: 'absolute',
                  right: 12,
                  height: '100%',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: 'white', fontSize: 13 }}>Xóa lọc</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={{ paddingHorizontal: '8%', paddingTop: 15 }}>
                <Text style={styles.filterLabel}>Từ khóa</Text>
                <View style={styles.filterKeywordWrap}>
                  <TextInput
                    value={input || ''}
                    onChangeText={text => setInput(text)}
                    placeholder="Nhập từ khóa..."
                    placeholderTextColor="gray"
                    style={styles.filterKeywordInput}
                  />
                  {input ? (
                    <TouchableOpacity
                      onPress={() => setInput('')}
                      style={{ paddingHorizontal: 8 }}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        style={{ color: 'black', fontSize: 20 }}
                      />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>

              <View style={{ paddingHorizontal: '8%', paddingTop: 18 }}>
                <Text style={styles.filterLabel}>Khoảng ngày ký</Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 8,
                  }}
                >
                  <Text style={styles.filterDateLabel}>Từ</Text>
                  <TextInput
                    value={fromDate}
                    onChangeText={t => setFromDate(formatDateInput(t))}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor="gray"
                    keyboardType="number-pad"
                    maxLength={10}
                    style={styles.filterDateInput}
                  />
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 8,
                  }}
                >
                  <Text style={styles.filterDateLabel}>Đến</Text>
                  <TextInput
                    value={toDate}
                    onChangeText={t => setToDate(formatDateInput(t))}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor="gray"
                    keyboardType="number-pad"
                    maxLength={10}
                    style={styles.filterDateInput}
                  />
                </View>
              </View>

              <View
                style={{
                  paddingHorizontal: '8%',
                  paddingTop: 18,
                  paddingBottom: 6,
                }}
              >
                <Text style={styles.filterLabel}>Cơ quan ban hành</Text>
              </View>

              <TouchableOpacity
                style={styles.agencyRowAll}
                onPress={() => {
                  if (chosenAgencies.length === AGENCIES.length) {
                    setChosenAgencies([]);
                  } else {
                    setChosenAgencies(AGENCIES.map(a => a.code));
                  }
                }}
              >
                <CheckBox
                  onClick={() => {
                    if (chosenAgencies.length === AGENCIES.length) {
                      setChosenAgencies([]);
                    } else {
                      setChosenAgencies(AGENCIES.map(a => a.code));
                    }
                  }}
                  isChecked={chosenAgencies.length === AGENCIES.length}
                />

                <Text
                  style={{ color: 'black', fontWeight: 'bold', marginLeft: 5 }}
                >
                  Tất cả
                </Text>
              </TouchableOpacity>

              <View
                style={{
                  paddingTop: 10,
                  paddingLeft: '10%',
                  paddingRight: '5%',
                }}
              >
                {AGENCIES.map(ag => {
                  const checked = chosenAgencies.includes(ag.code);
                  return (
                    <TouchableOpacity
                      key={ag.code}
                      style={styles.agencyRow}
                      onPress={() => toggleAgency(ag.code)}
                    >
                      <CheckBox
                        onClick={() => toggleAgency(ag.code)}
                        isChecked={checked}
                      />
                      <Text
                        style={{ marginLeft: 5, color: 'black', flexShrink: 1 }}
                      >
                        {ag.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity
              disabled={loading}
              style={{
                backgroundColor: 'green',
                opacity: loading ? 0.6 : 1,
              }}
              onPress={() => {
                searchWithFilter();
                let timeOut = setTimeout(() => {
                  setShowFilter(false);
                  return () => {};
                }, 500);
                Animated.timing(animated, {
                  toValue: !showFilter ? 100 : 0,
                  easing: Easing.in,
                  duration: 300,
                  useNativeDriver: false,
                }).start();
                setPaper(1);
                if (FlatListToScroll.current) {
                  FlatListToScroll.current.scrollToOffset({ offset: 0 });
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
                OK
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
      {/* ── Dropdown gợi ý: render ở GỐC (full-screen) để Android giao touch;
             định vị ngay dưới ô input theo toạ độ đo được (anchor). ── */}
      {showSuggest && suggestions.length > 0 && anchor && (
        <>
          {/* Backdrop phủ vùng kết quả phía sau -> tap vào đó ẩn CẢ dropdown
              lẫn bàn phím */}
          <TouchableWithoutFeedback
            onPress={() => {
              hideSuggest();
              Keyboard.dismiss();
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: anchor.y + anchor.h,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9998,
              }}
            />
          </TouchableWithoutFeedback>
          <View
            style={{
              position: 'absolute',
              top: anchor.y + anchor.h + 2,
              left: anchor.x - 24,
              width: anchor.w + 48,
              maxHeight: 360,
              backgroundColor: 'white',
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#e0e0e0',
              zIndex: 9999,
              elevation: 20,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
              overflow: 'hidden',
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {suggestions.map((s, k) => {
                const range = findMatchRange(s.d, normQuery(input));
                return (
                  <TouchableOpacity
                    key={s.i}
                    onPress={() => {
                      hideSuggest();
                      Keyboard.dismiss();
                      navigation.push('accessLaw', { screen: s.i });
                    }}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderBottomWidth: k < suggestions.length - 1 ? 1 : 0,
                      borderBottomColor: '#f0f0f0',
                    }}
                  >
                    <Text style={{ fontSize: 13, color: '#333' }}>
                      {range ? (
                        <>
                          {s.d.slice(0, range[0])}
                          <Text
                            style={{
                              backgroundColor: '#ffe08a',
                              fontWeight: 'bold',
                            }}
                          >
                            {s.d.slice(range[0], range[1])}
                          </Text>
                          {s.d.slice(range[1])}
                        </>
                      ) : (
                        s.d
                      )}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  titleText: {
    fontSize: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
    marginBottom: 7,
    textAlign: 'center',
    fontWeight: 'bold',
    color: 'white',
  },
  inputContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  inputArea: {
    width: '85%',
    backgroundColor: 'white',
    color: 'black',
    paddingLeft: 12,
    borderRadius: 15,
    paddingTop: 10,
    paddingBottom: 10,
  },
  containerBtb: {
    width: '15%',
    alignItems: 'center',
  },
  inputBtb: {
    width: '80%',
    height: 30,
    backgroundColor: 'black',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    // right: 5,
  },
  inputBtbText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 20,
  },
  filterLabel: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 15,
  },
  filterDateLabel: {
    width: 40,
    color: 'black',
    fontSize: 14,
  },
  filterDateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: 'black',
  },
  filterKeywordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
  filterKeywordInput: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: 'black',
  },
  agencyRowAll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: '5%',
    backgroundColor: 'rgb(240,240,240)',
    shadowColor: 'black',
    shadowOpacity: 0.5,
    shadowOffset: { width: 5, height: 5 },
    shadowRadius: 4,
    elevation: 10,
  },
  agencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    paddingRight: 10,
  },
  content: {
    height: 0,
    display: 'flex',
    position: 'relative',
    // paddingRight: 10,
    // paddingLeft: 10,
    margin: 0,
    overflow: 'hidden',
  },
  // chapter: {
  //   minHeight: 50,
  //   justifyContent: 'space-around',
  //   backgroundColor: '#F9CC76',
  //   color: 'black',
  //   alignItems: 'center',
  //   display: 'flex',
  //   flexDirection: 'column',
  // },
  item: {
    // minHeight: 80,
    display: 'flex',
    justifyContent: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    // paddingBottom: 2,
    flexDirection: 'column',
    alignItems: 'center',
    // backgroundColor:'red'
  },

  chapterText: {
    textAlign: 'center',
    color: 'black',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
    paddingBottom: 2,
    // backgroundColor: 'yellow',
  },
  descriptionText: {
    color: 'black',
    fontSize: 14,
    textAlign: 'justify',
    // textAlign: 'auto',
    // backgroundColor:'blue',
    // textAlignVertical:'bottom'
  },
  // chapterArrow: {
  //   backgroundColor: 'black',
  //   borderRadius: 25,
  //   // alignItems:'flex-end',
  //   display: 'flex',
  //   right: 10,
  //   position: 'absolute',
  //   width: 30,
  //   height: 30,
  //   textAlign: 'center',
  //   justifyContent: 'center',
  // },
  // articleContainer: {
  //   fontWeight: 'bold',
  //   paddingBottom: 6,
  //   paddingTop: 6,
  //   color: 'white',
  //   backgroundColor: '#66CCFF',
  //   justifyContent: 'center',
  //   // alignItems:'center',
  //   display: 'flex',
  //   textAlign: 'center',
  //   borderBottomColor: 'white',
  //   borderBottomWidth: 1,
  // },
  // article: {
  //   color: 'white',
  //   overflow: 'hidden',
  //   paddingRight: 10,
  //   paddingLeft: 10,
  //   textAlign: 'center',
  //   fontWeight: 'bold',
  // },
  // blackBackground: {
  //   backgroundColor: 'white',
  //   color: 'black',
  //   flexWrap: 'wrap',
  //   // width:200,
  //   overflow: 'hidden',
  //   flex: 1,
  //   display: 'flex',
  //   paddingRight: 10,
  //   paddingLeft: 10,
  //   textAlign: 'justify',
  //   paddingTop: 5,
  //   paddingBottom: 10,
  // },
  // highlight: {
  //   color: 'red',
  //   backgroundColor: 'yellow',
  //   textAlign: 'center',
  //   display: 'flex',
  //   justifyContent: 'center',
  //   alignItems: 'center',
  // },
});
