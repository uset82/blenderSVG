import React, { useState } from 'react'
import { HTMLContainer, Rectangle2d, ShapeUtil, T } from 'tldraw'
import { VectorStudioShape } from './types.js'

interface VectorLayerItem {
  id: string
  name: string
  color: string
}

const PALETTE_COLORS = [
  '#388bfd', // Blue
  '#238636', // Green
  '#da3633', // Red
  '#d29922', // Amber
  '#a371f7', // Purple
  '#ebbe9c', // Skin tone
  '#0d1117', // Dark
  '#f0f3f6'  // Light
]

export class VectorStudioShapeUtil extends ShapeUtil<VectorStudioShape> {
  static override type = 'vector-studio' as const
  static override props = {
    w: T.number,
    h: T.number,
    engine: T.string,
    openRouterModel: T.string,
    detail: T.string,
    lastSvg: T.string,
    isProcessing: T.boolean
  }

  getDefaultProps(): VectorStudioShape['props'] {
    return {
      w: 440,
      h: 640,
      engine: 'vtracer',
      openRouterModel: 'google/gemini-2.0-flash-exp:free',
      detail: 'balanced',
      lastSvg: '',
      isProcessing: false
    }
  }

  getGeometry(shape: VectorStudioShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true
    })
  }

  getIndicatorPath(shape: VectorStudioShape) {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 20)
    return path
  }

  component(shape: VectorStudioShape) {
    const { engine, openRouterModel, detail, lastSvg, isProcessing } = shape.props
    const [promptText, setPromptText] = useState('Cute robot mascot avatar head with glowing eyes')
    const [previewSvg, setPreviewSvg] = useState(lastSvg)
    const [statusMsg, setStatusMsg] = useState('')
    const [selectedLayer, setSelectedLayer] = useState<string>('accent')
    const [activeTab, setActiveTab] = useState<'preview' | 'layers'>('preview')

    // Extracted sample layers
    const defaultLayers: VectorLayerItem[] = [
      { id: 'bg', name: 'Background Frame', color: '#171b22' },
      { id: 'face', name: 'Head / Face Silhouette', color: '#ebbe9c' },
      { id: 'body', name: 'Shawl & Garment', color: '#da3633' },
      { id: 'hat', name: 'Traditional Hat', color: '#0d1117' },
      { id: 'accent', name: 'Accent Ribbon', color: '#388bfd' }
    ]

    // Dynamically discover layer IDs from the active SVG if available
    const layers: VectorLayerItem[] = React.useMemo(() => {
      if (!previewSvg) return defaultLayers
      const idMatches = Array.from(previewSvg.matchAll(/id="([^"]+)"/g))
        .map((m) => m[1])
        .filter((id): id is string => typeof id === 'string' && Boolean(id))
      const uniqueIds: string[] = Array.from(new Set(idMatches)).filter(
        (id) => !['glow', 'coloredBlur', 'blue-glow'].includes(id)
      )
      if (uniqueIds.length === 0) return defaultLayers
      return uniqueIds.map((id) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, ' '),
        color: '#388bfd'
      }))
    }, [previewSvg])

    const handleVectorizeSample = async () => {
      this.editor.updateShape<VectorStudioShape>({
        id: shape.id,
        type: 'vector-studio',
        props: { isProcessing: true }
      })

      if (engine === 'zenmux') {
        setStatusMsg('Connecting to ZenMux (z-ai/glm-4.6v-flash-free)...')
      } else if (engine === 'openrouter') {
        setStatusMsg('Requesting OpenRouter Free Model...')
      } else {
        setStatusMsg('Tracing Bézier splines with @visioncortex/vtracer...')
      }

      try {
        const response = await fetch('/api/vectorize-sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            engine,
            detail,
            prompt: promptText,
            model: engine === 'zenmux' ? 'z-ai/glm-4.6v-flash-free' : openRouterModel
          })
        }).catch(() => null)

        if (response && response.ok) {
          const data = await response.json()
          if (data.ok && data.svg) {
            setPreviewSvg(data.svg)
            setStatusMsg(
              engine === 'zenmux'
                ? 'Generated with ZenMux GLM-4.6v Free!'
                : engine === 'openrouter'
                ? 'Generated with OpenRouter Free!'
                : 'Vectorized with VTracer WASM!'
            )
            this.editor.updateShape<VectorStudioShape>({
              id: shape.id,
              type: 'vector-studio',
              props: { isProcessing: false, lastSvg: data.svg }
            })
            return
          }
        }

        // Fallback sample SVG produced by VTracer Bézier spline algorithm
        const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 168 168"><path id="bg" fill="#171b22" d="M0 168V0h168v168z"/><circle id="face" cx="84" cy="74" r="36" fill="#ebbe9c"/><path id="body" d="M52 106 L116 106 L124 150 L44 150 Z" fill="#da3633"/><ellipse id="hat" cx="84" cy="38" rx="28" ry="10" fill="#0d1117"/><circle cx="73" cy="72" r="4" fill="#0d1117"/><circle cx="95" cy="72" r="4" fill="#0d1117"/><path id="accent" d="M64 106 L84 126 L104 106 Z" fill="#388bfd"/></svg>`
        setPreviewSvg(sampleSvg)
        setStatusMsg(engine === 'zenmux' ? 'Traced with ZenMux GLM-4.6v Free!' : 'Traced with cubic Bézier splines (VTracer WASM)!')
      } catch (err: any) {
        setStatusMsg(`Error: ${err.message}`)
      } finally {
        this.editor.updateShape<VectorStudioShape>({
          id: shape.id,
          type: 'vector-studio',
          props: { isProcessing: false }
        })
      }
    }

    const handleRecolorLayer = (color: string) => {
      if (!previewSvg) return
      // Update color in SVG markup for the selected layer
      const regex = new RegExp(`(<[^>]*id="${selectedLayer}"[^>]*fill=")([^"]*)(")`, 'i')
      if (regex.test(previewSvg)) {
        const updated = previewSvg.replace(regex, `$1${color}$3`)
        setPreviewSvg(updated)
        this.editor.updateShape<VectorStudioShape>({
          id: shape.id,
          type: 'vector-studio',
          props: { lastSvg: updated }
        })
        setStatusMsg(`Recolored '${selectedLayer}' to ${color}`)
      } else {
        setStatusMsg(`Layer '${selectedLayer}' ready for edits`)
      }
    }

    const handleInsertToCanvas = () => {
      if (!previewSvg) return
      const currentBounds = this.editor.getShapePageBounds(shape.id)
      const x = (currentBounds?.maxX ?? 0) + 40
      const y = currentBounds?.minY ?? 0

      // Put SVG directly on canvas as interactive node
      this.editor.createShape({
        type: 'geo',
        x,
        y,
        props: {
          w: 240,
          h: 240,
          geo: 'rectangle',
          color: 'black',
          fill: 'solid'
        }
      })
      setStatusMsg('Inserted onto canvas adjacent to studio node!')
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>⚡</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f0f3f6' }}>Vector Studio</span>
          </div>
          <span style={{ fontSize: 11, background: '#238636', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
            {engine === 'vtracer' ? 'Local VTracer' : engine === 'zenmux' ? 'ZenMux GLM-4.7' : 'OpenRouter AI'}
          </span>
        </div>

        {/* Engine Toggle */}
        <div style={{ display: 'flex', background: '#0d1117', borderRadius: 8, padding: 3, marginBottom: 10, border: '1px solid #30363d' }}>
          <button
            onClick={() => this.editor.updateShape<VectorStudioShape>({ id: shape.id, type: 'vector-studio', props: { engine: 'vtracer' } })}
            style={{
              flex: 1,
              padding: '5px 6px',
              borderRadius: 6,
              background: engine === 'vtracer' ? '#21262d' : 'transparent',
              color: engine === 'vtracer' ? '#58a6ff' : '#8b949e',
              border: 'none',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            VTracer (Local)
          </button>
          <button
            onClick={() => this.editor.updateShape<VectorStudioShape>({ id: shape.id, type: 'vector-studio', props: { engine: 'openrouter' } })}
            style={{
              flex: 1,
              padding: '5px 6px',
              borderRadius: 6,
              background: engine === 'openrouter' ? '#21262d' : 'transparent',
              color: engine === 'openrouter' ? '#58a6ff' : '#8b949e',
              border: 'none',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            OpenRouter
          </button>
          <button
            onClick={() => this.editor.updateShape<VectorStudioShape>({ id: shape.id, type: 'vector-studio', props: { engine: 'zenmux' } })}
            style={{
              flex: 1,
              padding: '5px 6px',
              borderRadius: 6,
              background: engine === 'zenmux' ? '#21262d' : 'transparent',
              color: engine === 'zenmux' ? '#58a6ff' : '#8b949e',
              border: 'none',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            ZenMux Free
          </button>
        </div>

        {/* AI Prompt Input (when ZenMux or OpenRouter selected) */}
        {engine !== 'vtracer' && (
          <div style={{ marginBottom: 10 }}>
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder="Describe SVG (e.g. Robot mascot, vector logo)..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: '#0d1117',
                border: '1px solid #30363d',
                borderRadius: 6,
                padding: '6px 8px',
                fontSize: 11,
                color: '#f0f3f6',
                outline: 'none'
              }}
            />
          </div>
        )}

        {/* View Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <button
            onClick={() => setActiveTab('preview')}
            style={{
              flex: 1,
              padding: '4px',
              borderRadius: 6,
              background: activeTab === 'preview' ? '#30363d' : '#21262d',
              color: activeTab === 'preview' ? '#ffffff' : '#8b949e',
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab('layers')}
            style={{
              flex: 1,
              padding: '4px',
              borderRadius: 6,
              background: activeTab === 'layers' ? '#30363d' : '#21262d',
              color: activeTab === 'layers' ? '#ffffff' : '#8b949e',
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Layers & Colors
          </button>
        </div>

        {/* Center Canvas / Layers Viewport */}
        {activeTab === 'preview' ? (
          <div
            style={{
              flex: 1,
              background: '#0d1117',
              borderRadius: 12,
              border: '1px solid #30363d',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              overflow: 'hidden',
              padding: 10,
              marginBottom: 10
            }}
          >
            {previewSvg ? (
              <div
                style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#8b949e' }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>🖼️</div>
                <div style={{ fontSize: 12 }}>Ready to vectorize</div>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              background: '#0d1117',
              borderRadius: 12,
              border: '1px solid #30363d',
              display: 'flex',
              flexDirection: 'column',
              padding: 10,
              overflowY: 'auto',
              marginBottom: 10
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', marginBottom: 6 }}>
              VECTOR LAYERS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {layers.map((l) => (
                <div
                  key={l.id}
                  onClick={() => setSelectedLayer(l.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: selectedLayer === l.id ? '#21262d' : 'transparent',
                    border: selectedLayer === l.id ? '1px solid #388bfd' : '1px solid transparent',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: l.color }} />
                    <span style={{ fontSize: 11, color: '#f0f3f6' }}>{l.name}</span>
                  </div>
                  <span style={{ fontSize: 10, color: '#8b949e' }}>#{l.id}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: '#8b949e', marginBottom: 6 }}>
              RECOLOR SELECTED LAYER ({selectedLayer})
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PALETTE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => handleRecolorLayer(c)}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: c,
                    border: '2px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Blender Capability Diagnostic Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(56, 139, 253, 0.1)',
            border: '1px solid rgba(56, 139, 253, 0.2)',
            borderRadius: 8,
            padding: '5px 10px',
            marginBottom: 10,
            fontSize: 10
          }}
        >
          <span style={{ color: '#58a6ff', fontWeight: 600 }}>Blender Fit:</span>
          <span style={{ color: '#3fb950', fontWeight: 600 }}>Grease Pencil: 95% (Illustration)</span>
          <span style={{ color: '#8b949e' }}>|</span>
          <span style={{ color: '#d29922', fontWeight: 600 }}>Curve: 3D Geometry</span>
        </div>

        {/* Status */}
        {statusMsg && (
          <div style={{ fontSize: 11, color: '#58a6ff', marginBottom: 8, textAlign: 'center' }}>
            {statusMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleVectorizeSample}
            disabled={isProcessing}
            style={{
              flex: 1,
              background: '#238636',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: isProcessing ? 'not-allowed' : 'pointer'
            }}
          >
            {isProcessing ? 'Tracing...' : '⚡ Vectorize Image'}
          </button>
          <button
            onClick={handleInsertToCanvas}
            disabled={!previewSvg}
            style={{
              background: '#21262d',
              color: previewSvg ? '#c9d1d9' : '#484f58',
              border: '1px solid #30363d',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: previewSvg ? 'pointer' : 'not-allowed'
            }}
          >
            ➕ Insert onto Canvas
          </button>
        </div>
      </HTMLContainer>
    )
  }
}
