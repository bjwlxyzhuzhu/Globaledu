import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface Props {
  option: echarts.EChartsOption;
  onClick?: (params: { name?: string; data?: unknown }) => void;
  className?: string;
}

// 通用 ECharts 封装：init/setOption/resize/dispose + 点击事件。
// 地图通过 echarts.registerMap 全局注册（与本组件共享同一 echarts 单例）。
export default function EChart({ option, onClick, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    chart.on('click', (p) => onClickRef.current?.(p as { name?: string; data?: unknown }));
    const resize = () => chart.resize();
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} className={className} />;
}
