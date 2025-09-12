import { useState } from 'react'
import AutomationConfig from './components/AutomationConfig'
import ProfileTable from './components/ProfileTable'
import './App.css'

function App() {
  const [view, setView] = useState<'config' | 'profiles'>('config')

  if (view === 'profiles') {
    return (
      <div className="min-h-screen bg-background">
        <ProfileTable onBack={() => setView('config')} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AutomationConfig onContinue={() => setView('profiles')} />
    </div>
  )
}

export default App
