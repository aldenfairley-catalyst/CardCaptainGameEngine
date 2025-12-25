export type ISODateTime = string;

export type SchemaVersion = 'CJ-0.1';
export type GraphSchemaVersion = 'CJ-GRAPH-0.1';

export type ConnectorKind = 'exec' | 'data' | 'tool' | 'db' | 'error';
export type ConnectorSide = 'left' | 'right' | 'top' | 'bottom';
export type PortDirection = 'in' | 'out';

export type DataType =
  | 'any'
  | 'number'
  | 'string'
  | 'boolean'
  | 'json'
  | 'vector2'
  | 'entityRef'
  | 'eventPayload'
  | 'domElement'
  | 'error';

export type PortShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'hex';

export type PortSpec = {
  id: string;
  name: string;
  kind: ConnectorKind;
  direction: PortDirection;
  side: ConnectorSide;
  slot: number;
  dataType?: DataType;
  shape: PortShape;
  color: string;
  required?: boolean;
};

export type GraphNode = {
  id: string;
  type: string; // nodeTypeId, e.g. 'event.uiHover'
  title: string;
  color: string;
  position: { x: number; y: number };
  ports: PortSpec[];
  config: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  kind: ConnectorKind;
  from: { nodeId: string; portId: string };
  to: { nodeId: string; portId: string };
};

export type ActionGraph = {
  schemaVersion: GraphSchemaVersion;
  graphId: string;
  name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: {
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
  };
};

export type Card = {
  schemaVersion: SchemaVersion;
  cardId: string;
  name: string;
  description?: string;
  tags: string[];
  actions: Array<{
    actionId: string;
    name: string;
    graphId: string;
  }>;
  meta: {
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
  };
};

export type DbInitInfo = {
  kind: 'ready' | 'fallback';
  detail: string;
};

export type ListResult<T> = { items: T[] };
