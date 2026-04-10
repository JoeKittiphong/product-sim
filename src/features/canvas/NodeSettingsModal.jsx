export function NodeSettingsModal({
  node,
  onClose,
  onNodeFieldChange,
  onAddPort,
  onPortChange,
  onRemovePort,
}) {
  if (!node) {
    return null
  }

  return (
    <div className="node-modal-backdrop">
      <section className="node-modal" onClick={(event) => event.stopPropagation()}>
        <div className="node-modal__header">
          <div>
            <p className="node-modal__eyebrow">Node Settings</p>
            <h2>{node.data.label}</h2>
          </div>
          <button
            type="button"
            className="node-modal__close"
            onClick={onClose}
            aria-label="Close node settings"
          >
            x
          </button>
        </div>

        <div className="node-modal__grid">
          <label className="field">
            <span>Name</span>
            <input
              value={node.data.label}
              onChange={(event) => onNodeFieldChange('label', event.target.value)}
            />
          </label>

          <label className="field">
            <span>Time (seconds)</span>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={node.data.cycleTime}
              onChange={(event) => onNodeFieldChange('cycleTime', event.target.value)}
            />
          </label>
        </div>

        <section className="port-section">
          <div className="port-section__header">
            <h3>Inputs</h3>
            <button type="button" className="mini-button" onClick={() => onAddPort('inputs')}>
              + input
            </button>
          </div>

          {node.data.inputs.length ? (
            node.data.inputs.map((port) => (
              <div key={port.id} className="port-row">
                <input
                  placeholder="Resource"
                  value={port.resource}
                  onChange={(event) =>
                    onPortChange('inputs', port.id, 'resource', event.target.value)
                  }
                />
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={port.amount}
                  onChange={(event) =>
                    onPortChange('inputs', port.id, 'amount', event.target.value)
                  }
                />
                <button
                  type="button"
                  className="mini-button mini-button--danger"
                  onClick={() => onRemovePort('inputs', port.id)}
                >
                  -
                </button>
              </div>
            ))
          ) : (
            <p className="port-empty">ไม่มี input หมายถึง node นี้ผลิตเองได้</p>
          )}
        </section>

        <section className="port-section">
          <div className="port-section__header">
            <h3>Outputs</h3>
            <button type="button" className="mini-button" onClick={() => onAddPort('outputs')}>
              + output
            </button>
          </div>

          {node.data.outputs.length ? (
            node.data.outputs.map((port) => (
              <div key={port.id} className="port-row">
                <input
                  placeholder="Resource"
                  value={port.resource}
                  onChange={(event) =>
                    onPortChange('outputs', port.id, 'resource', event.target.value)
                  }
                />
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={port.amount}
                  onChange={(event) =>
                    onPortChange('outputs', port.id, 'amount', event.target.value)
                  }
                />
                <button
                  type="button"
                  className="mini-button mini-button--danger"
                  onClick={() => onRemovePort('outputs', port.id)}
                >
                  -
                </button>
              </div>
            ))
          ) : (
            <p className="port-empty">ยังไม่มี output ของ node นี้</p>
          )}
        </section>
      </section>
    </div>
  )
}
