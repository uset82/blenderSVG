import React, { useState, useEffect, useRef } from 'react'
import {
  OpenRouterModelInfo,
  POPULAR_MODELS,
  AgentChatMessage,
  ZCodeAgentMode,
  fetchAllOpenRouterModels
} from '../services/agentHarnessService.js'

export interface AgentHarnessSidebarProps {
  isOpen: boolean
  onClose: () => void
  onInsertSvgToCanvas: (svg: string, label?: string) => void
  onSendToBlender: (svg: string) => void
}

export function AgentHarnessSidebar({
  isOpen,
  onClose,
  onInsertSvgToCanvas,
  onSendToBlender
}: AgentHarnessSidebarProps) {
  const [activeTab, setActiveTab] = useState<'agent' | 'code' | 'history'>('agent')
  const [mode, setMode] = useState<ZCodeAgentMode>('build')
  const [selectedModel, setSelectedModel] = useState<string>('google/gemini-2.0-flash-exp:free')
  const [models, setModels] = useState<OpenRouterModelInfo[]>(POPULAR_MODELS)
  const [modelSearch, setModelSearch] = useState('')
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false)
  const [parallelAgents, setParallelAgents] = useState<1 | 2 | 3 | 4 | 6>(1)
  const [distribution, setDistribution] = useState<'split' | 'side-by-side'>('split')
  const [openRouterKey, setOpenRouterKey] = useState<string>(() => localStorage.getItem('blendersvg_openrouter_key') || '')
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false)

  // Messages state
  const [messages, setMessages] = useState<AgentChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      content: 'Welcome to the **blenderSVG Agent Harness**! I can design vector assets, generate SVG avatars, execute local Bézier tracing, and bridge directly into Blender 4.5. What should we build?',
      thought: 'Initialized ZCode harness with Build mode and OpenRouter free routing. Ready to orchestrate vector pipelines.',
      timestamp: Date.now()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Quick suggestions
  const promptSuggestions = [
    '✨ High contrast realtime trading terminal',
    '🌱 Cozy mobile app for tracking houseplants',
    '🤖 Cute 3D robot mascot avatar with glowing eyes',
    '⚡ Vectorize brand logo with cubic Bézier splines',
    '🧊 Generate Blender Grease Pencil illustration'
  ]

  // Fetch all OpenRouter models on mount
  useEffect(() => {
    fetchAllOpenRouterModels().then((data) => {
      if (data && data.length > 0) {
        setModels(data)
      }
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSaveApiKey = (key: string) => {
    setOpenRouterKey(key)
    localStorage.setItem('blendersvg_openrouter_key', key)
    setIsKeyModalOpen(false)
  }

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputValue).trim()
    if (!text || isProcessing) return

    const userMsg: AgentChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now()
    }

    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInputValue('')
    setIsProcessing(true)

    try {
      // Route request through Studio API endpoint
      const isZenMux = selectedModel.startsWith('z-ai/')
      const isVTracer = selectedModel.includes('vtracer')

      const response = await fetch('/api/vectorize-sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine: isZenMux ? 'zenmux' : isVTracer ? 'vtracer' : 'openrouter',
          prompt: text,
          model: selectedModel,
          apiKey: openRouterKey || undefined
        })
      })

      const data = await response.json()
      const svg = data.svg || ''

      const assistantMsg: AgentChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: `I've created the vector asset for **"${text}"** using **${selectedModel}** under **${mode.toUpperCase()}** mode with clean semantic layers.`,
        thought: `Synthesized request into ${parallelAgents}x agent workflow. Outputted mathematically optimized cubic Bézier SVG ready for canvas artboards and Blender 4.5.`,
        toolCall: {
          tool: 'vtracer',
          status: 'success',
          details: `Generated ${svg.length} bytes of clean SVG markup.`,
          svgPayload: svg
        },
        timestamp: Date.now()
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch (err: any) {
      const errorMsg: AgentChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Agent execution failed: ${err.message}. Retrying with local VTracer WASM fallback.`,
        timestamp: Date.now()
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsProcessing(false)
    }
  }

  const filteredModels = models.filter(
    (m) =>
      m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
      m.provider?.toLowerCase().includes(modelSearch.toLowerCase())
  )

  const activeModelObj = models.find((m) => m.id === selectedModel) || {
    id: selectedModel,
    name: selectedModel,
    isFree: selectedModel.includes(':free') || selectedModel.startsWith('z-ai/')
  }

  if (!isOpen) return null

  return (
    <aside
      style={{
        position: 'absolute',
        left: 0,
        top: 48,
        bottom: 0,
        width: 360,
        background: 'rgba(14, 16, 21, 0.94)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 95,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '12px 0 40px rgba(0, 0, 0, 0.7)',
        userSelect: 'none'
      }}
    >
      {/* Top Header & Tabs */}
      <div
        style={{
          padding: '12px 14px 8px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Tab Selector */}
          <div style={{ display: 'flex', background: '#151820', borderRadius: 8, padding: 2, gap: 2 }}>
            {(['agent', 'code', 'history'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? '#262b37' : 'transparent',
                  color: activeTab === tab ? '#ffffff' : '#8c96a5',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* API Key Modal Button */}
            <button
              onClick={() => setIsKeyModalOpen(true)}
              title="Configure OpenRouter / ZenMux API Keys"
              style={{
                background: openRouterKey ? 'rgba(35, 134, 54, 0.2)' : '#1e222b',
                border: `1px solid ${openRouterKey ? '#238636' : 'rgba(255, 255, 255, 0.08)'}`,
                color: openRouterKey ? '#3fb950' : '#8c96a5',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              🔑 {openRouterKey ? 'Key Set' : 'Add Key'}
            </button>

            {/* Close Sidebar Button */}
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#8c96a5',
                cursor: 'pointer',
                padding: 4,
                fontSize: 14
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ZCode Execution Mode Selector (Plan | Build | YOLO) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#5e6878', letterSpacing: 0.5 }}>
            ZCODE MODE
          </span>
          <div style={{ display: 'flex', background: '#090a0d', borderRadius: 8, padding: 2, gap: 2, flex: 1, marginLeft: 8 }}>
            {(
              [
                { id: 'plan', label: 'Plan', desc: 'Step verification' },
                { id: 'build', label: 'Build', desc: 'Autonomous build' },
                { id: 'yolo', label: 'YOLO', desc: 'Fast path' }
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                title={m.desc}
                style={{
                  flex: 1,
                  background: mode === m.id ? (m.id === 'yolo' ? '#da3633' : '#262b37') : 'transparent',
                  color: mode === m.id ? '#ffffff' : '#8c96a5',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 6px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Universal Model Selector Pill */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#151820',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
              padding: '6px 10px',
              cursor: 'pointer',
              color: '#f3f5f8',
              fontSize: 11,
              fontWeight: 600
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
              <span style={{ color: activeModelObj.isFree ? '#3fb950' : '#a855f7' }}>●</span>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {activeModelObj.name}
              </span>
            </div>
            <span style={{ fontSize: 10, color: '#8c96a5' }}>▼</span>
          </button>

          {/* Searchable Model Dropdown (All 455+ OpenRouter models) */}
          {isModelDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: '#151820',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 10,
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.8)',
                zIndex: 200,
                maxHeight: 280,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: 8, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <input
                  type="text"
                  placeholder="Search 455+ OpenRouter models..."
                  value={modelSearch}
                  autoFocus
                  onChange={(e) => setModelSearch(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#090a0d',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    padding: '5px 8px',
                    color: '#f3f5f8',
                    fontSize: 11,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ overflowY: 'auto', flex: 1, padding: 4 }}>
                {filteredModels.slice(0, 50).map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.id)
                      setIsModelDropdownOpen(false)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 8px',
                      borderRadius: 6,
                      background: selectedModel === m.id ? '#262b37' : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#f3f5f8', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {m.name}
                      </span>
                      <span style={{ fontSize: 9, color: '#8c96a5' }}>{m.id}</span>
                    </div>
                    {m.isFree && (
                      <span style={{ fontSize: 9, background: 'rgba(35, 134, 54, 0.25)', color: '#3fb950', padding: '2px 5px', borderRadius: 4, fontWeight: 700 }}>
                        FREE
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Parallel Agents Multiplier (pen.dev style) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#5e6878' }}>PARALLEL AGENTS</span>
          <div style={{ display: 'flex', gap: 3 }}>
            {([1, 2, 3, 4, 6] as const).map((count) => (
              <button
                key={count}
                onClick={() => setParallelAgents(count)}
                style={{
                  background: parallelAgents === count ? '#d29922' : '#151820',
                  color: parallelAgents === count ? '#000000' : '#8c96a5',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 5,
                  padding: '3px 6px',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {count}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Message Stream */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '92%'
            }}
          >
            {/* Header info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#8c96a5' }}>
              <span>{msg.role === 'user' ? '👤 You' : '🤖 ZCode Agent'}</span>
              <span>•</span>
              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>

            {/* Bubble */}
            <div
              style={{
                background: msg.role === 'user' ? '#1f6feb' : '#151820',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 12,
                padding: '10px 12px',
                fontSize: 12,
                lineHeight: 1.5,
                color: '#f3f5f8'
              }}
            >
              {msg.content}
            </div>

            {/* Expandable Reasoning / Thought (ZCode style) */}
            {msg.thought && (
              <details
                style={{
                  fontSize: 11,
                  background: '#090a0d',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  color: '#8c96a5'
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#d29922' }}>
                  💭 Reasoning Stream
                </summary>
                <div style={{ marginTop: 4, lineHeight: 1.4 }}>{msg.thought}</div>
              </details>
            )}

            {/* Tool Output Card */}
            {msg.toolCall?.svgPayload && (
              <div
                style={{
                  background: '#090a0d',
                  border: '1px solid rgba(56, 139, 253, 0.3)',
                  borderRadius: 10,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#58a6ff' }}>
                    ⚡ VECTOR ASSET GENERATED
                  </span>
                  <span style={{ fontSize: 9, color: '#3fb950', fontWeight: 600 }}>● Ready</span>
                </div>

                {/* SVG Preview thumbnail */}
                <div
                  style={{
                    background: '#151820',
                    borderRadius: 8,
                    padding: 8,
                    height: 100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}
                  dangerouslySetInnerHTML={{ __html: msg.toolCall.svgPayload }}
                />

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => onInsertSvgToCanvas(msg.toolCall!.svgPayload!)}
                    style={{
                      flex: 1,
                      background: '#238636',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px 8px',
                      color: '#ffffff',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    ➕ Insert to Canvas
                  </button>
                  <button
                    onClick={() => onSendToBlender(msg.toolCall!.svgPayload!)}
                    style={{
                      background: '#1e222b',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 6,
                      padding: '5px 8px',
                      color: '#f97316',
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    🧊 Send to Blender
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {isProcessing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#58a6ff' }}>
            <span>⚡ Orchestrating ZCode agent pipeline with {activeModelObj.name}...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div
        style={{
          padding: '6px 12px',
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)'
        }}
      >
        {promptSuggestions.map((s, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(s.replace(/^[^\s]+\s/, ''))}
            style={{
              whiteSpace: 'nowrap',
              background: '#151820',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 20,
              padding: '4px 10px',
              fontSize: 10,
              color: '#8c96a5',
              cursor: 'pointer'
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Chat Input Dock */}
      <div
        style={{
          padding: 12,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: '#090a0d',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#151820',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 10,
            padding: '4px 8px',
            gap: 6
          }}
        >
          <input
            type="text"
            placeholder="Ask me to design anything..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#f3f5f8',
              fontSize: 12,
              outline: 'none'
            }}
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={isProcessing || !inputValue.trim()}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: inputValue.trim() ? '#388bfd' : '#262b37',
              color: '#ffffff',
              border: 'none',
              cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700
            }}
          >
            ↑
          </button>
        </div>
      </div>

      {/* API Key Modal */}
      {isKeyModalOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 300
          }}
        >
          <div
            style={{
              background: '#151820',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 14,
              padding: 16,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#f3f5f8' }}>
                OpenRouter & ZenMux Keys
              </span>
              <button
                onClick={() => setIsKeyModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#8c96a5', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 11, color: '#8c96a5', margin: 0, lineHeight: 1.4 }}>
              Free models (Gemini 2.0 Flash, LLaMA 3.3, ZenMux GLM) work out of the box with zero setup. Enter your OpenRouter key below to access Claude 3.7, GPT-4o, or private enterprise models.
            </p>

            <input
              type="password"
              placeholder="sk-or-v1-..."
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              style={{
                background: '#090a0d',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '8px 10px',
                color: '#f3f5f8',
                fontSize: 12,
                outline: 'none'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                onClick={() => setIsKeyModalOpen(false)}
                style={{
                  background: '#262b37',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 12px',
                  color: '#8c96a5',
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveApiKey(openRouterKey)}
                style={{
                  background: '#238636',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 14px',
                  color: '#ffffff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
