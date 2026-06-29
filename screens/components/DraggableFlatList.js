/**
 * DraggableFlatList — thay thế react-native-draggable-flatlist
 * Yêu cầu: react-native-gesture-handler ^3.x, react-native-reanimated ^4.x
 *
 * Kiến trúc "floating" (mượt, không giật):
 *  - Kích hoạt kéo bằng gesture trên TỪNG cell (LongPress + Pan) -> onUpdate
 *    bắn ổn định kể cả khi item là TouchableOpacity.
 *  - Item đang kéo TRÔI theo ngón tay bằng translateY (UI-thread, bám 1:1).
 *  - Các item khác NHƯỜNG CHỖ bằng withSpring.
 *  - KHÔNG reorder dữ liệu khi kéo -> không re-render -> không nhảy/giật.
 *    Chỉ ghi thứ tự MỘT lần khi thả (onDragEnd).
 *  - Khi kéo tắt scroll FlatList; tới mép thì auto-scroll bằng scrollToOffset.
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  useAnimatedRef,
  useAnimatedScrollHandler,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

import { useTabBarHeight } from '../../hooks/useTabBarHeight';

const SPRING = { damping: 24, stiffness: 260, mass: 0.5 };
const NOOP = () => {};

const DragContext = createContext({ isActive: false });

export const ScaleDecorator = ({ children, activeScale = 1.04 }) => {
  const { isActive } = useContext(DragContext);
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withSpring(isActive ? activeScale : 1, {
      damping: 15,
      stiffness: 200,
    });
  }, [isActive]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
};

/* ------------------------------------------------------------------ */
/* Cell                                                                */
/* ------------------------------------------------------------------ */
const DragCell = React.memo(function DragCell({
  item,
  index,
  isActive,
  renderItem,
  gesture,
  onLayoutHeight,
  activeIndexSV,
  hoverIndexSV,
  transYSV,
  heightsSV,
}) {
  const style = useAnimatedStyle(() => {
    const a = activeIndexSV.value;

    // Item đang kéo: bám theo ngón tay (không spring)
    if (a === index) {
      return {
        transform: [{ translateY: transYSV.value }],
        zIndex: 999,
        elevation: 8,
      };
    }

    // Không kéo gì -> nằm yên
    if (a === -1) {
      return {
        transform: [{ translateY: withSpring(0, SPRING) }],
        zIndex: 0,
        elevation: 0,
      };
    }

    // Item khác nhường chỗ
    const h = heightsSV.value[a] ?? 0;
    const hv = hoverIndexSV.value;
    let shift = 0;
    if (index > a && index <= hv) shift = -h;
    else if (index < a && index >= hv) shift = h;

    return {
      transform: [{ translateY: withSpring(shift, SPRING) }],
      zIndex: 0,
      elevation: 0,
    };
  });

  return (
    <Animated.View
      style={style}
      onLayout={e => onLayoutHeight(index, e.nativeEvent.layout.height)}
    >
      <GestureDetector gesture={gesture}>
        <View>
          <DragContext.Provider value={{ isActive }}>
            {renderItem({ item, index, drag: NOOP, isActive, getIndex: () => index })}
          </DragContext.Provider>
        </View>
      </GestureDetector>
    </Animated.View>
  );
});

