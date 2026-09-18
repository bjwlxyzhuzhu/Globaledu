"use client";
// 成长星图 · 客户端自报"产出型动作"（导出文档 / 启用技能 / 干预回应）。
// fire-and-forget：存证失败静默，绝不阻塞学生操作。对话类里程碑不走这里（由 /api/ai/ask 服务端盖章）。

export function logClientEvidence(
  kind: "export_doc" | "skill_use" | "intervention_response",
  data: { title?: string; payload?: Record<string, unknown>; project?: string } = {}
): void {
  try {
    void fetch("/api/evidence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...data }),
      keepalive: true, // 页面跳转/关闭也尽量送达
    }).catch(() => {});
  } catch { /* 忽略 */ }
}
