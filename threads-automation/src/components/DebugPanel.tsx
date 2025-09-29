import React, { useState } from 'react'
import { Button } from './ui/button'
import { Card } from './ui/card'

interface DebugPanelProps {
  onDebugStart: () => void
  onDebugStop: () => void
  isDebugging: boolean
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ 
  onDebugStart, 
  onDebugStop, 
  isDebugging 
}) => {
  const [debugSteps, setDebugSteps] = useState<string[]>([])

  const addDebugStep = (step: string) => {
    setDebugSteps(prev => [...prev, `${new Date().toLocaleTimeString()}: ${step}`])
  }

  const clearDebugSteps = () => {
    setDebugSteps([])
  }

  return (
    <Card className="p-4 m-4">
      <h3 className="text-lg font-semibold mb-4">🐛 Debug Panel</h3>
      
      <div className="space-y-2 mb-4">
        <Button 
          onClick={onDebugStart}
          disabled={isDebugging}
          variant="default"
        >
          {isDebugging ? 'Debugging...' : 'Start Debug Mode'}
        </Button>
        
        <Button 
          onClick={onDebugStop}
          disabled={!isDebugging}
          variant="destructive"
        >
          Stop Debug
        </Button>
        
        <Button 
          onClick={clearDebugSteps}
          variant="outline"
        >
          Clear Log
        </Button>
      </div>

      <div className="bg-gray-100 p-3 rounded max-h-60 overflow-y-auto">
        <h4 className="font-medium mb-2">Debug Steps:</h4>
        {debugSteps.length === 0 ? (
          <p className="text-gray-500">No debug steps yet...</p>
        ) : (
          <div className="space-y-1">
            {debugSteps.map((step, index) => (
              <div key={index} className="text-sm font-mono bg-white p-1 rounded">
                {step}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Debug Instructions:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Click "Start Debug Mode" to enable debugging</li>
          <li>Open Chrome DevTools at <code>chrome://inspect</code></li>
          <li>Use breakpoints in your automation script</li>
          <li>Step through code with F10, F11</li>
        </ul>
      </div>
    </Card>
  )
}
