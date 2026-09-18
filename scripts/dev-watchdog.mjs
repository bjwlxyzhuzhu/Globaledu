// 看门狗：自愈式启动 Next dev。
// - 进程被杀软（360 主动防御 / 火绒）掐断 → 2 秒内自动重启，几乎无感。
// - 启动文件被误删 → 自动清装恢复后再起。
// - 看门狗父进程常驻，所以预览/外部框架不会“丢”掉服务器。
// - Ctrl-C 正常退出（不再重启）。
import { existsSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// 无论从哪个目录调用，都切到 web/ 根，保证下面的相对路径成立。
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)), ".."));

const BIN = "node_modules/next/dist/bin/next";
let stopping = false;
let child = null;

function heal() {
  if (existsSync(BIN)) return true;
  console.log("[watchdog] ⚠ Next 启动文件缺失（多半被 360/火绒 误删），自动清装恢复…");
  try {
    execSync("rmdir /s /q node_modules", { stdio: "inherit" });
    execSync("pnpm install --prefer-offline", { stdio: "inherit" });
  } catch (e) {
    console.error("[watchdog] ✗ 恢复失败：" + (e?.message || e));
  }
  return existsSync(BIN);
}

function runOnce() {
  return new Promise((resolve) => {
    if (!heal()) {
      console.error("[watchdog] 无法恢复 next，5 秒后重试…（请把 node.exe 加入杀软信任区）");
      return setTimeout(resolve, 5000);
    }
    console.log("[watchdog] ▶ 启动 next dev …");
    child = spawn(process.execPath, [BIN, "dev", ...process.argv.slice(2)], { stdio: "inherit" });
    child.on("exit", (code, signal) => {
      child = null;
      if (stopping) return resolve();
      console.warn(`\n[watchdog] ✖ next 退出 (code=${code} signal=${signal})——多半被杀软掐了，2 秒后自动重启…`);
      setTimeout(resolve, 2000);
    });
    child.on("error", (e) => {
      console.error("[watchdog] spawn 错误：" + e.message);
      if (!stopping) setTimeout(resolve, 2000);
    });
  });
}

function shutdown() {
  stopping = true;
  if (child) { try { child.kill(); } catch {} }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[watchdog] 🐕 看门狗已上岗：next 被杀软掐断后会自动重启（Ctrl-C 退出）");
while (!stopping) {
  await runOnce();
}
