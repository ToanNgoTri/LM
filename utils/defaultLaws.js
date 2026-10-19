// Tự tải "văn bản tải sẵn" (Mongo LawMachine.DefaultLaws, sửa bằng màn "Tải sẵn"
// của lawRNTool) về máy ở lần mở đầu tiên sau khi cài app.
//
// Chỉ người dùng MỚI: lần đầu chạy bản có tính năng này mà máy đã có dữ liệu
// (đã xem chính sách / đã tải văn bản) thì coi là người dùng cũ -> bỏ qua, để
// không tự chèn văn bản vào danh sách họ đã sắp xếp.
// Mất mạng / tải dở -> giữ trạng thái pending, lần mở app sau tải tiếp phần thiếu.
// DEFAULT_LAWS_FILE: { done: boolean }
import { DeviceEventEmitter } from 'react-native';
import {
  APPEAR_FILE,
  DEFAULT_LAWS_FILE,
  DOWNLOADED_FILE,
  ORDER_FILE,
  readUserJson,
  userFileExists,
  writeUserJson,
} from '../storage/userFiles';
import { indexTables } from './lawTables';

const CF_BASE = 'http://10.0.2.2:5002/project2-197c0/us-central1'; // TEMP-EMU

// Home nghe sự kiện này để đọc lại order.txt.
export const DOWNLOADED_CHANGED = 'downloadedLawsChanged';

let running = null;

export function ensureDefaultLaws() {
  if (!running) running = run().finally(() => (running = null));
  return running;
}

async function isFreshInstall() {
  for (const f of [APPEAR_FILE, ORDER_FILE, DOWNLOADED_FILE]) {
    if (await userFileExists(f)) return false;
  }
  return true;
}

async function run() {
  let state = await readUserJson(DEFAULT_LAWS_FILE, null);
  if (!state) {
    state = { done: !(await isFreshInstall()) };
    await writeUserJson(DEFAULT_LAWS_FILE, state);
  }
  if (state.done) return;

  try {
    const res = await fetch(`${CF_BASE}/getDefaultLaws`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return;
    const { ids } = await res.json();
    if (!Array.isArray(ids)) return;

    const have = (await readUserJson(DOWNLOADED_FILE, {})) || {};
    const laws = [];
    let failed = false;
    for (const id of ids) {
      if (have[id]) continue;
      try {
        const r = await fetch(`${CF_BASE}/callOneLaw`, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ screen: id }),
        });
        const doc = await r.json();
        if (doc && doc.content) laws.push({ id, doc });
        else failed = true;
      } catch (e) {
        failed = true;
      }
    }

    if (laws.length) {
      // Đọc lại ngay trước khi ghi: người dùng có thể vừa tải văn bản khác.
      const contentObject = (await readUserJson(DOWNLOADED_FILE, {})) || {};
      const orderRaw = await readUserJson(ORDER_FILE, []);
      const orderArray = Array.isArray(orderRaw) ? orderRaw : [];
      for (const { id, doc } of laws) {
        contentObject[id] = {
          Content: doc.content,
          Info: doc.info || {},
          Tables: Object.values(indexTables(doc.tables)),
        };
        if (!orderArray.some(item => Object.keys(item)[0] === id)) {
          orderArray.push({ [id]: doc.info || {} });
        }
      }
      await writeUserJson(DOWNLOADED_FILE, contentObject);
      await writeUserJson(ORDER_FILE, orderArray);
      DeviceEventEmitter.emit(DOWNLOADED_CHANGED);
    }

    if (!failed) await writeUserJson(DEFAULT_LAWS_FILE, { done: true });
  } catch (e) {
    console.log('[defaultLaws] lỗi', e?.message);
  }
}
