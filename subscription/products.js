// Cấu hình sản phẩm mua trong ứng dụng (IAP) cho tính năng "Sổ Tay Luật Premium".
//
// LƯU Ý QUAN TRỌNG — phải tạo đúng các ID này ở store trước khi test:
//   • Google Play Console → Monetize → Products → Subscriptions
//   • App Store Connect → App → In-App Purchases → Subscriptions (cùng 1 Subscription Group)
// ID ở 2 store PHẢI trùng với các hằng số dưới đây, nếu không fetchProducts trả về rỗng.

export const SKU_MONTHLY = 'com.lawmachine.premium.monthly'; // 6.000đ / tháng
export const SKU_YEARLY = 'com.lawmachine.premium.yearly'; //  60.000đ / năm

// Tất cả SKU subscription của app — dùng để fetchProducts / kiểm tra entitlement.
export const SUBSCRIPTION_SKUS = [SKU_MONTHLY, SKU_YEARLY];

// Thông tin hiển thị fallback (khi store chưa trả về giá đã bản địa hoá).
// Giá thật hiển thị cho người dùng luôn ưu tiên `displayPrice` từ store.
export const PLANS = [
  {
    sku: SKU_MONTHLY,
    key: 'monthly',
    title: 'Gói 1 tháng',
    priceFallback: '6.000đ',
    periodLabel: '/ tháng',
    note: 'Thanh toán hàng tháng, huỷ bất cứ lúc nào',
    highlight: false,
  },
  {
    sku: SKU_YEARLY,
    key: 'yearly',
    title: 'Gói 1 năm',
    priceFallback: '60.000đ',
    periodLabel: '/ năm',
    note: 'Tiết kiệm hơn — chỉ ~5.000đ/tháng',
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
