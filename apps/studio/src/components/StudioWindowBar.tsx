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
  activeMode,
  onModeChange,
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
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: 'rgba(14, 16, 21, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
        zIndex: 100,
        userSelect: 'none'
      }}
    >
      {/* Left: App Logo, Dashboard Switcher & Project Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Recents Dashboard Toggle */}
        <button
          onClick={onToggleRecents}
          title="Toggle Projects Dashboard"
          style={{
            background: isRecentsOpen ? '#262b37' : '#151820',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8,
            padding: '5px 8px',
            color: isRecentsOpen ? '#388bfd' : '#f3f5f8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600
          }}
        >
          <span style={{ fontSize: 13 }}>⊞</span>
          <span>Recents</span>
        </button>

        <div style={{ height: 16, width: 1, background: 'rgba(255, 255, 255, 0.1)' }} />

        {/* Brand & Document Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: 'linear-gradient(135deg, #f97316, #a855f7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 800,
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(249, 115, 22, 0.35)'
            }}
          >
            b
          </div>

          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              autoFocus
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
              style={{
                background: '#1e222b',
                border: '1px solid #388bfd',
                borderRadius: 6,
                padding: '3px 8px',
                color: '#f3f5f8',
                fontSize: 13,
                fontWeight: 600,
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
                padding: '3px 6px',
                borderRadius: 6,
                color: '#f3f5f8',
                fontSize: 13,
                fontWeight: 600
              }}
              title="Click to rename"
            >
              <span>{projectTitle}</span>
              <span style={{ fontSize: 11, color: '#5e6878' }}>• Auto-saved</span>
            </div>
          )}
        </div>
      </div>

      {/* Center: Mode Switchers (Design | Agents | Blender 3D) */}
      <div
        style={{
          display: 'flex',
          background: '#151820',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 10,
          padding: 3,
          gap: 2
        }}
      >
        <button
          onClick={() => onModeChange('design')}
          style={{
            background: activeMode === 'design' ? '#262b37' : 'transparent',
            color: activeMode === 'design' ? '#ffffff' : '#9aa4b2',
            border: 'none',
            borderRadius: 7,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Design
        </button>
        <button
          onClick={() => onModeChange('agents')}
          style={{
            background: activeMode === 'agents' ? '#262b37' : 'transparent',
            color: activeMode === 'agents' ? '#388bfd' : '#9aa4b2',
            border: 'none',
            borderRadius: 7,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <span>🤖</span>
          <span>Agents</span>
        </button>
        <button
          onClick={() => onModeChange('blender')}
          style={{
            background: activeMode === 'blender' ? '#262b37' : 'transparent',
            color: activeMode === 'blender' ? '#f97316' : '#9aa4b2',
            border: 'none',
            borderRadius: 7,
            padding: '5px 12px',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <span>🧊</span>
          <span>Blender 3D</span>
        </button>
      </div>

      {/* Right: Sidebar Toggles, Zoom & User Profile */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Toggle Agent Sidebar Button */}
        <button
          onClick={onToggleAgentSidebar}
          title="Toggle AI Agent Harness (pen.dev)"
          style={{
            background: isAgentSidebarOpen ? 'rgba(56, 139, 253, 0.15)' : '#151820',
            border: `1px solid ${isAgentSidebarOpen ? '#388bfd' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: 8,
            padding: '5px 10px',
            color: isAgentSidebarOpen ? '#58a6ff' : '#9aa4b2',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>✨</span>
          <span>Agent</span>
        </button>

        {/* Toggle Inspector Button */}
        <button
          onClick={onToggleInspector}
          title="Toggle Inspector & Importer"
          style={{
            background: isInspectorOpen ? 'rgba(168, 85, 247, 0.15)' : '#151820',
            border: `1px solid ${isInspectorOpen ? '#a855f7' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: 8,
            padding: '5px 10px',
            color: isInspectorOpen ? '#c084fc' : '#9aa4b2',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <span>⚙</span>
          <span>Inspector</span>
        </button>

        {/* Zoom Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#151820',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8,
            padding: '2px 4px'
          }}
        >
          <button
            onClick={onZoomOut}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9aa4b2',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: 13,
              fontWeight: 700
            }}
          >
            −
          </button>
          <span
            onClick={onZoomReset}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#f3f5f8',
              padding: '2px 6px',
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
              color: '#9aa4b2',
              cursor: 'pointer',
              padding: '2px 6px',
              fontSize: 13,
              fontWeight: 700
            }}
          >
            +
          </button>
        </div>

        {/* Export Button */}
        <button
          onClick={onExport}
          style={{
            background: '#238636',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 8,
            padding: '5px 12px',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          Export
        </button>

        {/* User Avatar */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #388bfd, #0969da)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
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
