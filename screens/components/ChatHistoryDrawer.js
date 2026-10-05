import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DRAWER_WIDTH = Math.min(
  300,
  Math.round(Dimensions.get('window').width * 0.76),
);
const OPEN_MS = 240;

const pad2 = n => String(n).padStart(2, '0');
const formatWhen = ms => {
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};

// Bỏ dấu + thường hoá để tìm "luat" ra "Luật".
const fold = str =>
  String(str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

// Drawer bên trái của Chat AI (giống app Claude): gói đăng ký + lịch sử hỏi.
// Dùng Modal trong suốt để phủ cả thanh tab; tự trượt bằng Animated.
export const ChatHistoryDrawer = memo(function ChatHistoryDrawer({
  visible,
  onClose,
  isPremium,
  planLabel,
  expiryDate,
  trialRemaining,
  trialTotal,
  onUpgrade,
  history,
  activeId,
  onSelect,
  onDelete,
  onNewChat,
}) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  // + thanh trạng thái / điều hướng: Modal trong suốt vẽ tràn cả hai.
  const screenSize = { width: winW, height: winH + 200 };
  // Giữ Modal mở tới khi animation đóng chạy xong.
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current; // 0 đóng, 1 mở
  const dragX = useRef(new Animated.Value(0)).current; // <= 0 khi vuốt đóng
  const [query, setQuery] = useState('');

  // Lọc lịch sử theo tiêu đề + nội dung tin nhắn.
  const filtered = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return history;
    return history.filter(
      c =>
        fold(c.title).includes(q) ||
        (c.messages || []).some(m => fold(m.text).includes(q)),
    );
  }, [history, query]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      dragX.setValue(0);
      setQuery('');
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: OPEN_MS - 40,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Vuốt sang trái để đóng.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_e, g) => dragX.setValue(Math.min(0, g.dx)),
      onPanResponderRelease: (_e, g) => {
        if (g.dx < -DRAWER_WIDTH / 3 || g.vx < -0.5) {
          onCloseRef.current?.();
        } else {
          Animated.spring(dragX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
      onPanResponderTerminate: () =>
        Animated.spring(dragX, { toValue: 0, useNativeDriver: true }).start(),
    }),
  ).current;

  if (!mounted) return null;

  // Modal là một cửa sổ riêng: trên Android insets.top ở đây có thể thiếu
  // thanh trạng thái -> lấy chiều cao thanh trạng thái làm mức tối thiểu.
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  );

  const translateX = Animated.add(
    progress.interpolate({
      inputRange: [0, 1],
      outputRange: [-DRAWER_WIDTH, 0],
    }),
    dragX,
  );
  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.2],
  });

  const renderItem = ({ item }) => {
    const active = item.id === activeId;
    return (
      <TouchableOpacity
        style={[styles.histItem, active && styles.histItemActive]}
        activeOpacity={0.7}
        onPress={() => onSelect?.(item)}
        onLongPress={() => onDelete?.(item)}
        delayLongPress={350}
      >
        <Text style={styles.histTitle} numberOfLines={1}>
          {item.title || 'Cuộc trò chuyện'}
        </Text>
        <Text style={styles.histWhen}>{formatWhen(item.updatedAt)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* Nền mờ (chỉ để nhìn) + lớp chạm trong suốt phủ cả màn hình: chạm vào
          phần bên cạnh drawer là đóng. Kích thước ghi rõ theo màn hình: view gốc
          của Modal (Android) không có bề ngang nên absoluteFill ra 0. */}
      <Animated.View
        pointerEvents="none"
        collapsable={false}
        style={[styles.backdrop, screenSize, { opacity: backdropOpacity }]}
      />
      <Pressable style={[styles.touchLayer, screenSize]} onPress={onClose} />

      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.panel,
          {
            width: DRAWER_WIDTH,
            paddingTop: topInset + 12,
            paddingBottom: insets.bottom + 10,
            transform: [{ translateX }],
          },
        ]}
      >
        {/* Đầu drawer: tên trợ lý + gói đăng ký */}
        <View style={styles.header}>
          <View style={styles.brandIcon}>
            <Ionicons name="sparkles" size={15} color="#fff" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.brandName}>Trợ lý Luật AI</Text>
            {isPremium ? (
              <View style={styles.planLine}>
                <Ionicons name="diamond" size={11} color="#FFD479" />
                <Text style={styles.planPremium} numberOfLines={1}>
                  Premium{planLabel ? ` · ${planLabel}` : ''}
                </Text>
              </View>
            ) : (
              <Text style={styles.planFree} numberOfLines={1}>
                Bản Free
                {trialRemaining > 0
                  ? ` · còn ${trialRemaining}/${trialTotal} lượt thử`
                  : ''}
              </Text>
            )}
          </View>
        </View>

        {isPremium ? (
          expiryDate ? (
            <View style={styles.expiryRow}>
              <Ionicons name="calendar-outline" size={14} color="#A0A0C0" />
              <Text style={styles.expiryText}>
                Kết thúc chu kỳ:{' '}
                <Text style={styles.expiryDate}>
                  {expiryDate.toLocaleDateString('vi-VN')}
                </Text>
              </Text>
            </View>
          ) : null
        ) : (
          <TouchableOpacity
            style={styles.upgradeBtn}
            activeOpacity={0.85}
            onPress={onUpgrade}
          >
            <Ionicons name="sparkles" size={14} color="#fff" />
            <Text style={styles.upgradeText}>Nâng cấp Premium</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.newChatBtn}
          activeOpacity={0.75}
          onPress={onNewChat}
        >
          <Ionicons name="create-outline" size={18} color="#C8C4FF" />
          <Text style={styles.newChatText}>Cuộc trò chuyện mới</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        {history.length ? (
          <View style={styles.searchBox}>
            <Ionicons name="search" size={15} color="#6A6A88" />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Tìm trong lịch sử"
              placeholderTextColor="#5E5E7C"
              returnKeyType="search"
              autoCorrect={false}
            />
            {query ? (
              <TouchableOpacity
                onPress={() => setQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={16} color="#6A6A88" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.sectionLabel}>Gần đây</Text>
        {filtered.length ? (
          <FlatList
            style={styles.list}
            data={filtered}
            keyboardShouldPersistTaps="handled"
            keyExtractor={c => c.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12 }}
          />
        ) : (
          <Text style={styles.emptyText}>
            {history.length ? 'Không tìm thấy.' : 'Chưa có câu hỏi nào.'}
          </Text>
        )}
      </Animated.View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  // Nền trắng đục (không dùng đen) để drawer tối nổi bật hơn.
  backdrop: { position: 'absolute', top: 0, left: 0, backgroundColor: '#fff' },
  touchLayer: { position: 'absolute', top: 0, left: 0 },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#12121C',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#2A2A44',
    paddingHorizontal: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, gap: 2 },
  brandName: { color: '#F0F0FA', fontSize: 16, fontWeight: '700' },
  planLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  planPremium: { color: '#FFD479', fontSize: 12.5, fontWeight: '600' },
  planFree: { color: '#8A8AA8', fontSize: 12.5 },
  expiryRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1A1A2E',
  },
  expiryText: { color: '#A0A0C0', fontSize: 13 },
  expiryDate: { color: '#F0F0FA', fontWeight: '700' },
  upgradeBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    paddingVertical: 10,
  },
  upgradeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  newChatBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2E2E4A',
  },
  newChatText: { color: '#E0E0F4', fontSize: 14.5, fontWeight: '600' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#2A2A44',
    marginTop: 16,
  },
  searchBox: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#1A1A2E',
  },
  searchInput: {
    flex: 1,
    color: '#E0E0F4',
    fontSize: 14,
    paddingVertical: 0,
  },
  sectionLabel: {
    marginTop: 14,
    marginBottom: 4,
    marginLeft: 4,
    color: '#6A6A88',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  list: { flex: 1 },
  histItem: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 2,
  },
  histItemActive: { backgroundColor: '#22223A' },
  histTitle: { color: '#E0E0F4', fontSize: 14.5 },
  histWhen: { color: '#5E5E7C', fontSize: 11.5 },
  emptyText: { color: '#6A6A88', fontSize: 13.5, marginLeft: 4, marginTop: 6 },
});
