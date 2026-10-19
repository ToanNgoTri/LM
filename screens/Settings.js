// ── Màn Cài đặt (mở từ icon bánh răng góc trên trái Home) ──────────────────
// Giao diện sáng/tối, cỡ chữ toàn app, gói đăng ký, chính sách, phiên bản.
// Cỡ chữ khi đọc văn bản (Detail5) chỉnh riêng ngay trong màn đọc; khi chưa
// chỉnh riêng thì nó theo cỡ chữ toàn app ở đây.
import { useState } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import VersionCheck from 'react-native-version-check';
import {
  Text,
  useTheme,
  useThemedStyles,
  THEME_MODES,
  FONT_SCALES,
} from '../theme';
import { useSubscription } from '../subscription/SubscriptionContext';
import { PaywallModal } from '../subscription/PaywallModal';
import { PolicyParagraphs } from './components/PolicyContent';
import {
  MANAGE_SUBSCRIPTIONS_URL,
  PRIVACY_URL,
  TERMS_URL,
  compareVersion,
  openStore,
  openUrl,
} from '../utils/appInfo';

function Section({ title, children }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

// Một dòng bấm được trong card: icon - nhãn - (giá trị) - mũi tên.
function Row({ icon, label, value, onPress, last, chevron = 'chevron-forward' }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowDivider]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={20} color={colors.primaryText} />
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {onPress && chevron ? (
        <Ionicons name={chevron} size={18} color={colors.textMuted} />
      ) : null}
    </TouchableOpacity>
  );
}

