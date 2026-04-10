import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './App.css'
import { CanvasEditor } from './features/canvas/CanvasEditor.jsx'

function App() {
  return (
    <ReactFlowProvider>
      <CanvasEditor />
    </ReactFlowProvider>
  )
}

export default App
