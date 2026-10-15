// hanzi-writer 改为本地打包，笔顺数据也改为自托管。
// 原实现从 cdn.jsdelivr.net 运行时加载脚本，且 hanzi-writer 默认还会
// 逐字去 cdn.jsdelivr.net/npm/hanzi-writer-data 取笔顺 JSON——校园网与
// WebVPN 下 jsdelivr 不可达，汉字模块的笔顺动画与书写测验因此整个失效。
// 现在：库由 Vite 打进主包；笔顺数据预下载到 web/public/hanzi-data/<字>.json。
import HanziWriter from 'hanzi-writer';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let p: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function loadHanziWriter(): Promise<any> {
  if (!p) p = Promise.resolve(HanziWriter);
  return p;
}

/**
 * 自托管笔顺数据加载器。
 * 用相对路径（不带开头的 /），使其同时适配两种部署形态：
 *   - 直接访问 https://lxsznt.ujs.edu.cn/ → hanzi-data/人.json
 *   - 经 WebVPN 的路径前缀 /https/<编码>/ → 前缀被保留，同样命中
 * 传给 HanziWriter.create 的 charDataLoader 即可。
 */
export function localCharDataLoader(
  char: string,
  onComplete: (data: unknown) => void,
  onError?: (err: unknown) => void,
): void {
  fetch(`hanzi-data/${encodeURIComponent(char)}.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`笔顺数据缺失：${char}（HTTP ${r.status}）`);
      return r.json();
    })
    .then(onComplete)
    .catch((e) => {
      if (onError) onError(e);
    });
}
