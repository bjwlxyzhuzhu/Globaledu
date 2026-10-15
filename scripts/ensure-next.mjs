// 启动守卫：若 Next 启动文件被杀软（360 主动防御 / 火绒）误删，自动清装恢复后再继续。
// 由 package.json 的 dev/build 脚本前置调用。文件在 → 立即放行；缺失 → rmdir + pnpm install。
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

const BIN = "node_modules/next/dist/bin/next";
if (existsSync(BIN)) process.exit(0);

console.log("[ensure-next] ⚠ 检测到 Next 启动文件缺失（多半被 360/火绒 误删），正在自动恢复…");
try {
  // 杀软常删到 .pnpm 源，普通 install 不会修复，需清装
  execSync("rmdir /s /q node_modules", { stdio: "inherit" });
  execSync("pnpm install --prefer-offline", { stdio: "inherit" });
  if (!existsSync(BIN)) throw new Error("恢复后仍缺失（杀软可能正在持续删除）");
  console.log("[ensure-next] ✓ 已恢复，继续启动");
} catch (e) {
  console.error("[ensure-next] ✗ 自动恢复失败：" + (e?.message || e));
  console.error("   请把项目目录加入 360/火绒 信任区后，手动执行： rmdir /s /q node_modules && pnpm install");
  process.exit(1);
}
