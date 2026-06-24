import path from 'node:path';

// 先加载根目录 .env（没有也无妨：LLM 层会走 mock 兜底）。默认 LLM 指向 NVIDIA NIM（key 需带 nvapi- 前缀）。
// 注意：放在最前；下游模块都「运行时」读 env，不在 import 期读，避免提升顺序问题。
try {
  process.loadEnvFile(path.resolve(import.meta.dirname, '../.env'));
} catch {
  // 没有 .env 文件时忽略
}

import express from 'express';
import cors from 'cors';
import chatRouter from './routes/chat';
import countriesRouter from './routes/countries';
import geoRouter from './routes/geo';
import kbRouter from './routes/kb';
import ttsRouter from './routes/tts';
import studioRouter from './routes/studio';
import quizRouter from './routes/quiz';
import stubsRouter from './routes/stubs';
import { hasLLM, getModel } from './llm/deepseek';
import { hasMiniMaxTTS } from './tts/minimax';

const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    name: '寰语星球 server',
    llm: hasLLM() ? getModel() : 'mock（无 key 兜底）',
    tts: hasMiniMaxTTS() ? 'minimax' : 'edge',
    ts: Date.now(),
  });
});

// 业务路由（统一前缀 /api）
app.use('/api', chatRouter);
app.use('/api', countriesRouter);
app.use('/api', geoRouter);
app.use('/api', kbRouter);
app.use('/api', ttsRouter);
app.use('/api', studioRouter);
app.use('/api', quizRouter);
app.use('/api', stubsRouter);

// 兜底 404（仅 /api 下）
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(
    `[寰语星球] 后端已启动 → http://localhost:${PORT}  LLM=${hasLLM() ? getModel() : 'mock 兜底（未配置 key）'}`,
  );
});
