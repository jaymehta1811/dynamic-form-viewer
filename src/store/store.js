import { configureStore } from '@reduxjs/toolkit'
import profilesReducer from './profilesSlice'

const STORAGE_KEY = 'dynamic-form-viewer:v1'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return undefined
    return parsed
  } catch {
    return undefined
  }
}

function saveToStorage(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore storage quota / blocked storage
  }
}

export const store = configureStore({
  reducer: {
    profiles: profilesReducer,
  },
  preloadedState: loadFromStorage(),
})

store.subscribe(() => {
  saveToStorage({
    profiles: store.getState().profiles,
  })
})

