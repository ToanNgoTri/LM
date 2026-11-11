// ── Thông tin app dùng chung: link Store, quản lý đăng ký, so sánh version ──
import { Linking, Platform } from 'react-native';

export const STORE_URL =
  Platform.OS == 'ios'
    ? 'https://apps.apple.com/vn/app/th%C6%B0-vi%E1%BB%87n-lu%E1%BA%ADt/id6741737005?l=vi'
    : 'https://play.google.com/store/apps/details?id=com.lawmachine&pcampaignid=web_share';

// Trang quản lý/huỷ gói đăng ký của chính cửa hàng (app không tự huỷ được).
export const MANAGE_SUBSCRIPTIONS_URL =
  Platform.OS == 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions?package=com.lawmachine';

export const TERMS_URL = 'https://project2-197c0.web.app/terms.html';
export const PRIVACY_URL = 'https://project2-197c0.web.app/privacy.html';

export const openUrl = url =>
  Linking.openURL(url).catch(err => console.error('Error opening URL: ', err));

export const openStore = () => openUrl(STORE_URL);

// So sánh versionName ("1.2.3" hoặc "13"). Trả <0 nếu a cũ hơn b.
export function compareVersion(a, b) {
  const pa = String(a ?? '0').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b ?? '0').split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

// Cấu hình cập nhật do ADMIN đặt (Mongo LawMachine.AppConfig, _id='update',
// sửa qua lawRNTool ▸ AppConfig). App KHÔNG còn đọc version mới nhất từ Store
// và KHÔNG gửi version lên Mongo nữa — chỉ nhắc khi cũ hơn bản admin khuyến nghị.
const APP_CONFIG_URL =
  'https://us-central1-project2-197c0.cloudfunctions.net/appConfig';

// Trả { recommendedVersion, forceUpdate, shouldUpdate, message } theo nền tảng.
// recommendedVersion = '' khi admin chưa đặt -> nơi gọi KHÔNG được nhắc/chặn.
export async function fetchUpdateConfig() {
  const res = await fetch(APP_CONFIG_URL, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const cfg = await res.json();
  return {
    recommendedVersion: String(
      (Platform.OS === 'ios'
        ? cfg?.recommendedVersioniOS
        : cfg?.recommendedVersionAndroid) || '',
    ).trim(),
    forceUpdate: cfg?.forceUpdate === true,
    shouldUpdate: cfg?.shouldUpdate === true,
    message: cfg?.message || '',
  };
}
