// Cấu hình sản phẩm mua trong ứng dụng (IAP) cho tính năng "Sổ Tay Luật Premium".
//
// LƯU Ý QUAN TRỌNG — phải tạo đúng các ID này ở store trước khi test:
//   • Google Play Console → Monetize → Products → Subscriptions
//   • App Store Connect → App → In-App Purchases → Subscriptions (cùng 1 Subscription Group)
// ID ở 2 store PHẢI trùng với các hằng số dưới đây, nếu không fetchProducts trả về rỗng.

import { Platform } from 'react-native';

export const SKU_MONTHLY = 'com.lawmachine.premium.monthly'; // iOS 9.000đ · Android 6.000đ / tháng
export const SKU_YEARLY = 'com.lawmachine.premium.yearly'; //  iOS 99.000đ · Android 60.000đ / năm

// Tất cả SKU subscription của app — dùng để fetchProducts / kiểm tra entitlement.
export const SUBSCRIPTION_SKUS = [SKU_MONTHLY, SKU_YEARLY];

// Giá fallback theo nền tảng (chỉ hiển thị khi store chưa trả về giá bản địa hoá).
// iOS và Android đặt giá riêng ở store nên fallback cũng khác nhau.
const isIOS = Platform.OS === 'ios';
const MONTHLY_FALLBACK = isIOS ? '9.000đ' : '6.000đ';
const YEARLY_FALLBACK = isIOS ? '99.000đ' : '60.000đ';
const YEARLY_NOTE = isIOS
  ? 'Tiết kiệm hơn — chỉ ~8.250đ/tháng'
  : 'Tiết kiệm hơn — chỉ ~5.000đ/tháng';

// Thông tin hiển thị fallback (khi store chưa trả về giá đã bản địa hoá).
// Giá thật hiển thị cho người dùng luôn ưu tiên `displayPrice` từ store.
export const PLANS = [
  {
    sku: SKU_MONTHLY,
    key: 'monthly',
    title: 'Gói 1 tháng',
    priceFallback: MONTHLY_FALLBACK,
    periodLabel: '/ tháng',
    note: 'Thanh toán hàng tháng, huỷ bất cứ lúc nào',
    highlight: false,
  },
  {
    sku: SKU_YEARLY,
    key: 'yearly',
    title: 'Gói 1 năm',
    priceFallback: YEARLY_FALLBACK,
    periodLabel: '/ năm',
    note: YEARLY_NOTE,
    highlight: true,
  },
];

// Map productId (hoặc basePlanId trên Android) về nhãn gói để hiển thị.
export const planLabelFromId = id => {
  if (!id) return 'Premium';
  if (id.includes('year') || id.includes('yearly')) return 'Gói 1 năm';
  if (id.includes('month') || id.includes('monthly')) return 'Gói 1 tháng';
  return 'Premium';
};
