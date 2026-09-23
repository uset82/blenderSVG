import React from 'react'

export interface StudioToolbarProps {
  activeTool: string
  onSelectTool: (tool: string) => void
  onAddShape: (type: 'frame' | 'avatar' | 'vector-studio' | 'blender-connector' | 'geo' | 'text') => void
}

export function StudioToolbar({ activeTool, onSelectTool, onAddShape }: StudioToolbarProps) {
  const tools = [
    { id: 'select', label: 'Pointer', icon: '↖', shortcut: 'V' },
    { id: 'hand', label: 'Hand / Pan', icon: '✋', shortcut: 'H' },
    { id: 'frame', label: 'Artboard Frame', icon: '⧉', shortcut: 'F', action: () => onAddShape('frame') },
    { id: 'geo', label: 'Rectangle / Shape', icon: '◻', shortcut: 'R', action: () => onAddShape('geo') },
    { id: 'text', label: 'Text', icon: 'T', shortcut: 'T', action: () => onAddShape('text') },
    { id: 'draw', label: 'Pen / Vector Spline', icon: '✎', shortcut: 'P' },
    { id: 'divider-1', isDivider: true },
    { id: 'avatar', label: '3D Avatar Stage', icon: '🎭', shortcut: 'A', action: () => onAddShape('avatar') },
    { id: 'vector-studio', label: 'Vector Studio', icon: '⚡', shortcut: 'S', action: () => onAddShape('vector-studio') },
    { id: 'blender', label: 'Blender 3D Bridge', icon: '🧊', shortcut: 'B', action: () => onAddShape('blender-connector') }
  ]

  return (
    <nav
      style={{
        position: 'absolute',
        left: 16,
        top: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'rgba(14, 16, 21, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: '6px 4px',
        gap: 3,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.03)',
        zIndex: 90,
        userSelect: 'none'
      }}
    >
      {tools.map((t, idx) => {
        if (t.isDivider) {
          return (
            <div
              key={`div-${idx}`}
              style={{
                width: 20,
                height: 1,
                background: 'rgba(255, 255, 255, 0.1)',
                margin: '4px 0'
              }}
            />
          )
        }

        const isSelected = activeTool === t.id

        return (
          <button
            key={t.id}
            onClick={() => {
              onSelectTool(t.id)
              if (t.action) t.action()
            }}
            title={`${t.label} (${t.shortcut})`}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: isSelected ? '#262b37' : 'transparent',
              color: isSelected ? '#58a6ff' : '#9aa4b2',
              border: isSelected ? '1px solid rgba(56, 139, 253, 0.3)' : '1px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              position: 'relative'
            }}
          >
            <span>{t.icon}</span>
          </button>
        )
      })}
    </nav>
  )
}
