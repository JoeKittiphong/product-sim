import { Handle, Position } from '@xyflow/react'
import { formatPortList } from './model.js'

function getRuntimeSnapshot(simulation) {
  return simulation ?? {
    progressPercent: 0,
    inventoryItems: [],
    hasInputs: false,
    status: 'idle',
  }
}

function getStatusText(status) {
  return (
    {
      generating: 'Generating',
      processing: 'Processing',
      waiting: 'Waiting for input',
      ready: 'Ready',
      idle: 'Idle',
    }[status] ?? 'Idle'
  )
}

function CanvasNodeContent({ data, simulation, selected = false }) {
  const runtime = getRuntimeSnapshot(simulation)

  return (
    <div
      className={`canvas-node${selected ? ' is-selected' : ''}`}
      style={{ '--node-accent': data.accent }}
    >
      <strong>{data.label}</strong>
      <span className="canvas-node__meta">{data.cycleTime}s</span>
      <span className="canvas-node__recipe">
        {formatPortList(data.inputs, 'No input')} {'->'}{' '}
        {formatPortList(data.outputs, 'No output')}
      </span>
      <div className="canvas-node__progress">
        <div
          className={`canvas-node__progress-bar ${
            runtime.status === 'waiting' ? 'is-waiting' : ''
          }`}
        >
          <div style={{ width: `${runtime.progressPercent}%` }} />
        </div>
        <span className="canvas-node__status">{getStatusText(runtime.status)}</span>
      </div>
      <div className="canvas-node__inventory">
        {runtime.inventoryItems.length ? (
          runtime.inventoryItems.slice(0, 4).map(([resource, amount]) => (
            <span key={resource} className="canvas-node__inventory-chip">
              {resource} {Number(amount.toFixed(2))}
            </span>
          ))
        ) : (
          <span className="canvas-node__inventory-empty">
            {runtime.hasInputs ? 'Waiting stock' : 'No stock yet'}
          </span>
        )}
      </div>
    </div>
  )
}

export function CanvasNodeCard({ data, simulation }) {
  return <CanvasNodeContent data={data} simulation={simulation} />
}

export function CanvasNode({ data, selected }) {
  return (
    <div className="canvas-node-shell" style={{ '--node-accent': data.accent }}>
      <Handle
        type="target"
        position={Position.Left}
        className="canvas-node__handle canvas-node__handle--target"
      />
      <CanvasNodeContent data={data} simulation={data.simulation} selected={selected} />
      <Handle
        type="source"
        position={Position.Right}
        className="canvas-node__handle canvas-node__handle--source"
      />
    </div>
  )
}
