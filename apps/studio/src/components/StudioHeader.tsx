import React from 'react'
import { useEditor } from 'tldraw'

export function StudioHeader() {
  const editor = useEditor()

  const handleAddAvatar = () => {
    const center = editor.getViewportPageBounds().center
    editor.createShape({
      type: 'avatar' as any,
      x: center.x - 170,
      y: center.y - 240,
      props: {
        w: 340,
        h: 480,
        character: 'cholita-3d',
        avatarState: 'idle',
        speech: 'Hello from the Infinite Canvas!'
      }
    })
  }

  const handleAddVectorStudio = () => {
    const center = editor.getViewportPageBounds().center
    editor.createShape({
      type: 'vector-studio' as any,
      x: center.x - 210,
      y: center.y - 260,
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
  }

  const handleAddBlender = () => {
    const center = editor.getViewportPageBounds().center
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
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 14,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(22, 27, 34, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 14,
        padding: '6px 12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        userSelect: 'none',
        pointerEvents: 'all'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
        <span style={{ fontSize: 16 }}>🎨</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f3f6' }}>blenderSVG Studio</span>
      </div>

      <div style={{ height: 18, width: 1, background: '#30363d', margin: '0 4px' }} />

      <button
        onClick={handleAddAvatar}
        style={{
          background: '#21262d',
          color: '#e6edf3',
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        <span>🎭</span>
        <span>+ Avatar Stage</span>
      </button>

      <button
        onClick={handleAddVectorStudio}
        style={{
          background: '#21262d',
          color: '#e6edf3',
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        <span>⚡</span>
        <span>+ Vector Studio</span>
      </button>

      <button
        onClick={handleAddBlender}
        style={{
          background: '#21262d',
          color: '#e6edf3',
          border: '1px solid #30363d',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}
      >
        <span>🧊</span>
        <span>+ Blender Node</span>
      </button>

      <div style={{ height: 18, width: 1, background: '#30363d', margin: '0 4px' }} />

      <span
        style={{
          fontSize: 11,
          color: '#3fb950',
          background: 'rgba(63, 185, 80, 0.1)',
          padding: '3px 8px',
          borderRadius: 8,
          border: '1px solid rgba(63, 185, 80, 0.2)',
          fontWeight: 600
        }}
      >
        Free Models Active
      </span>
    </div>
  )
}
