import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../lib/data';

const router = Router();

// GET /api/geo/:name —— 返回 data/geo/<name>.json（中国/省份 GeoJSON，PRD §13）
router.get('/geo/:name', async (req, res) => {
  const name = req.params.name.replace(/[^a-zA-Z0-9_-]/g, ''); // 防目录穿越
  const p = path.join(DATA_DIR, 'geo', `${name}.json`);
  if (!existsSync(p)) {
    return res.status(404).json({
      error: 'geo_not_found',
      detail: `缺少 geo/${name}.json。请按 data/README.md 从 DataV.GeoAtlas 下载后放入 data/geo/。`,
    });
  }
  try {
    const json = await readFile(p, 'utf-8');
    res.type('application/json').send(json);
  } catch (e) {
    res.status(500).json({ error: 'geo_read_error', detail: (e as Error).message });
  }
});

export default router;
