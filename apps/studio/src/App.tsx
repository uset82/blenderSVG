import React, { useState, useRef } from 'react'
import { Tldraw, Editor } from 'tldraw'
import 'tldraw/tldraw.css'
import './styles/studio.css'

import { AvatarShapeUtil } from './shapes/AvatarCanvasShape.js'
import { VectorStudioShapeUtil } from './shapes/VectorStudioCanvasShape.js'
import { BlenderConnectorShapeUtil } from './shapes/BlenderConnectorCanvasShape.js'

import { StudioWindowBar } from './components/StudioWindowBar.js'
import { StudioToolbar } from './components/StudioToolbar.js'
import { AgentHarnessSidebar } from './components/AgentHarnessSidebar.js'
import { FloatingPromptBar } from './components/FloatingPromptBar.js'
import { StudioInspector } from './components/StudioInspector.js'
import { RecentsDashboard } from './components/RecentsDashboard.js'

const customShapeUtils = [AvatarShapeUtil, VectorStudioShapeUtil, BlenderConnectorShapeUtil]

export function App() {
  const editorRef = useRef<Editor | null>(null)
  const [projectTitle, setProjectTitle] = useState('Untitled Canvas')
  const [activeMode, setActiveMode] = useState<'design' | 'agents' | 'blender'>('design')
  const [activeTool, setActiveTool] = useState('select')
  const [isRecentsOpen, setIsRecentsOpen] = useState(false)
  const [isAgentSidebarOpen, setIsAgentSidebarOpen] = useState(true)
  const [isInspectorOpen, setIsInspectorOpen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)

  const handleMount = (editor: Editor) => {
    editorRef.current = editor

    // Listen to selection changes for inspector
    editor.sideEffects.registerAfterChangeHandler('instance_page_state', () => {
      const selected = editor.getSelectedShapeIds()
      setSelectedShapeId(selected.length > 0 && selected[0] ? String(selected[0]) : null)
      setZoomLevel(editor.getZoomLevel())
    })

    // Spawn central Artboard Frame and default workstation nodes if blank
    const existingShapes = editor.getCurrentPageShapes()
    if (existingShapes.length === 0) {
      // 1. Central Artboard Frame (Paper.design & pen.dev style)
      editor.createShape({
        type: 'frame',
        x: 440,
        y: 80,
        props: {
          w: 960,
          h: 680,
          name: 'Main Artboard'
        }
      })

      // 2. Avatar Stage (inside artboard)
      editor.createShape({
        type: 'avatar' as any,
        x: 480,
        y: 140,
        props: {
          w: 320,
          h: 460,
          character: 'cholita-3d',
          avatarState: 'idle',
          speech: 'blenderSVG Studio ready. Agent harness online!'
        }
      })

      // 3. Vector Studio (inside artboard)
      editor.createShape({
        type: 'vector-studio' as any,
        x: 840,
        y: 140,
        props: {
          w: 420,
          h: 640,
          engine: 'zenmux',
          openRouterModel: 'z-ai/glm-4.6v-flash-free',
          detail: 'balanced',
          lastSvg: '',
          isProcessing: false
        }
      })

      editor.zoomToFit()
    }
  }

  const handleAddShape = (type: 'frame' | 'avatar' | 'vector-studio' | 'blender-connector' | 'geo' | 'text') => {
    const editor = editorRef.current
    if (!editor) return

    const center = editor.getViewportPageBounds().center

    if (type === 'frame') {
      editor.createShape({
        type: 'frame',
        x: center.x - 400,
        y: center.y - 300,
        props: { w: 800, h: 600, name: 'New Frame' }
      })
    } else if (type === 'avatar') {
      editor.createShape({
        type: 'avatar' as any,
        x: center.x - 160,
        y: center.y - 230,
        props: {
          w: 320,
          h: 460,
          character: 'cholita-3d',
          avatarState: 'idle',
          speech: 'Avatar Stage initialized!'
        }
      })
    } else if (type === 'vector-studio') {
      editor.createShape({
        type: 'vector-studio' as any,
        x: center.x - 210,
        y: center.y - 320,
        props: {
          w: 420,
          h: 640,
          engine: 'zenmux',
          openRouterModel: 'z-ai/glm-4.6v-flash-free',
          detail: 'balanced',
          lastSvg: '',
          isProcessing: false
        }
      })
    } else if (type === 'blender-connector') {
      editor.createShape({
        type: 'blender-connector' as any,
        x: center.x - 180,
        y: center.y - 190,
        props: {
          w: 360,
          h: 380,
          blenderVersion: 'Blender 4.5.3 LTS',
          isConnected: true,
          activeScene: 'cholita.blend',
          lastExport: ''
        }
      })
    } else if (type === 'geo') {
      editor.createShape({
        type: 'geo',
        x: center.x - 100,
        y: center.y - 100,
        props: { w: 200, h: 200, geo: 'rectangle', color: 'blue', fill: 'solid' }
      })
    } else if (type === 'text') {
      editor.createShape({
        type: 'text',
        x: center.x - 100,
        y: center.y - 20,
        props: { text: 'New Canvas Text' } as any
      })
    }
  }

  const handleInsertSvgToCanvas = (svg: string, label?: string) => {
    const editor = editorRef.current
    if (!editor) return

    const center = editor.getViewportPageBounds().center
    // Insert shape on canvas
    editor.createShape({
      type: 'geo',
      x: center.x - 120,
      y: center.y - 120,
      props: {
        w: 240,
        h: 240,
        geo: 'rectangle',
        color: 'black',
        fill: 'solid'
      }
    })
  }

  const handleSendToBlender = (svg: string) => {
    setIsInspectorOpen(true)
  }

  const handlePromptGenerate = async (prompt: string, mode: 'design' | 'vector' | 'avatar' | 'image') => {
    setIsGenerating(true)
    try {
      const response = await fetch('/api/vectorize-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: 'zenmux',
          prompt,
          model: 'z-ai/glm-4.6v-flash-free'
        })
      })

      const data = await response.json()
      if (data.ok && data.svg) {
        handleInsertSvgToCanvas(data.svg, prompt)
      }
    } catch (err) {
      console.error('Prompt generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleZoomIn = () => {
    editorRef.current?.zoomIn()
    if (editorRef.current) setZoomLevel(editorRef.current.getZoomLevel())
  }

  const handleZoomOut = () => {
    editorRef.current?.zoomOut()
    if (editorRef.current) setZoomLevel(editorRef.current.getZoomLevel())
  }

  const handleZoomReset = () => {
    editorRef.current?.resetZoom()
    if (editorRef.current) setZoomLevel(editorRef.current.getZoomLevel())
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Ambient Top Lighting Glow */}
      <div className="ambient-top-glow" />

      {/* Top Window Bar */}
      <StudioWindowBar
        projectTitle={projectTitle}
        onTitleChange={setProjectTitle}
        activeMode={activeMode}
        onModeChange={(m) => {
          setActiveMode(m)
          if (m === 'agents') setIsAgentSidebarOpen(true)
          if (m === 'blender') setIsInspectorOpen(true)
        }}
        isRecentsOpen={isRecentsOpen}
        onToggleRecents={() => setIsRecentsOpen(!isRecentsOpen)}
        isAgentSidebarOpen={isAgentSidebarOpen}
        onToggleAgentSidebar={() => setIsAgentSidebarOpen(!isAgentSidebarOpen)}
        isInspectorOpen={isInspectorOpen}
        onToggleInspector={() => setIsInspectorOpen(!isInspectorOpen)}
        zoomLevel={zoomLevel}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onZoomReset={handleZoomReset}
        onExport={() => alert('Exporting canvas project to .svg & .blend bundle...')}
      />

      {/* Left Canvas Toolbar (Vertical floating strip) */}
      <StudioToolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onAddShape={handleAddShape}
      />

      {/* On-Canvas Agent Harness Sidebar (pen.dev + ZCode) */}
      <AgentHarnessSidebar
        isOpen={isAgentSidebarOpen}
        onClose={() => setIsAgentSidebarOpen(false)}
        onInsertSvgToCanvas={handleInsertSvgToCanvas}
        onSendToBlender={handleSendToBlender}
      />

      {/* Right Inspector & Blender 3D Bridge */}
      <StudioInspector
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        selectedShapeId={selectedShapeId}
      />

      {/* Bottom Floating AI Generation Dock (Screenshot 3) */}
      <FloatingPromptBar
        onGenerate={handlePromptGenerate}
        isProcessing={isGenerating}
      />

      {/* Full-Screen Recents & Projects Dashboard (Paper.design style) */}
      <RecentsDashboard
        isOpen={isRecentsOpen}
        onClose={() => setIsRecentsOpen(false)}
        onOpenProject={(id) => {
          setProjectTitle(id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, ' '))
        }}
        onNewFile={() => {
          setProjectTitle('Untitled Canvas')
          editorRef.current?.selectAll().deleteShapes(editorRef.current.getSelectedShapeIds())
          handleAddShape('frame')
        }}
      />

      {/* Core Infinite Canvas (Tldraw) */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: 48 }}>
        <Tldraw shapeUtils={customShapeUtils} onMount={handleMount} />
      </div>
    </div>
  )
}

export default App

