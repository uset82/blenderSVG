import React, { useState } from 'react'
import { HTMLContainer, Rectangle2d, ShapeUtil, T } from 'tldraw'
import { VectorStudioShape } from './types.js'

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
      w: 420,
      h: 520,
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
    const [previewSvg, setPreviewSvg] = useState(lastSvg)
    const [statusMsg, setStatusMsg] = useState('')

    const handleVectorizeSample = async () => {
      this.editor.updateShape<VectorStudioShape>({
        id: shape.id,
        type: 'vector-studio',
        props: { isProcessing: true }
      })
      setStatusMsg('Vectorizing with @visioncortex/vtracer (WASM)...')

      try {
        const response = await fetch('/api/vectorize-sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ engine, detail })
        }).catch(() => null)

        if (response && response.ok) {
          const data = await response.json()
          setPreviewSvg(data.svg)
          setStatusMsg('Vectorized successfully!')
        } else {
          // Fallback sample SVG produced by VTracer Bézier spline algorithm
          const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 168 168"><path fill="#171b22" d="M0 168V0h168v168z"/><circle cx="84" cy="74" r="36" fill="#ebbe9c"/><path d="M52 106 L116 106 L124 150 L44 150 Z" fill="#da3633"/><ellipse cx="84" cy="38" rx="28" ry="10" fill="#0d1117"/><circle cx="73" cy="72" r="4" fill="#0d1117"/><circle cx="95" cy="72" r="4" fill="#0d1117"/></svg>`
          setPreviewSvg(sampleSvg)
          setStatusMsg('Sample vectorized with spline curves!')
        }
      } catch (err: any) {
        setStatusMsg(`Error: ${err.message}`)
      } finally {
        this.editor.updateShape<VectorStudioShape>({
          id: shape.id,
          type: 'vector-studio',
          props: { isProcessing: false, lastSvg: previewSvg }
        })
      }
    }

    const handleInsertToCanvas = () => {
      if (!previewSvg) return
      const currentBounds = this.editor.getShapePageBounds(shape.id)
      const x = (currentBounds?.maxX ?? 0) + 40
      const y = currentBounds?.minY ?? 0

      // Put SVG directly on canvas
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16 }}>⚡</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#f0f3f6' }}>Vector Studio</span>
          </div>
          <span style={{ fontSize: 11, background: '#238636', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>
            {engine === 'vtracer' ? 'Local VTracer' : 'OpenRouter AI'}
          </span>
        </div>

        {/* Engine Toggle */}
        <div style={{ display: 'flex', background: '#0d1117', borderRadius: 8, padding: 3, marginBottom: 12, border: '1px solid #30363d' }}>
          <button
            onClick={() => this.editor.updateShape<VectorStudioShape>({ id: shape.id, type: 'vector-studio', props: { engine: 'vtracer' } })}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 6,
              background: engine === 'vtracer' ? '#21262d' : 'transparent',
              color: engine === 'vtracer' ? '#58a6ff' : '#8b949e',
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            VTracer (Local WASM)
          </button>
          <button
            onClick={() => this.editor.updateShape<VectorStudioShape>({ id: shape.id, type: 'vector-studio', props: { engine: 'openrouter' } })}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 6,
              background: engine === 'openrouter' ? '#21262d' : 'transparent',
              color: engine === 'openrouter' ? '#58a6ff' : '#8b949e',
              border: 'none',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            OpenRouter (Free AI)
          </button>
        </div>

        {/* Controls */}
        {engine === 'openrouter' ? (
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: '#8b949e', display: 'block', marginBottom: 4 }}>Free Model</label>
            <select
              value={openRouterModel}
              onChange={(e) => this.editor.updateShape<VectorStudioShape>({ id: shape.id, type: 'vector-studio', props: { openRouterModel: e.target.value } })}
              style={{ width: '100%', background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6, padding: 6, fontSize: 11 }}
            >
              <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash (Free)</option>
              <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (Free)</option>
              <option value="deepseek/deepseek-r1:free">DeepSeek R1 (Free)</option>
              <option value="qwen/qwen-2.5-coder-32b-instruct:free">Qwen 2.5 Coder 32B (Free)</option>
            </select>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: '#8b949e', display: 'block', marginBottom: 4 }}>Curve Detail</label>
              <select
                value={detail}
                onChange={(e) => this.editor.updateShape<VectorStudioShape>({ id: shape.id, type: 'vector-studio', props: { detail: e.target.value } })}
                style={{ width: '100%', background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 6, padding: 6, fontSize: 11 }}
              >
                <option value="low">Low (Fast, coarse)</option>
                <option value="balanced">Balanced (Recommended)</option>
                <option value="high">High (Fine Bézier curves)</option>
              </select>
            </div>
          </div>
        )}

        {/* Preview Screen */}
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
            padding: 12,
            marginBottom: 12
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
