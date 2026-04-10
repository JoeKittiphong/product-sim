import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from 'react'
import { addEdge, reconnectEdge } from '@xyflow/react'
import { loadProject, saveProject } from '../../storage.js'
import { createId, createNewNode, normalizeEdge, normalizeNode } from './model.js'
import {
  buildDisplayEdges,
  buildDisplayNodes,
  createSimulationState,
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

        if (cancelled) {
          return
        }

        const hydratedNodes = (savedProject?.nodes ?? []).map((node, index) =>
          normalizeNode(node, index + 1),
        )
        const hydratedEdges = (savedProject?.edges ?? []).map(normalizeEdge)

        setNodes(hydratedNodes)
        setEdges(hydratedEdges)
        setSimulationState(createSimulationState(hydratedNodes))
        setIsReady(true)
      } catch {
        if (!cancelled) {
          setNodes([])
          setEdges([])
          setSimulationState(createSimulationState([]))
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

    let frameId = 0
    let previousTime = performance.now()

    const step = (currentTime) => {
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

      frameId = window.requestAnimationFrame(step)
    }

    frameId = window.requestAnimationFrame(step)

    return () => window.cancelAnimationFrame(frameId)
  }, [isReady])

  const handleNodesChange = useCallback((changes) => {
    setNodes((currentNodes) => {
      let nextNodes = currentNodes

      changes.forEach((change) => {
        if (change.type === 'position' && change.position) {
          nextNodes = nextNodes.map((node) =>
            node.id === change.id ? { ...node, position: change.position } : node,
          )
        }

        if (change.type === 'remove') {
          nextNodes = nextNodes.filter((node) => node.id !== change.id)
        }
      })

      return nextNodes
    })
  }, [])

  const handleEdgesChange = useCallback((changes) => {
    setEdges((currentEdges) => {
      let nextEdges = currentEdges

      changes.forEach((change) => {
        if (change.type === 'remove') {
          nextEdges = nextEdges.filter((edge) => edge.id !== change.id)
        }
      })

      return nextEdges
    })
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

  const canvasNodes = useMemo(
    () => buildDisplayNodes(nodes, simulationState),
    [nodes, simulationState],
  )

  const canvasEdges = useMemo(
    () => buildDisplayEdges(edges, nodes, simulationState),
    [edges, nodes, simulationState],
  )

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
