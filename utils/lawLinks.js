// Tách câu trả lời của Chat AI thành các đoạn chữ thường / số văn bản, để số
// văn bản thành link mở Detail5 ('accessLaw', { screen: lawId }).
//
// Nguồn chính: `sources` server gửi kèm (lawId các văn bản trong CONTEXT) —
// số hiệu văn bản rất đa dạng (24a/2016/NĐ-CP, 02/NĐ-CP(2008),
// 01/2021/TTLT-BCA-BQP-BNN&PTNT...) nên không đoán bằng regex được hết.
// Dự phòng: regex số hiệu phổ biến, cho câu trả lời cũ không có sources hoặc
// văn bản được nhắc lại từ câu hỏi trước.

// Đổi từng ký tự một (giữ nguyên độ dài) -> chỉ số trong chuỗi chuẩn hóa trùng
// với chuỗi gốc. Model hay viết ND thay NĐ, hoa/thường lẫn lộn.
const norm = s => String(s).toUpperCase().replace(/Đ/g, 'D');

// Ký tự được phép đứng sát số hiệu mà vẫn thuộc số hiệu -> không phải ranh giới.
const isIdChar = ch => !!ch && /[0-9A-Za-zÀ-ỹĐđ&/-]/.test(ch);

const ID_REGEX =
  /\d{1,4}[a-z]?(?:\/\d{4})?\/[A-ZĐ][A-ZĐ0-9&]*(?:[-/][A-ZĐ0-9&]+)*/gu;

export function splitLawLinks(text, sources) {
  if (!text) return [];
  const nText = norm(text);
  const ranges = []; // { start, end, lawId }
  const overlaps = (s, e) => ranges.some(r => s < r.end && e > r.start);

  // Số hiệu trong sources, kể cả dạng bỏ hậu tố năm "(2008)".
  const needles = [];
  for (const src of sources || []) {
    const id = src && src.id;
    if (!id) continue;
    needles.push({ n: norm(id), lawId: id });
    const short = id.replace(/\(\d{4}\)$/, '');
    if (short !== id) needles.push({ n: norm(short), lawId: id });
  }
  // dài trước: tránh "01/2021/TT" ăn mất "01/2021/TT-BCA"
  needles.sort((a, b) => b.n.length - a.n.length);

  for (const { n, lawId } of needles) {
    let from = 0;
    for (;;) {
      const start = nText.indexOf(n, from);
      if (start < 0) break;
      const end = start + n.length;
      from = end;
      if (isIdChar(text[start - 1]) || isIdChar(text[end])) continue;
      if (!overlaps(start, end)) ranges.push({ start, end, lawId });
    }
  }

  const byNorm = new Map(needles.map(x => [x.n, x.lawId]));
  for (const m of text.matchAll(ID_REGEX)) {
    const start = m.index;
    let raw = m[0];
    // dấu "/" hoặc "-" cuối câu không thuộc số hiệu
    raw = raw.replace(/[-/]+$/, '');
    const end = start + raw.length;
    if (isIdChar(text[start - 1]) || overlaps(start, end)) continue;
    ranges.push({ start, end, lawId: byNorm.get(norm(raw)) || raw });
  }

  ranges.sort((a, b) => a.start - b.start);
  linkArticles(text, sources, ranges, overlaps);
  ranges.sort((a, b) => a.start - b.start);

  const parts = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) parts.push({ text: text.slice(pos, r.start) });
    const part = { text: text.slice(r.start, r.end), lawId: r.lawId };
    if (r.article) part.article = r.article;
    parts.push(part);
    pos = r.end;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos) });
  return parts;
}

// "Điều 5" trong câu trả lời -> link mở văn bản và cuộn tới Điều 5.
// Gán văn bản cho từng "Điều N" theo thứ tự:
//   1) văn bản trong sources có đúng Điều N trong CONTEXT (server gửi
//      `articles`), nếu chỉ một văn bản có -> chắc chắn;
//   2) số văn bản gần nhất đứng SAU trên cùng dòng ("khoản 2 Điều 5 Luật
//      ... số 45/2019/QH14"), rồi số văn bản gần nhất đứng TRƯỚC ("Căn cứ ...
//      số 45/2019/QH14 ... Điều 5.") — trong số văn bản ứng viên ở bước 1;
//   3) chỉ có một văn bản -> lấy văn bản đó.
const ARTICLE_REGEX = /(?<![0-9A-Za-zÀ-ỹĐđ])[Đđ]iều\s+(\d+[a-zđ]?)(?![0-9A-Za-zÀ-ỹĐđ])/gu;

// "Điều 5. Tên điều" -> "5"; tiêu đề trong phụ lục ("Phụ lục I - Điều 5") bỏ qua
// vì Detail5 chỉ nhảy tới Điều của văn bản chính.
export const articleNo = title => {
  const m = String(title).match(/^\s*Điều\s+(\d+[a-zđ]?)(?:[.:\s]|$)/iu);
  return m ? m[1].toLowerCase() : null;
};

function linkArticles(text, sources, ranges, overlaps) {
  const lawRanges = ranges.slice();
  const ids = [...new Set((sources || []).map(s => s && s.id).filter(Boolean))];
  const added = [];

  for (const m of text.matchAll(ARTICLE_REGEX)) {
    const start = m.index;
    const end = start + m[0].length;
    if (overlaps(start, end)) continue;
    const no = m[1].toLowerCase();

    const withArticle = (sources || [])
      .filter(s => s && s.id && (s.articles || []).some(t => articleNo(t) === no))
      .map(s => s.id);
    const allowed = withArticle.length ? withArticle : null;
    const ok = r => !allowed || allowed.includes(r.lawId);

    let lawId = withArticle.length === 1 ? withArticle[0] : null;
    if (!lawId) {
      const after = lawRanges.find(
        r => r.start >= end && ok(r) && r.start - end <= 120 &&
          !text.slice(end, r.start).includes('\n'),
      );
      const before = [...lawRanges].reverse().find(r => r.end <= start && ok(r));
      lawId = (after || before || {}).lawId || null;
    }
    if (!lawId && allowed) lawId = allowed[0];
    if (!lawId && ids.length === 1) lawId = ids[0];
    if (!lawId) continue;

    added.push({ start, end, lawId, article: no });
  }
  ranges.push(...added);
}
