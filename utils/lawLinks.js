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
  const parts = [];
  let pos = 0;
  for (const r of ranges) {
    if (r.start > pos) parts.push({ text: text.slice(pos, r.start) });
    parts.push({ text: text.slice(r.start, r.end), lawId: r.lawId });
    pos = r.end;
  }
  if (pos < text.length) parts.push({ text: text.slice(pos) });
  return parts;
}
