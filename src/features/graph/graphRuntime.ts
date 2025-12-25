import { ActionGraph, ConnectorKind, GraphEdge, GraphNode } from '@/lib/types';

export type RuntimeStartOptions = {
  overlayMountId: string;
  log?: (msg: string, data?: any) => void;
};

export type RuntimeHandle = {
  stop: () => void;
};

type NodeId = string;
type PortId = string;

type RuntimeCtx = {
  graph: ActionGraph;
  opts: RuntimeStartOptions;
  values: Map<string, unknown>;
  lastEvent?: {
    type: string;
    clientX: number;
    clientY: number;
    time: number;
  };
};

function key(nodeId: string, portId: string) {
  return `${nodeId}:${portId}`;
}

export function startRuntime(graph: ActionGraph, opts: RuntimeStartOptions): RuntimeHandle {
  const ctx: RuntimeCtx = { graph, opts, values: new Map() };
  const listeners: Array<() => void> = [];

  // Precompute constants + tool roots (pure producers)
  for (const n of graph.nodes) {
    if (n.type === 'data.constString') {
      ctx.values.set(key(n.id, 'data_out'), String(n.config.value ?? ''));
    }
    if (n.type === 'data.constNumber') {
      ctx.values.set(key(n.id, 'data_out'), Number(n.config.value ?? 0));
    }
    if (n.type === 'tool.uiRoot') {
      const mountId = String(n.config.mountId ?? opts.overlayMountId);
      ctx.values.set(key(n.id, 'tool_out'), ensureOverlay(mountId));
    }
  }

  // Start listeners
  for (const n of graph.nodes) {
    if (n.type === 'event.uiHover') {
      const selector = String(n.config.selector ?? '#hoverTarget');
      const eventType = String(n.config.eventType ?? 'mouseover');
      const el = document.querySelector(selector);
      if (!el) {
        log(ctx, `Listener target not found for selector: ${selector}`);
        continue;
      }
      const handler = (ev: any) => {
        ctx.lastEvent = {
          type: eventType,
          clientX: ev?.clientX ?? 0,
          clientY: ev?.clientY ?? 0,
          time: Date.now()
        };
        ctx.values.set(key(n.id, 'data_out_event'), {
          ...ctx.lastEvent
        });
        void runExecFrom(n.id, 'exec_out', ctx);
      };
      el.addEventListener(eventType, handler);
      listeners.push(() => el.removeEventListener(eventType, handler));
      log(ctx, `Listener armed: ${eventType} on ${selector}`);
    }
  }

  return {
    stop: () => {
      listeners.forEach((fn) => fn());
    }
  };
}

async function runExecFrom(nodeId: NodeId, outPortId: PortId, ctx: RuntimeCtx) {
  // Find exec edges out of the given node/port
  const outs = ctx.graph.edges.filter((e) => e.kind === 'exec' && e.from.nodeId === nodeId && e.from.portId === outPortId);
  for (const e of outs) {
    await executeNode(e.to.nodeId, ctx);
  }
}

