import { Routes, Route, useLocation } from 'react-router-dom'
import Form from './components/Form'
import Table from './components/Table'

function AppShell({ children }) {
  const location = useLocation()
  const isTable = location.pathname.startsWith('/table')

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1 className="app-title">Dynamic Form Viewer</h1>
          <p className="app-subtitle">
            {isTable ? 'Review and manage submitted profiles.' : 'Create or edit a profile.'}
          </p>
        </div>
      </header>
      {children}
    </div>
  )
}

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Form />} />
        <Route path="/table" element={<Table />} />
      </Routes>
    </AppShell>
  )
}

export default App
