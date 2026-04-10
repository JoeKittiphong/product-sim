const NODE_COLORS = ['#147a78', '#dc6c35', '#3966d8', '#9a4dd0', '#2b8a4f']
const MAX_SANE_POSITION = 2400

function getFallbackPosition(index) {
  return {
    x: 120 + ((index - 1) % 4) * 260,
    y: 120 + Math.floor((index - 1) / 4) * 180,
  }
}

function normalizePosition(position, index) {
  const fallback = getFallbackPosition(index)
  const x = Number(position?.x)
  const y = Number(position?.y)

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return fallback
  }

  if (Math.abs(x) > MAX_SANE_POSITION || Math.abs(y) > MAX_SANE_POSITION) {
    return fallback
  }

  return { x, y }
}

export function createId(prefix) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

export function clampPositive(value, fallback = 1) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

export function normalizePortList(list) {
  if (!Array.isArray(list)) {
    return []
  }

  return list.map((item) => ({
    id: item?.id ?? createId('port'),
    resource: String(item?.resource ?? '').trim(),
    amount: clampPositive(item?.amount, 1),
  }))
}

export function formatPortList(items, emptyLabel) {
  const validItems = items.filter((item) => item.resource)

  if (!validItems.length) {
    return emptyLabel
  }

  return validItems.map((item) => `${item.resource} x${item.amount}`).join(', ')
}

export function normalizeNode(node, index = 1) {
  const inputs = normalizePortList(node?.data?.inputs ?? [])
  const outputs = normalizePortList(
    node?.data?.outputs ?? [{ resource: `Resource ${index}`, amount: 1 }],
  )

  return {
    id: node?.id ?? createId('node'),
    type: 'canvasNode',
    position: normalizePosition(node?.position, index),
    data: {
      label: String(node?.data?.label ?? '').trim() || `Node ${index}`,
      accent: node?.data?.accent || NODE_COLORS[(index - 1) % NODE_COLORS.length],
      cycleTime: clampPositive(node?.data?.cycleTime, 3),
      inputs,
      outputs,
    },
  }
}

export function normalizeEdge(edge) {
  return {
    id: edge?.id ?? createId('edge'),
    source: edge?.source,
    target: edge?.target,
    type: 'smoothstep',
  }
}

export function createNewNode(index, position) {
  return normalizeNode(
    {
      position: position ?? getFallbackPosition(index),
      data: {
        label: `Node ${index}`,
        accent: NODE_COLORS[(index - 1) % NODE_COLORS.length],
        cycleTime: 3,
        inputs: [],
        outputs: [{ resource: `Resource ${index}`, amount: 1 }],
      },
    },
    index,
  )
}

export function normalizeGraphLayout(nodes) {
  if (!nodes.length) {
    return nodes
  }

  const bounds = nodes.reduce(
    (accumulator, node) => ({
      minX: Math.min(accumulator.minX, node.position.x),
      minY: Math.min(accumulator.minY, node.position.y),
      maxX: Math.max(accumulator.maxX, node.position.x),
      maxY: Math.max(accumulator.maxY, node.position.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  )

  const needsShift =
    bounds.minX < -200 ||
    bounds.minY < -200 ||
    bounds.maxX > 1800 ||
    bounds.maxY > 1800

  if (!needsShift) {
    return nodes
  }

  const offsetX = 120 - bounds.minX
  const offsetY = 120 - bounds.minY

  return nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
  }))
}

export function createStarterGraph() {
  const sourceNode = normalizeNode(
    {
      id: createId('node'),
      position: { x: 120, y: 180 },
      data: {
        label: 'Wood Camp',
        accent: NODE_COLORS[0],
        cycleTime: 2.5,
        inputs: [],
        outputs: [{ resource: 'Wood', amount: 2 }],
      },
    },
    1,
  )

  const processorNode = normalizeNode(
    {
      id: createId('node'),
      position: { x: 460, y: 180 },
      data: {
        label: 'Workshop',
        accent: NODE_COLORS[1],
        cycleTime: 4,
        inputs: [{ resource: 'Wood', amount: 2 }],
        outputs: [{ resource: 'Plank', amount: 1 }],
      },
    },
    2,
  )

  return {
    nodes: [sourceNode, processorNode],
    edges: [
      normalizeEdge({
        id: createId('edge'),
        source: sourceNode.id,
        target: processorNode.id,
      }),
    ],
  }
}
