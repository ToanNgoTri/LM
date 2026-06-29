import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Keyboard,
  Animated,
  ActivityIndicator,
  FlatList,
  Easing,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import CheckBox from 'react-native-check-box';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useSelector, useDispatch } from 'react-redux';
import { useNetInfo } from '@react-native-community/netinfo';
import React, { useEffect, useState, useRef, memo, useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import { ScreenToggle } from './components/ScreenToggle';
import { AGENCIES, parseDateInput, formatDateInput } from './filterUtils';
import { setFilterUI } from '../redux/fetchData';

export function Detail1({}) {
  const [SearchResult, setSearchResult] = useState([]); // đây Object là các luật, điểm, khoản có kết quả tìm kiếm
  // console.log(SearchResult);

  const [paper, setPaper] = useState(0);

  const [showFilter, setShowFilter] = useState(false);

  // const [textInputFocus, setTextInputFocus] = useState(false);

  const [choosenLaw, setChoosenLaw] = useState([]);
  const [LawFilted, setLawFilted] = useState(false);

  const [choosenKindLaw, setChoosenKindLaw] = useState([0, 1, 2]);

  const [warning, setWanring] = useState(false);

  const textInput = useRef(null);

  const FlatListToScroll = useRef(null);

  const tabBarHeight = useTabBarHeight();

  const insets = useSafeAreaInsets(); // lất chiều cao để manu top iphone

  const dispatch = useDispatch();

  // Bộ lọc riêng của màn này (search) qua Redux -> không mất khi remount
  const filterUIState = useSelector(state => state['filterUI'].search);
  const input = filterUIState.input;
  const fromDate = filterUIState.dateFrom;
  const toDate = filterUIState.dateTo;
  const chosenAgencies = filterUIState.agencies;
  // Từ khóa đã áp dụng, truyền sang Detail5 để tự tìm trong văn bản
  const inputForNavi = filterUIState.valueInput;

  const setInput = v =>
    dispatch(
      setFilterUI({
        screen: 'search',
        input: typeof v === 'function' ? v(input) : v,
      }),
    );
  const setInputForNavi = v =>
    dispatch(
      setFilterUI({
        screen: 'search',
        valueInput: typeof v === 'function' ? v(inputForNavi) : v,
      }),
    );
  const setFromDate = v =>
    dispatch(
      setFilterUI({
        screen: 'search',
        dateFrom: typeof v === 'function' ? v(fromDate) : v,
      }),
    );
  const setToDate = v =>
    dispatch(
      setFilterUI({
        screen: 'search',
        dateTo: typeof v === 'function' ? v(toDate) : v,
      }),
    );
  const setChosenAgencies = v =>
    dispatch(
      setFilterUI({
        screen: 'search',
        agencies: typeof v === 'function' ? v(chosenAgencies) : v,
      }),
    );

  const { loading1, result } = useSelector(state => state['searchContent']);

  const navigation = useNavigation();

  const netInfo = useNetInfo();
  let internetConnected = netInfo.isConnected;

  useEffect(() => {
    setChoosenLaw(
      Object.keys(SearchResult).length ? Object.keys(SearchResult) : [],
    );
  }, [SearchResult]);

  useEffect(() => {
    if (result) {
      setSearchResult(convertResult(result));
      setLawFilted(convertResult(result));
      setChoosenKindLaw([0, 1, 2]);
    }
  }, [result]);

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
      type: 'searchContent',
      input: keyword,
      dateFrom: from ? from.toISOString() : '',
      dateTo: to ? to.toISOString() : '',
      agencies: chosenAgencies,
    });
    setInputForNavi(keyword);
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

  function chooseDisplayKindLaw() {
    // 1 là luật, 2 là nd, 3 là TT

    let newResult = {};

    if (
      // choosenKindLaw.length &&
      Object.keys(SearchResult).length &&
      SearchResult['_id'] !== 'none'
    ) {
      Object.keys(SearchResult).map((law, i) => {
        let kindSample =
          (choosenKindLaw.includes(0) ? 'Luật|Bộ luật' : '') +
          (choosenKindLaw.includes(1) ? '|Nghị định' : '') +
          (choosenKindLaw.includes(2) ? '|Thông tư' : '');
        kindSample = kindSample.replace(/^\|/, '');

        if (choosenKindLaw.length) {
          // console.log(1);
          // console.log( SearchResult[law]);

          if (
            SearchResult[law]['lawNameDisplay'].match(
              new RegExp(`^(${kindSample})`, 'img'),
            )
          ) {
            newResult[law] = SearchResult[law];
          } else {
            if (
              !SearchResult[law]['lawNameDisplay'].match(
                new RegExp(`^(Luật|Bộ luật|Nghị định|Thông tư)`, 'img'),
              )
            ) {
              newResult[law] = SearchResult[law];
            }
          }
        } else {
          if (
            !SearchResult[law]['lawNameDisplay'].match(
              new RegExp(`^(Luật|Bộ luật|Nghị định|Thông tư)`, 'img'),
            )
          ) {
            newResult[law] = SearchResult[law];
          }
        }

        setLawFilted(newResult);
        setChoosenLaw(Object.keys(newResult));
      });
    }
  }

  function OrderDaySign() {
    let data = LawFilted;
    let ArrayResult = [];

    if (Object.keys(LawFilted).length) {
      Object.keys(data).map((law, i) => {
        ArrayResult[i] = {
          [Object.keys(data)[Object.keys(data).length - i - 1]]:
            data[Object.keys(data)[Object.keys(data).length - i - 1]],
        };
      });
      let newArraySearch = [];
      ArrayResult.map((key, i) => {
        newArraySearch[i] = JSON.stringify(key);
      });
      newArraySearch = newArraySearch.join(',');
      newArraySearch = newArraySearch.replace(/\}\}\,\{/gim, '},');
      newArraySearch = newArraySearch.replace(/^\[\{/, '');
      newArraySearch = newArraySearch.replace(/\}\}\]$/, '}');
      // newArraySearch = newArraySearch.replace(/\\/g,'')
      let newObjectSearch = JSON.parse(newArraySearch);
      setLawFilted(newObjectSearch);
    }
  }

  function pressToSearch() {
    Keyboard.dismiss();
    setPaper(1);
    if (FlatListToScroll.current) {
      FlatListToScroll.current.scrollToOffset({ offset: 0 });
    }
    Keyboard.dismiss();
    if (!input || input.match(/^(\s)*$/)) {
      setWanring(true);
    } else {
      dispatch({ type: 'searchContent', input: input });
    }
    setInputForNavi(input);
  }

  useEffect(() => {
    setWanring(false);
  }, [input]);

  useEffect(() => {
    setChoosenLaw(
      Object.keys(SearchResult).length ? Object.keys(SearchResult) : [],
    );
  }, [SearchResult]);

  useEffect(() => {
    chooseDisplayKindLaw();
  }, [choosenKindLaw]);

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
            {Array.isArray(SearchResult)
              ? ''
              : 'Không có kết quả nào được tìm thấy'}
          </Text>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  const renderItem = useCallback(
    data => <Item id={data} />,
    [SearchResult, input],
  );

  const Item = memo(title => {
    console.log(title);
    let detailId = title?.id?.item;
    let i = title?.id?.index;

    let nameLaw = 'unknown name';
    let descriptionLaw = 'unknown name';
    if (result) {
      nameLaw = SearchResult[detailId]['lawNameDisplay'];

      descriptionLaw = SearchResult[detailId]['lawDescription'];
    }
    if (nameLaw) {
      if (nameLaw.match(/(?<=\w)\\(?=\w)/gim)) {
        nameLaw = detailId.replace(/(?<=\w)\\(?=\w)/gim, '/');
      }
    }

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

    return (
      <TouchableOpacity
        key={i}
        style={{
          paddingBottom: 10,
          paddingTop: 10,
          justifyContent: 'center',
          backgroundColor: i % 2 ? 'white' : '#DDDDDD', // #F9CC76
          // marginBottom: 6,
        }}
        onPress={() => {
          navigation.push(`accessLaw`, {
            screen: detailId,
            input: inputForNavi,
          });
          // setName(i);
        }}
      >
        <View style={styles.item}>
          <Text style={styles.chapterText} key={`${i}a`}>
            {nameLaw}
          </Text>
          {!nameLaw.match(/^(luật|bộ luật|Hiến)/gim) && (
            <Text style={styles.descriptionText}>
              {'   '}
              {descriptionLaw}
            </Text>
          )}
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

  function convertResultLoading(obj) {
    const first30Entries = Object.entries(obj).slice(0, paper * 30);
    // console.log(first10Entries.length);

    // Chuyển lại array thành object
    const first30Obj = Object.fromEntries(first30Entries);

    return first30Obj;
  }

  function loadMoreData() {
    if (paper < Math.ceil(Object.keys(SearchResult).length / 30)) {
      setPaper(paper + 1);
    }
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
          backgroundColor: '#222222',
          paddingTop: insets.top + 5,
          borderBottomWidth: 1,
          borderBottomColor: 'white',
        }}
      >
        <ScreenToggle active="search" />

        <View style={{ ...styles.inputContainer, height: 52, top: 5 }}>
          <View style={{ ...styles.containerBtb, paddingTop: 5 }}>
            <TouchableOpacity
              disabled={loading1}
              style={{
                ...styles.inputBtb,
                backgroundColor: 'white',
                opacity: loading1 ? 0.5 : 1,
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
              style={{
                position: 'relative',
                flexDirection: 'row',
                backgroundColor: 'white',
                borderRadius: 15,
                borderColor: warning ? '#FF4500' : 'none',
                borderWidth: warning ? 1 : 0,
              }}
            >
              <TextInput
                ref={textInput}
                style={styles.inputArea}
                onChangeText={text => {
                  setInput(text);
                  // ;dispatch(type1(text))
                }}
                value={input}
                selectTextOnFocus={true}
                placeholder="Nhập từ khóa..."
                placeholderTextColor={'gray'}
                onSubmitEditing={() => {
                  pressToSearch();
                }}
                // onFocus={() => setTextInputFocus(true)}
                // onBlur={() => setTextInputFocus(false)}
              ></TextInput>
              <TouchableOpacity
                onPress={() => {
                  setInput('');
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
                    }}
                  ></Ionicons>
                )}
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.containerBtb}>
            <TouchableOpacity
              disabled={loading1}
              style={{
                ...styles.inputBtb,
                borderRadius: 100,
                height: 40,
                borderWidth: 2,
                borderColor: '#f67c1a',
                minWidth: 40,
              }}
              onPress={() => {
                pressToSearch();
              }}
            >
              {loading1 ? (
                <ActivityIndicator
                  size="small"
                  color="black"
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
          pointerEvents={loading1 ? 'none' : 'auto'}
          style={{
            justifyContent: 'space-evenly',
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            paddingBottom: 5,
            opacity: loading1 ? 0.5 : 1,
          }}
        >
          {['Luật/Bộ Luật', 'Nghị định', 'Thông tư'].map((option, i) => {
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

          <TouchableOpacity
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 100,
              height: 25,
              backgroundColor: 'white',
              width: 50,
              padding: 0,
            }}
            onPress={async () => {
              Keyboard.dismiss();
              OrderDaySign();
            }}
          >
            <Ionicons
              name="swap-vertical-outline"
              style={{
                ...styles.inputBtbText,
                fontSize: 19,
                color: 'black',
              }}
            ></Ionicons>
          </TouchableOpacity>
        </View>
      </View>
      <View
        style={{
          marginTop: 0,
          flex: 1,
          backgroundColor: '#EEEFE4',
          paddingBottom:
            Platform.OS === 'ios'
              ? 0
              : insets.bottom / 2 - 50 - 5 + insets.bottom,
        }}
      >
        {loading1 && (
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

        {Array.isArray(SearchResult) ? (
          <NoneOfResutl />
        ) : !Object.keys(SearchResult).length ? (
          <NoneOfResutl />
        ) : (
          <FlatList
            onScrollBeginDrag={() => Keyboard.dismiss()}
            ref={ref => {
              (global.SearchContentRef = ref), FlatListToScroll;
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
              disabled={loading1}
              style={{
                backgroundColor: 'green',
                opacity: loading1 ? 0.6 : 1,
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
    backgroundColor: '#f67c1a',
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
  // content: {
  //   height: 0,
  //   display: 'flex',
  //   position: 'relative',
  //   margin: 0,
  //   overflow: 'hidden',
  // },
  item: {
    // minHeight: 80,
    display: 'flex',
    justifyContent: 'center',
    paddingLeft: 20,
    paddingRight: 20,
    flexDirection: 'column',
    alignItems: 'center',
  },
  chapterText: {
    textAlign: 'center',
    color: 'black',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  descriptionText: {
    textAlign: 'center',
    color: 'black',
    fontSize: 14,
    textAlign: 'justify',
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
