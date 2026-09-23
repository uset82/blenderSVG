import React, { useState } from 'react'

export interface StudioWindowBarProps {
  projectTitle: string
  onTitleChange: (title: string) => void
  activeMode: 'design' | 'agents' | 'blender'
  onModeChange: (mode: 'design' | 'agents' | 'blender') => void
  isRecentsOpen: boolean
  onToggleRecents: () => void
  isAgentSidebarOpen: boolean
  onToggleAgentSidebar: () => void
  isInspectorOpen: boolean
  onToggleInspector: () => void
  zoomLevel: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onExport: () => void
}

export function StudioWindowBar({
  projectTitle,
  onTitleChange,
  isRecentsOpen,
  onToggleRecents,
  isAgentSidebarOpen,
  onToggleAgentSidebar,
  isInspectorOpen,
  onToggleInspector,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onExport
}: StudioWindowBarProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState(projectTitle)

  const handleTitleSubmit = () => {
    setIsEditingTitle(false)
    if (titleInput.trim()) {
      onTitleChange(titleInput.trim())
    } else {
      setTitleInput(projectTitle)
    }
  }

  return (
    <header
      style={{
        height: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        background: '#0c0d10',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 100,
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* Left: Project Brand & Auto-saved Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Recents Dashboard Toggle */}
        <button
          onClick={onToggleRecents}
          title="All Projects (Paper style)"
          style={{
            background: isRecentsOpen ? '#20242e' : 'transparent',
            border: 'none',
            borderRadius: 6,
            padding: '5px 7px',
            color: '#c5cdd8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            fontSize: 13
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
          </svg>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#f0f3f6', letterSpacing: '-0.3px' }}>
            blendersvg
          </span>
          <span style={{ color: '#57606e', fontSize: 12 }}>/</span>

          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              autoFocus
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              style={{
                background: '#161920',
                border: '1px solid #388bfd',
                borderRadius: 5,
                padding: '2px 6px',
                color: '#f0f3f6',
                fontSize: 12,
                outline: 'none'
              }}
            />
          ) : (
            <div
              onClick={() => setIsEditingTitle(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                color: '#9aa4b2',
                fontSize: 12
              }}
            >
              <span style={{ color: '#f0f3f6', fontWeight: 500 }}>{projectTitle}</span>
              <span style={{ fontSize: 11, color: '#57606e' }}>— Auto-saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls (pen.dev style) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Agents Toggle */}
        <button
          onClick={onToggleAgentSidebar}
          style={{
            background: isAgentSidebarOpen ? '#20242e' : 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 6,
            padding: '4px 10px',
            color: isAgentSidebarOpen ? '#ffffff' : '#8c96a5',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: isAgentSidebarOpen ? '#388bfd' : '#57606e' }} />
          <span>Agents</span>
        </button>

        {/* Inspector Toggle */}
        <button
          onClick={onToggleInspector}
          style={{
            background: isInspectorOpen ? '#20242e' : 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 6,
            padding: '4px 10px',
            color: isInspectorOpen ? '#ffffff' : '#8c96a5',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Inspector
        </button>

        {/* Share Button */}
        <button
          style={{
            background: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 6,
            padding: '4px 10px',
            color: '#c5cdd8',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Share
        </button>

        {/* Export Button */}
        <button
          onClick={onExport}
          style={{
            background: '#ffffff',
            border: 'none',
            borderRadius: 6,
            padding: '4px 10px',
            color: '#0c0d10',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Export
        </button>

        {/* Zoom Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#14161c',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 6,
            padding: '1px 3px'
          }}
        >
          <button
            onClick={onZoomOut}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8c96a5',
              cursor: 'pointer',
              padding: '1px 4px',
              fontSize: 11
            }}
          >
            −
          </button>
          <span
            onClick={onZoomReset}
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: '#c5cdd8',
              padding: '1px 4px',
              cursor: 'pointer'
            }}
          >
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={onZoomIn}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8c96a5',
              cursor: 'pointer',
              padding: '1px 4px',
              fontSize: 11
            }}
          >
            +
          </button>
        </div>

        {/* User Avatar */}
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#262a36',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 700,
            color: '#f0f3f6',
            cursor: 'pointer'
          }}
          title="Carlos Carpio"
        >
          CC
        </div>
      </div>
    </header>
  )
}
