import { TLShape } from 'tldraw'

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'avatar': {
      w: number
      h: number
      character: string
      avatarState: string
      speech: string
    }
    'vector-studio': {
      w: number
      h: number
      engine: string
      openRouterModel: string
      detail: string
      lastSvg: string
      isProcessing: boolean
    }
    'blender-connector': {
      w: number
      h: number
      blenderVersion: string
      isConnected: boolean
      activeScene: string
      lastExport: string
    }
  }
}

export type AvatarShape = TLShape<'avatar'>
export type VectorStudioShape = TLShape<'vector-studio'>
export type BlenderConnectorShape = TLShape<'blender-connector'>
