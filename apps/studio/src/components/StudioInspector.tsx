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
  selectedShapeId,
  onRecolorLayer,
  onExportToBlender
}: StudioInspectorProps) {
  const [activeTab, setActiveTab] = useState<'properties' | 'web-import' | 'blender'>('web-import')
  const [urlInput, setUrlInput] = useState('')

  const palette = [
    '#388bfd', '#238636', '#da3633', '#d29922', '#a371f7', '#ebbe9c', '#0d1117', '#f0f3f6'
  ]

  const suggestedLinks = [
    { label: 'pen.dev', url: 'https://pen.dev' },
    { label: 'docs.pen.dev', url: 'https://docs.pen.dev' },
    { label: 'localhost:8080', url: 'http://localhost:8080' }
  ]

  if (!isOpen) return null

  return (
    <aside
      style={{
        width: 320,
        height: '100%',
        background: '#0f1115',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* Tab Navigation */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', background: '#161920', borderRadius: 6, padding: 2, gap: 2 }}>
          {(
            [
              { id: 'web-import', label: 'Web Import' },
              { id: 'properties', label: 'Properties' },
              { id: 'blender', label: 'Blender 3D' }
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                background: activeTab === t.id ? '#262a36' : 'transparent',
                color: activeTab === t.id ? '#ffffff' : '#8c96a5',
                border: 'none',
                borderRadius: 4,
                padding: '3px 8px',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {activeTab === 'web-import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Import From Web Header (pen.dev exact) */}
            <div style={{ textAlign: 'center', padding: '12px 0 8px 0' }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#161920',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px auto',
                  color: '#9aa4b2'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f3f6' }}>Import from the web</div>
              <p style={{ fontSize: 11, color: '#8c96a5', margin: '4px 0 12px 0', lineHeight: 1.4 }}>
                Open a live site or your localhost dev server, then bring it onto the canvas as editable layers.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                placeholder="Enter a URL >"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                style={{
                  flex: 1,
                  background: '#0c0d10',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: '#f0f3f6',
                  fontSize: 11,
                  outline: 'none'
                }}
              />
            </div>

            {/* Action buttons list (pen.dev exact) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              <button
                style={{
                  background: '#14161c',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  color: '#c5cdd8',
                  fontSize: 11,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <span style={{ color: '#8c96a5' }}>&lt;/&gt;</span>
                <div>
                  <div style={{ fontWeight: 600 }}>Import the full page</div>
                  <div style={{ fontSize: 9, color: '#57606e' }}>Reproduce it as frames, text, and images.</div>
                </div>
              </button>

              <button
                style={{
                  background: '#14161c',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  color: '#c5cdd8',
                  fontSize: 11,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <span style={{ color: '#8c96a5' }}>⧉</span>
                <div>
                  <div style={{ fontWeight: 600 }}>Import an element</div>
                  <div style={{ fontSize: 9, color: '#57606e' }}>Pick one element instead of the whole page.</div>
                </div>
              </button>

              <button
                style={{
                  background: '#14161c',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 6,
                  padding: '8px 10px',
                  color: '#c5cdd8',
                  fontSize: 11,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <span style={{ color: '#8c96a5' }}>📷</span>
                <div>
                  <div style={{ fontWeight: 600 }}>Import a screenshot</div>
                  <div style={{ fontSize: 9, color: '#57606e' }}>Drop a PNG onto the canvas or send to the agent.</div>
                </div>
              </button>
            </div>

            {/* Suggested Bookmarks */}
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#57606e', marginBottom: 6 }}>
                Suggested
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {suggestedLinks.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => setUrlInput(item.url)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#12141a',
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      color: '#9aa4b2',
                      cursor: 'pointer'
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ fontSize: 10, color: '#57606e' }}>→</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'properties' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#57606e', letterSpacing: 0.5 }}>
              SELECTION
            </div>
            <div
              style={{
                background: '#14161c',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 6,
                padding: 10,
                fontSize: 11,
                color: '#c5cdd8'
              }}
            >
              {selectedShapeId ? (
                <div>Selected: <code>{selectedShapeId}</code></div>
              ) : (
                <div style={{ color: '#7a8596' }}>Select any shape on canvas to inspect</div>
              )}
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: '#57606e', letterSpacing: 0.5 }}>
              PALETTE
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {palette.map((c) => (
                <button
                  key={c}
                  onClick={() => onRecolorLayer && onRecolorLayer('fill', c)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: c,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'blender' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f0f3f6' }}>Blender 4.5.3 LTS</div>
              <div style={{ fontSize: 10, color: '#3fb950', marginTop: 2 }}>Connected</div>
            </div>

            <div
              style={{
                background: '#14161c',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 6,
                padding: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: '#8c96a5' }}>
                CAPABILITY FIT
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
                <span style={{ color: '#c5cdd8' }}>Grease Pencil (2D Animation)</span>
                <span style={{ color: '#3fb950', fontWeight: 600 }}>95%</span>
              </div>
              <div style={{ height: 3, background: '#0c0d10', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: '95%', height: '100%', background: '#238636' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 2 }}>
                <span style={{ color: '#c5cdd8' }}>Curve Geometry (3D Extrusion)</span>
                <span style={{ color: '#d29922', fontWeight: 600 }}>85%</span>
              </div>
              <div style={{ height: 3, background: '#0c0d10', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: '85%', height: '100%', background: '#d29922' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={() => onExportToBlender && onExportToBlender('grease_pencil')}
                style={{
                  background: '#1e222b',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 6,
                  padding: '7px 10px',
                  color: '#f0f3f6',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Export to Grease Pencil (.blend)
              </button>
              <button
                onClick={() => onExportToBlender && onExportToBlender('curve')}
                style={{
                  background: '#1e222b',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 6,
                  padding: '7px 10px',
                  color: '#f0f3f6',
                  fontSize: 11,
                  fontWeight: 500,
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
