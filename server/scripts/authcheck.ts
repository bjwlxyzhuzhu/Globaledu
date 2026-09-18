// 鉴权回归自检：对着一个**正在运行**的服务端跑，验收标准来自渗透测试报告——
//   「匿名请求该端点必须返回鉴权错误」。
//
// 用法：
//   pnpm -C server authcheck                    # 默认测 http://127.0.0.1:8787
//   BASE=https://lxsznt.ujs.edu.cn pnpm -C server authcheck
//   ADMIN_PASSWORD=xxx pnpm -C server authcheck # 额外验证教师能读 /api/metrics
//
// 退出码非 0 即表示有接口漏鉴权，可直接接进部署流程。
const BASE = (process.env.BASE || 'http://127.0.0.1:8787').replace(/\/+$/, '');

interface Case {
  method: 'GET' | 'POST';
  path: string;
  /** protected：匿名必须被拒（401/403）；public：匿名必须不被拒 */
  kind: 'protected' | 'public';
  note: string;
}

const CASES: Case[] = [
  // —— 报告漏洞 2：5 个付费 AI 接口 ——
  { method: 'POST', path: '/api/chat', kind: 'protected', note: '付费 AI · 对话（兼漏洞 1 的污染入口）' },
  { method: 'POST', path: '/api/tts', kind: 'protected', note: '付费 AI · 语音合成' },
  { method: 'POST', path: '/api/quiz/generate', kind: 'protected', note: '付费 AI · 出题' },
  { method: 'POST', path: '/api/studio/generate', kind: 'protected', note: '付费 AI · 文档生成' },
  { method: 'POST', path: '/api/writing/grade', kind: 'protected', note: '付费 AI · 作文批改' },

  // —— 报告漏洞 1：教师端学情看板 ——
  { method: 'GET', path: '/api/metrics', kind: 'protected', note: '教师学情看板' },

  // —— 原本就有鉴权的接口：防回归 ——
  { method: 'POST', path: '/api/progress', kind: 'protected', note: '学习进度' },
  { method: 'POST', path: '/api/redeem', kind: 'protected', note: '积分兑换' },
  { method: 'GET', path: '/api/redemptions/me', kind: 'protected', note: '我的兑换' },
  { method: 'GET', path: '/api/leaderboard', kind: 'protected', note: '排行榜' },
  { method: 'GET', path: '/api/writing/history', kind: 'protected', note: '写作历史' },
  { method: 'GET', path: '/api/auth/me', kind: 'protected', note: '当前用户' },
  { method: 'GET', path: '/api/my/modules', kind: 'protected', note: '可用模块' },
  { method: 'GET', path: '/api/admin/classes', kind: 'protected', note: '管理后台 · 班级' },
  { method: 'GET', path: '/api/models', kind: 'protected', note: '模型清单' },

  // —— 公开白名单：必须仍然可用，否则登录前的主线演示就断了 ——
  { method: 'GET', path: '/api/health', kind: 'public', note: '健康检查' },
  { method: 'GET', path: '/api/countries', kind: 'public', note: '国家列表' },
  { method: 'GET', path: '/api/provinces', kind: 'public', note: '省份列表' },
  { method: 'GET', path: '/api/citylist', kind: 'public', note: '城市列表' },
  { method: 'GET', path: '/api/cities', kind: 'public', note: '城市' },
  { method: 'GET', path: '/api/capitals', kind: 'public', note: '首府坐标' },
  { method: 'GET', path: '/api/hanzi', kind: 'public', note: '汉字表' },
  { method: 'GET', path: '/api/rewards', kind: 'public', note: '奖励目录（约定保持公开）' },
  { method: 'GET', path: '/api/integration/manifest', kind: 'public', note: '集成清单' },

  // 带路径参数的公开接口：白名单用的是正则，必须确认真能匹配上，
  // 否则地球/图鉴等登录前的浏览主线会被 gate 误伤。
  { method: 'GET', path: `/api/geo/${encodeURIComponent('china')}`, kind: 'public', note: '地理边界（路径参数）' },
  { method: 'GET', path: `/api/learn/${encodeURIComponent('culture')}`, kind: 'public', note: '学习内容（路径参数）' },
  { method: 'GET', path: `/api/citypedia/${encodeURIComponent('北京')}`, kind: 'public', note: '城市图鉴（中文路径参数）' },
  { method: 'GET', path: `/api/culture/local/${encodeURIComponent('北京')}`, kind: 'public', note: '在地文化（两段路径参数）' },

  // 绕过尝试：尾斜杠、大小写。Express 默认非严格路由会把 /chat/ 当成 /chat，
  // 若 gate 不做归一化，这里就是一个绕过鉴权的口子。
  { method: 'POST', path: '/api/chat/', kind: 'protected', note: '绕过尝试 · 尾斜杠' },
  { method: 'GET', path: '/api/metrics/', kind: 'protected', note: '绕过尝试 · 尾斜杠' },
  { method: 'GET', path: '/api/Metrics', kind: 'protected', note: '绕过尝试 · 大小写' },
];

const AUTH_CODES = new Set([401, 403]);

async function call(method: string, path: string, token?: string): Promise<number> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    // 空对象：报告里正是用 {} 触发了完整的真实推理，这里沿用同样的最小载荷
    body: method === 'POST' ? '{}' : undefined,
  });
  return res.status;
}

let failed = 0;
let passed = 0;

function report(ok: boolean, label: string, detail: string): void {
  if (ok) {
    passed += 1;
    console.log(`  ✅ ${label}  ${detail}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${label}  ${detail}`);
  }
}

async function main(): Promise<void> {
  console.log(`\n鉴权回归自检 → ${BASE}\n`);

  console.log('【匿名访问】');
  for (const c of CASES) {
    let status: number;
    try {
      status = await call(c.method, c.path);
    } catch (e) {
      report(false, `${c.method} ${c.path}`, `请求失败：${(e as Error).message}（服务端没起来？）`);
      continue;
    }
    const label = `${c.method} ${c.path}`;
    if (c.kind === 'protected') {
      report(AUTH_CODES.has(status), label, `期望 401/403，实际 ${status} —— ${c.note}`);
    } else {
      report(!AUTH_CODES.has(status), label, `期望放行，实际 ${status} —— ${c.note}`);
    }
  }

  // 教师令牌：验证修好之后「该能用的仍然能用」，避免矫枉过正把看板锁死
  const pwd = process.env.ADMIN_PASSWORD;
  if (pwd) {
    console.log('\n【教师令牌】');
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: 'admin', password: pwd, as: 'admin' }),
      });
      if (!res.ok) {
        report(false, 'POST /api/auth/login', `管理员登录失败：${res.status}`);
      } else {
        const { token } = (await res.json()) as { token: string };
        report(true, 'POST /api/auth/login', '管理员登录成功');
        const s = await call('GET', '/api/metrics', token);
        report(s === 200, 'GET /api/metrics', `教师读看板：期望 200，实际 ${s}`);
      }
    } catch (e) {
      report(false, 'POST /api/auth/login', `请求失败：${(e as Error).message}`);
    }
  } else {
    console.log('\n【教师令牌】跳过（设置 ADMIN_PASSWORD 可一并验证教师仍能读看板）');
  }

  console.log(`\n通过 ${passed} 项，失败 ${failed} 项。\n`);
  process.exit(failed ? 1 : 0);
}

void main();
