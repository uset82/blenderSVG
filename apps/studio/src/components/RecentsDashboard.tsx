import React, { useState } from 'react'

export interface ProjectCard {
  id: string
  title: string
  subtitle: string
  updatedAt: string
  thumbnailColor?: string
}

export interface RecentsDashboardProps {
  isOpen: boolean
  onClose: () => void
  onOpenProject: (projectId: string) => void
  onNewFile: () => void
}

export function RecentsDashboard({
  isOpen,
  onClose,
  onOpenProject,
  onNewFile
}: RecentsDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeNav, setActiveNav] = useState<'recents' | 'learn' | 'files' | 'archive' | 'settings'>('recents')

  const projects: ProjectCard[] = [
    {
      id: 'scratchpad',
      title: 'Scratchpad',
      subtitle: 'Your permanent draft',
      updatedAt: 'Just now',
      thumbnailColor: '#1e222b'
    },
    {
      id: 'avatar-rig-3d',
      title: 'Avatar Stage 3D',
      subtitle: 'Cholita Live2D & Three.js Rig',
      updatedAt: '12m ago',
      thumbnailColor: '#171b22'
    },
    {
      id: 'vector-bezier-icons',
      title: 'Vector Splines & Icons',
      subtitle: 'Cubic Béziers from VTracer WASM',
      updatedAt: '2h ago',
      thumbnailColor: '#1c1f26'
    },
    {
      id: 'trading-terminal',
      title: 'Realtime Trading Terminal',
      subtitle: 'High contrast agentic canvas',
      updatedAt: 'Yesterday',
      thumbnailColor: '#12151c'
    }
  ]

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#090a0d',
        zIndex: 500,
        display: 'flex',
        color: '#f3f5f8',
        userSelect: 'none'
      }}
    >
      {/* Left Sidebar (Paper.design style) */}
      <aside
        style={{
          width: 240,
          background: '#0e1015',
          borderRight: '1px solid rgba(255, 255, 255, 0.07)',
          padding: '16px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* User Profile Dropdown */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #388bfd, #0969da)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700
                }}
              >
                CC
              </div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Carlos Carpio</span>
            </div>
            <span style={{ fontSize: 10, color: '#8c96a5' }}>⌄</span>
          </div>

          {/* Search Input (⌘F) */}
          <div
            style={{
              background: '#151820',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <span style={{ fontSize: 11, color: '#8c96a5' }}>🔍</span>
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#f3f5f8',
                  fontSize: 12,
                  outline: 'none',
                  width: '100%'
                }}
              />
            </div>
            <span style={{ fontSize: 10, color: '#5e6878', background: '#1e222b', padding: '2px 5px', borderRadius: 4 }}>
              ⌘F
            </span>
          </div>

          {/* Main Navigation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button
              onClick={() => setActiveNav('recents')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 8,
                background: activeNav === 'recents' ? '#212631' : 'transparent',
                color: activeNav === 'recents' ? '#ffffff' : '#8c96a5',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <span>⏱</span>
              <span>Recents</span>
            </button>
            <button
              onClick={() => setActiveNav('learn')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                borderRadius: 8,
                background: activeNav === 'learn' ? '#212631' : 'transparent',
                color: activeNav === 'learn' ? '#ffffff' : '#8c96a5',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>💡</span>
                <span>Learn</span>
              </div>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#388bfd' }} />
            </button>
          </div>

          {/* Team Section */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#5e6878', padding: '4px 10px' }}>
              Carlos's Team
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
              <button
                onClick={() => setActiveNav('files')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: activeNav === 'files' ? '#212631' : 'transparent',
                  color: activeNav === 'files' ? '#ffffff' : '#8c96a5',
                  border: 'none',
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span>📁</span>
                <span>Files</span>
              </button>
              <button
                onClick={() => setActiveNav('archive')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: activeNav === 'archive' ? '#212631' : 'transparent',
                  color: activeNav === 'archive' ? '#ffffff' : '#8c96a5',
                  border: 'none',
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span>📦</span>
                <span>Archive</span>
              </button>
              <button
                onClick={() => setActiveNav('settings')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: activeNav === 'settings' ? '#212631' : 'transparent',
                  color: activeNav === 'settings' ? '#ffffff' : '#8c96a5',
                  border: 'none',
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span>⚙</span>
                <span>Settings</span>
              </button>
            </div>
          </div>

          {/* Add Members Card */}
          <div
            style={{
              background: '#151820',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 10,
              padding: 12,
              marginTop: 10
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#f3f5f8', marginBottom: 4 }}>
              Add members to your team
            </div>
            <div style={{ fontSize: 10, color: '#8c96a5', marginBottom: 10, lineHeight: 1.4 }}>
              Paper is better with others. Add your colleagues for free.
            </div>
            <button
              style={{
                width: '100%',
                background: '#212631',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 6,
                padding: '5px 8px',
                color: '#f3f5f8',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              👥 Invite members
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div style={{ fontSize: 11, color: '#8c96a5', cursor: 'pointer' }}>↓ Get desktop app</div>
          <div style={{ fontSize: 10, color: '#5e6878' }}>What's new • Feedback</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: 32, overflowY: 'auto' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Recents</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => {
                onNewFile()
                onClose()
              }}
              style={{
                background: '#f3f5f8',
                color: '#090a0d',
                border: 'none',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <span>+</span>
              <span>New file</span>
            </button>

            <button
              onClick={onClose}
              title="Return to Canvas"
              style={{
                background: '#151820',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: '7px 12px',
                color: '#8c96a5',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              Back to Canvas ✕
            </button>
          </div>
        </div>

        {/* Project Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
          {projects.map((p, idx) => {
            const isSelected = idx === 0
            return (
              <div
                key={p.id}
                onClick={() => {
                  onOpenProject(p.id)
                  onClose()
                }}
                style={{
                  background: '#0e1015',
                  border: isSelected ? '2px solid #388bfd' : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isSelected ? '0 0 0 1px #388bfd, 0 12px 32px rgba(0, 0, 0, 0.6)' : '0 4px 16px rgba(0, 0, 0, 0.3)'
                }}
              >
                {/* Thumbnail Area */}
                <div
                  style={{
                    height: 160,
                    background: p.thumbnailColor || '#151820',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    position: 'relative'
                  }}
                >
                  <span style={{ fontSize: 36, opacity: 0.7 }}>
                    {idx === 0 ? '📝' : idx === 1 ? '🎭' : idx === 2 ? '⚡' : '📈'}
                  </span>
                </div>

                {/* Card Info */}
                <div style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#f3f5f8' }}>{p.title}</span>
                    <span style={{ fontSize: 10, color: '#5e6878' }}>{p.updatedAt}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#8c96a5' }}>{p.subtitle}</div>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
