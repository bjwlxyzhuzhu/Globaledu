// 插件（P3 起为真实功能，不再是演示）：
// - webfetch 网页抓取：服务端真实抓取用户消息里的网址，注入上下文（见 lib/ai/webfetch.ts + /api/ai/ask）。
// - chart 图表生成：指示模型输出 ```chart JSON 块，前端纯 SVG 渲染（断网也能演示，见 components/ChartBlock.tsx）。
export type Plugin = { id: string; name: string; icon: string; desc: string; instruction: string };

export const PLUGINS: Plugin[] = [
  {
    id: "webfetch", name: "网页抓取", icon: "🕸️",
    desc: "把消息里的网址真实抓回来做依据（竞品官网、政策原文、新闻）",
    instruction:
      "\n\n【插件·网页抓取已启用】用户消息中的网址已由系统真实抓取，抓取到的正文会以【网页抓取】资料块附在上下文中；请优先依据抓取内容作答并注明来源网址。若资料块标注抓取失败，如实告知用户，不要编造网页内容。",
  },
  {
    id: "chart", name: "图表生成", icon: "📈",
    desc: "把数据画成柱状/折线/饼图，直接显示在对话里",
    instruction:
      "\n\n【插件·图表生成已启用】当用户提供数据并要求图表，或图表能显著帮助表达时，在回答中输出如下格式的代码块（前端会渲染成真实图表）：\n```chart\n{\"type\":\"bar|line|pie\",\"title\":\"图表标题\",\"labels\":[\"类别1\",\"类别2\"],\"series\":[{\"name\":\"系列名\",\"data\":[数值1,数值2]}]}\n```\n要求：JSON 必须合法；labels 与每个 series.data 等长；pie 只用第一个 series；一次最多 2 张图；图外配一两句文字解读。没有数据依据时不要虚构数值画图。",
  },
];

export const PLUGIN_BY_ID: Record<string, Plugin> = Object.fromEntries(PLUGINS.map((p) => [p.id, p]));

/** 把激活插件转成注入模型的真实指令 */
export function pluginInstr(activePluginIds: string[]): string {
  return activePluginIds.map((id) => PLUGIN_BY_ID[id]?.instruction || "").join("");
}
