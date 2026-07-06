// Tiện ích dùng chung cho bộ lọc của Detail1 và Detail2.
// Cơ quan ban hành được nhận diện qua mã viết tắt trong số hiệu văn bản,
// ví dụ: 11/2026/TT-BCA -> Bộ Công an (BCA), .../NĐ-CP -> Chính phủ (CP).

export const AGENCIES = [
  { name: 'Quốc Hội', code: 'QH' },
  { name: 'Chính phủ', code: 'CP' },
  { name: 'Bộ Công an', code: 'BCA' },
  { name: 'Bộ Công Thương', code: 'BCT' },
  { name: 'Bộ Giáo dục và Đào tạo', code: 'BGDĐT' },
  { name: 'Bộ Khoa học và Công nghệ', code: 'BKHCN' },
  { name: 'Bộ Ngoại giao', code: 'BNG' },
  { name: 'Bộ Nội vụ', code: 'BNV' },
  { name: 'Bộ Quốc phòng', code: 'BQP' },
  { name: 'Bộ Tài chính', code: 'BTC' },
  { name: 'Bộ Tư pháp', code: 'BTP' },
  { name: 'Bộ Văn hóa, Thể thao và Du lịch', code: 'BVHTTDL' },
  { name: 'Bộ Xây dựng', code: 'BXD' },
  { name: 'Bộ Y tế', code: 'BYT' },
  { name: 'Bộ Nông nghiệp và Môi trường', code: 'BNNMT' },
  { name: 'Bộ Dân tộc và Tôn giáo', code: 'BDTTG' },
  { name: 'Bộ Giao thông Vận tải', code: 'BGTVT' },
  { name: 'Bộ Lao động Thương binh và Xã hội', code: 'BLĐTBXH' },
  { name: 'Bộ Kế hoạch và Đầu tư', code: 'BKHĐT' },
  { name: 'Bộ Thông tin và Truyền thông', code: 'BTTTT' },
  { name: 'Bộ Nông nghiệp và Phát triển nông thôn', code: 'BNNPTNT' },
  { name: 'Bộ Tài nguyên và Môi trường', code: 'BTNMT' },
  { name: 'Thanh tra Chính phủ', code: 'TTCP' },
  { name: 'Văn phòng Chính phủ', code: 'VPCP' },
  { name: 'Văn phòng Quốc hội', code: 'VPQH' },
  { name: 'Tòa án nhân dân tối cao', code: 'TANDTC' },
  { name: 'Viện kiểm sát nhân dân tối cao', code: 'VKSTC' },
  { name: 'Hội đồng thẩm phán Tòa án nhân dân tối cao', code: 'HĐTP' },
  { name: 'Ngân hàng Nhà nước Việt Nam', code: 'NHNN' },
  { name: 'Ủy ban Dân tộc', code: 'UBDT' },
];

// Phân tích chuỗi ngày dạng DD/MM/YYYY thành đối tượng Date.
// endOfDay=true -> lấy cuối ngày (23:59:59) để dùng cho mốc "đến ngày".
export function parseDateInput(str, endOfDay) {
  if (!str) return null;
  const m = str.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(
    Number(m[3]),
    Number(m[2]) - 1,
    Number(m[1]),
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return isNaN(d.getTime()) ? null : d;
}

// Tự chèn dấu "/" khi người dùng gõ, giữ tối đa 8 chữ số (DDMMYYYY).
export function formatDateInput(text) {
  const digits = text.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  }
  if (digits.length > 2) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

// Kiểm tra văn bản (tên + số hiệu) có thuộc một trong các mã cơ quan đã chọn.
// codes rỗng -> không lọc theo cơ quan (trả về true).
// Số hiệu của Quốc hội có số khóa đi kèm (QH14, QH15), nên mã cơ quan có thể
// nằm ở đầu token và theo sau là chữ số. So khớp: token bằng mã, hoặc token là
// mã + chuỗi chữ số (QH + 14).
export function lawMatchesAgencies(haystack, codes) {
  if (!codes || !codes.length) return true;
  const tokens = (haystack || '')
    .replace(/&/g, '')
    .toUpperCase()
    .split(/[^0-9A-ZÀ-Ỹ]+/)
    .filter(Boolean);
  return codes.some(code => {
    const c = code.toUpperCase();
    return tokens.some(t => t === c || new RegExp(`^${c}\\d+$`).test(t));
  });
}
