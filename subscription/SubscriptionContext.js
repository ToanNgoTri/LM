import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Alert, Platform } from 'react-native';
import { Dirs, FileSystem } from 'react-native-file-access';
import {
  SUBSCRIPTION_SKUS,
  PLANS,
  planLabelFromId,
} from './products';

// Nạp react-native-iap một cách an toàn: nếu native module chưa được build
// (ví dụ đang chạy bản dev chưa link), require sẽ ném lỗi. Khi đó app vẫn chạy
// bình thường ở chế độ Free thay vì crash.
let RNIap = null;
try {
  RNIap = require('react-native-iap');
} catch (e) {
  console.warn('[Subscription] react-native-iap chưa sẵn sàng:', e?.message);
  RNIap = null;
}
const IAP_AVAILABLE = !!(RNIap && RNIap.useIAP);

// ── File cache: hiển thị nhanh trạng thái đã biết trước khi hỏi lại store ────
// Store (Google/Apple) mới là nguồn xác thực — cache chỉ để hiển thị tức thì.
// Khi cài lại app cache mất: Android tự restore lúc mở app, iOS cần người dùng
// bấm "Khôi phục giao dịch đã mua" trong PaywallModal (Apple bắt xác thực Apple ID).
const CACHE_FILE = Dirs.DocumentDir + '/subscription.json';

async function readCache() {
  try {
    if (await FileSystem.exists(CACHE_FILE)) {
      return JSON.parse(await FileSystem.readFile(CACHE_FILE, 'utf8'));
    }
  } catch (_) {}
  return null;
}

async function writeCache(data) {
  try {
    await FileSystem.writeFile(CACHE_FILE, JSON.stringify(data), 'utf8');
  } catch (_) {}
}

// ── Dùng thử Premium: máy mới cài được TRIAL_TOTAL lượt hỏi chất lượng cao ──
// Đếm lượt lưu trong DocumentDir: còn qua các lần cập nhật app, mất khi user
// xoá app (coi như "máy mới tải" -> đúng ý nghĩa dùng thử cho người mới).
export const TRIAL_TOTAL = 3;
const TRIAL_FILE = Dirs.DocumentDir + '/premium-trial.json';

async function readTrialUsed() {
  try {
    if (await FileSystem.exists(TRIAL_FILE)) {
      const d = JSON.parse(await FileSystem.readFile(TRIAL_FILE, 'utf8'));
      const n = Number(d?.used);
      if (Number.isFinite(n) && n > 0) return Math.min(n, TRIAL_TOTAL);
    }
  } catch (_) {}
  return 0;
}

async function writeTrialUsed(used) {
  try {
    await FileSystem.writeFile(TRIAL_FILE, JSON.stringify({ used }), 'utf8');
  } catch (_) {}
}

function usePremiumTrial() {
  // Khởi tạo = ĐÃ DÙNG HẾT: trước khi đọc xong file thì không cấp lượt premium,
  // tránh trường hợp user bấm gửi ngay lúc mở app và được dùng lố.
  const [trialUsed, setTrialUsed] = useState(TRIAL_TOTAL);
  const [trialLoaded, setTrialLoaded] = useState(false);
  const usedRef = useRef(TRIAL_TOTAL);

  useEffect(() => {
    readTrialUsed().then(n => {
      usedRef.current = n;
      setTrialUsed(n);
      setTrialLoaded(true);
    });
  }, []);

  // Trừ 1 lượt dùng thử. Trả về số lượt còn lại sau khi trừ.
  const consumeTrial = useCallback(async () => {
    const next = Math.min(TRIAL_TOTAL, usedRef.current + 1);
    if (next !== usedRef.current) {
      usedRef.current = next;
      setTrialUsed(next);
      await writeTrialUsed(next);
    }
    return TRIAL_TOTAL - next;
  }, []);

  return {
    trialTotal: TRIAL_TOTAL,
    trialUsed,
    trialRemaining: Math.max(0, TRIAL_TOTAL - trialUsed),
    trialLoaded,
    consumeTrial,
  };
}

const DEFAULT_VALUE = {
  ready: false,
  iapAvailable: IAP_AVAILABLE,
  isPremium: false,
  plan: null, // 'monthly' | 'yearly' | null
  planLabel: '',
  expiryDate: null, // Date | null
  loading: true,
  purchasing: false,
  plans: PLANS.map(p => ({ ...p, displayPrice: p.priceFallback })),
  // Dùng thử
  trialTotal: TRIAL_TOTAL,
  trialUsed: TRIAL_TOTAL,
  trialRemaining: 0,
  trialLoaded: false,
  consumeTrial: async () => 0,
  // true khi được phép gọi model chất lượng cao (đã mua HOẶC còn lượt dùng thử)
  canUsePremium: false,
  buy: async () => {},
  restore: async () => {},
  refresh: async () => {},
};

