import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Pressable, StyleSheet, Vibration, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  makeMutable,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Ionicons from '@react-native-vector-icons/ionicons';
import { Text } from '../../theme';

// Vuốt ngang trên card — kiểu danh sách tin nhắn / cuộc gọi:
//   Vuốt TRÁI (xoá):
//     - vuốt ngắn rồi thả  -> card dừng lại, lộ nút thùng rác đỏ bên phải;
//                             chạm nút để xoá, chạm card / vuốt phải để đóng.
//     - vuốt quá nửa card  -> thùng rác bám theo mép card + rung nhẹ;
//                             thả tay là card trượt hẳn ra ngoài và bị xoá.
//   Vuốt PHẢI (đổi màu, khi có onSwipeRight):
//     - lộ nền tím + biểu tượng bảng màu bên trái; vuốt qua RIGHT_TRIGGER thì
//       rung nhẹ, thả tay là card trượt về và mở bảng chọn màu.
//     - chưa tới ngưỡng thì chỉ trượt về.
// Cử chỉ chỉ nhận khi vuốt NGANG (failOffsetY) nên không cản cuộn dọc, và
// kích hoạt ngay khi di chuyển nên không đụng nhấn-giữ-để-kéo-sắp-xếp.

const REVEAL = 88; // bề rộng nút thùng rác khi dừng ở trạng thái mở
const RIGHT_TRIGGER = 96; // vuốt phải quá chừng này rồi thả -> mở bảng màu
const SPRING = { damping: 20, stiffness: 220, mass: 0.6 };

const SIDE_NONE = 0;
const SIDE_DELETE = -1; // nền đỏ bên phải
const SIDE_COLOR = 1; // nền tím bên trái

// true trong lúc card đang được NHẤN-GIỮ-KÉO để sắp xếp (Home bật/tắt qua
// onDragStart/onDrop). Hai cử chỉ được nhận song song (xem gestureRef) nên phải
// khoá vuốt lúc đang kéo, kẻo kéo chéo lại thành xoá / đổi màu.
export const swipeDragLock = makeMutable(false);

// Chỉ một card được mở tại một thời điểm.
let closeOpened = null;
export function closeOpenSwipe() {
  if (closeOpened) closeOpened();
}

