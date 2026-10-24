import type { ColimaDeckApi } from '../shared/types'

declare global {
  interface Window {
    colimaDeck: ColimaDeckApi
  }
}
