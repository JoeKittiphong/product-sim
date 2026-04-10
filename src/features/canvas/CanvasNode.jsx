import { Handle, Position } from '@xyflow/react'
import { formatPortList } from './model.js'

export function CanvasNode({ data, selected }) {
  const simulation = data.simulation ?? {
    progressPercent: 0,
    inventoryItems: [],
    hasInputs: false,
    status: 'idle',
  }

  const statusText = {
    generating: 'Generating',
    processing: 'Processing',
    waiting: 'Waiting for input',
    ready: 'Ready',
    idle: 'Idle',
  }[simulation.status]

  return (
    <div
      className={`canvas-node ${selected ? 'is-selected' : ''}`}
      style={{ '--node-accent': data.accent }}
    >
      <Handle type="target" position={Position.Left} />
      <strong>{data.label}</strong>
      <span className="canvas-node__meta">{data.cycleTime}s</span>
      <span className="canvas-node__recipe">
        {formatPortList(data.inputs, 'No input')} {'->'}{' '}
        {formatPortList(data.outputs, 'No output')}
      </span>
      <div className="canvas-node__progress">
        <div
          className={`canvas-node__progress-bar ${
            simulation.status === 'waiting' ? 'is-waiting' : ''
          }`}
        >
          <div style={{ width: `${simulation.progressPercent}%` }} />
        </div>
        <span className="canvas-node__status">{statusText}</span>
      </div>
      <div className="canvas-node__inventory">
        {simulation.inventoryItems.length ? (
          simulation.inventoryItems.slice(0, 4).map(([resource, amount]) => (
            <span key={resource} className="canvas-node__inventory-chip">
              {resource} {Number(amount.toFixed(2))}
            </span>
          ))
        ) : (
          <span className="canvas-node__inventory-empty">
            {simulation.hasInputs ? 'Waiting stock' : 'No stock yet'}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}