// gestureRef: ref gắn vào cử chỉ vuốt. Card nằm trong SortableItem — pan
// nhấn-giữ-kéo của thư viện ở ngoài sẽ chặn mất cử chỉ vuốt nếu không khai báo
// nhận song song; Home truyền cùng ref này cho SortableItem
// (simultaneousWithGesture, thêm bằng patches/react-native-reanimated-dnd).
// holdBlockMs: nếu ngón tay đứng yên lâu hơn chừng này rồi mới vuốt ngang thì
// coi là NHẤN-GIỮ-KÉO để sắp xếp (pan của thư viện kích hoạt sau 200ms), bỏ
// qua vuốt. Xét ngay trên UI thread nên không bị trễ như swipeDragLock
// (đi vòng qua JS) -> không có khung hình nền màu chớp lên rồi tắt.
export function SwipeToDelete({
  children,
  onDelete,
  onSwipeRight,
  enabled = true,
  gestureRef,
  holdBlockMs,
}) {
  const tx = useSharedValue(0);
  const startX = useSharedValue(0);
  const width = useSharedValue(0);
  const armed = useSharedValue(false); // vuốt trái quá ngưỡng xoá
  const armedRight = useSharedValue(false); // vuốt phải quá ngưỡng đổi màu
  const beganAt = useSharedValue(0); // lúc chạm xuống
  const blocked = useSharedValue(false); // lần chạm này là kéo-sắp-xếp, không phải vuốt
  const sideSV = useSharedValue(SIDE_NONE); // bản UI-thread của `side`
  const hasRight = !!onSwipeRight;
  const [open, setOpen] = useState(false);
  // Nền (đỏ / tím) CHỈ được vẽ khi card đang lệch khỏi chỗ cũ. Nếu để nó luôn
  // nằm sau card và ẩn bằng opacity, nhấn giữ để kéo thì card
  // (TouchableOpacity) mờ đi + thư viện kéo-thả render lại => card chớp màu.
  const [side, setSide] = useState(SIDE_NONE);
  const mounted = useRef(true);

  const applySide = useCallback(s => {
    if (mounted.current) setSide(s);
  }, []);

  // Trượt card về 0 rồi mới gỡ nền (gỡ sớm thì đoạn đang trượt lộ nền trắng).
  const springHome = useCallback(() => {
    'worklet';
    tx.value = withSpring(0, SPRING, done => {
      if (done) {
        sideSV.value = SIDE_NONE;
        scheduleOnRN(applySide, SIDE_NONE);
      }
    });
  }, [tx, sideSV, applySide]);

  const close = useCallback(() => {
    springHome();
    setOpen(false);
  }, [springHome]);

  useEffect(
    () => () => {
      mounted.current = false;
      if (closeOpened === close) closeOpened = null;
    },
    [close],
  );

  const markOpen = useCallback(() => {
    if (closeOpened && closeOpened !== close) closeOpened();
    closeOpened = close;
    if (mounted.current) setOpen(true);
  }, [close]);

  const markClosed = useCallback(() => {
    if (closeOpened === close) closeOpened = null;
    if (mounted.current) setOpen(false);
  }, [close]);

  const buzz = useCallback(() => Vibration.vibrate(15), []);

  // Callback qua ref: prop đổi identity (arrow mới mỗi render) không làm tạo
  // lại cử chỉ.
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;
  const onSwipeRightRef = useRef(onSwipeRight);
  onSwipeRightRef.current = onSwipeRight;

  const doDelete = useCallback(() => {
    if (closeOpened === close) closeOpened = null;
    Vibration.vibrate(30);
    onDeleteRef.current?.();
  }, [close]);

  const doRight = useCallback(() => {
    onSwipeRightRef.current?.();
  }, []);

  // Card trượt hẳn sang trái rồi mới báo xoá (đỡ cảm giác "biến mất").
  const swipeOut = useCallback(() => {
    tx.value = withTiming(-(width.value || 400), { duration: 180 }, done => {
      if (done) scheduleOnRN(doDelete);
    });
  }, [tx, width, doDelete]);

  // useMemo: KHÔNG tạo cử chỉ mới mỗi lần render (setSide render lại ngay
  // giữa lúc đang vuốt).
  const pan = useMemo(() => {
    const isBlocked = () => {
      'worklet';
      return blocked.value || swipeDragLock.value;
    };
    let g = Gesture.Pan()
      .enabled(enabled)
      .activeOffsetX([-12, 12])
      .failOffsetY([-12, 12])
      .onBegin(() => {
        beganAt.value = Date.now();
        blocked.value = false;
      })
      .onStart(() => {
        startX.value = tx.value;
        if (holdBlockMs && Date.now() - beganAt.value > holdBlockMs) {
          blocked.value = true;
        }
      })
      .onUpdate(e => {
        if (isBlocked()) {
          tx.value = startX.value;
          return;
        }
        const w = width.value || 400;
        // Đang mở nút Xoá (startX < 0) thì vuốt phải chỉ để đóng, không lố
        // sang phía đổi màu.
        const maxRight = hasRight && startX.value >= 0 ? w * 0.4 : 0;
        const next = Math.min(
          maxRight,
          Math.max(-w, startX.value + e.translationX),
        );
        tx.value = next;

        // Chỉ vẽ nền khi card đã THẬT SỰ lệch; đổi phía thì đổi nền.
        const s =
          next < -1 ? SIDE_DELETE : next > 1 ? SIDE_COLOR : sideSV.value;
        if (s !== sideSV.value) {
          sideSV.value = s;
          scheduleOnRN(applySide, s);
        }

        const isArmed = -next > w * 0.5;
        if (isArmed !== armed.value) {
          armed.value = isArmed;
          if (isArmed) scheduleOnRN(buzz);
        }
        const isArmedRight = next > RIGHT_TRIGGER;
        if (isArmedRight !== armedRight.value) {
          armedRight.value = isArmedRight;
          if (isArmedRight) scheduleOnRN(buzz);
        }
      })
      .onEnd(e => {
        armed.value = false;
        armedRight.value = false;
        if (isBlocked()) return;
        const w = width.value || 400;
        const x = tx.value;

        if (x > 0) {
          // Vuốt phải: luôn trượt về; qua ngưỡng thì mở bảng màu.
          springHome();
          if (x > RIGHT_TRIGGER) scheduleOnRN(doRight);
          scheduleOnRN(markClosed);
          return;
        }

        const fling = e.velocityX < -1500 && -x > REVEAL;
        if (-x > w * 0.5 || fling) {
          tx.value = withTiming(-w, { duration: 160 }, done => {
            if (done) scheduleOnRN(doDelete);
          });
        } else if (-x > REVEAL / 2) {
          tx.value = withSpring(-REVEAL, SPRING);
          scheduleOnRN(markOpen);
        } else {
          springHome();
          scheduleOnRN(markClosed);
        }
      });
    if (gestureRef) g = g.withRef(gestureRef);
    return g;
  }, [
    enabled,
    gestureRef,
    holdBlockMs,
    hasRight,
    tx,
    startX,
    width,
    armed,
    armedRight,
    beganAt,
    blocked,
    sideSV,
    applySide,
    buzz,
    doDelete,
    doRight,
    markOpen,
    markClosed,
    springHome,
  ]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  // Vùng nút: rộng ít nhất REVEAL, vuốt sâu hơn thì giãn theo mép card
  // -> icon luôn nằm giữa khoảng trống vừa lộ ra.
  const deleteActionStyle = useAnimatedStyle(() => ({
    width: Math.max(REVEAL, -tx.value),
  }));
  const colorActionStyle = useAnimatedStyle(() => ({
    width: Math.max(REVEAL, tx.value),
  }));

  // Qua ngưỡng: icon to lên.
  const deleteIconStyle = useAnimatedStyle(() => {
    const w = width.value || 400;
    return {
      transform: [
        {
          scale: interpolate(
            -tx.value,
            [w * 0.45, w * 0.5],
            [1, 1.25],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });
  const colorIconStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          tx.value,
          [RIGHT_TRIGGER - 10, RIGHT_TRIGGER],
          [1, 1.25],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View
      onLayout={e => {
        width.value = e.nativeEvent.layout.width;
      }}
    >
      {side === SIDE_DELETE && (
        <View style={[StyleSheet.absoluteFill, styles.bgDelete]}>
          <Animated.View style={[styles.action, deleteActionStyle]}>
            <Pressable
              onPress={swipeOut}
              style={styles.actionPress}
              hitSlop={8}
            >
              <Animated.View style={[styles.actionInner, deleteIconStyle]}>
                <Ionicons name="trash" style={styles.icon} />
                <Text style={styles.label}>Xoá</Text>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </View>
      )}
      {side === SIDE_COLOR && (
        <View style={[StyleSheet.absoluteFill, styles.bgColor]}>
          <Animated.View style={[styles.action, colorActionStyle]}>
            <View style={styles.actionPress}>
              <Animated.View style={[styles.actionInner, colorIconStyle]}>
                <Ionicons name="color-palette" style={styles.icon} />
                <Text style={styles.label}>Màu</Text>
              </Animated.View>
            </View>
          </Animated.View>
        </View>
      )}

      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          {children}
          {/* Đang mở: chạm vào card thì chỉ đóng lại, không mở văn bản. */}
          {open && (
            <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  bgDelete: {
    backgroundColor: '#E5484D',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  bgColor: {
    backgroundColor: '#6C63FF',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  action: {
    height: '100%',
  },
  actionPress: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionInner: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
    color: '#FFFFFF',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 2,
  },
});
