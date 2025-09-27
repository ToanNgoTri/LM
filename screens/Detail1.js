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
} from 'react-native';
import CheckBox from 'react-native-check-box';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useSelector, useDispatch} from 'react-redux';
import {useNetInfo} from '@react-native-community/netinfo';
import React, {useEffect, useState, useRef} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

export function Detail1({}) {
  const [SearchResult, setSearchResult] = useState([]); // đây Object là các luật, điểm, khoản có kết quả tìm kiếm
  // console.log(SearchResult);

  const [input, setInput] = useState(undefined);

  const [inputForNavi, setInputForNavi] = useState('');

  const [paper, setPaper] = useState(0);
  // console.log('paper',paper);

  const [inputFilter, setInputFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const [checkedAllFilter, setCheckedAllFilter] = useState(true);

  // const [name, setName] = useState(); // dùng để collapse (thu thập key của các law)
  // const [nameArray, setNameArray] = useState([]); // arrray của các law đã expand

  // const [article, setArticle] = useState(); // dùng để collapse (thu thập key của các 'điều')
  // const [articleArray, setArticleArray] = useState([]); // arrray của các 'điều' đã expand
  const [textInputFocus, setTextInputFocus] = useState(false);

  const [textInputFilterFocus, setTextInputFilterFocus] = useState(false);


  const [choosenLaw, setChoosenLaw] = useState([]);
  const [LawFilted, setLawFilted] = useState(false);

  const [choosenKindLaw, setChoosenKindLaw] = useState([0, 1, 2]);

  const [warning, setWanring] = useState(false);

  const textInput = useRef(null);
  const textInputFilter = useRef(null);

  const FlatListToScroll = useRef(null);

  const insets = useSafeAreaInsets(); // lất chiều cao để manu top iphone

  const dispatch = useDispatch();

  const {loading1, result} = useSelector(state => state['searchContent']);

  const navigation = useNavigation();

  const netInfo = useNetInfo();
  let internetConnected = netInfo.isConnected;

  useEffect(() => {
    setChoosenLaw(
      Object.keys(SearchResult).length ? Object.keys(SearchResult) : [],
    );
  }, [SearchResult]);

  useEffect(() => {
    // if (result) {
    //   let lawObject = {};
    //   result.map(law => {
    //     lawObject[law._id] = {
    //       lawNameDisplay: law.info['lawNameDisplay'],
    //       lawDescription: law.info['lawDescription'],
    //     };
    //   });
    //   setSearchResult(lawObject);

    //   setLawFilted(lawObject);
    // }

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

  function LawFilterContent(choosenLaw, SearchResult) {
    let contentFilted = {};
    Object.keys(SearchResult).filter(key => {
      if (choosenLaw.includes(key)) {
        contentFilted[key] = SearchResult[key];
      }
    });
    setLawFilted(contentFilted);
    // console.log('LawFilted',LawFilted);
  }

  function convertResult(info) {
    let lawObject = {};
    info.map((law, i) => {
      // lawObject[i] = {[law._id]:{'lawNameDisplay':law.info['lawNameDisplay'],'lawDescription':law.info['lawDescription'],'lawDaySign':law.info['lawDaySign']}}
      lawObject[law._id] = {
        lawNameDisplay: law.info['lawNameDisplay'],
        lawDescription: law.info['lawDescription'],
        lawDaySign: law.info['lawDaySign'],
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
          } else{ if (
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
      FlatListToScroll.current.scrollToOffset({offset: 0});
    }
    Keyboard.dismiss();
    if (!input || input.match(/^(\s)*$/)) {
      setWanring(true);
    } else {
      dispatch({type: 'searchContent', input: input});
    }
    setInputForNavi(input);  }


  useEffect(() => {
    setWanring(false);
  }, [input]);

  useEffect(() => {
    setInputFilter('');

    if (choosenLaw.length == Object.keys(SearchResult || {}).length) {
      setCheckedAllFilter(true);
    } else {
      setCheckedAllFilter(false);
    }
  }, [showFilter]);

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
        style={{backgroundColor: 'red'}}
        onPress={() => Keyboard.dismiss()}>
        <View
          style={{
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            paddingBottom: 90,
            paddingLeft: 30,
            paddingRight: 30,
          }}>
          <Text style={{fontSize: 35, textAlign: 'center', color: 'gray'}}>
            {Array.isArray(SearchResult)
              ? ''
              : 'Không có kết quả nào được tìm thấy'}
          </Text>
        </View>
      </TouchableWithoutFeedback>
    );
  };

  const Item = ({title}) => {
    let key = title.item;
    let i = title.index;

    let nameLaw = 'unknown name';
    let descriptionLaw = 'unknown name';
    if (result) {
      nameLaw = SearchResult[key]['lawNameDisplay'];

      descriptionLaw = SearchResult[key]['lawDescription'];
    }
    if (nameLaw) {
      if (nameLaw.match(/(?<=\w)\\(?=\w)/gim)) {
        nameLaw = key.replace(/(?<=\w)\\(?=\w)/gim, '/');
      }
    }

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
          navigation.push(`accessLaw`, {screen: key, input: inputForNavi});
          // setName(i);
        }}>
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
      </TouchableOpacity>
    );
  };

  // const ItemForFilter = ({ data }) => {
  //   // console.log(data.item);
  //   // console.log(SearchResult);
    
  //   let nameLaw = SearchResult[data.item]['lawNameDisplay'];
  //   let lawDescription = SearchResult[data.item]['lawDescription'];
  
  //   let inputSearchLawReg = inputFilter;
  //   if (
  //     inputFilter.match(
  //       /(\w+|\(|\)|\.|\+|\-|\,|\&|\?|\;|\!|\/|\s?)/gim,
  //     )
  //   ) {
  //     inputSearchLawReg = inputFilter.replace(/\(/gim, '\\(');
  
  //     inputSearchLawReg = inputSearchLawReg.replace(
  //       /\)/gim,
  //       '\\)',
  //     );
  
  //     inputSearchLawReg = inputSearchLawReg.replace(
  //       /\\/gim,
  //       '.',
  //     );
  
  //     inputSearchLawReg = inputSearchLawReg.replace(
  //       /\./gim,
  //       '\\.',
  //     );
  
  //     inputSearchLawReg = inputSearchLawReg.replace(
  //       /\+/gim,
  //       '\\+',
  //     );
  
  //     inputSearchLawReg = inputSearchLawReg.replace(
  //       /\?/gim,
  //       '\\?',
  //     );
  //   }
  //   if (
  //     nameLaw.match(new RegExp(inputSearchLawReg, 'igm')) ||
  //     lawDescription.match(new RegExp(inputSearchLawReg, 'igm'))
  //   ) {
  //     return (
  //       <TouchableOpacity
  //         key={`${data.item}b`}
  //         style={{
  //           display: 'flex',
  //           flexDirection: 'row',
  //           paddingBottom: 10,
  //           width: '90%',
  //           alignItems: 'center',
  //           backgroundColor:'red'
  //         }}
  //         onPress={() => {
  //           // console.log('touch');

  //           if (data.item == undefined) {
  //           } else if (choosenLaw.includes(data.item)) {
  //             setChoosenLaw(
  //               choosenLaw.filter(a1 => a1 !== data.item),
  //               setCheckedAllFilter(false),
  //             );
  //           } else {
  //             setChoosenLaw([...choosenLaw, data.item]);
  //             if (
  //               choosenLaw.length ==
  //               Object.keys(SearchResult).length - 1
  //             ) {
  //               setCheckedAllFilter(true);
  //             }
  //           }
  //         }}
  //       >
  //         <CheckBox
  //           onClick={() => {
  //             if (data.item == undefined) {
  //             } else if (choosenLaw.includes(data.item)) {
  //               setChoosenLaw(
  //                 choosenLaw.filter(a1 => a1 !== data.item),
  //               );
  //               setCheckedAllFilter(false);
  //             } else {
  //               setChoosenLaw([...choosenLaw, data.item]);
  //               if (
  //                 choosenLaw.length ==
  //                 Object.keys(SearchResult).length - 1
  //               ) {
  //                 setCheckedAllFilter(true);
  //               }
  //             }
  //           }}
  //           isChecked={choosenLaw.includes(data.item)}
  //         />
  
  //         <Text style={{ marginLeft: 5, color: 'black' }}>
  //           {nameLaw}
  //         </Text>
  //       </TouchableOpacity>
  //     );
  //   }
  // }

  
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
          }}>
          <Text
            style={{
              color: 'white',
              marginBottom: 15,
              fontWeight: 'bold',
            }}>
            Vui lòng kiểm tra kết nối mạng ...
          </Text>
          <ActivityIndicator size="large" color="white"></ActivityIndicator>
        </View>
      )}

      <View
        style={{
          backgroundColor: '#222222',
          paddingTop: insets.top,
          borderBottomWidth: 1,
          borderBottomColor: 'white',
        }}>
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            // if (FlatListToScroll.current) {
            //   FlatListToScroll.current.scrollToOffset({offset: 0});
            // }
          }}>
          <Text style={styles.titleText}>{`Tìm kiếm nội dung`}</Text>
        </TouchableWithoutFeedback>
        <View style={{...styles.inputContainer, height: 52}}>
          <View style={{...styles.containerBtb, paddingTop: 5}}>
            <TouchableOpacity
              style={{
                ...styles.inputBtb,
                backgroundColor: 'white',
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
              }}>
              <Ionicons
                name="funnel-outline"
                style={{...styles.inputBtbText, color: 'black'}}></Ionicons>
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
                }}>
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
                  }}>
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
            }}>
            <View
              style={{
                position: 'relative',
                flexDirection: 'row',
                backgroundColor: 'white',
                borderRadius: 15,
                borderColor: warning ? '#FF4500' : 'none',
                borderWidth: warning ? 1 : 0,
              }}>
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
                  pressToSearch()
                }}
                // onTouchEnd={() => {
                //   if (textInputFocus) {
                //     textInput.current.blur();
                //     setTextInputFocus(false);
                //   } else {
                //     setTextInputFocus(true);
                //     textInput.current.focus();
                //   }
                // }}
                onFocus={() => setTextInputFocus(true)}
                onBlur={() => setTextInputFocus(false)}
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
                }}>
                {input && (
                  <Ionicons
                    name="close-circle-outline"
                    style={{
                      color: 'black',
                      fontSize: 20,
                      paddingRight: 8,
                      // textAlign: 'center',
                      // width: 20,
                      // height: 20,

                      // textAlign:'right'
                    }}></Ionicons>
                )}
              </TouchableOpacity>
            </View>
            <Text
              style={{
                color: '#FF4500',
                fontSize: 12,
                textAlign: 'center',
                fontWeight: 'bold',
                lineHeight: 14,
              }}>
              {warning ? 'Vui lòng nhập từ khóa hợp lệ' : ' '}
            </Text>
          </View>
          <View style={styles.containerBtb}>
            <TouchableOpacity
              style={{
                ...styles.inputBtb,
                borderRadius: 100,
                height: 40,
                borderWidth: 2,
                borderColor: 'green',
                minWidth: 40,
              }}
              onPress={() => {
                pressToSearch()
              }}>
              <Ionicons
                name="search-outline"
                style={styles.inputBtbText}></Ionicons>
            </TouchableOpacity>
          </View>
        </View>
        <View
          style={{
            justifyContent: 'space-evenly',
            flexDirection: 'row',
            alignItems: 'center',
            width: '100%',
            paddingBottom: 5,
          }}>
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
                }}>
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
                <Text style={{fontSize: 13, color: 'white'}}>{option}</Text>
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
            }}>
            <Ionicons
              name="swap-vertical-outline"
              style={{
                ...styles.inputBtbText,
                fontSize: 19,
                color: 'black',
              }}></Ionicons>
          </TouchableOpacity>
        </View>
      </View>
      <View style={{marginTop: 0, flex: 1, backgroundColor: '#EEEFE4'}}>
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
            onPress={() => Keyboard.dismiss()}>
            <View
              style={{
                top: '-9%',
              }}>
              <Text
                style={{
                  color: 'white',
                  marginBottom: 15,
                  fontWeight: 'bold',
                }}>
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
            renderItem={item => <Item title={item} />}
            onEndReached={distanceFromEnd => {
              if (!distanceFromEnd.distanceFromEnd) {
                loadMoreData();
              }
            }}
            onEndReachedThreshold={0}
            ListFooterComponent={
              paper < Math.ceil(Object.keys(LawFilted).length / 10) ? (
                <>
                  <ActivityIndicator color="black" />
                  <View
                    style={{height: 50 + insets.bottom / 2, width: 10}}></View>
                </>
              ) : (
                <View
                  style={{height: 50 + insets.bottom / 2, width: 10}}></View>
              )
            }
          />
        )}
      </View>
      {/* </ScrollView> */}

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
            }}>
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
              }}></TouchableOpacity>
          </Animated.View>

          <Animated.View
            style={{
              position: 'absolute',
              top: 80,
              bottom: 60,
              minHeight: 500,
              right: 50,
              left: 50,
              backgroundColor: 'white',
              display: 'flex',
              borderRadius: 20,
              transform: [{scale: Scale}],
              overflow: 'hidden',
              // borderWidth:1,
              // borderColor:'brown',
              shadowColor: 'black',
              shadowOpacity: 1,
              shadowOffset: {
                width: 10,
                height: 10,
              },
              shadowRadius: 4,
              elevation: 20,
            }}>
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: 'black',
                height: 50,
              }}>
              <TextInput
                ref={textInputFilter}
                onChangeText={text => setInputFilter(text)}
                value={inputFilter}
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  color: 'white',
                  width: '85%',
                  alignItems: 'center',
                }}
                placeholder=" Nhập để tìm kiếm ..."
                placeholderTextColor={'gray'}
                onTouchEnd={() => {
                  if (textInputFilterFocus) {
                    textInputFilter.current.blur();
                    setTextInputFilterFocus(false);
                  } else {
                    setTextInputFilterFocus(true);
                    textInputFilter.current.focus();
                  }
                }}
                onFocus={() => setTextInputFilterFocus(true)}
                onBlur={() => setTextInputFilterFocus(false)}
              ></TextInput>
              <TouchableOpacity
                onPress={() => setInputFilter('')}
                style={{
                  width: '15%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {inputFilter && (
                  <Text
                    style={{
                      height: 20,
                      width: 20,
                      color: 'white',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      backgroundColor: 'gray',
                      borderRadius: 25,
                    }}>
                    X
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={{
                display: 'flex',
                flexDirection: 'row',
                paddingBottom: 10,
                width: '100%',
                paddingLeft: '5%',
                paddingTop: 10,
                alignItems: 'center',
                backgroundColor: 'rgb(240,240,240)',
                shadowColor: 'black',
                shadowOpacity: 0.5,
                shadowOffset: {
                  width: 5,
                  height: 5,
                },
                shadowRadius: 4,
                elevation: 10,
              }}
              onPress={() => {
                if (choosenLaw.length == Object.keys(SearchResult).length) {
                  setCheckedAllFilter(false);
                  setChoosenLaw([]);
                } else {
                  setChoosenLaw(Object.keys(SearchResult));
                  setCheckedAllFilter(true);
                }
              }}>
              <CheckBox
                onClick={() => {
                  if (choosenLaw.length == Object.keys(SearchResult).length) {
                    setCheckedAllFilter(false);
                    setChoosenLaw([]);
                  } else {
                    setChoosenLaw(Object.keys(SearchResult));
                    setCheckedAllFilter(true);
                  }
                }}
                isChecked={checkedAllFilter}
              />

              <Text
                style={{
                  color: 'black',
                  fontWeight: 'bold',
                  marginLeft: 5,
                  // backgroundColor:'green'
                }}>
                Tất cả
              </Text>
            </TouchableOpacity>

            <ScrollView keyboardShouldPersistTaps="never">
              <View
                style={{
                  paddingTop: 10,
                  paddingLeft: '10%',
                  paddingRight: '5%',
                  display: 'flex',
                  // flexDirection:'row'
                }}>
                {SearchResult &&
                  Object.keys(SearchResult).map((key, i) => {
                    let nameLaw = SearchResult[key]['lawNameDisplay'];
                    let lawDescription = SearchResult[key]['lawDescription'];

                    let inputSearchLawReg = inputFilter;
                    if (
                      inputFilter.match(
                        /(\w+|\(|\)|\.|\+|\-|\,|\&|\?|\;|\!|\/|\s?)/gim,
                      )
                    ) {
                      inputSearchLawReg = inputFilter.replace(/\(/gim, '\\(');

                      inputSearchLawReg = inputSearchLawReg.replace(
                        /\)/gim,
                        '\\)',
                      );

                      inputSearchLawReg = inputSearchLawReg.replace(
                        /\\/gim,
                        '.',
                      );

                      inputSearchLawReg = inputSearchLawReg.replace(
                        /\./gim,
                        '\\.',
                      );

                      inputSearchLawReg = inputSearchLawReg.replace(
                        /\+/gim,
                        '\\+',
                      );

                      inputSearchLawReg = inputSearchLawReg.replace(
                        /\?/gim,
                        '\\?',
                      );
                    }
                    if (
                      nameLaw.match(new RegExp(inputSearchLawReg, 'igm')) ||
                      lawDescription.match(new RegExp(inputSearchLawReg, 'igm'))
                    ) {
                      return (
                        <TouchableOpacity
                          key={`${i}b`}
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            paddingBottom: 10,
                            width: '90%',
                            alignItems: 'center',
                          }}
                          onPress={() => {
                            if (key == undefined) {
                            } else if (choosenLaw.includes(key)) {
                              setChoosenLaw(
                                choosenLaw.filter(a1 => a1 !== key),
                                setCheckedAllFilter(false),
                              );
                            } else {
                              setChoosenLaw([...choosenLaw, key]);
                              if (
                                choosenLaw.length ==
                                Object.keys(SearchResult).length - 1
                              ) {
                                setCheckedAllFilter(true);
                              }
                            }
                          }}>
                          <CheckBox
                            onClick={() => {
                              if (key == undefined) {
                              } else if (choosenLaw.includes(key)) {
                                setChoosenLaw(
                                  choosenLaw.filter(a1 => a1 !== key),
                                );
                                setCheckedAllFilter(false);
                              } else {
                                setChoosenLaw([...choosenLaw, key]);
                                if (
                                  choosenLaw.length ==
                                  Object.keys(SearchResult).length - 1
                                ) {
                                  setCheckedAllFilter(true);
                                }
                              }
                            }}
                            isChecked={choosenLaw.includes(key)}
                            style={{}}
                          />

                          <Text style={{marginLeft: 5, color: 'black'}}>
                            {nameLaw}
                          </Text>
                        </TouchableOpacity>
                      );
                    }
                  })}
              </View>
            </ScrollView>


