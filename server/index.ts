import path from 'node:path';
import { existsSync } from 'node:fs';

// 先加载根目录 .env（没有也无妨：LLM 层会走 mock 兜底）。默认 LLM 指向 DeepSeek 官方 V4 接口。
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
import writingRouter from './routes/writing';
import authRouter from './routes/auth';
import progressRouter from './routes/progress';
import adminRouter from './routes/admin';
import rewardsRouter from './routes/rewards';
import stubsRouter from './routes/stubs';
import { gate } from './lib/gate';
import { assertAuthSecret } from './lib/auth';
import { hasLLM, getModel } from './llm/deepseek';
import { hasMiniMaxTTS } from './tts/minimax';

// 启动自检：此处 .env 已加载完毕（import 会先于模块体求值，loadEnvFile 在模块体最前）。
// 放在这里而不是 auth.ts 顶层，否则读到的永远是兜底密钥。
assertAuthSecret();

const app = express();

// CORS：默认不允许任何跨源访问。
// 开发时前端走 vite 代理、生产时前端由本服务同端口托管，两种模式都是同源，用不到 CORS。
// 确有跨源需求（例如独立部署的前端）时，用 CORS_ORIGINS=https://a.example,https://b.example 显式放行。
const CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: CORS_ORIGINS.length ? CORS_ORIGINS : false }));

app.use(express.json({ limit: '4mb' }));

// 默认拒绝：/api/* 一律需要登录，白名单见 lib/gate.ts。必须挂在所有业务路由之前。
app.use('/api', gate);

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
app.use('/api', writingRouter);
app.use('/api', authRouter);
app.use('/api', progressRouter);
app.use('/api', adminRouter);
app.use('/api', rewardsRouter);
app.use('/api', stubsRouter);

// 兜底 404（仅 /api 下）
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// 生产单进程模式：若已构建前端（web/dist 存在），由本服务同端口托管页面 + 接口。
// 开发模式没有 dist，前端仍由 vite(5173) 提供、/api 代理到这里 —— 两种模式互不影响。
const distDir = path.resolve(import.meta.dirname, '../web/dist');
if (existsSync(distDir)) {
  app.use(express.static(distDir));
  // SPA 回退：非 /api 的未匹配路由都返回 index.html，交给前端路由接管（刷新子路由不 404）。
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
  console.log(`[寰语星球] 生产模式：同端口托管前端 ${distDir}`);
}

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(
    `[寰语星球] 后端已启动 → http://localhost:${PORT}  LLM=${hasLLM() ? getModel() : 'mock 兜底（未配置 key）'}`,
  );
});
