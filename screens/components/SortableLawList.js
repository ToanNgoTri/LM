import React, { forwardRef, memo, useImperativeHandle } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { scrollTo, runOnUI } from 'react-native-reanimated';
import { GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import {
  DropProvider,
  SortableDirection,
  useSortableList,
} from 'react-native-reanimated-dnd';

const AnimatedScrollView = Animated.createAnimatedComponent(ScrollView);

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

    return (
      <GestureHandlerRootView style={styles.flex}>
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
            simultaneousHandlers={dropProviderRef}
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
      </GestureHandlerRootView>
    );
  }),
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollView: { flex: 1, position: 'relative', backgroundColor: 'white' },
});
