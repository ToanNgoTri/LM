import React, { forwardRef, memo, useImperativeHandle } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { scrollTo, runOnUI } from 'react-native-reanimated';
import {
  DropProvider,
  SortableDirection,
  useSortableList,
} from 'react-native-reanimated-dnd';

// KHÔNG dùng ScrollView của react-native-gesture-handler.
// Bản RNGH bọc ScrollView trong NativeViewGestureHandler. Trên Android, khi
// nhấc tay mà các Gesture.Pan của item (activateAfterLongPress) phân giải thành
// failed, RNGH gửi ACTION_CANCEL xuống ScrollView thay vì ACTION_UP. Android chỉ
// khởi động fling ở ACTION_UP; gặp ACTION_CANCEL nó gọi endDrag() -> cuộn dừng
// ngay, mất quán tính. iOS không dính vì UIScrollView chạy pan recognizer riêng.
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
        <AnimatedScrollView
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={[styles.scrollView, style]}
          contentContainerStyle={[
            { height: contentHeight },
            contentContainerStyle,
          ]}
          onScrollEndDrag={handleScrollEnd}
          onMomentumScrollEnd={handleScrollEnd}
        >
          {data.map((item, index) => {
            const itemProps = getItemProps(item, index);
            return renderItem({
              item,
              index,
              direction: SortableDirection.Vertical,
              ...itemProps,
            });
          })}
        </AnimatedScrollView>
      </DropProvider>
    );
  }),
);

const styles = StyleSheet.create({
  scrollView: { flex: 1, position: 'relative', backgroundColor: 'white' },
});
