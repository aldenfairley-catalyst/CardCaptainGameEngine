import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnConnect,
  ReactFlowInstance
} from 'reactflow';
import 'reactflow/dist/style.css';
import '@/styles/graph.css';

import { storage } from '@/lib/storage';
import { ActionGraph, ConnectorKind, GraphEdge, GraphNode } from '@/lib/types';
import { makeHoverEmojiDemoGraph } from '@/assets/sample/demoGraph';
import { nodeCatalog } from '@/lib/nodeCatalog';
import ForgeNode from './ForgeNode';
import NodeInspector from './NodeInspector';
import { nanoid } from 'nanoid';
import Modal from '@/components/Modal';
import { startRuntime, RuntimeHandle } from './graphRuntime';

const nodeTypes = {
  forgeNode: ForgeNode
};

const KIND_STROKE: Record<ConnectorKind, string> = {
  exec: '#6dd6ff',
  data: '#6bff95',
  tool: '#d3a4ff',
  db: '#ffd36d',
  error: '#ff5c7a'
};

export default function GraphEditorPage() {
  const { graphId = '' } = useParams();
  const navigate = useNavigate();

  const [graph, setGraph] = useState<ActionGraph | null>(null);
  const [rfNodes, setRfNodes] = useState<Node[]>([]);
  const [rfEdges, setRfEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const [runtimeLog, setRuntimeLog] = useState<string[]>([]);
  const runtimeRef = useRef<RuntimeHandle | null>(null);

  const rfRef = useRef<ReactFlowInstance | null>(null);

  const rebuildFlowFromGraph = useCallback((g: ActionGraph) => {
    const nodes: Node[] = g.nodes.map((n) => ({
      id: n.id,
      type: 'forgeNode',
      position: n.position,
      data: {
        title: n.title,
        type: n.type,
        color: n.color,
        ports: n.ports
      },
      draggable: true
    }));

    const edges: Edge[] = g.edges.map((e) => ({
      id: e.id,
      source: e.from.nodeId,
      target: e.to.nodeId,
      sourceHandle: e.from.portId,
      targetHandle: e.to.portId,
      type: 'smoothstep',
      animated: e.kind === 'exec',
      style: { stroke: KIND_STROKE[e.kind] },
      data: { kind: e.kind }
    }));

    setRfNodes(nodes);
    setRfEdges(edges);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      await storage.init();
      const existing = graphId ? await storage.getGraph(graphId) : null;
      const g = existing ?? makeHoverEmojiDemoGraph(graphId || `graph_${nanoid(10)}`);
      setGraph(g);
      rebuildFlowFromGraph(g);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [graphId, rebuildFlowFromGraph]);

  useEffect(() => {
    load();
  }, [load]);

  const stopRuntime = () => {
    runtimeRef.current?.stop();
    runtimeRef.current = null;
    setRuntimeLog((l) => [...l, '[runtime] stopped']);
  };

  useEffect(() => () => stopRuntime(), []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setRfNodes((nds) => applyNodeChanges(changes, nds));
      setGraph((g) => {
        if (!g) return g;
        const next = { ...g, nodes: g.nodes.map((n) => ({ ...n })) };
        for (const ch of changes) {
          if (ch.type === 'position' && ch.position && ch.id) {
            const nn = next.nodes.find((x) => x.id === ch.id);
            if (nn) nn.position = ch.position;
          }
        }
        next.meta = { ...next.meta, updatedAt: new Date().toISOString() };
        return next;
      });
    },
    []
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setRfEdges((eds) => applyEdgeChanges(changes, eds));
    setGraph((g) => {
      if (!g) return g;
      const removed = changes.filter((c) => c.type === 'remove').map((c) => c.id);
      if (removed.length === 0) return g;
      const next = { ...g, edges: g.edges.filter((e) => !removed.includes(e.id)) };
      next.meta = { ...next.meta, updatedAt: new Date().toISOString() };
      return next;
    });
  }, []);

  const getPortKind = useCallback(
    (nodeId: string, portId: string): ConnectorKind | null => {
      const n = graph?.nodes.find((x) => x.id === nodeId);
      const p = n?.ports.find((pp) => pp.id === portId);
      return p?.kind ?? null;
    },
    [graph]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (!graph) return;
      const { source, target, sourceHandle, targetHandle } = connection;
      if (!source || !target || !sourceHandle || !targetHandle) return;

      const kind = getPortKind(source, sourceHandle);
      const kind2 = getPortKind(target, targetHandle);
      if (!kind || !kind2 || kind !== kind2) {
        alert('Invalid connection: connector kinds must match (exec↔exec, data↔data, etc).');
        return;
      }

      const newEdge: GraphEdge = {
        id: `edge_${nanoid(10)}`,
        kind,
        from: { nodeId: source, portId: sourceHandle },
        to: { nodeId: target, portId: targetHandle }
      };

      setGraph((g) => {
        if (!g) return g;
        const next = { ...g, edges: [...g.edges, newEdge], meta: { ...g.meta, updatedAt: new Date().toISOString() } };
        return next;
      });

      setRfEdges((eds) => addEdge(
        {
          id: newEdge.id,
          source,
          target,
          sourceHandle,
          targetHandle,
          type: 'smoothstep',
          animated: kind === 'exec',
          style: { stroke: KIND_STROKE[kind] },
          data: { kind }
        },
        eds
      ));
    },
    [graph, getPortKind]
  );

  const selectedNode = useMemo(() => graph?.nodes.find((n) => n.id === selectedNodeId) ?? null, [graph, selectedNodeId]);

  const setNode = (updated: GraphNode) => {
    if (!graph) return;
    const next = {
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === updated.id ? updated : n)),
      meta: { ...graph.meta, updatedAt: new Date().toISOString() }
    };
    setGraph(next);
    rebuildFlowFromGraph(next);
  };

  const saveGraph = async () => {
    if (!graph) return;
    await storage.upsertGraph(graph);
    setRuntimeLog((l) => [...l, `[db] saved graph ${graph.graphId}`]);
  };

  const exportGraph = async () => {
    if (!graph) return;
    const blob = new Blob([JSON.stringify(graph, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${graph.graphId}.graph.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addNode = (type: keyof typeof nodeCatalog) => {
    if (!graph) return;
    const spec = nodeCatalog[type];
    const center = rfRef.current?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
    const x = (-center.x + 240) / center.zoom;
    const y = (-center.y + 120) / center.zoom;

    const n: GraphNode = {
      id: `node_${nanoid(10)}`,
      type: spec.type,
      title: spec.title,
      color: spec.color,
      position: { x, y },
      ports: spec.ports,
      config: { ...spec.defaultConfig }
    };

    const next = { ...graph, nodes: [...graph.nodes, n], meta: { ...graph.meta, updatedAt: new Date().toISOString() } };
    setGraph(next);
    rebuildFlowFromGraph(next);
  };

  const run = () => {
    if (!graph) return;
    stopRuntime();
    setRuntimeLog([]);
    runtimeRef.current = startRuntime(graph, {
      overlayMountId: 'cj-ui-overlay',
      log: (msg, data) => setRuntimeLog((l) => [...l, data ? `${msg} ${JSON.stringify(data)}` : msg])
    });
  };

  const clearOverlay = () => {
    const el = document.getElementById('cj-ui-overlay');
    if (el) el.innerHTML = '';
  };

  const doImport = () => {
    try {
      const parsed = JSON.parse(importText) as ActionGraph;
      setGraph(parsed);
      rebuildFlowFromGraph(parsed);
      setShowImport(false);
      setImportText('');
      navigate(`/graph/${parsed.graphId}`);
    } catch (e) {
      alert(`Import failed: ${String(e)}`);
    }
  };

  const canImport = useMemo(() => importText.trim().startsWith('{'), [importText]);

  if (loading) return <div className="small">Loading…</div>;
  if (err) return <div className="panel" style={{ padding: 12, borderColor: 'rgba(255,92,122,0.35)' }}>{err}</div>;
  if (!graph) return null;

  return (
    <div className="row" style={{ gap: 14, alignItems: 'stretch' }}>
      {/* Left: Palette */}
      <div className="panel" style={{ width: 290, padding: 12, overflow: 'auto' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0 }}>Node Palette</h3>
            <div className="small">Drag wires. Click a node to configure.</div>
          </div>
        </div>
        <hr />
        {groupedCatalog().map(([group, items]) => (
          <div key={group} style={{ marginBottom: 14 }}>
            <div className="badge" style={{ marginBottom: 8 }}>{group}</div>
            <div className="col" style={{ gap: 8 }}>
              {items.map((it) => (
                <button key={it.type} onClick={() => addNode(it.key)} style={{ justifyContent: 'space-between' }}>
                  <span>{it.title}</span>
                  <span className="small" style={{ fontFamily: 'var(--mono)' }}>{it.type}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Center: Graph */}
      <div className="panel" style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Action Graph</h2>
            <div className="small" style={{ fontFamily: 'var(--mono)' }}>{graph.graphId}</div>
          </div>
          <div className="row">
            <button onClick={() => navigate(-1)}>Back</button>
            <button onClick={saveGraph}>Save</button>
            <button onClick={exportGraph}>Export</button>
            <button onClick={() => setShowImport(true)}>Import</button>
            <button onClick={run}>Run</button>
            <button onClick={stopRuntime}>Stop</button>
            <button onClick={clearOverlay}>Clear UI</button>
          </div>
        </div>

        <div className="row" style={{ gap: 12, alignItems: 'stretch', flex: 1, minHeight: 520 }}>
          <div className="panel" style={{ flex: 1, padding: 0, overflow: 'hidden' }}>
            <ReactFlow
              nodes={rfNodes}
              edges={rfEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              fitView
              onInit={(inst) => (rfRef.current = inst)}
              onNodeClick={(_, n) => setSelectedNodeId(n.id)}
            >
              <Background />
              <Controls />
              <MiniMap />
            </ReactFlow>
          </div>

          <div className="panel" style={{ width: 420, padding: 12, overflow: 'auto' }}>
            <div className="badge">Preview</div>
            <div style={{ marginTop: 10 }}>
              <div className="small">Hover the target after you click <b>Run</b>:</div>
              <div id="hoverTarget" className="hoverTarget">
                Hover me →
              </div>
              <div id="cj-ui-overlay" />
            </div>

            <hr />
            <div className="badge">Runtime Log</div>
            <pre className="codebox" style={{ maxHeight: 160 }}>{runtimeLog.join('\n')}</pre>

            <hr />
            <div className="badge">Live Graph JSON</div>
            <pre className="codebox" style={{ maxHeight: 260 }}>{JSON.stringify(graph, null, 2)}</pre>
          </div>
        </div>
      </div>

      {selectedNode ? (
        <NodeInspector
          node={selectedNode}
          onClose={() => setSelectedNodeId('')}
          onChange={setNode}
        />
      ) : null}

      {showImport ? (
        <Modal title="Import Graph JSON" onClose={() => setShowImport(false)}>
          <div className="col" style={{ gap: 10 }}>
            <div className="small">Paste a single graph JSON object.</div>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} placeholder="{ ... }" />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button onClick={() => setShowImport(false)}>Cancel</button>
              <button disabled={!canImport} onClick={doImport}>Import</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function groupedCatalog(): Array<[string, Array<{ key: any; type: string; title: string }>]> {
  const groups = new Map<string, Array<{ key: any; type: string; title: string }>>();
  (Object.keys(nodeCatalog) as Array<keyof typeof nodeCatalog>).forEach((k) => {
    const it = nodeCatalog[k];
    const arr = groups.get(it.group) ?? [];
    arr.push({ key: k, type: it.type, title: it.title });
    groups.set(it.group, arr);
  });
  return [...groups.entries()].map(([g, items]) => [g, items.sort((a, b) => a.title.localeCompare(b.title))]);
}
