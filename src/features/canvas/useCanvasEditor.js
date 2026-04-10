import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
} from '@xyflow/react'
import { loadProject, saveProject } from '../../storage.js'
import {
  createId,
  createNewNode,
  createStarterGraph,
  normalizeGraphLayout,
  normalizeEdge,
  normalizeNode,
} from './model.js'
import {
  createSimulationState,
  getEdgeResourceNames,
  simulateResources,
} from './simulation.js'

export function useCanvasEditor() {
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [editingNodeId, setEditingNodeId] = useState(null)
  const [isReady, setIsReady] = useState(false)
  const [simulationState, setSimulationState] = useState(createSimulationState([]))
  const [simulationClock, setSimulationClock] = useState(0)
  const reconnectSucceededRef = useRef(false)
  const graphRef = useRef({ nodes: [], edges: [] })

  const editingNode = nodes.find((node) => node.id === editingNodeId) ?? null

  const persistProject = useEffectEvent(async (project) => {
    try {
      await saveProject(project)
    } catch {
      // Keep the canvas usable even if IndexedDB is unavailable.
    }
  })

  useEffect(() => {
    let cancelled = false

    async function hydrateProject() {
      try {
        const savedProject = await loadProject()
        const project =
          savedProject?.nodes?.length
            ? {
                nodes: normalizeGraphLayout(
                  savedProject.nodes.map((node, index) => normalizeNode(node, index + 1)),
                ),
                edges: (savedProject?.edges ?? []).map(normalizeEdge),
              }
            : createStarterGraph()

        if (cancelled) {
          return
        }

        setNodes(project.nodes)
        setEdges(project.edges)
        setSimulationState(createSimulationState(project.nodes))
        setIsReady(true)
      } catch {
        if (!cancelled) {
          const fallbackProject = createStarterGraph()

          setNodes(fallbackProject.nodes)
          setEdges(fallbackProject.edges)
          setSimulationState(createSimulationState(fallbackProject.nodes))
          setIsReady(true)
        }
      }
    }

    hydrateProject()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isReady) {
      return undefined
    }

    const timeoutId = window.setTimeout(() => {
      persistProject({ nodes, edges })
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [nodes, edges, isReady])

  useEffect(() => {
    graphRef.current = { nodes, edges }
  }, [nodes, edges])

  useEffect(() => {
    if (!isReady) {
      return undefined
    }

    let previousTime = performance.now()
    const intervalId = window.setInterval(() => {
      const currentTime = performance.now()
      const elapsedSeconds = Math.min((currentTime - previousTime) / 1000, 0.5)
      previousTime = currentTime
      setSimulationState((currentState) =>
        simulateResources(
          graphRef.current.nodes,
          graphRef.current.edges,
          currentState,
          elapsedSeconds,
          currentTime,
        ),
      )
      setSimulationClock(currentTime)
    }, 250)

    return () => window.clearInterval(intervalId)
  }, [isReady])

  const handleNodesChange = useCallback((changes) => {
    const removedNodeIds = changes
      .filter((change) => change.type === 'remove')
      .map((change) => change.id)

    if (removedNodeIds.length) {
      const removedNodeIdsSet = new Set(removedNodeIds)

      setSelectedNodeId((currentSelectedNodeId) =>
        removedNodeIdsSet.has(currentSelectedNodeId) ? null : currentSelectedNodeId,
      )
      setEditingNodeId((currentEditingNodeId) =>
        removedNodeIdsSet.has(currentEditingNodeId) ? null : currentEditingNodeId,
      )
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => !removedNodeIdsSet.has(edge.source) && !removedNodeIdsSet.has(edge.target),
        ),
      )
    }

    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes))
  }, [])

  const handleEdgesChange = useCallback((changes) => {
    const removedEdgeIds = changes
      .filter((change) => change.type === 'remove')
      .map((change) => change.id)

    if (removedEdgeIds.length) {
      const removedEdgeIdsSet = new Set(removedEdgeIds)

      setSelectedEdgeId((currentSelectedEdgeId) =>
        removedEdgeIdsSet.has(currentSelectedEdgeId) ? null : currentSelectedEdgeId,
      )
    }

    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges))
  }, [])

  const handleConnect = useCallback((connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) {
      return
    }

    setEdges((currentEdges) =>
      addEdge(
        {
          ...connection,
          id: createId('edge'),
          type: 'smoothstep',
        },
        currentEdges,
      ),
    )
  }, [])

  const handleReconnectStart = useCallback(() => {
    reconnectSucceededRef.current = false
  }, [])

  const handleReconnect = useCallback((oldEdge, newConnection) => {
    if (
      !newConnection.source ||
      !newConnection.target ||
      newConnection.source === newConnection.target
    ) {
      return
    }

    reconnectSucceededRef.current = true
    setEdges((currentEdges) =>
      reconnectEdge(oldEdge, newConnection, currentEdges, { shouldReplaceId: false }),
    )
    setSelectedEdgeId(oldEdge.id)
    setSelectedNodeId(null)
  }, [])

  const handleReconnectEnd = useCallback((_, edge) => {
    if (reconnectSucceededRef.current) {
      reconnectSucceededRef.current = false
      return
    }

    setEdges((currentEdges) => currentEdges.filter((currentEdge) => currentEdge.id !== edge.id))
    reconnectSucceededRef.current = false

    setSelectedEdgeId((currentSelectedEdgeId) =>
      currentSelectedEdgeId === edge.id ? null : currentSelectedEdgeId,
    )
  }, [])

  const handleSelectionChange = useCallback(({ nodes: pickedNodes, edges: pickedEdges }) => {
    setSelectedNodeId(pickedNodes[0]?.id ?? null)
    setSelectedEdgeId(pickedEdges[0]?.id ?? null)
  }, [])

  const handleNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
    setEditingNodeId(node.id)
  }, [])

  const handleAddNode = useCallback((position) => {
    const nextIndex = graphRef.current.nodes.length + 1
    const nextNode = createNewNode(nextIndex, position)

    setNodes((currentNodes) => [...currentNodes, nextNode])
    setSelectedNodeId(nextNode.id)
    setSelectedEdgeId(null)
  }, [])

  const handleRemoveSelected = useCallback(() => {
    if (selectedNodeId) {
      setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedNodeId))
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId,
        ),
      )

      if (editingNodeId === selectedNodeId) {
        setEditingNodeId(null)
      }

      setSelectedNodeId(null)
      return
    }

    if (selectedEdgeId) {
      setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== selectedEdgeId))
      setSelectedEdgeId(null)
    }
  }, [editingNodeId, selectedEdgeId, selectedNodeId])

  const updateEditingNode = useCallback((updater) => {
    if (!editingNodeId) {
      return
    }

    setNodes((currentNodes) =>
      currentNodes.map((node, index) =>
        node.id === editingNodeId ? normalizeNode(updater(node), index + 1) : node,
      ),
    )
  }, [editingNodeId])

  const handleNodeFieldChange = useCallback((field, value) => {
    updateEditingNode((node) => ({
      ...node,
      data: {
        ...node.data,
        [field]: value,
      },
    }))
  }, [updateEditingNode])

  const handlePortChange = useCallback((portType, portId, field, value) => {
    updateEditingNode((node) => ({
      ...node,
      data: {
        ...node.data,
        [portType]: node.data[portType].map((port) =>
          port.id === portId
            ? {
                ...port,
                [field]: value,
              }
            : port,
        ),
      },
    }))
  }, [updateEditingNode])

  const handleAddPort = useCallback((portType) => {
    updateEditingNode((node) => ({
      ...node,
      data: {
        ...node.data,
        [portType]: [
          ...node.data[portType],
          { id: createId('port'), resource: '', amount: 1 },
        ],
      },
    }))
  }, [updateEditingNode])

  const handleRemovePort = useCallback((portType, portId) => {
    updateEditingNode((node) => ({
      ...node,
      data: {
        ...node.data,
        [portType]: node.data[portType].filter((port) => port.id !== portId),
      },
    }))
  }, [updateEditingNode])

  const canvasNodes = useMemo(() => {
    return nodes.map((node) => {
      const runtime = simulationState.runtimeByNodeId[node.id] ?? {
        progress: 0,
        inventory: {},
        lastStatus: 'idle',
      }
      const inventoryItems = Object.entries(runtime.inventory ?? {})
        .filter(([, amount]) => amount > 0)
        .sort(([left], [right]) => left.localeCompare(right))

      const simulation = {
        progressPercent: Math.min(100, (runtime.progress / Math.max(node.data.cycleTime, 0.1)) * 100),
        inventoryItems,
        hasInputs: node.data.inputs.some((item) => item.resource),
        status: runtime.lastStatus,
      }

      return {
        ...node,
        type: 'canvasNode',
        data: {
          ...node.data,
          simulation,
        },
      }
    })
  }, [nodes, simulationState])

  const canvasEdges = useMemo(() => {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]))

    return edges.map((edge) => {
      const resources = getEdgeResourceNames(edge, nodeMap)
      const activity = simulationState.edgeActivityById[edge.id]
      const isActive = Boolean(activity && simulationClock - activity.timestamp < 1600)
      const sourceAccent = nodeMap.get(edge.source)?.data.accent ?? '#147a78'

      return {
        ...edge,
        type: 'smoothstep',
        animated: isActive,
        label: activity?.label ?? (resources.length ? resources.join(', ') : ''),
        labelStyle: { fill: '#17332d', fontSize: 11, fontWeight: 600 },
        labelBgStyle: { fill: 'rgba(255, 251, 245, 0.95)' },
        labelBgPadding: [10, 6],
        labelBgBorderRadius: 999,
        style: {
          stroke: sourceAccent,
          strokeWidth: 2.5,
          strokeOpacity: isActive ? 0.95 : 0.36,
        },
      }
    })
  }, [edges, nodes, simulationClock, simulationState])

  return {
    nodes: canvasNodes,
    canvasEdges,
    editingNode,
    handleAddNode,
    handleRemoveSelected,
    handleNodeClick,
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleReconnectStart,
    handleReconnect,
    handleReconnectEnd,
    handleSelectionChange,
    handleNodeFieldChange,
    handlePortChange,
    handleAddPort,
    handleRemovePort,
    closeEditor: () => setEditingNodeId(null),
  }
}
