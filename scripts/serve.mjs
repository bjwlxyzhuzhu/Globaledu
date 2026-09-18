// 生产模式常驻服务：Next standalone server + 看门狗 + 日志，脱离桌面应用独立运行。
// 用法（任意目录）：node <本文件路径>            前台跑，Ctrl-C 退出
// 开机自启由计划任务「双创AI星际-网站」调用 start-hidden.vbs 间接调用本文件。
//
// 为什么不是 next start：next.config.mjs 里 output:"standalone"（阿里云 Docker 部署要用），
// 这种构建下 next start 会明确警告不支持，必须跑 .next/standalone/server.js。
// standalone 目录不含静态资源，本脚本每次启动前把 .next/static 和 public 同步进去，
// 与 Dockerfile 里那两条 COPY 等价，所以本地和阿里云跑的是同一套东西。
//
// 特性：
//  - 端口占用即退出（幂等）：计划任务每 10 分钟重跑一次也不会起第二个实例，
//    真挂了则这一次重跑就把它拉起来，等于双保险。
//  - server.js 异常退出 → 3 秒后自动重启（杀软误杀、OOM 都能自愈）。
//  - 全部输出追加到 logs/server.log，超过 5MB 自动轮转一份 .1。
//  - 只监听 127.0.0.1。要让同局域网的学生机访问，把下面 HOST 改成 0.0.0.0 并放行防火墙。
import { existsSync, mkdirSync, statSync, renameSync, createWriteStream, readFileSync, cpSync } from "node:fs";
import { spawn } from "node:child_process";
import { connect } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(WEB);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOSTNAME || "127.0.0.1";
const SA = join(WEB, ".next", "standalone");
const LOG_DIR = join(WEB, "logs");
const LOG = join(LOG_DIR, "server.log");
const MAX_LOG = 5 * 1024 * 1024;

mkdirSync(LOG_DIR, { recursive: true });
if (existsSync(LOG) && statSync(LOG).size > MAX_LOG) renameSync(LOG, LOG + ".1");
// 新建日志时写 UTF-8 BOM：否则 PowerShell 的 Get-Content 按 ANSI 解，中文全是乱码
const fresh = !existsSync(LOG);
const logStream = createWriteStream(LOG, { flags: "a" });
if (fresh) logStream.write("﻿");
const log = (s) => {
  const line = `[${new Date().toISOString()}] ${s}\n`;
  logStream.write(line);
  process.stdout.write(line);
};

const portBusy = () =>
  new Promise((res) => {
    const sock = connect({ host: "127.0.0.1", port: PORT });
    const done = (v) => { sock.destroy(); res(v); };
    sock.setTimeout(800, () => done(false));
    sock.on("connect", () => done(true));
    sock.on("error", () => done(false));
  });

if (await portBusy()) {
  log(`端口 ${PORT} 已在服务中，本次不重复启动。`);
  process.exit(0);
}
if (!existsSync(join(SA, "server.js"))) {
  log("✗ 未找到生产构建（.next/standalone/server.js）。请先在 web/ 执行：");
  log("    node node_modules/next/dist/bin/next build");
  process.exit(1);
}

// standalone 不带静态资源，同步进去（等价于 Dockerfile 的两条 COPY）
cpSync(join(WEB, ".next", "static"), join(SA, ".next", "static"), { recursive: true, force: true });
if (existsSync(join(WEB, "public"))) {
  cpSync(join(WEB, "public"), join(SA, "public"), { recursive: true, force: true });
}

// standalone server.js 不读 .env.local（Docker 里靠 env_file 注入），这里手动喂给它
const env = { ...process.env, NODE_ENV: "production", PORT: String(PORT), HOSTNAME: HOST };
const envFile = join(WEB, ".env.local");
if (existsSync(envFile)) {
  let n = 0;
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, "");
    n++;
  }
  log(`已从 .env.local 载入 ${n} 个环境变量`);
} else {
  log("⚠ 未找到 .env.local，登录/积分/AI 接口会不可用");
}

let stopping = false;
let child = null;

const shutdown = () => {
  stopping = true;
  if (child) child.kill();
  log("收到退出信号，已停止。");
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

while (!stopping) {
  log(`▶ 启动 standalone server  http://${HOST}:${PORT} …`);
  const how = await new Promise((res) => {
    child = spawn(process.execPath, ["server.js"], { cwd: SA, stdio: ["ignore", "pipe", "pipe"], env });
    child.stdout.on("data", (d) => { logStream.write(d); process.stdout.write(d); });
    child.stderr.on("data", (d) => { logStream.write(d); process.stderr.write(d); });
    child.on("exit", (c, sig) => { child = null; res(`code=${c} signal=${sig}`); });
    child.on("error", (e) => { child = null; res("spawn 错误: " + e.message); });
  });
  if (stopping) break;
  log(`✖ 服务退出（${how}），3 秒后自动重启…`);
  await new Promise((r) => setTimeout(r, 3000));
}
