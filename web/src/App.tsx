import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useStore } from './store/useStore';
import { api, getToken } from './lib/api';
import Opening from './pages/Opening';
import GlobeView from './pages/GlobeView';
import LanguageSelect from './pages/LanguageSelect';
import Login from './pages/Login';
import ChinaMap from './pages/ChinaMap';
import ProvinceCities from './pages/ProvinceCities';
import CityHub from './pages/CityHub';
import CityDirectory from './pages/CityDirectory';
import ModuleStage from './pages/ModuleStage';
import HanziChallenge from './pages/HanziChallenge';
import Culture from './pages/Culture';
import CultureQuiz from './pages/CultureQuiz';
import Listening from './pages/Listening';
import Speaking from './pages/Speaking';
import Reading from './pages/Reading';
import Writing from './pages/Writing';
import HskQuiz from './pages/HskQuiz';
import Hskk from './pages/Hskk';
import ModulePage from './pages/ModulePage';
import Studio from './pages/Studio';
import Profile from './pages/Profile';
import TeacherDashboard from './pages/TeacherDashboard';
import Admin from './pages/Admin';
import Rewards from './pages/Rewards';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

export default function App() {
  const location = useLocation();
  const setUser = useStore((s) => s.setUser);
  const logout = useStore((s) => s.logout);
  const currentUser = useStore((s) => s.currentUser);

  // 启动校验：有 token 则拉当前用户；失效则登出。
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then((r) => setUser(r.user))
      .catch(() => logout());
  }, [setUser, logout]);

  // 心跳：登录且页面可见时每 60s 累计互动时长（防刷由后端封顶）。
  useEffect(() => {
    if (!currentUser) return;
    const beat = () => {
      if (document.visibilityState === 'visible') api.heartbeat().catch(() => {});
    };
    beat();
    const id = window.setInterval(beat, 60000);
    return () => window.clearInterval(id);
  }, [currentUser]);

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Opening />} />
        <Route path="/language" element={<LanguageSelect />} />
        <Route path="/globe" element={<GlobeView />} />
        <Route path="/login" element={<Login />} />
        <Route path="/map/china" element={<ChinaMap />} />
        <Route path="/map/china/:province" element={<ProvinceCities />} />
        <Route path="/city/:cityId" element={<CityHub />} />
        <Route path="/cities" element={<CityDirectory />} />
        <Route path="/modules" element={<ModuleStage />} />
        <Route path="/module/hanzi" element={<HanziChallenge />} />
        <Route path="/module/culture" element={<Culture />} />
        <Route path="/module/culture-quiz" element={<CultureQuiz />} />
        <Route path="/module/listening" element={<Listening />} />
        <Route path="/module/speaking" element={<Speaking />} />
        <Route path="/module/reading" element={<Reading />} />
        <Route path="/module/writing" element={<Writing />} />
        <Route path="/module/hsk" element={<HskQuiz />} />
        <Route path="/module/hskk" element={<Hskk />} />
        <Route path="/module/:moduleId" element={<ModulePage />} />
        <Route path="/studio" element={<Studio />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/rewards" element={<Rewards />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}
