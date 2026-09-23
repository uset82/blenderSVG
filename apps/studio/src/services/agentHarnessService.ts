export interface OpenRouterModelInfo {
  id: string
  name: string
  context_length?: number
  pricing?: { prompt: string; completion: string }
  isFree?: boolean
  provider?: string
}

export const POPULAR_MODELS: OpenRouterModelInfo[] = [
  // Free Tiers
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', isFree: true, provider: 'Google' },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', isFree: true, provider: 'Meta' },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', isFree: true, provider: 'DeepSeek' },
  { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B (Free)', isFree: true, provider: 'Qwen' },
  { id: 'z-ai/glm-4.6v-flash-free', name: 'ZenMux GLM-4.6v (Free)', isFree: true, provider: 'ZenMux' },
  { id: 'z-ai/glm-4.7-flash-free', name: 'ZenMux GLM-4.7 (Free)', isFree: true, provider: 'ZenMux' },
  { id: 'local/vtracer-spline', name: 'VTracer Bézier (Local WASM)', isFree: true, provider: 'Local' },
  
  // Flagship Models
  { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet', isFree: false, provider: 'Anthropic' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', isFree: false, provider: 'Anthropic' },
  { id: 'openai/gpt-4o', name: 'GPT-4o (Omni)', isFree: false, provider: 'OpenAI' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', isFree: false, provider: 'DeepSeek' }
]

export interface AgentChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  thought?: string
  toolCall?: {
    tool: 'vtracer' | 'insert_canvas' | 'blender_bridge' | 'recolor_layer'
    status: 'pending' | 'success' | 'failed'
    details?: string
    svgPayload?: string
  }
  timestamp: number
}

export type ZCodeAgentMode = 'plan' | 'build' | 'yolo'

export interface AgentHarnessConfig {
  mode: ZCodeAgentMode
  model: string
  parallelAgents: 1 | 2 | 3 | 4 | 6
  distribution: 'split' | 'side-by-side'
  openRouterApiKey?: string
  zenMuxApiKey?: string
}

/**
 * Fetch all available OpenRouter models dynamically with fallback to curated models.
 */
export async function fetchAllOpenRouterModels(): Promise<OpenRouterModelInfo[]> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models')
    if (!res.ok) return POPULAR_MODELS
    const json = await res.json()
    const rawList = json.data || []
    
    const formatted: OpenRouterModelInfo[] = rawList.map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      context_length: m.context_length,
      pricing: m.pricing,
      isFree: m.id.endsWith(':free') || m.pricing?.prompt === '0',
      provider: m.id.split('/')[0] || 'Unknown'
    }))

    // Merge in local and ZenMux options
    return [
      { id: 'local/vtracer-spline', name: 'VTracer Bézier (Local WASM)', isFree: true, provider: 'Local' },
      { id: 'z-ai/glm-4.6v-flash-free', name: 'ZenMux GLM-4.6v (Free)', isFree: true, provider: 'ZenMux' },
      { id: 'z-ai/glm-4.7-flash-free', name: 'ZenMux GLM-4.7 (Free)', isFree: true, provider: 'ZenMux' },
      ...formatted
    ]
  } catch {
    return POPULAR_MODELS
  }
}
