import { onRequest } from 'firebase-functions/v2/https';
import { MongoClient } from 'mongodb';

import openrouterAPIKey from './openrouterAPIKey.json' with { type: "json" } ;

// Mongo metadata (LawCollection, LawSearchContent, LawSearchDescription).
const client = new MongoClient(
  'mongodb://thuvienphapluat:ZvQn9683p8NnPXFMdR1VX53HTK3Da1WqyXJpvtgMMASTRdDkyu87lFAL7aR5DiiN@46.225.145.42:6980/?directConnection=true',
);

// Mongo ragdb: collection `chunks` + index $vectorSearch — nguồn RAG cho askLawAI
// (thay Firestore findNearest). TODO: nên chuyển cred sang Secret Manager.
const ragClient = new MongoClient(
  'mongodb://root:sebHiv-sekdup-gymfu1@46.225.145.42:27017/ragdb?authSource=admin&directConnection=true',
);
const RAG_DB = 'ragdb';
const RAG_CHUNKS = 'chunks';
const RAG_VECTOR_INDEX = 'vector_index';


function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Điều kiện lọc theo khoảng ngày ký (info.lawDaySign lưu dạng chuỗi ISO,
// so sánh chuỗi ISO theo thứ tự từ điển là hợp lệ).
function buildDateCondition(dateFrom, dateTo) {
  const range = {};
  if (dateFrom) range.$gte = dateFrom;
  if (dateTo) range.$lte = dateTo;
  return Object.keys(range).length ? { 'info.lawDaySign': range } : null;
}

// Điều kiện lọc theo cơ quan ban hành: mã viết tắt nằm trong số hiệu (_id),
// ví dụ 221/2026/NĐ-CP -> CP, 11/2026/TT-BCA -> BCA.
// Riêng Quốc hội, số hiệu có số khóa đi kèm (59/2020/QH14, 80/2025/QH15),
// nên cho phép có chữ số ngay sau mã; chỉ chặn khi theo sau là chữ cái
// để tránh khớp nhầm với mã dài hơn.
function buildAgencyCondition(agencies) {
  if (!Array.isArray(agencies) || !agencies.length) return null;
  return {
    $or: agencies.map(code => ({
      _id: new RegExp(`[-/]${escapeRegex(code)}\\d*(?![A-Za-z])`, 'i'),
    })),
  };
}

export const searchLawDescription = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json([]);
    return;
  }
  try {
    const database = client.db('LawMachine');
    const LawContent = database.collection('LawSearchDescription');

    const conditions = [];

    const input = (req.body.input || '').trim();
    if (input) {
      const keywords = input.split(/\s+/).filter(Boolean);
      keywords.forEach(word => {
        conditions.push({
          $or: [
            { _id: new RegExp(word, 'i') },
            { 'info.lawDescription': new RegExp(word, 'i') },
            { 'info.lawNameDisplay': new RegExp(word, 'i') },
          ],
        });
      });
    }

    const dateCond = buildDateCondition(req.body.dateFrom, req.body.dateTo);
    if (dateCond) conditions.push(dateCond);

    const agencyCond = buildAgencyCondition(req.body.agencies);
    if (agencyCond) conditions.push(agencyCond);

    const query = conditions.length ? { $and: conditions } : {};

    const result = await LawContent.find(query)
      .project({ info: 1 })
      .sort({ 'info.lawDaySign': -1 })
      .limit(300)
      .allowDiskUse(true)
      .toArray();

    res.json(result);
  } catch (e) {
    console.error('searchLawDescription error:', e);
    res.status(500).json([]);
  }
});

export const countAllLaw = onRequest(async (req, res) => {
  if (req.method === 'POST') {
    try {
      const database = client.db('LawMachine');
      const LawContent = database.collection('LawSearchDescription');

      const estimate = await LawContent.countDocuments();

      res.json(estimate);
    } finally {
    }
  }
});

export const searchContent = onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json([]);
    return;
  }
  try {
    const database = client.db('LawMachine');
    const LawSearch = database.collection('LawSearchContent');

    const conditions = [];

    const input = (req.body.input || '').trim();
    if (input) {
      conditions.push({ fullText: new RegExp(`${input}`, 'i') });
    }

    const dateCond = buildDateCondition(req.body.dateFrom, req.body.dateTo);
    if (dateCond) conditions.push(dateCond);

    const agencyCond = buildAgencyCondition(req.body.agencies);
    if (agencyCond) conditions.push(agencyCond);

    const query = conditions.length ? { $and: conditions } : {};

    const result = await LawSearch.find(query)
      .project({ info: 1 })
      .sort({ 'info.lawDaySign': -1 })
      .limit(300)
      .allowDiskUse(true)
      .toArray();

    res.json(result);
  } catch (e) {
    console.error('searchContent error:', e);
    res.status(500).json([]);
  }
});

