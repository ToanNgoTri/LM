import {
  View,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Animated,
  ActivityIndicator,
  FlatList,
  Easing,
  TouchableWithoutFeedback,
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
import { Text, TextInput, useTheme, useThemedStyles } from '../theme';

export function Detail1({}) {
  const [SearchResult, setSearchResult] = useState([]);
  const [paper, setPaper] = useState(0);
  const [showFilter, setShowFilter] = useState(false);
  const [choosenLaw, setChoosenLaw] = useState([]);
  const [LawFilted, setLawFilted] = useState(false);
  const [choosenKindLaw, setChoosenKindLaw] = useState([0, 1, 2, 3]);
  const [warning, setWanring] = useState(false);

  const textInput = useRef(null);
  const FlatListToScroll = useRef(null);
  const tabBarHeight = useTabBarHeight();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Thanh tìm kiếm phía trên: nền tối cố định ở bản sáng (giữ như cũ), bản tối
  // dùng nền surface cho hợp tông.
  const headerBg = isDark ? colors.surface : '#222222';
  // Hộp lọc "Nâng cao": header đen ở bản sáng.
  const filterHeaderBg = isDark ? colors.cardAlt : '#000000';
  const filterHeaderText = isDark ? colors.text : '#FFFFFF';
  // Checkbox trong hộp lọc: bản sáng giữ màu mặc định của thư viện.
  const filterCheckBoxColor = isDark ? colors.textSecondary : undefined;

  const filterUIState = useSelector(state => state['filterUI'].search);
  const input = filterUIState.input;
  const fromDate = filterUIState.dateFrom;
  const toDate = filterUIState.dateTo;
  const chosenAgencies = filterUIState.agencies;
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
      lawTypes: choosenKindLaw,  // ← Thêm dòng này
    });
    setInputForNavi(keyword);
  }

  function convertResult(info) {
    let lawObject = {};
    info.map((law, i) => {
      lawObject[law._id] = {
        lawNameDisplay: law.info['lawNameDisplay'],
        lawDescription: law.info['lawDescription'],
        lawDaySign: law.info['lawDaySign'],
        lawDayActive: law.info['lawDayActive'],
      };
    });
    return lawObject;
  }

  function pressToSearch() {
    Keyboard.dismiss();
    setPaper(1);
    if (FlatListToScroll.current) {
      FlatListToScroll.current.scrollToOffset({ offset: 0 });
    }
    if (!input || input.match(/^(\s)*$/)) {
      setWanring(true);
    } else {
      dispatch({ 
        type: 'searchContent', 
        input: input,
        lawTypes: choosenKindLaw,  // ← Thêm dòng này
      });
      setInputForNavi(input);
    }
  }

  useEffect(() => {
    setWanring(false);
  }, [input]);

  useEffect(() => {
    setChoosenLaw(
      Object.keys(SearchResult).length ? Object.keys(SearchResult) : [],
    );
  }, [SearchResult]);

  // Khi có kết quả search mới
  useEffect(() => {
    if (result) {
      setSearchResult(convertResult(result));
      setLawFilted(convertResult(result));
      // setChoosenKindLaw([0, 1, 2, 3]); // Reset checkbox sau search
    }
  }, [result]);

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
            paddingBottom: tabBarHeight,
            paddingLeft: 30,
            paddingRight: 30,
          }}
        >
          <Text
            style={{ fontSize: 35, textAlign: 'center', color: colors.textMuted }}
          >
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
    [SearchResult, input, colors, styles],
  );

  const Item = memo(title => {
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
          backgroundColor: i % 2
            ? colors.card
            : isDark
            ? colors.cardAlt
            : '#DDDDDD',
          // tối: kẻ mảnh để tách các hàng
          ...(isDark && {
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }),
        }}
        onPress={() => {
          navigation.push(`accessLaw`, {
            screen: detailId,
            input: inputForNavi,
          });
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
                color: colors.textMuted,
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
                color: colors.textMuted,
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
          backgroundColor: headerBg,
          paddingTop: insets.top + 5,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? colors.border : 'white',
        }}
      >
        <ScreenToggle active="search" />

        <View style={{ ...styles.inputContainer, height: 52, top: 5 }}>
          <View style={{ ...styles.containerBtb, paddingTop: 5 }}>
            <TouchableOpacity
              disabled={loading1}
              style={{
                ...styles.inputBtb,
                backgroundColor: colors.inputBg,
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
                style={{ ...styles.inputBtbText, color: colors.text }}
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
                backgroundColor: colors.inputBg,
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
                placeholderTextColor={colors.placeholder}
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
                      color: colors.text,
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
                borderColor: colors.warning,
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
          backgroundColor: isDark ? colors.bg : '#EEEFE4',
          // Không cần chừa chỗ ở đây: FlatList đã có ListFooterComponent
          // cao tabBarHeight, còn các nhánh khác tự chừa riêng.
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
              global.SearchContentRef = ref;
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
                  <ActivityIndicator color={colors.text} />
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
              backgroundColor: colors.textMuted,
              opacity: 0.6,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.shadow,
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
              backgroundColor: colors.card,
              display: 'flex',
              borderRadius: 20,
              transform: [{ scale: Scale }],
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
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: filterHeaderBg,
                height: 50,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: filterHeaderText,
                  fontWeight: 'bold',
                  fontSize: 16,
                }}
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
                <Text style={{ color: filterHeaderText, fontSize: 13 }}>
                  Xóa lọc
                </Text>
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
                    placeholderTextColor={colors.placeholder}
                    style={styles.filterKeywordInput}
                  />
                  {input ? (
                    <TouchableOpacity
                      onPress={() => setInput('')}
                      style={{ paddingHorizontal: 8 }}
                    >
                      <Ionicons
                        name="close-circle-outline"
                        style={{ color: colors.text, fontSize: 20 }}
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
                    placeholderTextColor={colors.placeholder}
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
                    placeholderTextColor={colors.placeholder}
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
                  checkBoxColor={filterCheckBoxColor}
                />

                <Text
                  style={{ color: colors.text, fontWeight: 'bold', marginLeft: 5 }}
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
                        checkBoxColor={filterCheckBoxColor}
                      />
                      <Text
                        style={{ marginLeft: 5, color: colors.text, flexShrink: 1 }}
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
                backgroundColor: colors.primary,
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
                  color: colors.onPrimary,
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

const makeStyles = (c, isDark) => ({
  titleText: {
    fontSize: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
    marginBottom: 7,
    textAlign: 'center',
    fontWeight: 'bold',
    color: c.onPrimary,
  },
  inputContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  inputArea: {
    width: '85%',
    backgroundColor: c.inputBg,
    color: c.text,
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
    backgroundColor: c.warning,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    // right: 5,
  },
  inputBtbText: {
    // Icon trên nền cam nên giữ trắng ở cả hai theme.
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 20,
  },
  filterLabel: {
    color: c.text,
    fontWeight: 'bold',
    fontSize: 15,
  },
  filterDateLabel: {
    width: 40,
    color: c.text,
    fontSize: 14,
  },
  filterDateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: c.text,
  },
  filterKeywordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 8,
  },
  filterKeywordInput: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    color: c.text,
  },
  agencyRowAll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: '5%',
    backgroundColor: isDark ? c.cardAlt : 'rgb(240,240,240)',
    shadowColor: c.shadow,
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
    color: c.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  descriptionText: {
    textAlign: 'center',
    color: c.text,
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
