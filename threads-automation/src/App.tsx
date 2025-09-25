import { useState } from 'react'
import AutomationConfig from './components/AutomationConfig'
import ProfileTable from './components/ProfileTable'
import './App.css'

type AutomationSettings = {
  windowWidth: number
  windowHeight: number
  scalePercent: number
  numThreads: number
  csvData?: Array<Record<string, string>>
  selectedScenario?: string
}

function App() {
  const [view, setView] = useState<'config' | 'profiles'>('config')
  const [settings, setSettings] = useState<AutomationSettings>({
    windowWidth: 800,
    windowHeight: 600,
    scalePercent: 100,
    numThreads: 5
  })

  if (view === 'profiles') {
    return (
      <div className="min-h-screen bg-background">
        <ProfileTable 
          onBack={() => setView('config')} 
          settings={settings}
          csvData={settings.csvData}
          selectedScenario={settings.selectedScenario}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AutomationConfig 
        onContinue={(config) => {
          setSettings(config)
          setView('profiles')
        }} 
      />
    </div>
  )
}

export default App