export const callOneLaw = onRequest(async (req, res) => {
  if (req.method === 'POST') {
    let a;

    try {
      const database = client.db('LawMachine');
      const LawContent = database.collection('LawCollection');
      // Query for a movie that has the title 'Back to the Future'

      a = await LawContent.findOne({ _id: req.body.screen });
    } finally {
    }

    res.json(a);
  }
});

export const getlastedlaws = onRequest(async (req, res) => {
  if (req.method === 'POST') {
    try {
      const database = client.db('LawMachine');
      const LawContent = database.collection('LawSearchDescription');

      LawContent.find()
        .limit(50)
        .project({ info: 1 })
        .sort({ 'info.lawDaySign': -1 })
        .toArray()
        .then(o => res.json(o));
    } finally {
    }
  }
});



export const askLawAI = onRequest(
  { memory: '256MiB' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const { question, history = [], plan = 'free' } = req.body;
    if (!question) { res.status(400).json({ error: 'Missing question' }); return; }

    const isPremium = plan === 'premium';

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Model miễn phí (mặc định) cho người dùng bản Free.
    const FREE_MODELS = [
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'qwen/qwen3-next-80b-a3b-instruct:free',
      'qwen/qwen3-coder:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.2-3b-instruct:free',
    ];

    // Model trả phí (chất lượng cao hơn) cho người dùng Premium.
    // Vẫn giữ fallback sang model free ở cuối để không bao giờ trả lỗi trắng.
    const PREMIUM_MODELS = [
      ...FREE_MODELS,
      'qwen/qwen-2.5-7b-instruct'
    ];

    const MODELS = isPremium ? PREMIUM_MODELS : FREE_MODELS;
    console.log(`Plan: ${plan} → dùng ${MODELS.length} model`);

    try {
      // ── BƯỚC 1: Embed câu hỏi ────────────────────────────────────────
      const embedRes = await fetch('https://ollama.pixelplaces.net/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'bge-m3', input: question }),
      });
      const embedData = await embedRes.json();
      const questionVector = embedData.embeddings[0];

      // ── BƯỚC 2: Vector search + re-rank theo độ mới ───────────────────
      // Lấy DƯ ứng viên (40) rồi re-rank = semantic (chính) + recency (phụ)
      // để vừa "gần đúng nhất", vừa ưu tiên luật/hiệu lực GẦN NHẤT và loại
      // bản đã bị thay thế / chưa có hiệu lực.
      const CANDIDATES = 40;    // số chunk lấy về để re-rank
      const TOP_CONTEXT = 6;    // số chunk cuối cùng đưa vào context
      const RECENCY_WEIGHT = 0.2; // trọng số độ mới (semantic vẫn áp đảo)

      const ragCol = ragClient.db(RAG_DB).collection(RAG_CHUNKS);
      const docs = await ragCol.aggregate([
        {
          $vectorSearch: {
            index: RAG_VECTOR_INDEX,
            path: 'embedding',
            queryVector: questionVector,
            numCandidates: Math.max(CANDIDATES * 10, 200), // rộng hơn limit để tăng recall
            limit: CANDIDATES,
          },
        },
        {
          $project: {
            _id: 1, article: 1, fullText: 1, lawId: 1,
            lawDescription: 1, lawDayActive: 1, lawdateSign: 1,
            score: { $meta: 'vectorSearchScore' }, // cosine similarity, càng cao càng giống
          },
        },
      ]).toArray();

      if (!docs.length) {
        res.write(`data: ${JSON.stringify({ text: 'Không tìm thấy dữ liệu.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      // Parse ngày linh hoạt: Firestore Timestamp | ISO string | Date | epoch.
      const toTime = v => {
        if (!v) return NaN;
        if (typeof v === 'object') {
          if (typeof v.toDate === 'function') return v.toDate().getTime();
          if (typeof v._seconds === 'number') return v._seconds * 1000;
          if (typeof v.seconds === 'number') return v.seconds * 1000;
        }
        const t = new Date(v).getTime();
        return Number.isNaN(t) ? NaN : t;
      };
      const NOW = Date.now();

      // Gom ứng viên + tính điểm thành phần.
      let cands = docs.map(d => {
        const activeT = toTime(d.lawDayActive);
        const signT = toTime(d.lawdateSign);
        const recencyT = !Number.isNaN(activeT) ? activeT : signT; // ưu tiên hiệu lực
        return {
          data: d,
          semantic: d.score ?? 0, // vectorSearchScore (cosine) — càng cao càng giống
          recencyT,
          activeT,
          notYetEffective: !Number.isNaN(activeT) && activeT > NOW,
        };
      });

      // Loại văn bản CHƯA có hiệu lực (nếu loại xong vẫn còn dữ liệu).
      const effective = cands.filter(c => !c.notYetEffective);
      if (effective.length) cands = effective;

      // Chuẩn hoá recency về [0,1] theo min/max trong tập ứng viên.
      const times = cands.map(c => c.recencyT).filter(t => !Number.isNaN(t));
      const minT = Math.min(...times);
      const maxT = Math.max(...times);
      const span = maxT - minT;
      for (const c of cands) {
        const norm = span > 0 && !Number.isNaN(c.recencyT) ? (c.recencyT - minT) / span : 0;
        c.score = c.semantic + RECENCY_WEIGHT * norm;
      }

      // Khử trùng theo lawId + article: giữ chunk điểm cao nhất mỗi (luật, điều)
      // -> tránh nhiều bản/phiên bản của cùng một điều luật lấn át context.
      const bestByKey = new Map();
      for (const c of cands) {
        const key = `${c.data.lawId || ''}|${c.data.article || ''}`;
        const prev = bestByKey.get(key);
        if (!prev || c.score > prev.score) bestByKey.set(key, c);
      }

      // Xếp hạng cuối: điểm tổng giảm dần, lấy TOP_CONTEXT, rồi sắp theo
      // hiệu lực MỚI NHẤT trước để LLM thấy văn bản gần nhất trên cùng.
      const picked = [...bestByKey.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_CONTEXT)
        .sort((a, b) => (b.activeT || 0) - (a.activeT || 0));

      const fmt = t => (Number.isNaN(t) ? '(không rõ)' : new Date(t).toLocaleDateString('vi-VN'));
      const context = picked
        .map(
          c =>
            `[${c.data.fullText}\nVăn bản ký ngày ${fmt(toTime(c.data.lawdateSign))} có hiệu lực ngày ${fmt(c.activeT)}]`,
        )
        .join('\n\n');

      // ── BƯỚC 3: Gọi LLM với fallback ─────────────────────────────────
      const systemMsg = {
        role: 'system',
        content: `Bạn là AI tư vấn pháp luật Việt Nam.
Nhiệm vụ:
- Chỉ dùng thông tin trong CONTEXT bên dưới.
- CONTEXT được sắp xếp theo hiệu lực MỚI NHẤT trước. Khi nhiều văn bản cùng
  điều chỉnh một vấn đề hoặc mâu thuẫn nhau, ưu tiên văn bản có ngày hiệu lực
  GẦN NHẤT (mới nhất) và bỏ qua quy định đã bị thay thế.
- Trả lời NGẮN GỌN, dễ hiểu.
- Hãy diễn giải lại bằng ngôn ngữ tự nhiên.

Khi câu trả lời có căn cứ pháp luật:
1. Luôn nêu căn cứ trước.
2. Ghi theo mẫu:
   "Căn cứ [Tên văn bản] số [Số văn bản] ngày ...., có hiệu lực từ ngày ... .
   Điều [1|2|3]. [ghi rõ nội dung trích yếu]:
   [[1|2|3]. nội dung cụ thể ]...
2. Sau đó mới giải thích nội dung bằng lời văn tự nhiên.
4. Không được bịa số điều, khoản hoặc tên văn bản. Chỉ sử dụng thông tin có trong CONTEXT.

Định dạng đầu ra:
- Chỉ được xuất plain text.
- Cấm sử dụng các ký tự Markdown như *, **, #, -, _, >, 

Nếu không đủ thông tin thì trả lời:
"Không tìm thấy thông tin phù hợp."

CONTEXT:
${context}`,
      };

      const userMsg = {
        role: 'user',
        content: `Dữ liệu tham khảo:\n${context}\n\nCâu hỏi:\n${question}\nHãy trả lời ngắn gọn và diễn giải lại.`,
      };

      let llmRes = null;
      let usedModel = null;

      for (const model of MODELS) {
        console.log(`Thử model: ${model}`);
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
          Authorization: `${openrouterAPIKey.openrouter_api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [...history, systemMsg, userMsg],
            temperature: 0.2,
            max_tokens: 500,
            stream: true,
          }),
        });

if (r.status === 429 || r.status === 400) {  // ← thêm 400
  const errText = await r.text().catch(() => '');
  console.warn(`Model ${model} lỗi ${r.status}, thử tiếp:`, errText);
  continue;
}
        if (!r.ok || !r.body) {
          const errText = await r.text().catch(() => '');
          throw new Error(`Model ${model} lỗi ${r.status}: ${errText}`);
        }

        llmRes = r;
        usedModel = model;
        break;
      }

      if (!llmRes) {
        res.write(`data: ${JSON.stringify({ error: 'Tất cả model đều bị rate limit. Vui lòng thử lại sau.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      console.log(`Dùng model: ${usedModel}`);

      // ── BƯỚC 4: Stream response về client ────────────────────────────
      const reader = llmRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }
          try {
            const json = JSON.parse(data);
            const text = json.choices?.[0]?.delta?.content;
            if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
          } catch (_) {}
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();

    } catch (err) {
      console.error('askLawAI error:', err);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    }
  }
);