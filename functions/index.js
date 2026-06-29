import { onRequest } from 'firebase-functions/v2/https';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore'
import { MongoClient } from 'mongodb';

import serviceAccount from'./project2-197c0-firebase-adminsdk-wgo9a-ddd9ec03a8.json' with { type: "json" } ;;
import openrouterAPIKey from './openrouterAPIKey.json' with { type: "json" } ;

// const serviceAccount = require('./project2-197c0-firebase-adminsdk-wgo9a-4a0448ab63.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://project2-197c0-default-rtdb.firebaseio.com',
});

const client = new MongoClient(
  'mongodb://thuvienphapluat:ZvQn9683p8NnPXFMdR1VX53HTK3Da1WqyXJpvtgMMASTRdDkyu87lFAL7aR5DiiN@46.225.145.42:6980/?directConnection=true',
);


export const searchLawDescription = onRequest(async (req, res) => {
  if (req.method === 'POST') {
    try {
      const database = client.db('LawMachine');
      const LawContent = database.collection('LawSearchDescription');

      const keywords = req.body.input.trim().split(/\s+/).filter(Boolean);

      const regexConditions = keywords.map(word => ({
        $or: [
          { _id: new RegExp(word, 'i') },
          { 'info.lawDescription': new RegExp(word, 'i') },
          { 'info.lawNameDisplay': new RegExp(word, 'i') },
        ],
      }));

      LawContent.find({
        $and: regexConditions,
      })
        .project({ info: 1 })
        .sort({ 'info.lawDaySign': -1 })
        .toArray()
        .then(o => res.json(o));
    } finally {
    }
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
  if (req.method === 'POST') {
    try {
      const database = client.db('LawMachine');
      const LawSearch = database.collection('LawSearchContent');
      LawSearch.find({ fullText: new RegExp(`${req.body.input}`, 'i') })
        .project({ info: 1 })
        .sort({ 'info.lawDaySign': -1 })
        .toArray()
        .then(o => res.json(o));
    } finally {
    }
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
    const db = getFirestore();
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const { question, history = [] } = req.body;
    if (!question) { res.status(400).json({ error: 'Missing question' }); return; }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const MODELS = [
      'google/gemma-4-31b-it:free',
      'google/gemma-4-26b-a4b-it:free',
      'qwen/qwen3-next-80b-a3b-instruct:free',
      'qwen/qwen3-coder:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.2-3b-instruct:free',
    ];

    try {
      // ── BƯỚC 1: Embed câu hỏi ────────────────────────────────────────
      const embedRes = await fetch('https://ollama.pixelplaces.net/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'bge-m3', input: question }),
      });
      const embedData = await embedRes.json();
      const questionVector = embedData.embeddings[0];

      // ── BƯỚC 2: Vector search ─────────────────────────────────────────
      const snapshot = await db.collection('chunks').findNearest({
        vectorField: 'embedding',
        queryVector: questionVector,
        limit: 5,
        distanceMeasure: 'COSINE',
      }).get();

      if (snapshot.empty) {
        res.write(`data: ${JSON.stringify({ text: 'Không tìm thấy dữ liệu.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

    const context = snapshot.docs
      .map(
        (doc, i) =>
          `[${doc.data().fullText}\nVăn bản ký ngày ${new Date(doc.data().lawdateSign).toLocaleDateString("vi-VN")} có hiệu lực ngày ${new Date(doc.data().lawDayActive).toLocaleDateString("vi-VN")}]`,
      )
      .join("\n\n");

      // ── BƯỚC 3: Gọi LLM với fallback ─────────────────────────────────
      const systemMsg = {
        role: 'system',
        content: `Bạn là AI tư vấn pháp luật Việt Nam.
Nhiệm vụ:
- Chỉ dùng thông tin trong CONTEXT bên dưới.
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