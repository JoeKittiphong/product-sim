const NODE_COLORS = ['#147a78', '#dc6c35', '#3966d8', '#9a4dd0', '#2b8a4f']

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
    position: {
      x: Number(node?.position?.x) || 0,
      y: Number(node?.position?.y) || 0,
    },
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
      position: {
        x: position?.x ?? 140 + ((index - 1) % 4) * 120,
        y: position?.y ?? 120 + ((index - 1) % 5) * 90,
      },
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
