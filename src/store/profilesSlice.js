import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  items: [],
  editingId: null,
}

const profilesSlice = createSlice({
  name: 'profiles',
  initialState,
  reducers: {
    addProfile: (state, action) => {
      const profile = action.payload
      state.items.unshift(profile)
    },
    updateProfile: (state, action) => {
      const { id, changes } = action.payload
      const idx = state.items.findIndex((p) => p.id === id)
      if (idx === -1) return
      state.items[idx] = { ...state.items[idx], ...changes, updatedAt: Date.now() }
    },
    deleteProfile: (state, action) => {
      const id = action.payload
      state.items = state.items.filter((p) => p.id !== id)
      if (state.editingId === id) state.editingId = null
    },
    startEdit: (state, action) => {
      state.editingId = action.payload
    },
    cancelEdit: (state) => {
      state.editingId = null
    },
  },
})

export const { addProfile, updateProfile, deleteProfile, startEdit, cancelEdit } =
  profilesSlice.actions

export default profilesSlice.reducer