// Nhóm nút chọn một (chế độ giao diện / cỡ chữ).
function Segmented({ options, selected, onSelect }) {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.segmented}>
      {options.map(o => {
        const active = o.key === selected;
        return (
          <TouchableOpacity
            key={o.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onSelect(o)}
            activeOpacity={0.8}
          >
            {o.icon ? (
              <Ionicons
                name={o.icon}
                size={18}
                color={active ? colors.onPrimary : colors.textSecondary}
              />
            ) : null}
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
              numberOfLines={1}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function formatDate(d) {
  if (!d) return '';
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Số ngày còn lại tính theo ngày lịch (hôm nay hết hạn -> 0).
function daysLeft(d) {
  const startOfDay = x => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  return Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
}

export function Settings() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(makeStyles);
  const { colors, mode, setMode, fontScale, setFontScale } = useTheme();
  const {
    iapAvailable,
    isPremium,
    planLabel,
    expiryDate,
    expiryEstimated,
    autoRenew,
    trialRemaining,
    trialTotal,
    trialLoaded,
    loading,
    ready,
    restore,
  } = useSubscription();

  const [showPaywall, setShowPaywall] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  // idle | checking | latest | outdated | error
  const [updateState, setUpdateState] = useState('idle');
  const [latestVersion, setLatestVersion] = useState('');

  const currentVersion = VersionCheck.getCurrentVersion();
  const scaleKey =
    FONT_SCALES.find(s => s.value === fontScale)?.key ?? 'normal';

  const checkUpdate = async () => {
    setUpdateState('checking');
    try {
      const latest = String((await VersionCheck.getLatestVersion()) || '');
      if (!latest) throw new Error('empty');
      setLatestVersion(latest);
      setUpdateState(
        compareVersion(currentVersion, latest) < 0 ? 'outdated' : 'latest',
      );
    } catch (e) {
      setUpdateState('error');
    }
  };

  const handleRestore = async () => {
    try {
      await restore();
      Alert.alert('Khôi phục giao dịch', 'Đã kiểm tra lại gói đăng ký của bạn.');
    } catch (e) {
      Alert.alert('Khôi phục giao dịch', e?.message || 'Đã có lỗi xảy ra.');
    }
  };

  const updateLabel = {
    idle: 'Kiểm tra cập nhật',
    checking: 'Đang kiểm tra...',
    latest: 'Đã là phiên bản mới nhất',
    outdated: `Có bản mới ${latestVersion} — Cập nhật`,
    error: 'Không kiểm tra được, thử lại',
  }[updateState];

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={colors.onPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cài đặt</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Section title="GIAO DIỆN">
          <View style={styles.cardPad}>
            <Segmented
              options={THEME_MODES}
              selected={mode}
              onSelect={o => setMode(o.key)}
            />
          </View>
        </Section>

        <Section title="CỠ CHỮ">
          <View style={styles.cardPad}>
            <Segmented
              options={FONT_SCALES}
              selected={scaleKey}
              onSelect={o => setFontScale(o.value)}
            />
            <Text style={styles.preview}>
              Điều 1. Phạm vi điều chỉnh — chữ mẫu theo cỡ đang chọn.
            </Text>
            <Text style={styles.hint}>
              Áp dụng cho toàn ứng dụng. Cỡ chữ nội dung văn bản có thể chỉnh
              riêng trong màn đọc văn bản (nút Aa).
            </Text>
          </View>
        </Section>

        <Section title="GÓI ĐĂNG KÝ">
          <View style={[styles.cardPad, styles.planBox]}>
            <View
              style={[
                styles.planIcon,
                { backgroundColor: isPremium ? colors.accent : colors.cardAlt },
              ]}
            >
              <Ionicons
                name="sparkles"
                size={20}
                color={isPremium ? colors.onAccent : colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.planTitle}>
                {isPremium ? `Premium · ${planLabel}` : 'Gói miễn phí'}
              </Text>
              <Text style={styles.planSub}>
                {isPremium
                  ? 'Đang hoạt động'
                  : trialLoaded
                  ? `Còn ${trialRemaining}/${trialTotal} lượt dùng thử AI Premium`
                  : ' '}
              </Text>
            </View>
            {loading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : null}
          </View>
          {iapAvailable && !ready && !loading && (
            <Text style={[styles.hint, styles.storeOffline]}>
              Chưa kết nối được cửa hàng ứng dụng nên chưa thể kiểm tra/mua gói.
              Kiểm tra mạng hoặc tài khoản Google Play/App Store rồi mở lại app.
            </Text>
          )}
          {isPremium && expiryDate && (
            <View style={[styles.cardPad, styles.expiryBox]}>
              <Text style={styles.expiryLabel}>
                {autoRenew === false
                  ? 'Đã huỷ gia hạn · Premium kết thúc vào'
                  : 'Thời hạn Premium đến hết ngày'}
              </Text>
              <Text style={styles.expiryDate}>
                {formatDate(expiryDate)}
                <Text style={styles.expiryDays}>
                  {'  '}(còn {Math.max(0, daysLeft(expiryDate))} ngày)
                </Text>
              </Text>
              <Text style={styles.hint}>
                {autoRenew === true
                  ? 'Gói sẽ tự động gia hạn vào ngày này nếu bạn không huỷ.'
                  : autoRenew === false
                  ? 'Sau ngày này app trở về gói miễn phí. Có thể đăng ký lại bất cứ lúc nào.'
                  : ' '}
                {expiryEstimated
                  ? ' Ngày được tính từ ngày mua; ngày chính xác xem trong Google Play.'
                  : ''}
              </Text>
            </View>
          )}
          {!isPremium && (
            <Row
              icon="rocket-outline"
              label="Nâng cấp Premium"
              onPress={() => setShowPaywall(true)}
            />
          )}
          {isPremium && (
            <Row
              icon="card-outline"
              label="Quản lý / huỷ đăng ký"
              onPress={() => openUrl(MANAGE_SUBSCRIPTIONS_URL)}
              chevron="open-outline"
              last
            />
          )}
          {/* Đã là Premium thì không cần khôi phục nữa */}
          {!isPremium && (
            <Row
              icon="refresh-outline"
              label="Khôi phục giao dịch đã mua"
              onPress={iapAvailable ? handleRestore : undefined}
              last
            />
          )}
        </Section>

        <Section title="CHÍNH SÁCH">
          <Row
            icon="document-text-outline"
            label="Lời mở đầu"
            onPress={() => setShowPolicy(v => !v)}
            chevron={showPolicy ? 'chevron-up' : 'chevron-down'}
          />
          {showPolicy && (
            <View style={styles.policyBox}>
              <PolicyParagraphs />
            </View>
          )}
          <Row
            icon="reader-outline"
            label="Điều khoản sử dụng"
            onPress={() => openUrl(TERMS_URL)}
            chevron="open-outline"
          />
          <Row
            icon="shield-checkmark-outline"
            label="Chính sách bảo mật"
            onPress={() => openUrl(PRIVACY_URL)}
            chevron="open-outline"
            last
          />
        </Section>

        <Section title="PHIÊN BẢN">
          <Row
            icon="information-circle-outline"
            label="Phiên bản hiện tại"
            value={currentVersion}
          />
          <Row
            icon={
              updateState === 'outdated'
                ? 'cloud-download-outline'
                : 'sync-outline'
            }
            label={updateLabel}
            onPress={
              updateState === 'checking'
                ? undefined
                : updateState === 'outdated'
                ? openStore
                : checkUpdate
            }
            chevron={updateState === 'outdated' ? 'open-outline' : null}
            last
          />
        </Section>
      </ScrollView>

      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </View>
  );
}

const makeStyles = (c, isDark) => ({
  screen: { flex: 1, backgroundColor: c.bgAlt },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.primary,
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  backBtn: { width: 32, alignItems: 'center' },
  headerTitle: { color: c.onPrimary, fontSize: 18, fontWeight: 'bold' },
  content: { padding: 16 },
  section: { marginBottom: 20 },
  sectionTitle: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    backgroundColor: c.card,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: isDark ? 1 : 0,
    borderColor: c.border,
  },
  cardPad: { padding: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: c.divider },
  rowLabel: { flex: 1, color: c.text, fontSize: 15 },
  rowValue: { color: c.textMuted, fontSize: 14 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: c.cardAlt,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 8,
  },
  segmentActive: { backgroundColor: c.primary },
  segmentText: { color: c.textSecondary, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: c.onPrimary },
  preview: {
    color: c.text,
    fontSize: 15,
    marginTop: 12,
    textAlign: 'justify',
  },
  hint: { color: c.textMuted, fontSize: 12, marginTop: 8, lineHeight: 17 },
  planBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  planSub: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  storeOffline: {
    marginTop: 0,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  expiryBox: { borderBottomWidth: 1, borderBottomColor: c.divider },
  expiryLabel: { color: c.textMuted, fontSize: 13 },
  expiryDate: { color: c.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  expiryDays: { color: c.accent, fontSize: 14, fontWeight: '600' },
  policyBox: {
    paddingVertical: 12,
    backgroundColor: c.bgAlt,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
});
