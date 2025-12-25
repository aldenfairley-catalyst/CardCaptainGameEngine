import { memo } from 'react';
import { Handle, NodeProps, Position } from 'reactflow';
import { PortSpec } from '@/lib/types';

type ForgeNodeData = {
  title: string;
  type: string;
  color: string;
  ports: PortSpec[];
};

function sideToPosition(side: PortSpec['side']): Position {
  switch (side) {
    case 'left':
      return Position.Left;
    case 'right':
      return Position.Right;
    case 'top':
      return Position.Top;
    case 'bottom':
      return Position.Bottom;
  }
}

function portOffset(port: PortSpec): React.CSSProperties {
  const pct = 20 + port.slot * 18;
  if (port.side === 'left' || port.side === 'right') return { top: `${pct}%` };
  return { left: `${pct}%` };
}

function PortDot({ port }: { port: PortSpec }) {
  return (
    <div
      className={`portDot shape-${port.shape}`}
      style={{ borderColor: port.color, background: 'rgba(0,0,0,0.25)' }}
      title={`${port.name}${port.dataType ? ` : ${port.dataType}` : ''}`}
    />
  );
}

function ForgeNodeInner({ data, selected }: NodeProps<ForgeNodeData>) {
  return (
    <div className={`forgeNode ${selected ? 'selected' : ''}`} style={{ borderColor: 'rgba(255,255,255,0.16)' }}>
      <div className="forgeNodeTitle" style={{ background: data.color }}>
        <div>{data.title}</div>
        <div className="forgeNodeType">{data.type}</div>
      </div>

      {/* Ports */}
      {data.ports.map((p) => {
        const isSource = p.direction === 'out';
        const id = p.id;
        return (
          <div
            key={`${data.type}:${id}`}
            className={`portWrap side-${p.side}`}
            style={port_attach(p)}
          >
            <PortDot port={p} />
            <Handle
              id={id}
              type={isSource ? 'source' : 'target'}
              position={sideToPosition(p.side)}
              style={{ ...portOffset(p), opacity: 0, width: 18, height: 18, border: 'none', background: 'transparent' }}
              isConnectable={true}
            />
          </div>
        );
      })}

      <div className="forgeNodeBody">
        <div className="small">Click to configure.</div>
      </div>
    </div>
  );
}

function port_attach(p: PortSpec): React.CSSProperties {
  const offset = portOffset(p);
  if (p.side === 'left') return { left: -10, ...offset };
  if (p.side === 'right') return { right: -10, ...offset };
  if (p.side === 'top') return { top: -10, ...offset };
  return { bottom: -10, ...offset };
}

export default memo(ForgeNodeInner);
