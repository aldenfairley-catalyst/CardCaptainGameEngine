import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { storage } from '@/lib/storage';
import { makeDemoCard } from '@/assets/sample/demoCard';
import { nanoid } from 'nanoid';
import Modal from '@/components/Modal';
import { Card } from '@/lib/types';

export default function CardListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Array<{ id: string; name: string; updated_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const refresh = async () => {
    setLoading(true);
    setErr('');
    try {
      await storage.init();
      const res = await storage.listCards();
      setItems(res.items);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const canImport = useMemo(() => importText.trim().startsWith('{'), [importText]);

  const createNew = async () => {
    const cardId = `card_${nanoid(10)}`;
    const c = makeDemoCard(cardId);
    c.name = 'New Card';
    c.description = '';
    c.tags = [];
    c.actions = [];
    await storage.upsertCard(c);
    await refresh();
    navigate(`/cards/${cardId}`);
  };

  const exportAll = async () => {
    const payload = await storage.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cjforge_export_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async () => {
    try {
      const obj = JSON.parse(importText) as { cards?: Card[]; graphs?: any[] };
      await storage.importAll(obj as any);
      setShowImport(false);
      setImportText('');
      await refresh();
    } catch (e) {
      alert(`Import failed: ${String(e)}`);
    }
  };

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Card Library</h2>
          <div className="small">This POC stores cards + graphs in an in-browser SQLite DB (wa-sqlite).</div>
        </div>

        <div className="row">
          <button onClick={createNew}>+ New Card</button>
          <button onClick={() => setShowImport(true)}>Import JSON</button>
          <button onClick={exportAll}>Export All</button>
        </div>
      </div>

      {err ? (
        <div className="panel" style={{ padding: 12, borderColor: 'rgba(255,92,122,0.35)' }}>
          {err}
        </div>
      ) : null}

      <div className="panel" style={{ padding: 12 }}>
        {loading ? (
          <div className="small">Loading…</div>
        ) : items.length === 0 ? (
          <div className="small">No cards yet. Create one.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: 220 }}>Updated</th>
                <th style={{ width: 140 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link to={`/cards/${c.id}`}>{c.name}</Link>
                    <div className="small">{c.id}</div>
                  </td>
                  <td className="small">{new Date(c.updated_at).toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => navigate(`/cards/${c.id}`)}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showImport ? (
        <Modal title="Import JSON" onClose={() => setShowImport(false)}>
          <div className="col">
            <div className="small">
              Paste an export object shaped like: <span className="kbd">&#123; cards: [...], graphs: [...] &#125;</span>
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'{\n  "cards": [...],\n  "graphs": [...]\n}'}
            />

            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setShowImport(false)}>Cancel</button>
              <button disabled={!canImport} onClick={doImport}>
                Import
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
