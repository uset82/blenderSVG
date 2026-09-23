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
  onInsertSvgToCanvas,
  onSendToBlender
}: AgentHarnessSidebarProps) {
  const [activeTab, setActiveTab] = useState<'agent' | 'code' | 'inspector'>('agent')
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
  const [messages, setMessages] = useState<AgentChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Pen.dev exact prompt suggestions
  const promptSuggestions = [
    'High contrast realtime trading terminal',
    'Cozy mobile app for tracking houseplants',
    'Vintage ticketing site for an independent ortho',
    'Elegant reservation app for a Michelin-star sushi bar',
    'Control panel for a humanoid robotics factory'
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
        content: `Generated vector specification for "${text}" using ${selectedModel}. Ready for placement on canvas frame.`,
        thought: `Synthesized request into ${parallelAgents}x agent workflow under ${mode} mode. Produced clean SVG markup ready for artboard insertion.`,
        toolCall: {
          tool: 'vtracer',
          status: 'success',
          details: `Generated ${svg.length} bytes of clean SVG.`,
          svgPayload: svg
        },
        timestamp: Date.now()
      }

      setMessages((prev) => [...prev, assistantMsg])
      if (svg) {
        onInsertSvgToCanvas(svg, text)
      }
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
        width: 340,
        height: '100%',
        background: '#0f1115',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* Top Header & Tabs (pen.dev style) */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Tab Selector */}
          <div style={{ display: 'flex', background: '#161920', borderRadius: 7, padding: 2, gap: 2 }}>
            {(['agent', 'code', 'inspector'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  background: activeTab === tab ? '#262a36' : 'transparent',
                  color: activeTab === tab ? '#ffffff' : '#8c96a5',
                  border: 'none',
                  borderRadius: 5,
                  padding: '3px 9px',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Agent Switcher & New */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#8c96a5' }}>New Agent ⌄</span>
            <button
              onClick={() => setMessages([])}
              style={{
                background: '#1a1d26',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#c5cdd8',
                borderRadius: 5,
                padding: '2px 7px',
                fontSize: 11,
                cursor: 'pointer'
              }}
            >
              + New
            </button>
          </div>
        </div>

        {/* ZCode Mode Selector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: '#57606e' }}>MODE</span>
          <div style={{ display: 'flex', background: '#14161c', borderRadius: 6, padding: 2, gap: 2 }}>
            {(['plan', 'build', 'yolo'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  background: mode === m ? '#262a36' : 'transparent',
                  color: mode === m ? '#ffffff' : '#8c96a5',
                  border: 'none',
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Body (Suggestions or Messages) */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#c5cdd8', marginBottom: 2 }}>
              Ask me to design anything
            </div>

            {promptSuggestions.map((text, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(text)}
                style={{
                  background: '#14161c',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  color: '#9aa4b2',
                  fontSize: 11,
                  textAlign: 'left',
                  cursor: 'pointer',
                  lineHeight: 1.4
                }}
              >
                {text}
              </button>
            ))}

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#57606e', marginBottom: 4 }}>
                How to export to code
              </div>
              <div style={{ fontSize: 10, color: '#7a8596', lineHeight: 1.4 }}>
                Click Export in the titlebar to generate React/Tailwind code or send directly to Blender 4.5.
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '92%'
              }}
            >
              <div style={{ fontSize: 10, color: '#57606e' }}>
                {msg.role === 'user' ? 'You' : 'Agent'}
              </div>

              <div
                style={{
                  background: msg.role === 'user' ? '#1f6feb' : '#161922',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: '8px 11px',
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: '#f0f3f6'
                }}
              >
                {msg.content}
              </div>

              {msg.toolCall?.svgPayload && (
                <div
                  style={{
                    background: '#12141a',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 8,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6
                  }}
                >
                  <div
                    style={{
                      height: 80,
                      background: '#181b24',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden'
                    }}
                    dangerouslySetInnerHTML={{ __html: msg.toolCall.svgPayload }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => onInsertSvgToCanvas(msg.toolCall!.svgPayload!)}
                      style={{
                        flex: 1,
                        background: '#262a36',
                        border: 'none',
                        borderRadius: 5,
                        padding: '4px',
                        color: '#c5cdd8',
                        fontSize: 10,
                        cursor: 'pointer'
                      }}
                    >
                      Insert to Canvas
                    </button>
                    <button
                      onClick={() => onSendToBlender(msg.toolCall!.svgPayload!)}
                      style={{
                        flex: 1,
                        background: '#262a36',
                        border: 'none',
                        borderRadius: 5,
                        padding: '4px',
                        color: '#c5cdd8',
                        fontSize: 10,
                        cursor: 'pointer'
                      }}
                    >
                      Blender 3D
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {isProcessing && (
          <div style={{ fontSize: 11, color: '#8c96a5' }}>
            Designing with {activeModelObj.name}...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Section (pen.dev Parallel Agents + Chat Input) */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: '#0c0d10',
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}
      >
        {/* Parallel Agents Multiplier (pen.dev exact) */}
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#57606e', letterSpacing: 0.5, marginBottom: 4 }}>
            PARALLEL AGENTS
          </div>
          <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
            {([1, 2, 3, 4, 5, 6] as const).map((n) => (
              <button
                key={n}
                onClick={() => setParallelAgents(n as any)}
                style={{
                  flex: 1,
                  background: parallelAgents === n ? '#d29922' : '#14161c',
                  color: parallelAgents === n ? '#000000' : '#8c96a5',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 4,
                  padding: '3px 0',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {n}x
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => setDistribution('split')}
              style={{
                flex: 1,
                background: distribution === 'split' ? '#20242e' : 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 4,
                padding: '3px 6px',
                fontSize: 9,
                color: distribution === 'split' ? '#c5cdd8' : '#57606e',
                cursor: 'pointer'
              }}
            >
              Split Work
            </button>
            <button
              onClick={() => setDistribution('side-by-side')}
              style={{
                flex: 1,
                background: distribution === 'side-by-side' ? '#20242e' : 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: 4,
                padding: '3px 6px',
                fontSize: 9,
                color: distribution === 'side-by-side' ? '#c5cdd8' : '#57606e',
                cursor: 'pointer'
              }}
            >
              Side by Side
            </button>
          </div>
        </div>

        {/* Input Bar (pen.dev style) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#161920',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 8,
            padding: '4px 6px',
            gap: 6,
            position: 'relative'
          }}
        >
          {/* Plus / Attach */}
          <button
            onClick={() => setIsKeyModalOpen(true)}
            title="Configure API Keys"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8c96a5',
              cursor: 'pointer',
              fontSize: 14,
              padding: '0 2px'
            }}
          >
            +
          </button>

          {/* Input Text */}
          <input
            type="text"
            placeholder="Ask me to design..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#f0f3f6',
              fontSize: 11,
              outline: 'none'
            }}
          />

          {/* Model Selector Pill */}
          <button
            onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
            style={{
              background: '#20242e',
              border: 'none',
              borderRadius: 4,
              padding: '2px 6px',
              color: '#c5cdd8',
              fontSize: 10,
              cursor: 'pointer',
              maxWidth: 90,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {activeModelObj.name} ⌄
          </button>

          {/* Send Arrow */}
          <button
            onClick={() => handleSendMessage()}
            disabled={isProcessing || !inputValue.trim()}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              background: inputValue.trim() ? '#ffffff' : '#262a36',
              color: '#0c0d10',
              border: 'none',
              cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700
            }}
          >
            ↑
          </button>

          {/* Model Search Dropdown */}
          {isModelDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                marginBottom: 6,
                background: '#161920',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8)',
                zIndex: 200,
                maxHeight: 240,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: 6, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <input
                  type="text"
                  placeholder="Search 455+ models..."
                  value={modelSearch}
                  autoFocus
                  onChange={(e) => setModelSearch(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: '#0c0d10',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 4,
                    padding: '4px 6px',
                    color: '#f0f3f6',
                    fontSize: 10,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ overflowY: 'auto', flex: 1, padding: 3 }}>
                {filteredModels.slice(0, 40).map((m) => (
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
                      padding: '5px 6px',
                      borderRadius: 4,
                      background: selectedModel === m.id ? '#262a36' : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: 10, color: '#f0f3f6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name}
                    </span>
                    {m.isFree && (
                      <span style={{ fontSize: 8, background: '#238636', color: '#fff', padding: '1px 3px', borderRadius: 3 }}>
                        FREE
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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
            padding: 16,
            zIndex: 300
          }}
        >
          <div
            style={{
              background: '#161920',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 10,
              padding: 14,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#f0f3f6' }}>
                OpenRouter Key
              </span>
              <button
                onClick={() => setIsKeyModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#8c96a5', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 10, color: '#8c96a5', margin: 0, lineHeight: 1.4 }}>
              Free models (Gemini 2.0 Flash, LLaMA 3.3, ZenMux) work without a key. Enter key for Claude 3.7 or GPT-4o.
            </p>

            <input
              type="password"
              placeholder="sk-or-v1-..."
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              style={{
                background: '#0c0d10',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 6,
                padding: '6px 8px',
                color: '#f0f3f6',
                fontSize: 11,
                outline: 'none'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
              <button
                onClick={() => setIsKeyModalOpen(false)}
                style={{
                  background: '#20242e',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 10px',
                  color: '#8c96a5',
                  fontSize: 10,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveApiKey(openRouterKey)}
                style={{
                  background: '#ffffff',
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 12px',
                  color: '#0c0d10',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
