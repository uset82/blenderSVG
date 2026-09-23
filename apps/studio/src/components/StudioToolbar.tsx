import React from 'react'

export interface StudioToolbarProps {
  activeTool: string
  onSelectTool: (tool: string) => void
  onAddShape: (type: 'frame' | 'avatar' | 'vector-studio' | 'blender-connector' | 'geo' | 'text') => void
}

export function StudioToolbar({ activeTool, onSelectTool, onAddShape }: StudioToolbarProps) {
  const tools = [
    { id: 'select', label: 'Select (V)', icon: '↖' },
    { id: 'hand', label: 'Hand (H)', icon: '✋' },
    { id: 'frame', label: 'Frame (F)', icon: '⧉', action: () => onAddShape('frame') },
    { id: 'geo', label: 'Rectangle (R)', icon: '◻', action: () => onAddShape('geo') },
    { id: 'text', label: 'Text (T)', icon: 'T', action: () => onAddShape('text') },
    { id: 'draw', label: 'Pen (P)', icon: '✎' }
  ]

  return (
    <nav
      style={{
        position: 'absolute',
        left: 16,
        top: 16,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#12141a',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        padding: 3,
        gap: 2,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
        zIndex: 50,
        userSelect: 'none'
      }}
    >
      {tools.map((t) => {
        const isSelected = activeTool === t.id

        return (
          <button
            key={t.id}
            onClick={() => {
              onSelectTool(t.id)
              if (t.action) t.action()
            }}
            title={t.label}
            style={{
              width: 30,
              height: 30,
              borderRadius: 5,
              background: isSelected ? '#262a36' : 'transparent',
              color: isSelected ? '#ffffff' : '#8c96a5',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13
            }}
          >
            {t.icon}
          </button>
        )
      })}
    </nav>
  )
}
