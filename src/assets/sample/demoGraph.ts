import { ActionGraph, GraphEdge, GraphNode } from '@/lib/types';
import { nodeCatalog } from '@/lib/nodeCatalog';

const nowIso = () => new Date().toISOString();

function node(id: string, type: keyof typeof nodeCatalog, x: number, y: number, configOverrides?: Record<string, unknown>): GraphNode {
  const spec = nodeCatalog[type];
  return {
    id,
    type: spec.type,
    title: spec.title,
    color: spec.color,
    position: { x, y },
    ports: spec.ports.map((p) => ({ ...p })),
    config: { ...structuredClone(spec.defaultConfig), ...(configOverrides ?? {}) }
  };
}

function edge(id: string, kind: GraphEdge['kind'], fromNode: string, fromPort: string, toNode: string, toPort: string): GraphEdge {
  return {
    id,
    kind,
    from: { nodeId: fromNode, portId: fromPort },
    to: { nodeId: toNode, portId: toPort }
  };
}

export function makeHoverEmojiDemoGraph(graphId = 'graph_demo_hover_emoji'): ActionGraph {
  const nHover = node('n_hover', 'event.uiHover', 0, 0, { selector: '#hoverTarget', eventType: 'mouseover' });
  const nUiRoot = node('n_uiRoot', 'tool.uiRoot', 0, 180, { mountId: 'cj-ui-overlay' });
  const nEmoji = node('n_emoji', 'data.constString', -220, 200, { value: '🪽' });
  const nSize = node('n_size', 'data.constNumber', -220, 280, { value: 120 });
  const nSpawn = node('n_spawn', 'ui.spawnEmoji', 280, 40, { defaultEmoji: '🪽', defaultSizePx: 120 });
  const nFly = node('n_fly', 'ui.animateFly', 600, 40, { toX: 1100, toY: -180, durationMs: 900 });
  const nRemove = node('n_remove', 'ui.removeElement', 920, 40, {});

  const edges: GraphEdge[] = [
    edge('e_exec_1', 'exec', 'n_hover', 'exec_out', 'n_spawn', 'exec_in'),
    edge('e_exec_2', 'exec', 'n_spawn', 'exec_out', 'n_fly', 'exec_in'),
    edge('e_exec_3', 'exec', 'n_fly', 'exec_out', 'n_remove', 'exec_in'),

    edge('e_data_emoji', 'data', 'n_emoji', 'data_out', 'n_spawn', 'data_in_emoji'),
    edge('e_data_size', 'data', 'n_size', 'data_out', 'n_spawn', 'data_in_size'),
    edge('e_data_event', 'data', 'n_hover', 'data_out_event', 'n_spawn', 'data_in_event'),

    edge('e_tool_1', 'tool', 'n_uiRoot', 'tool_out', 'n_spawn', 'tool_in'),

    edge('e_data_el_1', 'data', 'n_spawn', 'data_out_el', 'n_fly', 'data_in_el'),
    edge('e_data_el_2', 'data', 'n_fly', 'data_out_el', 'n_remove', 'data_in_el')
  ];

  const graph: ActionGraph = {
    schemaVersion: 'CJ-GRAPH-0.1',
    graphId,
    name: 'Hover -> Flying Emoji Demo',
    nodes: [nHover, nUiRoot, nEmoji, nSize, nSpawn, nFly, nRemove],
    edges,
    meta: { createdAt: nowIso(), updatedAt: nowIso() }
  };

  return graph;
}
