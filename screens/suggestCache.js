// ── Cache gợi ý dùng chung (suggestIndex.json) ────────────────────────────
// Định dạng: { count, items:[{ i:_id, d:lawDescription }] }
//  - syncSuggestCache(): đồng bộ file lúc mở app (rẻ: gate bằng countAllLaw,
//    chỉ tải delta phần thiếu). Trả về cache mới nhất.
//  - loadSuggestMap(): đọc file -> map { [_id]: tên } để tra nhanh lawRelated.
import { Dirs, FileSystem } from 'react-native-file-access';

export const CF_BASE = 'https://us-central1-project2-197c0.cloudfunctions.net';
export const SUGGEST_FILE = Dirs.CacheDir + '/suggestIndex.json';
const DESC_BATCH = 400; // số _id mỗi lần gọi getSuggestDescs (tránh $in quá lớn)

export async function cfPost(path, body) {
  const res = await fetch(`${CF_BASE}/${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return res.json();
}

async function readCache() {
  try {
    if (await FileSystem.exists(SUGGEST_FILE)) {
      return JSON.parse(await FileSystem.readFile(SUGGEST_FILE, 'utf8'));
    }
  } catch (e) {}
  return null;
}

async function writeCache(cache) {
  try {
    await FileSystem.writeFile(SUGGEST_FILE, JSON.stringify(cache), 'utf8');
  } catch (e) {}
}

async function fetchFull() {
  const r = await cfPost('getSuggestData', {});
  const cache = { count: r.count || 0, items: r.data || [] };
  await writeCache(cache);
  return cache;
}

async function syncDelta(cache) {
  const r = await cfPost('getSuggestIds', {});
  const ids = r.ids || [];
  if (!ids.length) return cache; // lỗi mạng -> giữ cache cũ
  const idSet = new Set(ids);
  const have = new Map(cache.items.map(x => [x.i, x]));
  const items = cache.items.filter(x => idSet.has(x.i)); // bỏ phần đã xoá
  const missing = ids.filter(id => !have.has(id));
  for (let k = 0; k < missing.length; k += DESC_BATCH) {
    const batch = missing.slice(k, k + DESC_BATCH);
    const descs = await cfPost('getSuggestDescs', { ids: batch });
    if (Array.isArray(descs)) items.push(...descs);
  }
  const next = { count: r.count || ids.length, items };
  await writeCache(next);
  return next;
}

// Đồng bộ cache (gọi 1 lần lúc mở app). Chạy nền, lỗi thì bỏ qua.
export async function syncSuggestCache() {
  try {
    let cache = await readCache();
    if (!cache || !Array.isArray(cache.items) || !cache.items.length) {
      cache = await fetchFull(); // lần đầu / mất cache
    } else {
      const serverCount = await cfPost('countAllLaw', {}); // gate vài byte
      if (typeof serverCount === 'number' && serverCount !== cache.count) {
        cache = await syncDelta(cache);
      }
    }
    return cache;
  } catch (e) {
    return null;
  }
}

// Map { _id: tên } để rà lawRelated (đọc từ file, không gọi server).
export async function loadSuggestMap() {
  const cache = await readCache();
  const map = {};
  if (cache && Array.isArray(cache.items)) {
    cache.items.forEach(it => {
      if (it && it.i) map[it.i] = it.d;
    });
  }
  return map;
}
