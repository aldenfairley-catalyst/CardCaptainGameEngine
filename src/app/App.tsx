import { NavLink, Route, Routes } from 'react-router-dom';
import CardListPage from '@/features/cards/CardListPage';
import CardEditPage from '@/features/cards/CardEditPage';
import GraphEditorPage from '@/features/graph/GraphEditorPage';
import { useEffect, useState } from 'react';
import { storage } from '@/lib/storage';

export default function App() {
  const [dbStatus, setDbStatus] = useState<'init' | 'ready' | 'fallback' | 'error'>('init');
  const [dbDetail, setDbDetail] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const info = await storage.init();
        if (!mounted) return;
        setDbStatus(info.kind);
        setDbDetail(info.detail);
      } catch (e) {
        if (!mounted) return;
        setDbStatus('error');
        setDbDetail(String(e));
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontWeight: 800, letterSpacing: 0.3 }}>CJ Forge (POC)</div>
          <span className="badge">Schema CJ-0.1</span>
          <span className="badge">DB: {dbStatus}{dbDetail ? ` — ${dbDetail}` : ''}</span>
        </div>
        <div className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Cards
          </NavLink>
          <NavLink to="/graph" className={({ isActive }) => (isActive ? 'active' : '')}>
            Action Graph
          </NavLink>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        <Routes>
          <Route path="/" element={<CardListPage />} />
          <Route path="/cards/:cardId" element={<CardEditPage />} />
          <Route path="/graph/:graphId?" element={<GraphEditorPage />} />
        </Routes>
      </div>
    </div>
  );
}
