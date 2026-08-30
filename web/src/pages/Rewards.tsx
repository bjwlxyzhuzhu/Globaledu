import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import Hud from '../components/Hud';
import { BackButton } from '../components/MapUI';
import GuidedTour, { type TourStep } from '../components/GuidedTour';
import { api } from '../lib/api';
import { useStore } from '../store/useStore';
import type { Reward, Redemption, LeaderboardRow } from '@shared/types';

// 积分中心功能导览
const REWARDS_TOUR: TourStep[] = [
  { sel: '[data-tour="r-head"]', title: { zh: '💎 积分中心', en: 'Points Center' }, desc: { zh: '学习就能赚积分：登录、与智能体对话、做题闯关、写作批改都有分。这里显示你的积分总数和当前排名。', en: 'Earn points by learning — logging in, chatting, quizzes and writing all give points. Your total and rank show here.' } },
  { sel: '[data-tour="r-tabs"]', title: { zh: '🏆 三大板块', en: 'Three sections' }, desc: { zh: '排行榜：看你在同学中的名次；兑换商城：用积分换奖励（文化徽章 / 一对一辅导 / 纸质证书…）；我的兑换：查看兑换记录与发放状态。', en: 'Leaderboard, rewards shop (redeem points for prizes), and your redemption history.' } },
];

type Tab = 'rank' | 'shop' | 'mine';

