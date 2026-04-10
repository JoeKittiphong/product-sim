import { clampPositive } from './model.js'

const BUFFER_MULTIPLIER = 2
const MAX_BATCHES_PER_STEP = 24
const MIN_STEP_SECONDS = 1 / 30

function getNodeOutputs(node) {
  return node.data.outputs.filter((output) => output.resource)
}

function getNodeInputs(node) {
  return node.data.inputs.filter((input) => input.resource)
}

function roundAmount(value) {
  return Number.parseFloat(Number(value).toFixed(3))
}

function buildIncomingResourcesByNodeId(nodes, edges) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const incomingResourcesByNodeId = {}

  nodes.forEach((node) => {
    incomingResourcesByNodeId[node.id] = []
  })

  edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source)

    if (!sourceNode || !incomingResourcesByNodeId[edge.target]) {
      return
    }

    getNodeOutputs(sourceNode).forEach((output) => {
      if (!incomingResourcesByNodeId[edge.target].includes(output.resource)) {
        incomingResourcesByNodeId[edge.target].push(output.resource)
      }
    })
  })

  return incomingResourcesByNodeId
}

function getDeclaredResources(node, incomingResources = []) {
  const resources = new Set()

  getNodeInputs(node).forEach((input) => {
    if (input.resource) {
      resources.add(input.resource)
    }
  })

  getNodeOutputs(node).forEach((output) => {
    if (output.resource) {
      resources.add(output.resource)
    }
  })

  incomingResources.forEach((resource) => {
    resources.add(resource)
  })

  return Array.from(resources)
}

function createNodeRuntime(node, previousEntry, incomingResources) {
  const inventory = {}

  getDeclaredResources(node, incomingResources).forEach((resource) => {
    inventory[resource] = Number(previousEntry?.inventory?.[resource] ?? 0)
  })

  return {
    inventory,
    progress: Number(previousEntry?.progress ?? 0),
    lastStatus: previousEntry?.lastStatus ?? 'idle',
  }
}

export function createSimulationState(nodes, edges = []) {
  const incomingResourcesByNodeId = buildIncomingResourcesByNodeId(nodes, edges)

  return {
    runtimeByNodeId: nodes.reduce((accumulator, node) => {
      accumulator[node.id] = createNodeRuntime(
        node,
        undefined,
        incomingResourcesByNodeId[node.id] ?? [],
      )
      return accumulator
    }, {}),
    edgeActivityById: {},
  }
}

function reconcileRuntime(nodes, previousRuntimeByNodeId, edges) {
  const incomingResourcesByNodeId = buildIncomingResourcesByNodeId(nodes, edges)

  return nodes.reduce((accumulator, node) => {
    accumulator[node.id] = createNodeRuntime(
      node,
      previousRuntimeByNodeId?.[node.id],
      incomingResourcesByNodeId[node.id] ?? [],
    )
    return accumulator
  }, {})
}

function formatTransferLabel(transfers) {
  return transfers
    .map((transfer) => `${transfer.resource} x${Number(transfer.amount.toFixed(2))}`)
    .join(', ')
}

export function getEdgeResourceNames(edge, nodeMap) {
  const sourceNode = nodeMap.get(edge.source)
  const targetNode = nodeMap.get(edge.target)

  if (!sourceNode || !targetNode) {
    return []
  }

  const targetInputs = new Set(
    targetNode.data.inputs.filter((item) => item.resource).map((item) => item.resource),
  )

  const outputs = getNodeOutputs(sourceNode)
  const matchingOutputs = outputs.filter((item) => targetInputs.has(item.resource))

  return (matchingOutputs.length ? matchingOutputs : outputs).map((item) => item.resource)
}

export function buildNodeConnectionInsights(nodes, edges) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const insightsByNodeId = nodes.reduce((accumulator, node) => {
    accumulator[node.id] = {
      incomingSources: [],
      missingInputs: [],
    }
    return accumulator
  }, {})

  edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source)
    const targetNode = nodeMap.get(edge.target)

    if (!sourceNode || !targetNode) {
      return
    }

    const targetInputs = new Set(getNodeInputs(targetNode).map((item) => item.resource))
    const sourceOutputs = getNodeOutputs(sourceNode)

    if (!sourceOutputs.length) {
      return
    }

    const preferredOutputs = sourceOutputs.filter((output) => targetInputs.has(output.resource))
    const resourcesToShow = preferredOutputs.length ? preferredOutputs : sourceOutputs

    insightsByNodeId[targetNode.id].incomingSources.push({
      edgeId: edge.id,
      sourceId: sourceNode.id,
      sourceLabel: sourceNode.data.label,
      resources: resourcesToShow.map((resource) => ({
        resource: resource.resource,
        amount: resource.amount,
        matched: targetInputs.has(resource.resource),
      })),
    })
  })

  nodes.forEach((node) => {
    const suppliedResources = new Set(
      insightsByNodeId[node.id].incomingSources.flatMap((source) =>
        source.resources.filter((resource) => resource.matched).map((resource) => resource.resource),
      ),
    )

    insightsByNodeId[node.id].missingInputs = getNodeInputs(node).filter(
      (input) => !suppliedResources.has(input.resource),
    )
  })

  return insightsByNodeId
}

