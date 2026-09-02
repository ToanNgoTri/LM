import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';

// Giá trị ScrollDirection.None của react-native-reanimated-dnd (chuỗi 'none').
// Khai báo tại chỗ để worklet không phải bắt (capture) enum từ thư viện.
const AUTO_SCROLL_NONE = 'none';

const defaultKeyExtractor = item => item.id;

function listToObject(list, keyExtractor) {
  const object = {};
  for (let i = 0; i < list.length; i++) {
    object[keyExtractor(list[i], i)] = i;
  }
  return object;
}

function resolveItemHeight(itemHeight, item, index, fallback) {
  if (typeof itemHeight === 'number') return itemHeight;
  if (Array.isArray(itemHeight)) return itemHeight[index] ?? fallback;
  if (typeof itemHeight === 'function') return itemHeight(item, index);
  return fallback;
}

/**
 * Bản thay thế cho useSortableList() của react-native-reanimated-dnd.
 *
 * Vì sao phải tự viết: hook gốc chạy
 *
 *   useAnimatedReaction(() => scrollY.value,
 *                       y => scrollTo(scrollViewRef, 0, y, false));
 *
 * KHÔNG kèm điều kiện. scrollY được cập nhật từ chính onScroll, nên MỌI frame
 * cuộn tay đều gọi scrollTo() ép ScrollView về đúng vị trí nó vừa tới. Trên
 * Android, scrollTo() cắt ngang fling animator -> vuốt bị khựng, mất đà, cuộn
 * nhấp nhả. Đây là nguyên nhân chính khiến màn "Đã tải xuống" cuộn không mượt.
 *
 * scrollTo() chỉ THỰC SỰ cần khi đang KÉO item tới mép danh sách: lúc đó
 * useSortable() animate scrollY (lowerBound) bằng withTiming và ScrollView phải
 * chạy theo. Ở đây ta chặn lại đúng trường hợp đó (autoScroll !== 'none').
 *
 * Khác biệt còn lại so với bản gốc:
 * - contentHeight tính bằng useMemo thay vì useState -> đổi data không kéo theo
 *   một vòng setState/re-render thừa.
 * - Bỏ nhánh tự đo chiều cao (enableDynamicHeights). Home.js đã tự đo card ở
 *   lớp ẩn rồi truyền vào qua itemHeight dạng hàm, nên nhánh đó chỉ là mã chết.
 */
export function useSortableListSmooth({
  data,
  itemHeight,
  estimatedItemHeight = 60,
  itemKeyExtractor,
}) {
  const keyExtractor = useMemo(
    () => itemKeyExtractor ?? defaultKeyExtractor,
    [itemKeyExtractor],
  );

  const positions = useSharedValue(listToObject(data, keyExtractor));
  const scrollY = useSharedValue(0);
  const autoScroll = useSharedValue(AUTO_SCROLL_NONE);
  const scrollViewRef = useAnimatedRef();
  const dropProviderRef = useRef(null);

  const isFixedHeight = typeof itemHeight === 'number';

  // Bảng chiều cao theo id + tổng chiều cao nội dung.
  const { heights, contentHeight } = useMemo(() => {
    const map = {};
    let total = 0;
    data.forEach((item, index) => {
      const h = resolveItemHeight(
        itemHeight,
        item,
        index,
        estimatedItemHeight,
      );
      map[keyExtractor(item, index)] = h;
      total += h;
    });
    return { heights: map, contentHeight: total };
  }, [data, itemHeight, estimatedItemHeight, keyExtractor]);

  const itemHeightsSV = useSharedValue(heights);
  useEffect(() => {
    itemHeightsSV.value = heights;
  }, [heights, itemHeightsSV]);

  // Đồng bộ lại `positions` khi TẬP id (hoặc thứ tự nguồn) đổi.
  // Kéo-thả KHÔNG đổi thứ tự của prop `data` nên thao tác kéo không bị reset.
  const idsKey = useMemo(
    () => data.map((it, i) => keyExtractor(it, i)).join('|'),
    [data, keyExtractor],
  );
  const lastIdsKey = useRef(idsKey);
  useEffect(() => {
    if (idsKey === lastIdsKey.current) return;
    lastIdsKey.current = idsKey;
    positions.value = listToObject(data, keyExtractor);
  }, [idsKey, data, keyExtractor, positions]);

  // ✅ Chỉ lái ScrollView khi đang auto-scroll lúc kéo item.
  //    Cuộn tay -> không đụng vào scroll offset -> fling của Android chạy trọn vẹn.
  useAnimatedReaction(
    () => scrollY.value,
    y => {
      if (autoScroll.value === AUTO_SCROLL_NONE) return;
      scrollTo(scrollViewRef, 0, y, false);
    },
    [],
  );

  const handleScroll = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });

  // Sau khi cuộn xong, báo DropProvider đo lại vị trí các slot.
  // (Bản gốc khai báo biến timeout BÊN TRONG callback nên clearTimeout không bao
  //  giờ có tác dụng — mỗi lần cuộn lại xếp thêm một timer.)
  const scrollEndTimer = useRef(null);
  const handleScrollEnd = useCallback(() => {
    if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = setTimeout(() => {
      dropProviderRef.current?.requestPositionUpdate();
    }, 50);
  }, []);
  useEffect(
    () => () => {
      if (scrollEndTimer.current) clearTimeout(scrollEndTimer.current);
    },
    [],
  );

  const itemsCount = data.length;
  const getItemProps = useCallback(
    (item, index) => ({
      id: keyExtractor(item, index),
      positions,
      lowerBound: scrollY,
      autoScrollDirection: autoScroll,
      itemsCount,
      itemHeight: isFixedHeight ? itemHeight : undefined,
      isDynamicHeight: !isFixedHeight,
      estimatedItemHeight,
      itemHeights: isFixedHeight ? undefined : itemHeightsSV,
    }),
    [
      keyExtractor,
      positions,
      scrollY,
      autoScroll,
      itemsCount,
      isFixedHeight,
      itemHeight,
      estimatedItemHeight,
      itemHeightsSV,
    ],
  );

  return {
    positions,
    scrollY,
    autoScroll,
    scrollViewRef,
    dropProviderRef,
    handleScroll,
    handleScrollEnd,
    contentHeight,
    getItemProps,
  };
}
