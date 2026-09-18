import { Router, type Request, type Response } from 'express';

// 后续里程碑的接口占位：先返回结构化占位，保证前端调用不 404。
const router = Router();

const todo = (milestone: string, note: string) => (_req: Request, res: Response) =>
  res.json({ todo: true, milestone, note });

// 认证已由 routes/auth.ts 实现（学生/管理员登录）；此处仅保留超星 SSO 桩（M7）。
router.get('/auth/chaoxing/login', todo('M7', '超星账号 SSO 登录桩'));

// 智能体集群产出已在 studio.ts 实现；此处仅留点播动画占位（M6 后续）
router.post('/animation/generate', todo('M6', '点播动画生成（分镜→Lottie/图文+TTS）'));

// 评 / 管（M7）
router.get('/profile/:userId', todo('M7', '能力画像（六维 + HSKK 雷达）'));
router.post('/certificate/issue', todo('M7', '颁发国际中文能力数字证书'));
router.get('/teacher/dashboard', todo('M7', '教师学情看板'));
router.post('/teacher/config', todo('M7', '菜单式选配保存'));

// 超星生态对接（M7 桩）
router.post('/grade/writeback', todo('M7', '超星成绩/证书回写桩'));
router.get('/integration/manifest', (_req, res) =>
  res.json({
    name: '寰语星球',
    embed: { type: 'iframe', url: '' },
    lti: { version: '1.3', sample: true },
    knowledgeGraph: { importFormat: 'json', exportFormat: 'json' },
    todo: true,
    milestone: 'M7',
  }),
);

export default router;