{/* <FlatList
              onScrollBeginDrag={() => Keyboard.dismiss()}
              data={Object.keys(SearchResult)}
              renderItem={(item) => <ItemForFilter data={item}  />}
              style={{
                  paddingTop: 10,
                  paddingLeft: '10%',
                  paddingRight: '5%',
                  display: 'flex',
                  // flexDirection:'row'
              }}
            /> */}

            <TouchableOpacity
              style={{
                backgroundColor: 'green',
              }}
              onPress={() => {
                LawFilterContent(choosenLaw, SearchResult);
                let timeOut = setTimeout(() => {
                  setShowFilter(false);
                  return () => {};
                }, 500);
                // setChoosenLaw(Object.keys(LawFilted))
                Animated.timing(animated, {
                  toValue: !showFilter ? 100 : 0,
                  easing: Easing.in,
                  duration: 300,
                  useNativeDriver: false,
                }).start();
                // if(checkedAllFilter){
                //   setLawFilted(false)
                // }
                setPaper(1);
                if (FlatListToScroll.current) {
                  FlatListToScroll.current.scrollToOffset({offset: 0});
                }
              }}>
              <Text
                style={{
                  paddingBottom: 10,
                  paddingTop: 10,
                  textAlign: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 16,
                }}>
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
    backgroundColor: 'black',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    // right: 5,
  },
  inputBtbText: {
    color: '#f67c1a',
    fontWeight: 'bold',
    fontSize: 20,
  },
  // content: {
  //   height: 0,
  //   display: 'flex',
  //   position: 'relative',
  //   margin: 0,
  //   overflow: 'hidden',
  // },
  item: {
    minHeight: 80,
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
