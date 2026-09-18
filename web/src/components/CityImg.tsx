import { useEffect, useState, type ReactNode } from 'react';
import { cityImage, cityImgPath } from '../lib/cityImage';

// 城市图：预生成静态图秒显；静态缺失→退回 pollinations 实时生成；实时也失败→emoji 兜底。
// 取代旧的 <SmartImg>（全实时+限流），让已策展城市的图几乎都瞬间出现、不再大面积 emoji。
export default function CityImg({
  kw,
  alt,
  className,
  fallback,
  w,
  h,
  model,
}: {
  kw: string;
  alt?: string;
  className?: string;
  fallback: ReactNode;
  w?: number;
  h?: number;
  model?: 'flux' | 'turbo';
}) {
  const [src, setSrc] = useState(() => cityImgPath(kw));
  const [dead, setDead] = useState(false);

  useEffect(() => {
    setSrc(cityImgPath(kw));
    setDead(false);
  }, [kw]);

  if (dead) return <>{fallback}</>;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (src.startsWith('/cityimg/')) setSrc(cityImage(kw, { w, h, model })); // 静态缺失→实时生成
        else setDead(true); // 实时也失败→emoji
      }}
    />
  );
}
