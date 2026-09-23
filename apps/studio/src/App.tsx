import React from 'react'
import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import { AvatarShapeUtil } from './shapes/AvatarCanvasShape.js'
import { VectorStudioShapeUtil } from './shapes/VectorStudioCanvasShape.js'
import { BlenderConnectorShapeUtil } from './shapes/BlenderConnectorCanvasShape.js'
import { StudioHeader } from './components/StudioHeader.js'

const customShapeUtils = [AvatarShapeUtil, VectorStudioShapeUtil, BlenderConnectorShapeUtil]

export function App() {
  const handleMount = (editor: any) => {
    // Check if shapes already exist, if not, spawn starter workstation nodes
    const existingShapes = editor.getCurrentPageShapes()
    if (existingShapes.length === 0) {
      // 1. Avatar Stage
      editor.createShape({
        type: 'avatar' as any,
        x: 100,
        y: 120,
        props: {
          w: 340,
          h: 480,
          character: 'cholita-3d',
          avatarState: 'idle',
          speech: 'Welcome to blenderSVG Studio! Ready on canvas.'
        }
      })

      // 2. Vector Studio
      editor.createShape({
        type: 'vector-studio' as any,
        x: 500,
        y: 120,
        props: {
          w: 420,
          h: 520,
          engine: 'vtracer',
          openRouterModel: 'google/gemini-2.0-flash-exp:free',
          detail: 'balanced',
          lastSvg: '',
          isProcessing: false
        }
      })

      // 3. Blender Connector
      editor.createShape({
        type: 'blender-connector' as any,
        x: 980,
        y: 120,
        props: {
          w: 360,
          h: 380,
          blenderVersion: 'Blender 4.5.3 LTS',
          isConnected: true,
          activeScene: 'cholita.blend',
          lastExport: ''
        }
      })

      editor.zoomToFit({ duration: 400 })
    }
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <Tldraw shapeUtils={customShapeUtils} onMount={handleMount}>
        <StudioHeader />
      </Tldraw>
    </div>
  )
}
export default App
