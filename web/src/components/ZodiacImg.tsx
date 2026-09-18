import { useEffect, useState, type CSSProperties } from 'react';
import type { Zodiac } from '../lib/zodiac';

// 生肖老师头像：直接用预生成的静态图（/zodiac/<id>.jpg），纯 <img> 秒显、不走限流懒加载；
// 缺图时 onError 降级为 emoji。用于下拉、选择页、对话框等需要立即显示头像的地方。
export default function ZodiacImg({
  z,
  className,
  emojiClassName = 'w-full h-full grid place-items-center text-2xl',
  emojiStyle,
}: {
  z: Zodiac;
  className?: string;
  emojiClassName?: string;
  emojiStyle?: CSSProperties;
}) {
  const [dead, setDead] = useState(false);
  useEffect(() => setDead(false), [z.id]); // 切换老师时重置
  if (dead)
    return (
      <div className={emojiClassName} style={emojiStyle}>
        {z.emoji}
      </div>
    );
  return <img src={`/zodiac/${z.id}.jpg`} alt={z.name_zh} className={className} onError={() => setDead(true)} />;
}
