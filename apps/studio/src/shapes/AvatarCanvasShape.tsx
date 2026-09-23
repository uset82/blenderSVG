import React from 'react'
import { HTMLContainer, Rectangle2d, ShapeUtil, T } from 'tldraw'
import { AvatarShape } from './types.js'

const AVATAR_STATES = [
  { id: 'idle', label: 'Idle', icon: '💤' },
  { id: 'thinking', label: 'Thinking', icon: '💭' },
  { id: 'speaking', label: 'Speaking', icon: '🗣️' },
  { id: 'coding', label: 'Coding', icon: '💻' },
  { id: 'celebrate', label: 'Celebrate', icon: '🎉' },
  { id: 'error', label: 'Error', icon: '⚠️' }
]

export class AvatarShapeUtil extends ShapeUtil<AvatarShape> {
  static override type = 'avatar' as const
  static override props = {
    w: T.number,
    h: T.number,
    character: T.string,
    avatarState: T.string,
    speech: T.string
  }

  getDefaultProps(): AvatarShape['props'] {
    return {
      w: 340,
      h: 480,
      character: 'cholita-3d',
      avatarState: 'idle',
      speech: 'Ready on the canvas!'
    }
  }

  getGeometry(shape: AvatarShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true
    })
  }

  getIndicatorPath(shape: AvatarShape) {
    const path = new Path2D()
    path.roundRect(0, 0, shape.props.w, shape.props.h, 20)
    return path
  }

  component(shape: AvatarShape) {
    const { character, avatarState, speech } = shape.props

    const handleStateChange = (newState: string) => {
      this.editor.updateShape<AvatarShape>({
        id: shape.id,
        type: 'avatar',
        props: {
          avatarState: newState,
          speech: `State changed to ${newState}`
        }
      })
    }

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          borderRadius: 20,
          background: 'linear-gradient(145deg, #181b22, #111317)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: 16,
          boxSizing: 'border-box',
          color: '#f0f3f6',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          userSelect: 'none',
          pointerEvents: 'all'
        }}
      >
        {/* Header */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.05em', color: '#58a6ff', textTransform: 'uppercase' }}>
            Avatar Stage
          </span>
          <span style={{ fontSize: 11, background: '#21262d', padding: '2px 8px', borderRadius: 12, color: '#8b949e', border: '1px solid #30363d' }}>
            {character === 'cholita-3d' ? '3D WebGL' : '2D SVG'}
          </span>
        </div>

        {/* Speech Bubble */}
        <div
          style={{
            width: '100%',
            background: '#21262d',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 12,
            lineHeight: 1.4,
            marginBottom: 12,
            borderLeft: '3px solid #388bfd',
            color: '#e6edf3',
            boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
          }}
        >
          {speech}
        </div>

        {/* Avatar Viewport */}
        <div
          style={{
            width: '100%',
            flex: 1,
            background: 'radial-gradient(circle at center, #21262d 0%, #0d1117 100%)',
            borderRadius: 14,
            border: '1px solid #30363d',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Animated Avatar Graphic */}
          <div
            style={{
              width: 140,
              height: 140,
              position: 'relative',
              transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform: avatarState === 'celebrate' ? 'scale(1.1) translateY(-8px)' : avatarState === 'thinking' ? 'rotate(-4deg)' : 'scale(1)'
            }}
          >
            {character === 'cholita-3d' ? (
              <svg viewBox="0 0 168 168" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.6))' }}>
                <circle cx="84" cy="84" r="70" fill="#1f242d" stroke="#388bfd" strokeWidth="2" />
                {/* Hat */}
                <ellipse cx="84" cy="38" rx="28" ry="10" fill="#0d1117" />
                <rect x="68" y="22" width="32" height="18" rx="6" fill="#161b22" stroke="#30363d" />
                {/* Face */}
                <circle cx="84" cy="74" r="32" fill="#ebbe9c" />
                {/* Eyes */}
                <ellipse cx="73" cy="72" rx="4" ry={avatarState === 'idle' ? '1' : '6'} fill="#0d1117" />
                <ellipse cx="95" cy="72" rx="4" ry={avatarState === 'idle' ? '1' : '6'} fill="#0d1117" />
                {/* Smile / Mouth */}
                <path
                  d={avatarState === 'speaking' ? 'M78 86 Q84 94 90 86 Z' : avatarState === 'error' ? 'M78 88 Q84 82 90 88' : 'M78 84 Q84 90 90 84'}
                  fill={avatarState === 'speaking' ? '#da3633' : 'none'}
                  stroke="#0d1117"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                {/* Blushes */}
                <ellipse cx="66" cy="80" rx="4" ry="2" fill="#f85149" opacity="0.4" />
                <ellipse cx="102" cy="80" rx="4" ry="2" fill="#f85149" opacity="0.4" />
                {/* Shawl & Dress */}
                <path d="M52 106 L116 106 L124 150 L44 150 Z" fill="#da3633" />
                <path d="M64 106 L84 126 L104 106 Z" fill="#388bfd" />
              </svg>
            ) : (
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                <circle cx="50" cy="50" r="40" fill="#238636" opacity="0.8" />
                <circle cx="40" cy="45" r="5" fill="#fff" />
                <circle cx="60" cy="45" r="5" fill="#fff" />
                <path d="M40 65 Q50 75 60 65" stroke="#fff" strokeWidth="3" fill="none" />
              </svg>
            )}
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: 8,
              fontSize: 11,
              fontWeight: 600,
              color: '#8b949e',
              display: 'flex',
              alignItems: 'center',
              gap: 5
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: avatarState === 'error' ? '#f85149' : '#3fb950' }} />
            {avatarState.toUpperCase()}
          </div>
        </div>

        {/* State Buttons Dock */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 6,
            width: '100%',
            marginTop: 12
          }}
        >
          {AVATAR_STATES.map((st) => (
            <button
              key={st.id}
              onClick={() => handleStateChange(st.id)}
              style={{
                background: avatarState === st.id ? '#388bfd' : '#21262d',
                color: avatarState === st.id ? '#ffffff' : '#c9d1d9',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: '6px 4px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                transition: 'all 0.15s ease'
              }}
            >
              <span>{st.icon}</span>
              <span>{st.label}</span>
            </button>
          ))}
        </div>
      </HTMLContainer>
    )
  }
}
