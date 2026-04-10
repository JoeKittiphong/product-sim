import { Handle, Position } from '@xyflow/react'
import { formatPortList } from './model.js'

function getRuntimeSnapshot(simulation) {
  return simulation ?? {
    progressPercent: 0,
    inventoryItems: [],
    hasInputs: false,
    incomingSources: [],
    missingInputs: [],
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
  const visibleIncomingSources = runtime.incomingSources.slice(0, 2)

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
      {visibleIncomingSources.length ? (
        <div className="canvas-node__connections">
          {visibleIncomingSources.map((source) => (
            <span key={source.edgeId} className="canvas-node__connection-chip">
              {source.sourceLabel}: {source.resources.map((resource) => resource.resource).join(', ')}
            </span>
          ))}
          {runtime.incomingSources.length > visibleIncomingSources.length ? (
            <span className="canvas-node__connection-chip">
              +{runtime.incomingSources.length - visibleIncomingSources.length} more
            </span>
          ) : null}
        </div>
      ) : null}
      {runtime.missingInputs.length ? (
        <div className="canvas-node__missing">
          Need {runtime.missingInputs.map((input) => input.resource).join(', ')}
        </div>
      ) : null}
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
