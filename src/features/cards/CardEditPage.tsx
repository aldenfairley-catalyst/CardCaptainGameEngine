import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { storage } from '@/lib/storage';
import { Card } from '@/lib/types';
import Modal from '@/components/Modal';
import { nanoid } from 'nanoid';
import { makeHoverEmojiDemoGraph } from '@/assets/sample/demoGraph';

function downloadJson(filename: string, obj: unknown) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CardEditPage() {
  const { cardId = '' } = useParams();
  const navigate = useNavigate();

  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      await storage.init();
      const c = await storage.getCard(cardId);
      if (!c) {
        setErr(`Card not found: ${cardId}`);
        setCard(null);
      } else {
        setCard(c);
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  const canImport = useMemo(() => importText.trim().startsWith('{'), [importText]);

  const update = (patch: Partial<Card>) => {
    if (!card) return;
    setCard({ ...card, ...patch, meta: { ...card.meta, updatedAt: new Date().toISOString() } });
  };

  const save = async () => {
    if (!card) return;
    await storage.upsertCard(card);
    await load();
  };

  const del = async () => {
    if (!confirm('Delete this card?')) return;
    await storage.deleteCard(cardId);
    navigate('/');
  };

  const addAction = async () => {
    if (!card) return;
    const graphId = `graph_${nanoid(10)}`;
    const g = makeHoverEmojiDemoGraph(graphId);
    g.name = 'New Action Graph';
    await storage.upsertGraph(g);

    const action = {
      actionId: `action_${nanoid(10)}`,
      name: 'New Action',
      graphId
    };
    update({ actions: [...card.actions, action] });
  };

  const openAction = (graphId: string) => {
    navigate(`/graph/${graphId}`);
  };

  const exportCard = async () => {
    if (!card) return;
    downloadJson(`${card.cardId}.json`, card);
  };

  const doImportCard = async () => {
    try {
      const obj = JSON.parse(importText) as Card;
      await storage.upsertCard(obj);
      setShowImport(false);
      setImportText('');
      navigate(`/cards/${obj.cardId}`);
    } catch (e) {
      alert(`Import failed: ${String(e)}`);
    }
  };

  if (loading) return <div className="small">Loading…</div>;
  if (err) return <div className="panel" style={{ padding: 12, borderColor: 'rgba(255,92,122,0.35)' }}>{err}</div>;
  if (!card) return null;

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0 }}>Edit Card</h2>
          <div className="small">{card.cardId}</div>
        </div>
        <div className="row">
          <button onClick={save}>Save</button>
          <button onClick={exportCard}>Export JSON</button>
          <button onClick={() => setShowImport(true)}>Import JSON</button>
          <button onClick={del} style={{ borderColor: 'rgba(255,92,122,0.4)' }}>
            Delete
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div className="panel" style={{ padding: 12, flex: 1 }}>
          <div className="col" style={{ gap: 10 }}>
            <label>
              <div className="small">Name</div>
              <input value={card.name} onChange={(e) => update({ name: e.target.value })} />
            </label>
            <label>
              <div className="small">Description</div>
              <textarea value={card.description ?? ''} onChange={(e) => update({ description: e.target.value })} />
            </label>
            <label>
              <div className="small">Tags (comma separated)</div>
              <input
                value={card.tags.join(', ')}
                onChange={(e) => update({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })}
              />
            </label>
          </div>
        </div>

        <div className="panel" style={{ padding: 12, flex: 1 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Actions</h3>
            <button onClick={addAction}>+ Add</button>
          </div>
          <hr />
          {card.actions.length === 0 ? (
            <div className="small">No actions yet.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Graph</th>
                  <th style={{ width: 160 }}></th>
                </tr>
              </thead>
              <tbody>
                {card.actions.map((a, idx) => (
                  <tr key={a.actionId}>
                    <td>
                      <input
                        value={a.name}
                        onChange={(e) => {
                          const next = [...card.actions];
                          next[idx] = { ...next[idx], name: e.target.value };
                          update({ actions: next });
                        }}
                      />
                      <div className="small">{a.actionId}</div>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'var(--mono)' }}>{a.graphId}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button onClick={() => openAction(a.graphId)}>Open Graph</button>
                      <button
                        onClick={() => {
                          const next = card.actions.filter((x) => x.actionId !== a.actionId);
                          update({ actions: next });
                        }}
                        style={{ marginLeft: 8 }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel" style={{ padding: 12 }}>
        <div className="small">Raw JSON (live preview):</div>
        <pre className="codebox">{JSON.stringify(card, null, 2)}</pre>
      </div>

      {showImport ? (
        <Modal title="Import Card JSON" onClose={() => setShowImport(false)}>
          <div className="col">
            <div className="small">
              Paste a single card JSON object. Import overwrites any existing card with the same <span className="kbd">cardId</span>.
            </div>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="{ ... }" />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setShowImport(false)}>Cancel</button>
              <button disabled={!canImport} onClick={doImportCard}>
                Import
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
