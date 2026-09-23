import React, { useState } from 'react'

export interface FloatingPromptBarProps {
  onGenerate: (prompt: string, mode: 'design' | 'vector' | 'avatar' | 'image') => void
  isProcessing: boolean
}

export function FloatingPromptBar({ onGenerate, isProcessing }: FloatingPromptBarProps) {
  const [prompt, setPrompt] = useState('')
  const [mode, setMode] = useState<'design' | 'vector' | 'avatar' | 'image'>('design')
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false)

  const floatingSuggestions = [
    '✨ A recruitment ad for product designers',
    '✨ Three variants for a YouTube thumbnail',
    '✨ Cyberpunk cat vector mascot'
  ]

  const modeLabels = {
    design: '✨ Design',
    vector: '📐 Vector Asset',
    avatar: '🎭 Avatar 3D',
    image: '🖼️ Image'
  }

  const handleSubmit = () => {
    if (!prompt.trim() || isProcessing) return
    onGenerate(prompt.trim(), mode)
    setPrompt('')
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        zIndex: 85,
        userSelect: 'none',
        pointerEvents: 'all'
      }}
    >
      {/* Floating Suggestion Pills */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {floatingSuggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => {
              const cleaned = s.replace(/^[^\s]+\s/, '')
              onGenerate(cleaned, mode)
            }}
            style={{
              background: 'rgba(21, 24, 32, 0.75)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 20,
              padding: '5px 12px',
              fontSize: 11,
              color: '#8c96a5',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)'
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Main Glassmorphic Prompt Bar */}
      <div
        style={{
          width: 580,
          background: 'rgba(14, 16, 21, 0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 20,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.03)'
        }}
      >
        {/* Mode Selector Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
            style={{
              background: '#151820',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 12,
              padding: '6px 10px',
              color: '#f3f5f8',
              fontSize: 11,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer'
            }}
          >
            <span>{modeLabels[mode]}</span>
            <span style={{ fontSize: 9, color: '#8c96a5' }}>▼</span>
          </button>

          {isModeDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                marginBottom: 6,
                background: '#151820',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 10,
                boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
                zIndex: 100,
                overflow: 'hidden',
                minWidth: 140
              }}
            >
              {(Object.keys(modeLabels) as Array<keyof typeof modeLabels>).map((k) => (
                <div
                  key={k}
                  onClick={() => {
                    setMode(k)
                    setIsModeDropdownOpen(false)
                  }}
                  style={{
                    padding: '8px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: mode === k ? '#388bfd' : '#f3f5f8',
                    background: mode === k ? '#262b37' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  {modeLabels[k]}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input */}
        <input
          type="text"
          placeholder="Describe what you want to create..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            color: '#f3f5f8',
            fontSize: 13,
            outline: 'none'
          }}
        />

        {/* Model Badge */}
        <div
          style={{
            background: 'rgba(56, 139, 253, 0.12)',
            border: '1px solid rgba(56, 139, 253, 0.25)',
            borderRadius: 8,
            padding: '4px 8px',
            fontSize: 10,
            fontWeight: 700,
            color: '#58a6ff'
          }}
        >
          ⚡ OpenRouter
        </div>

        {/* Action Button */}
        <button
          onClick={handleSubmit}
          disabled={isProcessing || !prompt.trim()}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: prompt.trim() ? '#f97316' : '#262b37',
            border: 'none',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            cursor: prompt.trim() ? 'pointer' : 'not-allowed',
            boxShadow: prompt.trim() ? '0 4px 12px rgba(249, 115, 22, 0.35)' : 'none'
          }}
        >
          {isProcessing ? '⏳' : '↑'}
        </button>
      </div>
    </div>
  )
}
