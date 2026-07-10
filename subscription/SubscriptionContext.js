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
// Khi cài lại app cache mất, nhưng restore từ store sẽ khôi phục entitlement.
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

  // Khi kết nối store xong: lấy giá sản phẩm + khôi phục entitlement (survive reinstall).
  useEffect(() => {
    if (!connected || didInit.current) return;
    didInit.current = true;
    (async () => {
      try {
        await fetchProducts({ skus: SUBSCRIPTION_SKUS, type: 'subs' });
        // restorePurchases đảm bảo lấy lại subscription đã mua trên tài khoản store.
        await restorePurchases();
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
