import React, { useState } from 'react'

export interface StudioInspectorProps {
  isOpen: boolean
  onClose: () => void
  selectedShapeId?: string | null
  activeSvg?: string
  onRecolorLayer?: (layerId: string, color: string) => void
  onVectorizeImage?: (imageBase64: string) => void
  onExportToBlender?: (adapter: 'curve' | 'grease_pencil') => void
}

export function StudioInspector({
  isOpen,
  onClose,
  selectedShapeId,
  activeSvg,
  onRecolorLayer,
  onVectorizeImage,
  onExportToBlender
}: StudioInspectorProps) {
  const [activeTab, setActiveTab] = useState<'properties' | 'web-import' | 'blender'>('properties')
  const [urlInput, setUrlInput] = useState('')
  const [selectedLayer, setSelectedLayer] = useState<string>('accent')

  const palette = [
    '#388bfd', '#238636', '#da3633', '#d29922', '#a371f7', '#ebbe9c', '#0d1117', '#f0f3f6'
  ]

  if (!isOpen) return null

  return (
    <aside
      style={{
        position: 'absolute',
        right: 0,
        top: 48,
        bottom: 0,
        width: 320,
        background: 'rgba(14, 16, 21, 0.94)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 95,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-12px 0 40px rgba(0, 0, 0, 0.7)',
        userSelect: 'none'
      }}
    >
      {/* Tab Navigation */}
      <div
        style={{
          padding: '12px 14px 8px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', background: '#151820', borderRadius: 8, padding: 2, gap: 2 }}>
          {(
            [
              { id: 'properties', label: 'Properties' },
              { id: 'web-import', label: 'Web Import' },
              { id: 'blender', label: 'Blender 3D' }
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                background: activeTab === t.id ? '#262b37' : 'transparent',
                color: activeTab === t.id ? '#ffffff' : '#8c96a5',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#8c96a5', cursor: 'pointer', padding: 4 }}
        >
          ✕
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {activeTab === 'properties' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Selection Status */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5e6878', letterSpacing: 0.5 }}>
              SELECTION
            </div>
            <div
              style={{
                background: '#151820',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: 10,
                fontSize: 12,
                color: '#f3f5f8'
              }}
            >
              {selectedShapeId ? (
                <div>Selected: <code>{selectedShapeId}</code></div>
              ) : (
                <div style={{ color: '#8c96a5' }}>Click any element or node on canvas to inspect</div>
              )}
            </div>

            {/* Quick Palette */}
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5e6878', letterSpacing: 0.5 }}>
              LAYER RECOLORING
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {palette.map((c) => (
                <button
                  key={c}
                  onClick={() => onRecolorLayer && onRecolorLayer(selectedLayer, c)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: c,
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'web-import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Import From Web Header (pen.dev style) */}
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🌐</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f3f5f8' }}>Import from the web</div>
              <p style={{ fontSize: 11, color: '#8c96a5', margin: '4px 0 12px 0', lineHeight: 1.4 }}>
                Enter a live URL or localhost dev server, then bring it onto the canvas as editable vector layers.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Enter a URL (e.g. localhost:8080)..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                style={{
                  flex: 1,
                  background: '#090a0d',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 8,
                  padding: '7px 10px',
                  color: '#f3f5f8',
                  fontSize: 11,
                  outline: 'none'
                }}
              />
              <button
                style={{
                  background: '#388bfd',
                  border: 'none',
                  borderRadius: 8,
                  padding: '0 12px',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Go →
              </button>
            </div>

            {/* Drop Screenshot Area */}
            <div
              style={{
                border: '1px dashed rgba(255, 255, 255, 0.15)',
                borderRadius: 12,
                padding: 20,
                textAlign: 'center',
                background: '#090a0d',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>📷</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f3f5f8' }}>Drop a screenshot</div>
              <div style={{ fontSize: 10, color: '#8c96a5', marginTop: 2 }}>
                Vectorize instantly into cubic Béziers via VTracer WASM
              </div>
            </div>
          </div>
        )}

        {activeTab === 'blender' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20 }}>🧊</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f3f5f8' }}>Blender 4.5.3 LTS</div>
                <div style={{ fontSize: 10, color: '#3fb950', fontWeight: 600 }}>● Engine Connected</div>
              </div>
            </div>

            {/* Pre-flight Diagnostic Score */}
            <div
              style={{
                background: '#151820',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 10,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#58a6ff' }}>
                DUAL-ADAPTER CAPABILITY FIT
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: '#f3f5f8' }}>Grease Pencil (2D Animation)</span>
                <span style={{ color: '#3fb950', fontWeight: 700 }}>95% Fit</span>
              </div>
              <div style={{ height: 4, background: '#090a0d', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: '95%', height: '100%', background: '#238636' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                <span style={{ color: '#f3f5f8' }}>Curve Geometry (3D Extrusion)</span>
                <span style={{ color: '#d29922', fontWeight: 700 }}>85% Fit</span>
              </div>
              <div style={{ height: 4, background: '#090a0d', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: '85%', height: '100%', background: '#d29922' }} />
              </div>
            </div>

            {/* Export Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={() => onExportToBlender && onExportToBlender('grease_pencil')}
                style={{
                  background: '#238636',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Export to Grease Pencil (.blend)
              </button>
              <button
                onClick={() => onExportToBlender && onExportToBlender('curve')}
                style={{
                  background: '#1e222b',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  color: '#f97316',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Export to 3D Curves (.blend)
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
