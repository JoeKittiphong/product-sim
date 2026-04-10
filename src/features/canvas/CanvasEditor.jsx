import { Background, Controls, ReactFlow, useReactFlow } from '@xyflow/react'
import { edgeTypes } from './edgeTypes.js'
import { NodeSettingsModal } from './NodeSettingsModal.jsx'
import { nodeTypes } from './nodeTypes.js'
import { useCanvasEditor } from './useCanvasEditor.js'

export function CanvasEditor() {
  const { screenToFlowPosition } = useReactFlow()
  const {
    nodes,
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
    closeEditor,
  } = useCanvasEditor()

  const handleAddNodeAtViewportCenter = () => {
    const nextPosition = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })

    handleAddNode({
      x: nextPosition.x - 110,
      y: nextPosition.y - 60,
    })
  }

  return (
    <main className="canvas-shell">
      <div className="floating-actions">
        <button
          type="button"
          className="fab"
          onClick={handleAddNodeAtViewportCenter}
          aria-label="Add node"
        >
          +
        </button>
        <button
          type="button"
          className="fab fab-danger"
          onClick={handleRemoveSelected}
          aria-label="Remove selected node"
        >
          -
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={canvasEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onReconnectStart={handleReconnectStart}
        onReconnect={handleReconnect}
        onReconnectEnd={handleReconnectEnd}
        onSelectionChange={handleSelectionChange}
        fitView
        minZoom={0.3}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
        deleteKeyCode={['Backspace', 'Delete']}
        edgesReconnectable
      >
        <Background gap={28} size={1.2} color="#c1cec8" />
        <Controls showInteractive />
      </ReactFlow>

      <NodeSettingsModal
        node={editingNode}
        onClose={closeEditor}
        onNodeFieldChange={handleNodeFieldChange}
        onAddPort={handleAddPort}
        onPortChange={handlePortChange}
        onRemovePort={handleRemovePort}
      />
    </main>
  )
}
