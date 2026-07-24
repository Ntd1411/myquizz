import { registerMode } from './registry.js'
import { classicMode } from './modes/classic.mode.js'
import { survivalMode } from './modes/survival.mode.js'
import { practiceMode } from './modes/practice.mode.js'
import { soloMode } from './modes/solo.mode.js'
import { marathonMode } from './modes/marathon.mode.js'

export const bootstrapEngine = () => {
  registerMode(classicMode)
  registerMode(soloMode)
  registerMode(survivalMode)
  registerMode(practiceMode)
  registerMode(marathonMode)
}

export * from './registry.js'
