// Lịch sử Chat AI lưu trên máy: tối đa HISTORY_LIMIT cuộc trò chuyện gần nhất.
// Mỗi cuộc: { id, title, updatedAt (ms), messages: [{ id, role, text, sources?, timestamp (ms) }] }
import { AI_HISTORY_FILE, readUserJson, writeUserJson } from '../storage/userFiles';

export const HISTORY_LIMIT = 20;

// Lời chào ('0') không lưu: mở lại cuộc cũ sẽ tự gắn lời chào mới ở đầu.
const isSavable = m => m && m.id !== '0' && typeof m.text === 'string';

export const makeConversationId = () =>
  `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Tiêu đề = câu hỏi đầu tiên (một dòng, cắt ngắn).
const titleOf = messages => {
  const first = messages.find(m => m.role === 'user');
  const t = (first?.text || '').replace(/\s+/g, ' ').trim();
  return t.length > 80 ? `${t.slice(0, 80)}…` : t;
};

export function toConversation(id, messages) {
  const list = messages.filter(isSavable).map(m => ({
    id: m.id,
    role: m.role,
    text: m.text,
    ...(m.sources?.length ? { sources: m.sources } : null),
    timestamp: new Date(m.timestamp).getTime(),
  }));
  if (!list.some(m => m.role === 'user')) return null;
  return {
    id,
    title: titleOf(list),
    // Theo tin nhắn cuối chứ không theo lúc lưu: mở lại một cuộc cũ để đọc thì
    // nó không bị nhảy lên đầu danh sách.
    updatedAt: list[list.length - 1].timestamp,
    messages: list,
  };
}

export function restoreMessages(conv) {
  return (conv?.messages || []).map(m => ({
    ...m,
    timestamp: new Date(m.timestamp),
  }));
}

export async function loadHistory() {
  const data = await readUserJson(AI_HISTORY_FILE, []);
  return Array.isArray(data) ? data : [];
}

// Thêm/cập nhật một cuộc, xếp mới nhất lên đầu, giữ HISTORY_LIMIT cuộc.
export function upsertConversation(list, conv) {
  const rest = list.filter(c => c.id !== conv.id);
  return [conv, ...rest]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, HISTORY_LIMIT);
}

export function saveHistory(list) {
  return writeUserJson(AI_HISTORY_FILE, list);
}
