// 给每个省/市按名称分配一个鲜明的颜色（哈希稳定），让每个板块都「激活」可见、可点。
const PALETTE = [
  '#3fd2ff', '#8b6cff', '#5a78d0', '#42c9a0', '#6aa0ff', '#9b7bff',
  '#4db8e8', '#7d8cff', '#5ad1c0', '#c08bff', '#5e9bff', '#48c7d6',
  '#7aa0ff', '#a07bff', '#4fc9b0', '#6c8cff',
];

export function regionColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

// 同色但带透明度（地球仪板块用 rgba）
export function regionColorRgba(name: string, alpha = 1): string {
  const hex = regionColor(name);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