const SubscriptionContext = createContext(DEFAULT_VALUE);

export const useSubscription = () => useContext(SubscriptionContext);

// Chuyển danh sách subscription đang hoạt động (từ store) thành entitlement.
function deriveEntitlement(activeSubs) {
  if (!activeSubs || activeSubs.length === 0) {
    return { isPremium: false, plan: null, planLabel: '', expiryDate: null };
  }
  const active = activeSubs.find(s => s.isActive) || activeSubs[0];
  const id = active.currentPlanId || active.productId || '';
  const isYearly = id.includes('year');
  const expiryMs = active.expirationDateIOS; // iOS: ms timestamp; Android: undefined
  return {
    isPremium: true,
    plan: isYearly ? 'yearly' : 'monthly',
    planLabel: planLabelFromId(id),
    expiryDate: expiryMs ? new Date(expiryMs) : null,
  };
}

// ── Provider khi CÓ react-native-iap ────────────────────────────────────────
function IapProvider({ children }) {
  const [entitlement, setEntitlement] = useState({
    isPremium: false,
    plan: null,
    planLabel: '',
    expiryDate: null,
  });
  const [plans, setPlans] = useState(
    PLANS.map(p => ({ ...p, displayPrice: p.priceFallback })),
  );
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const didInit = useRef(false);
  const trial = usePremiumTrial();

  const applyEntitlement = useCallback(async ent => {
    setEntitlement(ent);
    await writeCache({
      isPremium: ent.isPremium,
      plan: ent.plan,
      planLabel: ent.planLabel,
      expiryDate: ent.expiryDate ? ent.expiryDate.getTime() : null,
    });
  }, []);

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
    getActiveSubscriptions,
    restorePurchases,
  } = RNIap.useIAP({
    onPurchaseSuccess: async purchase => {
      try {
        // Hoàn tất giao dịch để store không phát lại (Android tự hoàn tiền sau 3 ngày nếu không finish).
        await finishTransaction({ purchase, isConsumable: false });
      } catch (e) {
        console.warn('[Subscription] finishTransaction lỗi:', e?.message);
      }
      await refreshEntitlement();
      setPurchasing(false);
    },
    onPurchaseError: err => {
      setPurchasing(false);
      if (err?.code !== 'E_USER_CANCELLED' && err?.code !== 'user-cancelled') {
        Alert.alert('Không thể thanh toán', err?.message || 'Đã có lỗi xảy ra.');
      }
    },
    onError: e => console.warn('[Subscription] IAP error:', e?.message),
  });

  const refreshEntitlement = useCallback(async () => {
    try {
      const active = await getActiveSubscriptions(SUBSCRIPTION_SKUS);
      await applyEntitlement(deriveEntitlement(active));
    } catch (e) {
      console.warn('[Subscription] refresh lỗi:', e?.message);
    }
  }, [getActiveSubscriptions, applyEntitlement]);

  // Đọc cache ngay khi mount để hiển thị nhanh.
  useEffect(() => {
    readCache().then(c => {
      if (c && c.isPremium) {
        setEntitlement({
          isPremium: c.isPremium,
          plan: c.plan,
          planLabel: c.planLabel || '',
          expiryDate: c.expiryDate ? new Date(c.expiryDate) : null,
        });
      }
    });
  }, []);

  // Khi kết nối store xong: lấy giá sản phẩm + đọc lại entitlement.
  // KHÔNG gọi restorePurchases() trên iOS ở đây: nó chạy AppStore.sync(), và Apple
  // thiết kế hàm này luôn bắt xác thực lại Apple ID -> popup đăng nhập ngay khi mở
  // app. Apple yêu cầu chỉ sync khi người dùng chủ động bấm khôi phục (PaywallModal).
  // getActiveSubscriptions đọc transaction đã có trên máy nên vẫn nhận đúng gói
  // đang active mà không cần đăng nhập.
  useEffect(() => {
    if (!connected || didInit.current) return;
    didInit.current = true;
    (async () => {
      try {
        await fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' });
        // Android: restore im lặng, không hỏi tài khoản -> giữ để survive reinstall.
        if (Platform.OS === 'android') {
          await restorePurchases();
        }
      } catch (e) {
        console.warn('[Subscription] init lỗi:', e?.message);
      }
      await refreshEntitlement();
      setLoading(false);
    })();
  }, [connected, fetchProducts, restorePurchases, refreshEntitlement]);

  // Ghép giá bản địa hoá từ store vào danh sách gói hiển thị.
  useEffect(() => {
    if (!subscriptions || subscriptions.length === 0) return;
    setPlans(
      PLANS.map(p => {
        const s = subscriptions.find(x => x.id === p.sku);
        const androidPrice =
          s?.subscriptionOfferDetailsAndroid?.[0]?.pricingPhases
            ?.pricingPhaseList?.[0]?.formattedPrice;
        return {
          ...p,
          displayPrice: s?.displayPrice || androidPrice || p.priceFallback,
          offerToken: s?.subscriptionOfferDetailsAndroid?.[0]?.offerToken,
        };
      }),
    );
  }, [subscriptions]);

  const buy = useCallback(
    async sku => {
      if (!connected) {
        Alert.alert('Chưa sẵn sàng', 'Chưa kết nối được cửa hàng. Thử lại sau.');
        return;
      }
      const sub = subscriptions.find(s => s.id === sku);
      // Nếu store chưa trả về sản phẩm này thì requestPurchase chắc chắn lỗi
      // "sku-not-found" → chặn sớm và báo đúng nguyên nhân.
      if (!sub) {
        Alert.alert(
          'Sản phẩm chưa sẵn sàng',
          `Cửa hàng chưa trả về gói "${sku}". Kiểm tra: sản phẩm đã tạo & Active trên Google Play/App Store chưa, app đã ở track Internal testing chưa, tài khoản đã là tester chưa (sản phẩm mới tạo có thể cần vài giờ để hiển thị).`,
        );
        return;
      }
      const offerToken =
        sub?.subscriptionOfferDetailsAndroid?.[0]?.offerToken;
      try {
        setPurchasing(true);
        await requestPurchase({
          type: 'subs',
          request: {
            apple: { sku },
            google: {
              skus: [sku],
              ...(offerToken
                ? { subscriptionOffers: [{ sku, offerToken }] }
                : {}),
            },
          },
        });
        // Kết quả trả về qua onPurchaseSuccess / onPurchaseError.
      } catch (e) {
        setPurchasing(false);
        Alert.alert('Không thể thanh toán', e?.message || 'Đã có lỗi xảy ra.');
      }
    },
    [connected, subscriptions, requestPurchase],
  );

  const restore = useCallback(async () => {
    try {
      setLoading(true);
      await restorePurchases();
      await refreshEntitlement();
    } finally {
      setLoading(false);
    }
  }, [restorePurchases, refreshEntitlement]);

  const value = {
    ready: connected,
    iapAvailable: true,
    isPremium: entitlement.isPremium,
    plan: entitlement.plan,
    planLabel: entitlement.planLabel,
    expiryDate: entitlement.expiryDate,
    loading,
    purchasing,
    plans,
    ...trial,
    canUsePremium: entitlement.isPremium || trial.trialRemaining > 0,
    buy,
    restore,
    refresh: refreshEntitlement,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// ── Provider dự phòng khi KHÔNG có react-native-iap (không crash app) ────────
function FallbackProvider({ children }) {
  const [entitlement, setEntitlement] = useState({
    isPremium: false,
    plan: null,
    planLabel: '',
    expiryDate: null,
  });
  const trial = usePremiumTrial();

  useEffect(() => {
    readCache().then(c => {
      if (c && c.isPremium) {
        setEntitlement({
          isPremium: c.isPremium,
          plan: c.plan,
          planLabel: c.planLabel || '',
          expiryDate: c.expiryDate ? new Date(c.expiryDate) : null,
        });
      }
    });
  }, []);

  const notReady = useCallback(() => {
    Alert.alert(
      'Tính năng chưa sẵn sàng',
      'Thanh toán trong ứng dụng chưa khả dụng trên bản build này. Vui lòng cập nhật ứng dụng.',
    );
  }, []);

  const value = {
    ...DEFAULT_VALUE,
    ready: false,
    iapAvailable: false,
    loading: false,
    isPremium: entitlement.isPremium,
    plan: entitlement.plan,
    planLabel: entitlement.planLabel,
    expiryDate: entitlement.expiryDate,
    ...trial,
    canUsePremium: entitlement.isPremium || trial.trialRemaining > 0,
    buy: notReady,
    restore: notReady,
    refresh: async () => {},
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const SubscriptionProvider = IAP_AVAILABLE ? IapProvider : FallbackProvider;
