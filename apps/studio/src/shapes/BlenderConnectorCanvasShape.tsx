import React, { useState } from 'react'
import { HTMLContainer, Rectangle2d, ShapeUtil, T } from 'tldraw'
import { BlenderConnectorShape } from './types.js'

export class BlenderConnectorShapeUtil extends ShapeUtil<BlenderConnectorShape> {
  static override type = 'blender-connector' as const
  static override props = {
    w: T.number,
    h: T.number,
    blenderVersion: T.string,
    isConnected: T.boolean,
    activeScene: T.string,
    lastExport: T.string
  }

  getDefaultProps(): BlenderConnectorShape['props'] {
    return {
      w: 360,
      h: 380,
      blenderVersion: 'Blender 4.5.3 LTS',
      isConnected: true,
      activeScene: 'cholita.blend',
      lastExport: ''
    }
  }

  getGeometry(shape: BlenderConnectorShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true
    })
  }

  getIndicatorPath(shape: BlenderConnectorShape) {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 20)
    return path
  }

  component(shape: BlenderConnectorShape) {
    const { blenderVersion, isConnected, activeScene } = shape.props
    const [status, setStatus] = useState('')

    const handleExportLineArt = () => {
      setStatus('Exporting Line Art SVG from Blender...')
      setTimeout(() => {
        setStatus('Line Art SVG exported to .codex-avatar/exports/svg!')
        const currentBounds = this.editor.getShapePageBounds(shape.id)
        this.editor.createShape({
          type: 'geo',
          x: (currentBounds?.maxX ?? 0) + 30,
          y: currentBounds?.minY ?? 0,
          props: {
            w: 200,
            h: 200,
            geo: 'ellipse',
            color: 'blue'
          }
        })
      }, 800)
    }

    const handleExportGLB = () => {
      setStatus('Exporting optimized GLB for WebGL...')
      setTimeout(() => {
        setStatus('3D GLB exported to .codex-avatar/exports/glb!')
      }, 800)
    }

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          borderRadius: 20,
          background: '#161b22',
          border: '1px solid #30363d',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          boxSizing: 'border-box',
          color: '#f0f3f6',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          userSelect: 'none',
          pointerEvents: 'all'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 18 }}>🧊</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Blender Connector</span>
          </div>
          <span style={{ fontSize: 11, background: '#238636', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
            {isConnected ? 'Connected' : 'Offline'}
          </span>
        </div>

        {/* Info card */}
        <div style={{ background: '#0d1117', borderRadius: 10, padding: 12, border: '1px solid #30363d', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: '#8b949e' }}>Engine:</span>
            <span style={{ fontWeight: 600, color: '#e6edf3' }}>{blenderVersion}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
            <span style={{ color: '#8b949e' }}>Scene:</span>
            <span style={{ fontWeight: 600, color: '#58a6ff' }}>{activeScene}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#8b949e' }}>MCP Status:</span>
            <span style={{ fontWeight: 600, color: '#3fb950' }}>Bridge Active</span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, justifyContent: 'center' }}>
          <button
            onClick={handleExportLineArt}
            style={{
              background: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>🖋️ Export Line-Art SVG</span>
            <span style={{ fontSize: 10, color: '#8b949e' }}>To Canvas</span>
          </button>

          <button
            onClick={handleExportGLB}
            style={{
              background: '#21262d',
              color: '#c9d1d9',
              border: '1px solid #30363d',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>📦 Export 3D GLB Model</span>
            <span style={{ fontSize: 10, color: '#8b949e' }}>WebGL Ready</span>
          </button>
        </div>

        {/* Status */}
        {status && (
          <div style={{ fontSize: 11, color: '#58a6ff', marginTop: 10, textAlign: 'center' }}>
            {status}
          </div>
        )}
      </HTMLContainer>
    )
  }
}
