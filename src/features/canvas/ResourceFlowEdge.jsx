import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react'

export function ResourceFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const isActive = Boolean(data?.isActive)
  const edgeClassName = isActive
    ? 'resource-edge__path resource-edge__path--active'
    : 'resource-edge__path'

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={edgeClassName}
        style={{ stroke: data?.sourceAccent ?? '#147a78' }}
      />
      <EdgeLabelRenderer>
        <div
          className={`resource-edge__label ${isActive ? 'is-active' : ''}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            borderColor: data?.sourceAccent ?? '#147a78',
          }}
        >
          <span className="resource-edge__label-name">
            {data?.activityLabel ?? data?.resourceLabel ?? 'No resource'}
          </span>
          {isActive && <span className="resource-edge__pulse" />}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
