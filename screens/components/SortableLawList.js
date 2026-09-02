import React, { forwardRef, memo, useImperativeHandle } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { scrollTo, runOnUI } from 'react-native-reanimated';
import { ScrollView } from 'react-native-gesture-handler';
import { DropProvider, SortableDirection } from 'react-native-reanimated-dnd';
import { useSortableListSmooth } from './useSortableListSmooth';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

// Bản thay thế cho <Sortable> (chiều dọc, useFlatList=false) của
// react-native-reanimated-dnd. Ba khác biệt, tất cả đều nhằm cuộn mượt:
//
// 1. Dùng useSortableListSmooth thay useSortableList: không còn gọi scrollTo()
//    ở mỗi frame cuộn tay (xem giải thích trong useSortableListSmooth.js).
// 2. KHÔNG bọc GestureHandlerRootView nữa. App.js đã bọc ở root; lồng thêm một
//    root nữa tách các gesture handler bên trong sang một "root" riêng, khiến
//    ScrollView (NativeViewGestureHandler) và Pan của từng card phải phối hợp
//    chéo root -> chạm/vuốt phản hồi chậm hơn.
// 3. Bỏ simultaneousHandlers={dropProviderRef}: dropProviderRef KHÔNG phải ref
//    của gesture handler (nó chỉ có requestPositionUpdate/getDroppedItems), nên
//    prop này vô nghĩa — bản gốc truyền nhầm.
//
// Vẫn expose ref.scrollToOffset dùng Reanimated scrollTo(animated=true) để
// nhấn lần 2 vào tab "Đã tải xuống" cuộn lên đầu MƯỢT.
export const SortableLawList = memo(
  forwardRef(function SortableLawList(
    {
      data,
      renderItem,
      itemHeight,
      estimatedItemHeight = 60,
      itemKeyExtractor,
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
    } = useSortableListSmooth({
      data,
      itemHeight,
      estimatedItemHeight,
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
