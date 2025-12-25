import { ConnectorKind, DataType, GraphNode, PortShape, PortSpec } from './types';

export type NodeGroup =
  | 'Events & Listeners'
  | 'Data'
  | 'UI'
  | 'Logic'
  | 'Debug'
  | 'Database'
  | 'Tools'
  | 'Networking'
  | 'Game';

export type NodeTypeSpec = {
  type: string;
  title: string;
  group: NodeGroup;
  description: string;
  color: string;
  ports: PortSpec[];
  defaultConfig: Record<string, unknown>;
};

export const connectorStyles: Record<ConnectorKind, { color: string; shape: PortShape }> = {
  exec: { color: '#6dd6ff', shape: 'triangle' },
  data: { color: '#6bff95', shape: 'circle' },
  tool: { color: '#d3a4ff', shape: 'diamond' },
  db: { color: '#ffd36d', shape: 'square' },
  error: { color: '#ff5c7a', shape: 'hex' }
};

function port(
  id: string,
  name: string,
  kind: ConnectorKind,
  direction: 'in' | 'out',
  side: 'left' | 'right' | 'top' | 'bottom',
  slot: number,
  dataType?: DataType,
  required?: boolean
): PortSpec {
  const s = connectorStyles[kind];
  return {
    id,
    name,
    kind,
    direction,
    side,
    slot,
    dataType,
    required,
    shape: s.shape,
    color: s.color
  };
}

export const nodeCatalog: Record<string, NodeTypeSpec> = {
  'event.uiHover': {
    type: 'event.uiHover',
    title: 'UI Hover Listener',
    group: 'Events & Listeners',
    description:
      'Listens for a mouseover event on a CSS selector. When triggered, emits an exec pulse plus an event payload.',
    color: '#2b5a7a',
    ports: [
      port('exec_out', 'Triggered', 'exec', 'out', 'right', 0),
      port('data_out_event', 'Event', 'data', 'out', 'right', 1, 'eventPayload')
    ],
    defaultConfig: {
      selector: '#hoverTarget',
      eventType: 'mouseover'
    }
  },

  'data.constString': {
    type: 'data.constString',
    title: 'Const String',
    group: 'Data',
    description: 'Outputs a constant string.',
    color: '#1f4632',
    ports: [port('data_out', 'Value', 'data', 'out', 'right', 0, 'string')],
    defaultConfig: { value: '🚀' }
  },

  'data.constNumber': {
    type: 'data.constNumber',
    title: 'Const Number',
    group: 'Data',
    description: 'Outputs a constant number.',
    color: '#1f4632',
    ports: [port('data_out', 'Value', 'data', 'out', 'right', 0, 'number')],
    defaultConfig: { value: 96 }
  },

  'tool.uiRoot': {
    type: 'tool.uiRoot',
    title: 'UI Root',
    group: 'Tools',
    description: 'Provides a DOM container for UI effects (overlay root).',
    color: '#4a2b7a',
    ports: [port('tool_out', 'UI Root', 'tool', 'out', 'bottom', 0, 'domElement')],
    defaultConfig: {
      mountId: 'cj-ui-overlay'
    }
  },

  'ui.spawnEmoji': {
    type: 'ui.spawnEmoji',
    title: 'Spawn Emoji',
    group: 'UI',
    description:
      'Creates an emoji element in the UI root. By default it spawns near the mouse pointer (if an event payload is connected).',
    color: '#56311a',
    ports: [
      port('exec_in', 'In', 'exec', 'in', 'left', 0),
      port('exec_out', 'Out', 'exec', 'out', 'right', 0),
      port('data_in_emoji', 'Emoji', 'data', 'in', 'left', 2, 'string', true),
      port('data_in_size', 'Size px', 'data', 'in', 'left', 3, 'number'),
      port('data_in_event', 'Event', 'data', 'in', 'left', 4, 'eventPayload'),
      port('tool_in', 'UI Root', 'tool', 'in', 'bottom', 0, 'domElement'),
      port('data_out_el', 'Element', 'data', 'out', 'right', 2, 'domElement')
    ],
    defaultConfig: {
      defaultEmoji: '🚀',
      defaultSizePx: 96,
      positionMode: 'fromEvent',
      offsetX: 10,
      offsetY: -10
    }
  },

  'ui.animateFly': {
    type: 'ui.animateFly',
    title: 'Animate Fly',
    group: 'UI',
    description: 'Animates a DOM element flying across the screen with scaling.',
    color: '#56311a',
    ports: [
      port('exec_in', 'In', 'exec', 'in', 'left', 0),
      port('exec_out', 'Out', 'exec', 'out', 'right', 0),
      port('data_in_el', 'Element', 'data', 'in', 'left', 2, 'domElement', true),
      port('data_in_toX', 'To X', 'data', 'in', 'left', 3, 'number'),
      port('data_in_toY', 'To Y', 'data', 'in', 'left', 4, 'number'),
      port('data_in_ms', 'Duration ms', 'data', 'in', 'left', 5, 'number'),
      port('data_out_el', 'Element', 'data', 'out', 'right', 2, 'domElement')
    ],
    defaultConfig: {
      toX: 900,
      toY: -120,
      durationMs: 900,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      startScale: 1,
      endScale: 1.7
    }
  },

  'ui.removeElement': {
    type: 'ui.removeElement',
    title: 'Remove Element',
    group: 'UI',
    description: 'Removes a DOM element from the screen.',
    color: '#56311a',
    ports: [
      port('exec_in', 'In', 'exec', 'in', 'left', 0),
      port('exec_out', 'Out', 'exec', 'out', 'right', 0),
      port('data_in_el', 'Element', 'data', 'in', 'left', 2, 'domElement', true)
    ],
    defaultConfig: {}
  },

  'debug.log': {
    type: 'debug.log',
    title: 'Debug Log',
    group: 'Debug',
    description: 'Console.log a value (or the event payload).',
    color: '#273042',
    ports: [
      port('exec_in', 'In', 'exec', 'in', 'left', 0),
      port('exec_out', 'Out', 'exec', 'out', 'right', 0),
      port('data_in', 'Value', 'data', 'in', 'left', 2, 'any')
    ],
    defaultConfig: { label: 'debug' }
  },

  'logic.evalJs': {
    type: 'logic.evalJs',
    title: 'Eval JS (Unsafe)',
    group: 'Logic',
    description:
      'Executes arbitrary JavaScript from config. This is powerful and dangerous; use only in trusted authoring environments.',
    color: '#4a1f2a',
    ports: [
      port('exec_in', 'In', 'exec', 'in', 'left', 0),
      port('exec_out', 'Out', 'exec', 'out', 'right', 0),
      port('data_in', 'Input', 'data', 'in', 'left', 2, 'json'),
      port('data_out', 'Output', 'data', 'out', 'right', 2, 'json'),
      port('error_out', 'Error', 'error', 'out', 'right', 3, 'error')
    ],
    defaultConfig: {
      code: "// ctx: {event, now, vars}\n// input: any\nreturn { ok: true, input };"
    }
  }
};

export function makeNode(type: string, position: { x: number; y: number }): GraphNode {
  const spec = nodeCatalog[type];
  if (!spec) throw new Error(`Unknown node type: ${type}`);
  return {
    id: `node_${crypto.randomUUID()}`,
    type: spec.type,
    title: spec.title,
    color: spec.color,
    position,
    ports: spec.ports.map((p) => ({ ...p })),
    config: structuredClone(spec.defaultConfig)
  };
}
