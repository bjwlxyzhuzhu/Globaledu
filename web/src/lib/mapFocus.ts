// Leaflet 聚焦工具：① 蒙版——只显示目标区域板块（其余压暗）；② 首都/省会红点标注。

// 把 GeoJSON 的所有外环作为「洞」，外面盖一层暗色 → 只剩目标区域明亮。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function maskOutside(L: any, geojson: any): any {
  const world = [
    [-85, -180],
    [-85, 180],
    [85, 180],
    [85, -180],
  ];
  const holes: number[][][] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addRings = (geom: any) => {
    if (!geom) return;
    if (geom.type === 'Polygon') {
      holes.push(geom.coordinates[0].map((c: number[]) => [c[1], c[0]]));
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) holes.push(poly[0].map((c: number[]) => [c[1], c[0]]));
    }
  };
  const feats = geojson?.type === 'FeatureCollection' ? geojson.features : [geojson];
  for (const f of feats) addRings(f.geometry || f);
  return L.polygon([world, ...holes], {
    fillColor: '#05060f',
    fillOpacity: 0.8,
    stroke: false,
    interactive: false,
  });
}

// 红点（首都/省会）+ 常驻标注
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function redDot(L: any, lat: number, lng: number, label: string, onClick?: () => void): any {
  const m = L.circleMarker([lat, lng], {
    radius: 7,
    color: '#ffffff',
    weight: 1.5,
    fillColor: '#ff3b3b',
    fillOpacity: 1,
  });
  m.bindTooltip(label, { permanent: true, direction: 'top', className: 'hyxq-tip', offset: [0, -6] });
  if (onClick) m.on('click', onClick);
  return m;
}
