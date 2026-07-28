import { AppError } from '../../../shared/errors/AppError.js'
import type { GameModeHandler } from './mode.type.js'

const registry = new Map<string, GameModeHandler>()

export const registerMode = (h: GameModeHandler) => registry.set(h.mode, h)

export const getModeHandler = (mode: string): GameModeHandler => {
  const h = registry.get(mode)
  if (!h) throw new AppError(400, `Unsupported mode: ${mode}`)
  return h
}

export const listModes = () => [...registry.keys()]
