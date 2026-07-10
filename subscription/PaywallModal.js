import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from './SubscriptionContext';

const BENEFITS = [
  'Dùng model AI trả phí, trả lời chính xác & sâu hơn',
  'Ưu tiên xử lý, hạn chế nghẽn khi hệ thống bận',
  'Câu trả lời dài và chi tiết hơn',
];

export const PaywallModal = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const { plans, buy, restore, purchasing, isPremium } = useSubscription();
  const [selected, setSelected] = useState('yearly');

  useEffect(() => {
    if (visible) setSelected('yearly');
  }, [visible]);

  // Khi mua thành công, isPremium chuyển true → tự đóng modal.
  useEffect(() => {
    if (visible && isPremium) onClose?.();
  }, [isPremium, visible, onClose]);

  const handleBuy = () => {
    const plan = plans.find(p => p.key === selected);
    if (plan) buy(plan.sku);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={22} color="#8A8AA8" />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.headerIcon}>
              <Ionicons name="sparkles" size={26} color="#fff" />
            </View>
            <Text style={styles.title}>Nâng cấp Premium</Text>
            <Text style={styles.subtitle}>
              Mở khoá model AI trả phí cho câu trả lời chất lượng hơn
            </Text>

            <View style={styles.benefits}>
              {BENEFITS.map((b, i) => (
                <View key={i} style={styles.benefitRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#22D3A0"
                  />
                  <Text style={styles.benefitText}>{b}</Text>
                </View>
              ))}
            </View>

            {plans.map(p => {
              const active = selected === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  activeOpacity={0.85}
                  style={[styles.planCard, active && styles.planCardActive]}
                  onPress={() => setSelected(p.key)}
                >
                  {p.highlight && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>TIẾT KIỆM</Text>
                    </View>
                  )}
                  <View style={styles.radioOuter}>
                    {active && <View style={styles.radioInner} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planTitle}>{p.title}</Text>
                    <Text style={styles.planNote}>{p.note}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.planPrice}>{p.displayPrice}</Text>
                    <Text style={styles.planPeriod}>{p.periodLabel}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[styles.buyBtn, purchasing && styles.buyBtnDisabled]}
              onPress={handleBuy}
              disabled={purchasing}
              activeOpacity={0.85}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buyBtnText}>
                  {isPremium ? 'Đang là Premium' : 'Tiếp tục thanh toán'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={restore} disabled={purchasing}>
              <Text style={styles.restoreText}>Khôi phục giao dịch đã mua</Text>
            </TouchableOpacity>

            <Text style={styles.legal}>
              Gói tự động gia hạn. Bạn có thể huỷ bất cứ lúc nào trong phần
              quản lý đăng ký của cửa hàng. Thanh toán sẽ được tính vào tài
              khoản cửa hàng của bạn.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#13131F',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2E2E48',
    alignSelf: 'center',
    marginBottom: 8,
  },
  closeBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
    zIndex: 10,
    padding: 4,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 8,
    shadowColor: '#6C63FF',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  title: {
    color: '#F0F0FA',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 14,
  },
  subtitle: {
    color: '#9A9AB8',
    fontSize: 13.5,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  benefits: { marginBottom: 18, gap: 10 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitText: { color: '#D0D0E8', fontSize: 14, flex: 1, lineHeight: 19 },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#252540',
    padding: 16,
    marginBottom: 12,
  },
  planCardActive: { borderColor: '#6C63FF', backgroundColor: '#1E1B3A' },
  badge: {
    position: 'absolute',
    top: -9,
    right: 16,
    backgroundColor: '#22D3A0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: { color: '#0D0D14', fontSize: 10, fontWeight: '800' },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#4A4A68',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#6C63FF',
  },
  planTitle: { color: '#F0F0FA', fontSize: 15.5, fontWeight: '700' },
  planNote: { color: '#8A8AA8', fontSize: 12, marginTop: 3 },
  planPrice: { color: '#F0F0FA', fontSize: 16, fontWeight: '800' },
  planPeriod: { color: '#8A8AA8', fontSize: 11, marginTop: 2 },
  buyBtn: {
    backgroundColor: '#6C63FF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: '#6C63FF',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  buyBtnDisabled: { opacity: 0.6 },
  buyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  restoreText: {
    color: '#8A8AA8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
    textDecorationLine: 'underline',
  },
  legal: {
    color: '#5A5A78',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});