/* ------------------------------------------------------------------ */
/* DraggableFlatList                                                    */
/* ------------------------------------------------------------------ */
const DraggableFlatList = forwardRef(function DraggableFlatList(
  {
    data,
    renderItem,
    keyExtractor,
    onDragEnd,
    onDragBegin,
    enabled = true,
    longPressDuration = 250,
    containerStyle,
    contentContainerStyle,
    itemHeight: itemHeightProp = 100,
    autoscrollThreshold = 80,
    autoscrollSpeed = 8,
    onScrollBeginDrag,
    ...rest
  },
  forwardedRef,
) {
  const [localData, setLocalData] = useState(data);
  // activeIndex (state) chỉ đổi 2 lần / lần kéo -> không re-render mỗi frame
  const [activeIndex, setActiveIndex] = useState(-1);
  const tabBarHeight = useTabBarHeight();

  // --- refs (JS) ---
  const localDataRef = useRef(localData);
  const heightsRef = useRef([]);
  const containerRef = useRef(null);
  const rafId = useRef(null);

  // --- shared values (UI) ---
  const listRef = useAnimatedRef();
  const activeIndexSV = useSharedValue(-1);
  const fingerAbsYSV = useSharedValue(0);
  const dragStartFingerYSV = useSharedValue(0);
  const dragStartScrollSV = useSharedValue(0);
  const scrollYSV = useSharedValue(0);
  const listTopSV = useSharedValue(0);
  const listHeightSV = useSharedValue(0);
  const heightsSV = useSharedValue([]);
  const offsetsSV = useSharedValue([]);
  const draggingSV = useSharedValue(false);

  // Độ dịch của item đang kéo (content coords) = ngón tay dịch + scroll dịch.
  const transYSV = useDerivedValue(() => {
    if (activeIndexSV.value === -1) return 0;
    return (
      fingerAbsYSV.value -
      dragStartFingerYSV.value +
      (scrollYSV.value - dragStartScrollSV.value)
    );
  });

  // Slot ngón tay đang nằm.
  const hoverIndexSV = useDerivedValue(() => {
    const a = activeIndexSV.value;
    if (a === -1) return -1;
    const hs = heightsSV.value;
    const offs = offsetsSV.value;
    const center = (offs[a] ?? 0) + (hs[a] ?? 0) / 2 + transYSV.value;
    let hi = offs.length - 1;
    for (let j = 0; j < offs.length; j++) {
      const mid = (offs[j] ?? 0) + (hs[j] ?? 0) / 2;
      if (center < mid) {
        hi = j;
        break;
      }
    }
    return hi;
  });

  useImperativeHandle(
    forwardedRef,
    () => ({
      scrollToOffset: p => listRef.current?.scrollToOffset(p),
      scrollToEnd: p => listRef.current?.scrollToEnd(p),
      getNode: () => listRef.current,
    }),
    [],
  );

  // Đồng bộ data từ props (chỉ khi không kéo)
  useEffect(() => {
    if (activeIndexSV.value === -1) {
      localDataRef.current = data;
      heightsRef.current = [];
      setLocalData(data);
    }
  }, [data]);

  const rebuildOffsets = useCallback(() => {
    const hs = heightsRef.current;
    const n = localDataRef.current.length;
    const offs = [];
    let acc = 0;
    for (let i = 0; i < n; i++) {
      offs[i] = acc;
      acc += hs[i] ?? itemHeightProp;
    }
    offsetsSV.value = offs;
    heightsSV.value = hs.slice();
  }, [itemHeightProp]);

  useEffect(() => {
    localDataRef.current = localData;
    rebuildOffsets();
  }, [localData, rebuildOffsets]);

  const setItemHeight = useCallback(
    (index, h) => {
      if (heightsRef.current[index] === h) return;
      heightsRef.current[index] = h;
      rebuildOffsets();
    },
    [rebuildOffsets],
  );

  const measureList = useCallback(() => {
    containerRef.current?.measureInWindow((x, y, w, h) => {
      if (typeof y === 'number') listTopSV.value = y;
      if (h) listHeightSV.value = h;
    });
  }, []);

  // --- autoscroll (JS rAF) ---
  const autoScrollStep = useCallback(() => {
    if (!draggingSV.value) return;
    const finger = fingerAbsYSV.value;
    const top = listTopSV.value;
    const bottom = top + listHeightSV.value;
    let next = null;
    if (finger < top + autoscrollThreshold) next = scrollYSV.value - autoscrollSpeed;
    else if (finger > bottom - autoscrollThreshold)
      next = scrollYSV.value + autoscrollSpeed;
    if (next != null) {
      next = Math.max(0, next);
      listRef.current?.scrollToOffset({ offset: next, animated: false });
    }
    rafId.current = requestAnimationFrame(autoScrollStep);
  }, [autoscrollThreshold, autoscrollSpeed]);

  const stopAutoScroll = useCallback(() => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
  }, []);

  // --- phần JS khi bắt đầu / kết thúc kéo ---
  const onDragStartedJS = useCallback(
    index => {
      measureList();
      rebuildOffsets();
      setActiveIndex(index);
      onDragBegin?.(index);
      stopAutoScroll();
      rafId.current = requestAnimationFrame(autoScrollStep);
    },
    [measureList, rebuildOffsets, onDragBegin, autoScrollStep, stopAutoScroll],
  );

  const endDrag = useCallback(() => {
    if (!draggingSV.value) return;
    stopAutoScroll();
    const from = activeIndexSV.value;
    const to = hoverIndexSV.value;
    draggingSV.value = false;
    activeIndexSV.value = -1;
    setActiveIndex(-1);

    if (from >= 0 && to >= 0 && from !== to) {
      const nd = [...localDataRef.current];
      const [moved] = nd.splice(from, 1);
      nd.splice(to, 0, moved);

      const nh = [...heightsRef.current];
      const [mh] = nh.splice(from, 1);
      nh.splice(to, 0, mh);
      heightsRef.current = nh;

      localDataRef.current = nd;
      setLocalData(nd);
      onDragEnd?.({ data: nd, from, to });
    }
  }, [stopAutoScroll, onDragEnd]);

  // Giữ handler mới nhất trong ref -> gesture (cache) luôn gọi đúng bản mới.
  const startRef = useRef(onDragStartedJS);
  startRef.current = onDragStartedJS;
  const endRef = useRef(endDrag);
  endRef.current = endDrag;
  const invokeStart = useCallback(index => startRef.current(index), []);
  const invokeEnd = useCallback(() => endRef.current(), []);

  // --- cache gesture theo INDEX (object ổn định qua re-render) ---
  const gestureCache = useRef(new Map());
  useEffect(() => {
    gestureCache.current.clear();
  }, [enabled]);

  const getGesture = useCallback(
    index => {
      const cache = gestureCache.current;
      let g = cache.get(index);
      if (!g) {
        const longPress = Gesture.LongPress()
          .enabled(enabled)
          .minDuration(longPressDuration)
          .maxDistance(40)
          .onStart(e => {
            'worklet';
            if (draggingSV.value) return;
            dragStartFingerYSV.value = e.absoluteY;
            fingerAbsYSV.value = e.absoluteY;
            dragStartScrollSV.value = scrollYSV.value;
            activeIndexSV.value = index;
            draggingSV.value = true;
            runOnJS(invokeStart)(index);
          });

        const pan = Gesture.Pan()
          .enabled(enabled)
          .activateAfterLongPress(longPressDuration)
          .onUpdate(e => {
            'worklet';
            fingerAbsYSV.value = e.absoluteY;
          })
          .onFinalize(() => {
            'worklet';
            if (draggingSV.value) runOnJS(invokeEnd)();
          });

        g = Gesture.Simultaneous(longPress, pan);
        cache.set(index, g);
      }
      return g;
    },
    [enabled, longPressDuration, invokeStart, invokeEnd],
  );

  const scrollHandler = useAnimatedScrollHandler(e => {
    scrollYSV.value = e.contentOffset.y;
  });

  const renderCell = useCallback(
    ({ item, index }) => (
      <DragCell
        item={item}
        index={index}
        isActive={activeIndex === index}
        renderItem={renderItem}
        gesture={getGesture(index)}
        onLayoutHeight={setItemHeight}
        activeIndexSV={activeIndexSV}
        hoverIndexSV={hoverIndexSV}
        transYSV={transYSV}
        heightsSV={heightsSV}
      />
    ),
    [activeIndex, renderItem, getGesture, setItemHeight],
  );

  return (
    <GestureHandlerRootView style={[styles.root, containerStyle]}>
      <View
        ref={containerRef}
        style={{ flex: 1 }}
        onLayout={e => {
          listHeightSV.value = e.nativeEvent.layout.height;
          measureList();
        }}
      >
        <Animated.FlatList
          ref={listRef}
          data={localData}
          renderItem={renderCell}
          keyExtractor={keyExtractor}
          onScroll={scrollHandler}
          onScrollBeginDrag={onScrollBeginDrag}
          scrollEventThrottle={16}
          scrollEnabled={activeIndex === -1}
          removeClippedSubviews={false}
          windowSize={21}
          contentContainerStyle={contentContainerStyle}
          ListFooterComponent={
            <View style={{ height: tabBarHeight, width: '100%' }} />
          }
          {...rest}
        />
      </View>
    </GestureHandlerRootView>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default DraggableFlatList;