// 积分中心：排行榜 + 兑换商城 + 我的兑换。需登录；游客引导去登录。
export default function Rewards() {
  const { i18n } = useTranslation();
  const zh = i18n.language === 'zh';
  const nav = useNavigate();
  const user = useStore((s) => s.currentUser);
  const setUser = useStore((s) => s.setUser);

  const [tab, setTab] = useState<Tab>('rank');
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [top, setTop] = useState<LeaderboardRow[]>([]);
  const [myRank, setMyRank] = useState<{ rank: number; credits: number } | null>(null);
  const [mine, setMine] = useState<Redemption[]>([]);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState('');

  const refresh = () => {
    api.rewards().then((r) => setRewards(r.rewards)).catch(() => {});
    if (!user) return;
    api.leaderboard().then((r) => { setTop(r.top); setMyRank(r.me); }).catch(() => {});
    api.myRedemptions().then((r) => setMine(r.redemptions)).catch(() => {});
  };
  useEffect(refresh, [user]);

  const redeem = async (rw: Reward) => {
    if (!user) return;
    if ((user.credits ?? 0) < rw.cost) {
      setToast(zh ? '积分不足，继续学习赚积分吧！' : 'Not enough points — keep learning!');
      return;
    }
    setBusy(rw.id);
    setToast('');
    try {
      const r = await api.redeem(rw.id);
      setUser({ ...user, credits: r.remaining });
      setToast((zh ? '兑换成功！剩余 ' : 'Redeemed! Balance ') + r.remaining + (zh ? ' 积分。请凭记录找老师领取。' : ' pts. Show the record to your teacher.'));
      api.myRedemptions().then((x) => setMine(x.redemptions)).catch(() => {});
      api.leaderboard().then((x) => { setTop(x.top); setMyRank(x.me); }).catch(() => {});
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy('');
    }
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'rank', icon: '🏆', label: zh ? '排行榜' : 'Leaderboard' },
    { key: 'shop', icon: '🎁', label: zh ? '兑换商城' : 'Rewards' },
    { key: 'mine', icon: '🧾', label: zh ? '我的兑换' : 'My Redemptions' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen">
      <Hud />
      <BackButton to="/globe" />
      <div className="max-w-3xl mx-auto px-5 pt-24 pb-16">
        <div data-tour="r-head" className="flex items-end justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-3xl font-bold text-glow">💎 {zh ? '积分中心' : 'Points Center'}</h1>
            <p className="mt-1 text-white/55 text-sm">
              {zh ? '学习赚积分，登录/对话/做题都有分，可兑换奖励、上榜争名次。' : 'Earn points by learning — redeem rewards and climb the leaderboard.'}
            </p>
          </div>
          {user ? (
            <div className="text-right">
              <div className="text-2xl font-bold text-gold">{user.credits}💎</div>
              {myRank && <div className="text-xs text-white/50">{zh ? '我的排名' : 'My rank'} #{myRank.rank}</div>}
            </div>
          ) : (
            <button onClick={() => nav('/login')} className="btn-primary px-4 py-2 rounded-xl text-sm font-semibold">
              {zh ? '登录后查看' : 'Sign in'}
            </button>
          )}
        </div>

        {toast && <p className="text-xs text-gold bg-gold/10 rounded-lg px-3 py-2 mb-4">✨ {toast}</p>}

        {/* Tab 切换 */}
        <div data-tour="r-tabs" className="flex rounded-xl bg-space-800/70 border border-white/10 p-1 mb-5 text-sm">
          {tabs.map((tk) => (
            <button
              key={tk.key}
              onClick={() => setTab(tk.key)}
              className={'flex-1 py-2 rounded-lg transition ' + (tab === tk.key ? 'bg-starcyan/20 text-starcyan font-semibold' : 'text-white/60 hover:text-white')}
            >
              {tk.icon} {tk.label}
            </button>
          ))}
        </div>

        {/* 排行榜 */}
        {tab === 'rank' && (
          <div className="glass rounded-2xl p-4">
            {!user ? (
              <p className="text-white/45 text-sm text-center py-8">{zh ? '登录后查看排行榜与你的名次。' : 'Sign in to see the leaderboard.'}</p>
            ) : top.length === 0 ? (
              <p className="text-white/45 text-sm text-center py-8">{zh ? '还没有上榜的同学，快去学习抢第一！' : 'No one on the board yet — be the first!'}</p>
            ) : (
              <div className="space-y-1.5">
                {top.map((r) => (
                  <div
                    key={r.id}
                    className={'flex items-center gap-3 px-3 py-2 rounded-lg ' + (r.me ? 'bg-starcyan/15 border border-starcyan/40' : 'hover:bg-white/5')}
                  >
                    <span className={'w-8 text-center font-bold ' + (r.rank <= 3 ? 'text-gold text-lg' : 'text-white/45')}>
                      {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}
                    </span>
                    <span className="flex-1 text-white/90">
                      {r.name} {r.me && <span className="text-xs text-starcyan">({zh ? '我' : 'me'})</span>}
                    </span>
                    <span className="text-gold font-semibold">{r.credits}💎</span>
                  </div>
                ))}
                {myRank && myRank.rank > top.length && (
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-starcyan/15 border border-starcyan/40 mt-2">
                    <span className="w-8 text-center font-bold text-white/45">{myRank.rank}</span>
                    <span className="flex-1 text-white/90">{user.name} <span className="text-xs text-starcyan">({zh ? '我' : 'me'})</span></span>
                    <span className="text-gold font-semibold">{myRank.credits}💎</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 兑换商城 */}
        {tab === 'shop' && (
          <div className="grid sm:grid-cols-2 gap-3">
            {rewards.map((rw) => {
              const affordable = !!user && (user.credits ?? 0) >= rw.cost;
              return (
                <div key={rw.id} className="glass rounded-2xl p-4 flex flex-col">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{rw.emoji || '🎁'}</div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white/90">{zh ? rw.name_zh : rw.name_en}</h3>
                      <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{zh ? rw.desc_zh : rw.desc_en}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-gold font-bold">{rw.cost}💎</span>
                    <button
                      onClick={() => redeem(rw)}
                      disabled={!user || !affordable || busy === rw.id}
                      className="btn-primary px-4 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                    >
                      {busy === rw.id ? (zh ? '兑换中…' : '…') : !user ? (zh ? '请先登录' : 'Sign in') : affordable ? (zh ? '兑换' : 'Redeem') : (zh ? '积分不足' : 'Not enough')}
                    </button>
                  </div>
                </div>
              );
            })}
            {rewards.length === 0 && <p className="text-white/45 text-sm col-span-full text-center py-8">{zh ? '暂无奖励（老师可在 data/rewards.json 添加）。' : 'No rewards yet.'}</p>}
          </div>
        )}

        {/* 我的兑换 */}
        {tab === 'mine' && (
          <div className="glass rounded-2xl p-4">
            {!user ? (
              <p className="text-white/45 text-sm text-center py-8">{zh ? '登录后查看你的兑换记录。' : 'Sign in to see your redemptions.'}</p>
            ) : mine.length === 0 ? (
              <p className="text-white/45 text-sm text-center py-8">{zh ? '还没有兑换记录，去兑换商城看看吧。' : 'No redemptions yet.'}</p>
            ) : (
              <div className="space-y-2">
                {mine.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                    <div>
                      <div className="text-white/90 text-sm">{m.reward_name}</div>
                      <div className="text-xs text-white/40">{new Date(m.ts).toLocaleString(zh ? 'zh-CN' : 'en-US')}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-gold text-sm">-{m.cost}💎</div>
                      <span className={'text-[11px] px-2 py-0.5 rounded-full ' + (m.status === 'fulfilled' ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-300')}>
                        {m.status === 'fulfilled' ? (zh ? '已发放' : 'Fulfilled') : (zh ? '待发放' : 'Pending')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <GuidedTour id="rewards" steps={REWARDS_TOUR} />
    </motion.div>
  );
}