async function executeNode(nodeId: NodeId, ctx: RuntimeCtx) {
  const node = ctx.graph.nodes.find((n) => n.id === nodeId);
  if (!node) return;

  // Run node behavior
  switch (node.type) {
    case 'ui.spawnEmoji': {
      const root = (resolveInputOfKind(node, 'tool', 'tool_in', ctx) as HTMLElement) ?? ensureOverlay(ctx.opts.overlayMountId);
      const emoji = (resolveInputOfKind(node, 'data', 'data_in_emoji', ctx) as string) ?? String(node.config.defaultEmoji ?? '✨');
      const size = (resolveInputOfKind(node, 'data', 'data_in_size', ctx) as number) ?? Number(node.config.defaultSizePx ?? 120);
      const evt = (resolveInputOfKind(node, 'data', 'data_in_event', ctx) as any) ?? ctx.lastEvent;
      const x = (evt?.clientX ?? window.innerWidth / 2) + (Number(node.config.offsetX ?? 0) || 0);
      const y = (evt?.clientY ?? window.innerHeight / 2) + (Number(node.config.offsetY ?? 0) || 0);

      const el = document.createElement('div');
      el.textContent = emoji;
      el.style.position = 'fixed';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.fontSize = `${size}px`;
      el.style.transform = 'translate(-50%, -50%) scale(1)';
      el.style.willChange = 'transform, opacity';
      el.style.pointerEvents = 'none';
      el.style.filter = 'drop-shadow(0 12px 22px rgba(0,0,0,0.45))';
      root.appendChild(el);

      ctx.values.set(key(node.id, 'data_out_el'), el);
      log(ctx, 'Spawned emoji', { emoji, x, y, size });

      await runExecFrom(node.id, 'exec_out', ctx);
      return;
    }

    case 'ui.animateFly': {
      const el = resolveInputOfKind(node, 'data', 'data_in_el', ctx) as HTMLElement | undefined;
      if (!el) {
        log(ctx, 'AnimateFly: missing element input');
        return;
      }

      const toX = Number(resolveInputOfKind(node, 'data', 'data_in_toX', ctx) ?? node.config.toX ?? 900);
      const toY = Number(resolveInputOfKind(node, 'data', 'data_in_toY', ctx) ?? node.config.toY ?? -200);
      const durationMs = Number(resolveInputOfKind(node, 'data', 'data_in_duration', ctx) ?? node.config.durationMs ?? 900);
      const scaleTo = Number(resolveInputOfKind(node, 'data', 'data_in_scaleTo', ctx) ?? node.config.scaleTo ?? 1.6);

      const a = el.animate(
        [
          { transform: el.style.transform, opacity: 1 },
          { transform: `translate(${toX}px, ${toY}px) scale(${scaleTo})`, opacity: 0.9 },
          { transform: `translate(${toX * 1.08}px, ${toY * 1.08}px) scale(${scaleTo * 1.05})`, opacity: 0 }
        ],
        {
          duration: durationMs,
          easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)'
        }
      );
      await a.finished.catch(() => void 0);

      ctx.values.set(key(node.id, 'data_out_el'), el);
      log(ctx, 'Animated emoji', { toX, toY, durationMs });

      await runExecFrom(node.id, 'exec_out', ctx);
      return;
    }

    case 'ui.removeElement': {
      const el = resolveInputOfKind(node, 'data', 'data_in_el', ctx) as HTMLElement | undefined;
      if (el?.parentElement) el.parentElement.removeChild(el);
      log(ctx, 'Removed element');
      await runExecFrom(node.id, 'exec_out', ctx);
      return;
    }

    case 'debug.log': {
      const prefix = String(node.config.prefix ?? '[graph]');
      const v = resolveInputOfKind(node, 'data', 'data_in', ctx);
      // eslint-disable-next-line no-console
      console.log(prefix, v);
      await runExecFrom(node.id, 'exec_out', ctx);
      return;
    }

    case 'logic.evalJs': {
      const code = String(node.config.code ?? '');
      try {
        const input = resolveInputOfKind(node, 'data', 'data_in', ctx);
        // Unsafe by design for the POC.
        const fn = new Function('input', 'event', 'helpers', code) as (
          input: unknown,
          event: unknown,
          helpers: { log: typeof console.log }
        ) => unknown;
        const out = fn(input, ctx.lastEvent, { log: console.log });
        ctx.values.set(key(node.id, 'data_out'), out);
      } catch (e) {
        ctx.values.set(key(node.id, 'error_out'), { message: String(e) });
      }
      await runExecFrom(node.id, 'exec_out', ctx);
      return;
    }

    default:
      // If it's an event/tool/data-only node, nothing to execute.
      return;
  }
}

function resolveInputOfKind(node: GraphNode, kind: ConnectorKind, inPortId: string, ctx: RuntimeCtx): unknown {
  const edge = ctx.graph.edges.find((e) => e.kind === kind && e.to.nodeId === node.id && e.to.portId === inPortId);
  if (!edge) return undefined;
  // Value might have been produced already.
  const existing = ctx.values.get(key(edge.from.nodeId, edge.from.portId));
  if (existing !== undefined) return existing;

  // Try to compute producers that are pure (constants, tool roots).
  const from = ctx.graph.nodes.find((n) => n.id === edge.from.nodeId);
  if (!from) return undefined;

  if (from.type === 'data.constString') {
    const v = String(from.config.value ?? '');
    ctx.values.set(key(from.id, edge.from.portId), v);
    return v;
  }
  if (from.type === 'data.constNumber') {
    const v = Number(from.config.value ?? 0);
    ctx.values.set(key(from.id, edge.from.portId), v);
    return v;
  }
  if (from.type === 'event.uiHover') {
    const v = ctx.values.get(key(from.id, edge.from.portId));
    return v;
  }
  if (from.type === 'tool.uiRoot') {
    const mountId = String(from.config.mountId ?? ctx.opts.overlayMountId);
    const v = ensureOverlay(mountId);
    ctx.values.set(key(from.id, edge.from.portId), v);
    return v;
  }

  // Otherwise we only support flow-through outputs we already have.
  return undefined;
}

function ensureOverlay(mountId: string): HTMLElement {
  const existing = document.getElementById(mountId);
  if (existing) return existing;
  const el = document.createElement('div');
  el.id = mountId;
  el.style.position = 'fixed';
  el.style.inset = '0';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '9999';
  document.body.appendChild(el);
  return el;
}

function log(ctx: RuntimeCtx, msg: string, data?: any) {
  ctx.opts.log?.(msg, data);
}
