// ── Dữ liệu người dùng: đường dẫn + đọc/ghi an toàn ───────────────────────
// Trước đây các file dưới đây nằm ở Dirs.CacheDir. Cache là vùng hệ điều hành
// được quyền xoá bất cứ lúc nào và không báo:
//   - Android: Storage manager "Giải phóng dung lượng", app dọn dẹp của hãng
//     (Samsung Device Care, Xiaomi Security...), hoặc khi máy thiếu chỗ.
//   - iOS: hệ thống purge thư mục Caches khi thiếu dung lượng.
// Vì vậy người dùng mất văn bản đã tải chỉ sau 1-2 ngày.
//
// DocumentDir (Android filesDir, iOS Documents) chỉ mất khi user gỡ app —
// giống cách subscription/SubscriptionContext.js đang lưu.
import { Dirs, FileSystem } from 'react-native-file-access';

const DOC = Dirs.DocumentDir;
const LEGACY = Dirs.CacheDir; // vị trí cũ, chỉ dùng để chuyển dữ liệu sang

// Tên file cần chuyển từ CacheDir sang DocumentDir (một lần, lúc mở app).
const MIGRATE_FILES = [
  'downloaded.txt', // nội dung văn bản đã tải
  'order.txt', // danh sách + thứ tự văn bản đã tải (màn hình Home)
  'bookmarks.txt', // Điều đã ghi nhớ theo từng luật
  'lastedLaw.txt', // 50 luật mới nhất đã xem
  'Appear.txt', // đã xem chính sách / đã tắt nhắc cập nhật theo version
];

export const DOWNLOADED_FILE = DOC + '/downloaded.txt';
export const ORDER_FILE = DOC + '/order.txt';
export const BOOKMARKS_FILE = DOC + '/bookmarks.txt';
export const LASTED_LAW_FILE = DOC + '/lastedLaw.txt';
export const APPEAR_FILE = DOC + '/Appear.txt';

// Chạy đúng một lần cho cả vòng đời app; mọi hàm đọc/ghi bên dưới đều await
// promise này nên không có chuyện màn hình đọc trước khi chuyển xong.
let migrating = null;

async function runMigration() {
  for (const name of MIGRATE_FILES) {
    const dest = DOC + '/' + name;
    const src = LEGACY + '/' + name;
    try {
      // Đã có ở chỗ mới -> dữ liệu mới hơn, không đụng vào.
      if (await FileSystem.exists(dest)) continue;
      if (!(await FileSystem.exists(src))) continue;
      await FileSystem.cp(src, dest);
      // Giữ nguyên bản cũ trong cache: hệ thống sẽ tự dọn, và nếu bước copy
      // lỗi giữa chừng thì lần mở app sau vẫn còn nguồn để chuyển lại.
    } catch (e) {
      console.log('[userFiles] migrate lỗi', name, e?.message);
    }
  }
}

export function migrateUserFiles() {
  if (!migrating) migrating = runMigration();
  return migrating;
}

/** Đọc file JSON. File thiếu/rỗng/hỏng đều trả về fallback thay vì throw. */
export async function readUserJson(path, fallback = null) {
  await migrateUserFiles();
  try {
    if (!(await FileSystem.exists(path))) return fallback;
    const raw = await FileSystem.readFile(path, 'utf8');
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.log('[userFiles] đọc lỗi', path, e?.message);
    return fallback;
  }
}

/** Ghi file JSON. Trả về true/false, không throw ra ngoài. */
export async function writeUserJson(path, value) {
  await migrateUserFiles();
  try {
    await FileSystem.writeFile(path, JSON.stringify(value), 'utf8');
    return true;
  } catch (e) {
    console.log('[userFiles] ghi lỗi', path, e?.message);
    return false;
  }
}

export async function userFileExists(path) {
  await migrateUserFiles();
  try {
    return await FileSystem.exists(path);
  } catch (e) {
    return false;
  }
}
