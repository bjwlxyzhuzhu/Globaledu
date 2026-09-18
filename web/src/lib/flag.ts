// 国旗改为自托管：原先直连 flagcdn.com，虽然目前校园网可达，
// 但外网 CDN 随时可能被封锁或变慢（jsdelivr 就是先例），
// 故预下载到 web/public/flags/ 统一由本服务提供。
// 文件名规则：<尺寸>_<小写二位国家码>.png，例如 w40_cn.png，
// 与 scripts 下载时的命名一致。

export type FlagSize = 'w20' | 'w40' | 'w80';

/**
 * 返回本地国旗图片路径。
 * 使用相对路径（不带开头的 /），使其在直接访问与 WebVPN 路径前缀
 * （/https/<编码>/）两种形态下都能命中。
 */
export function flagUrl(code: string, size: FlagSize = 'w40'): string {
  const c = (code || '').toLowerCase();
  return `flags/${size}_${c}.png`;
}