export function buildDisplayNodes(nodes, simulationState) {
  return nodes.map((node) => {
    const runtime = simulationState.runtimeByNodeId[node.id] ?? createNodeRuntime(node)
    const inventoryItems = Object.entries(runtime.inventory)
      .filter(([, amount]) => amount > 0)
      .sort(([left], [right]) => left.localeCompare(right))

    return {
      ...node,
      data: {
        ...node.data,
        simulation: {
          progressPercent:
            Math.min(100, (runtime.progress / clampPositive(node.data.cycleTime, 3)) * 100),
          inventoryItems,
          hasInputs: node.data.inputs.some((item) => item.resource),
          status: runtime.lastStatus,
        },
      },
    }
  })
}

export function buildDisplayEdges(edges, nodes, simulationState) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))

  return edges.map((edge) => {
    const resources = getEdgeResourceNames(edge, nodeMap)
    const activity = simulationState.edgeActivityById[edge.id]
    const isActive = Boolean(activity && performance.now() - activity.timestamp < 1600)
    const sourceAccent = nodeMap.get(edge.source)?.data.accent ?? '#147a78'

    return {
      ...edge,
      type: 'resourceFlow',
      animated: isActive,
      data: {
        resourceLabel: resources.length ? resources.join(', ') : 'No matching resource',
        activityLabel: isActive ? activity.label : null,
        isActive,
        sourceAccent,
      },
    }
  })
}

export function simulateResources(nodes, edges, currentState, elapsedSeconds, now) {
  if (!nodes.length) {
    return createSimulationState(nodes, edges)
  }

  const stepSeconds = Math.max(elapsedSeconds, MIN_STEP_SECONDS)
  const runtimeByNodeId = reconcileRuntime(nodes, currentState.runtimeByNodeId, edges)
  const edgeActivityById = { ...currentState.edgeActivityById }
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const edgesBySource = edges.reduce((accumulator, edge) => {
    if (!accumulator.has(edge.source)) {
      accumulator.set(edge.source, [])
    }

    accumulator.get(edge.source).push(edge)
    return accumulator
  }, new Map())

  nodes.forEach((node) => {
    const runtime = runtimeByNodeId[node.id]
    const cycleTime = clampPositive(node.data.cycleTime, 3)
    const hasRecipeInputs = node.data.inputs.some((input) => input.resource)
    const hasEnoughInputs = () =>
      !hasRecipeInputs ||
      node.data.inputs.every(
        (input) => !input.resource || (runtime.inventory[input.resource] ?? 0) >= input.amount,
      )

    if (hasEnoughInputs()) {
      runtime.progress += stepSeconds
      runtime.lastStatus = hasRecipeInputs ? 'processing' : 'generating'
    } else {
      runtime.lastStatus = 'waiting'
    }

    let completedBatches = 0

    while (
      runtime.progress >= cycleTime &&
      completedBatches < MAX_BATCHES_PER_STEP &&
      hasEnoughInputs()
    ) {
      if (hasRecipeInputs) {
        node.data.inputs.forEach((input) => {
          if (!input.resource) {
            return
          }

          runtime.inventory[input.resource] = roundAmount(
            (runtime.inventory[input.resource] ?? 0) - input.amount,
          )
        })
      }

      node.data.outputs.forEach((output) => {
        if (!output.resource) {
          return
        }

        runtime.inventory[output.resource] = roundAmount(
          (runtime.inventory[output.resource] ?? 0) + output.amount,
        )
      })

      runtime.progress -= cycleTime
      completedBatches += 1
    }

    if (completedBatches === 0 && !hasEnoughInputs() && runtime.progress > cycleTime) {
      runtime.progress = Math.min(runtime.progress, cycleTime * 0.9)
    }
  })

  edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.source)
    const targetNode = nodeMap.get(edge.target)

    if (!sourceNode || !targetNode) {
      return
    }

    const sourceRuntime = runtimeByNodeId[sourceNode.id]
    const targetRuntime = runtimeByNodeId[targetNode.id]
    const transfers = []

    getNodeOutputs(sourceNode).forEach((output) => {
      if (!output.resource) {
        return
      }

      const targetInput = targetNode.data.inputs.find(
        (input) => input.resource && input.resource === output.resource,
      )

      const available = sourceRuntime.inventory[output.resource] ?? 0
      const desired = targetInput
        ? targetInput.amount * BUFFER_MULTIPLIER
        : Math.max(output.amount * BUFFER_MULTIPLIER, BUFFER_MULTIPLIER)
      const currentAtTarget = targetRuntime.inventory[output.resource] ?? 0
      const missing = Math.max(0, desired - currentAtTarget)
      const transferAmount = Math.min(available, missing)

      if (transferAmount <= 0) {
        return
      }

      sourceRuntime.inventory[output.resource] = roundAmount(available - transferAmount)
      targetRuntime.inventory[output.resource] = roundAmount(currentAtTarget + transferAmount)

      transfers.push({
        resource: output.resource,
        amount: transferAmount,
      })
    })

    if (transfers.length) {
      edgeActivityById[edge.id] = {
        label: formatTransferLabel(transfers),
        timestamp: now,
      }
    }
  })

  nodes.forEach((node) => {
    const runtime = runtimeByNodeId[node.id]

    if (!edgesBySource.has(node.id) && runtime.lastStatus === 'idle') {
      runtime.lastStatus = 'ready'
    }
  })

  return {
    runtimeByNodeId,
    edgeActivityById,
  }
}
