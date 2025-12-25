import Modal from '@/components/Modal';
import { nodeCatalog } from '@/lib/nodeCatalog';
import { GraphNode } from '@/lib/types';

export default function NodeInspector({
  node,
  onClose,
  onChange
}: {
  node: GraphNode;
  onClose: () => void;
  onChange: (node: GraphNode) => void;
}) {
  const spec = nodeCatalog[node.type as keyof typeof nodeCatalog];
  return (
    <Modal title={`Configure: ${node.title}`} onClose={onClose}>
      <div className="col" style={{ gap: 10 }}>
        <div className="small">{spec?.description ?? node.type}</div>

        {renderFields(node, onChange)}

        <hr />
        <div className="small">Raw node JSON (advanced):</div>
        <textarea
          value={JSON.stringify(node, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value) as GraphNode;
              onChange(parsed);
            } catch {
              // ignore until valid
            }
          }}
          style={{ minHeight: 220, fontFamily: 'var(--mono)' }}
        />
      </div>
    </Modal>
  );
}

function renderFields(node: GraphNode, onChange: (n: GraphNode) => void) {
  const setConfig = (patch: Record<string, unknown>) => {
    onChange({ ...node, config: { ...node.config, ...patch } });
  };

  switch (node.type) {
    case 'event.uiHover':
      return (
        <>
          <label>
            <div className="small">Target CSS selector</div>
            <input value={String(node.config.selector ?? '')} onChange={(e) => setConfig({ selector: e.target.value })} />
          </label>
          <label>
            <div className="small">DOM event</div>
            <input value={String(node.config.eventType ?? 'mouseover')} onChange={(e) => setConfig({ eventType: e.target.value })} />
          </label>
        </>
      );
    case 'tool.uiRoot':
      return (
        <label>
          <div className="small">Overlay mount element id</div>
          <input value={String(node.config.mountId ?? 'cj-ui-overlay')} onChange={(e) => setConfig({ mountId: e.target.value })} />
        </label>
      );
    case 'data.constString':
      return (
        <label>
          <div className="small">Value</div>
          <input value={String(node.config.value ?? '')} onChange={(e) => setConfig({ value: e.target.value })} />
        </label>
      );
    case 'data.constNumber':
      return (
        <label>
          <div className="small">Value</div>
          <input
            type="number"
            value={Number(node.config.value ?? 0)}
            onChange={(e) => setConfig({ value: Number(e.target.value) })}
          />
        </label>
      );
    case 'ui.spawnEmoji':
      return (
        <>
          <label>
            <div className="small">Default Emoji</div>
            <input value={String(node.config.defaultEmoji ?? '✨')} onChange={(e) => setConfig({ defaultEmoji: e.target.value })} />
          </label>
          <label>
            <div className="small">Default Size (px)</div>
            <input
              type="number"
              value={Number(node.config.defaultSizePx ?? 120)}
              onChange={(e) => setConfig({ defaultSizePx: Number(e.target.value) })}
            />
          </label>
        </>
      );
    case 'ui.animateFly':
      return (
        <>
          <div className="row" style={{ gap: 10 }}>
            <label style={{ flex: 1 }}>
              <div className="small">toX (px)</div>
              <input type="number" value={Number(node.config.toX ?? 900)} onChange={(e) => setConfig({ toX: Number(e.target.value) })} />
            </label>
            <label style={{ flex: 1 }}>
              <div className="small">toY (px)</div>
              <input type="number" value={Number(node.config.toY ?? -200)} onChange={(e) => setConfig({ toY: Number(e.target.value) })} />
            </label>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <label style={{ flex: 1 }}>
              <div className="small">Duration (ms)</div>
              <input
                type="number"
                value={Number(node.config.durationMs ?? 900)}
                onChange={(e) => setConfig({ durationMs: Number(e.target.value) })}
              />
            </label>
            <label style={{ flex: 1 }}>
              <div className="small">Scale end</div>
              <input
                type="number"
                value={Number(node.config.scaleTo ?? 1.6)}
                onChange={(e) => setConfig({ scaleTo: Number(e.target.value) })}
              />
            </label>
          </div>
        </>
      );
    case 'logic.evalJs':
      return (
        <label>
          <div className="small">JS code (unsafe)</div>
          <textarea
            value={String(node.config.code ?? '')}
            onChange={(e) => setConfig({ code: e.target.value })}
            style={{ minHeight: 160, fontFamily: 'var(--mono)' }}
          />
        </label>
      );
    case 'debug.log':
      return (
        <label>
          <div className="small">Prefix</div>
          <input value={String(node.config.prefix ?? '[graph]')} onChange={(e) => setConfig({ prefix: e.target.value })} />
        </label>
      );
    default:
      return <div className="small">No editor yet for this node type (v0.1).</div>;
  }
}
