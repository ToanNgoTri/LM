import React, {
  forwardRef,
  memo,
  useImperativeHandle,
  useMemo,
} from 'react';
import { StyleSheet } from 'react-native';
import Animated, { scrollTo, runOnUI } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  DropProvider,
  SortableDirection,
  useSortableList,
} from 'react-native-reanimated-dnd';

// Dùng ScrollView gốc của React Native (không phải bản của gesture-handler),
// rồi khai báo nó với RNGH bằng Gesture.Native() ở dưới.
const AnimatedScrollView = Animated.ScrollView;

// Bản sao của <Sortable> gốc (chiều dọc, useFlatList=false) — render y hệt
// (cùng dùng useSortableList) và ĐƯỢC BỌC memo giống bản gốc để hiệu năng cuộn
// tay tương đương. Khác biệt duy nhất: expose ref có scrollToOffset dùng
// Reanimated scrollTo(animated=true) -> cuộn LÊN ĐẦU MƯỢT (bản gốc giấu
// scrollViewRef nên chỉ có thể remount = nhảy).
export const SortableLawList = memo(
  forwardRef(function SortableLawList(
    {
      data,
      renderItem,
      itemHeight,
      estimatedItemHeight = 60,
      itemKeyExtractor = item => item.id,
      enableDynamicHeights = false,
      onHeightsMeasured,
      style,
      contentContainerStyle,
    },
    ref,
  ) {
    const {
      scrollViewRef,
      dropProviderRef,
      handleScroll,
      handleScrollEnd,
      contentHeight,
      getItemProps,
    } = useSortableList({
      data,
      itemHeight,
      enableDynamicHeights,
      estimatedItemHeight,
      onHeightsMeasured,
      itemKeyExtractor,
    });

    // Khai báo cuộn native của ScrollView thành một gesture mà RNGH biết tới.
    // Các Gesture.Pan của item sẽ chạy ĐỒNG THỜI với nó (xem scrollGesture
    // truyền xuống dưới), nhờ vậy orchestrator không gửi ACTION_CANCEL xuống
    // ScrollView khi Pan chưa/không kích hoạt -> ScrollView vẫn nhận ACTION_UP
    // -> Android khởi động fling bình thường.
    const scrollGesture = useMemo(() => Gesture.Native(), []);

    useImperativeHandle(
      ref,
      () => ({
        scrollToOffset: ({ offset = 0 } = {}) => {
          // Cuộn mượt trên UI thread (animated = true).
          runOnUI(() => {
            'worklet';
            scrollTo(scrollViewRef, 0, offset, true);
          })();
        },
      }),
      [scrollViewRef],
    );

    // KHÔNG bọc GestureHandlerRootView ở đây: App.js đã có một cái ở root.
    // Trên Android mỗi root view là một GestureHandlerOrchestrator riêng, lồng
    // nhau khiến mọi MotionEvent phải đi qua 2 tầng khi cuộn.
    return (
      <DropProvider ref={dropProviderRef}>
        <GestureDetector gesture={scrollGesture}>
          <AnimatedScrollView
            ref={scrollViewRef}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            style={[styles.scrollView, style]}
            contentContainerStyle={[
              { height: contentHeight },
              contentContainerStyle,
            ]}
            // ===== LOG TẠM — xoá sau khi chẩn đoán xong =====
            onLayout={e =>
              console.log(
                `[SCROLL] viewport=${Math.round(
                  e.nativeEvent.layout.height,
                )} contentHeight=${Math.round(contentHeight)} scrollRange=${Math.round(
                  contentHeight - e.nativeEvent.layout.height,
                )}`,
              )
            }
            onScrollBeginDrag={() => console.log('[SCROLL] beginDrag')}
            onScrollEndDrag={e => {
              const v = e?.nativeEvent?.velocity;
              console.log(
                `[SCROLL] endDrag velocity=${v ? JSON.stringify(v) : 'undefined'}`,
              );
              handleScrollEnd();
            }}
            onMomentumScrollBegin={() =>
              console.log('[SCROLL] momentumBegin  <<< FLING KHỞI ĐỘNG')
            }
            onMomentumScrollEnd={() => {
              console.log('[SCROLL] momentumEnd');
              handleScrollEnd();
            }}
          >
            {data.map((item, index) => {
              const itemProps = getItemProps(item, index);
              return renderItem({
                item,
                index,
                direction: SortableDirection.Vertical,
                scrollGesture,
                ...itemProps,
              });
            })}
          </AnimatedScrollView>
        </GestureDetector>
      </DropProvider>
    );
  }),
);

const styles = StyleSheet.create({
  scrollView: { flex: 1, position: 'relative', backgroundColor: 'white' },
});
