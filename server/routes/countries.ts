import { Router } from 'express';
import { readJson } from '../lib/data';
import type { Country } from '../../shared/types';

const router = Router();

// GET /api/countries —— 地球仪国家点数据（PRD §13）
router.get('/countries', async (_req, res) => {
  const countries = await readJson<Country[]>('countries.json', []);
  res.json(countries);
});

export default router;
