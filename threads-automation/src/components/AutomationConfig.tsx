import { useState } from 'react'
import { Button } from '@/components/ui/button'
// Removed Card wrappers; using plain sections instead
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// Tabs components no longer needed - using sidebar instead
import { HelpCircle, Plus, Trash2, Copy, Upload } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import DatePickerAndTimePickerDemo, { type DateTimeValue } from '@/components/ui/datetime-picker'
import { type CsvRow } from '@/utils/csvReader'

type Props = { 
  onContinue?: (config: {
    windowWidth: number
    windowHeight: number
    scalePercent: number
    numThreads: number
    csvData?: CsvRow[]
  }) => void 
}

export default function AutomationConfig({ onContinue }: Props) {
  const [activeTab, setActiveTab] = useState('input-from-application')
  const [viewAsObject, setViewAsObject] = useState(false) // Toggle between table and object view
  const [selectedScript, setSelectedScript] = useState('')
  
  // Separate state for each scenario
  const [scenarios, setScenarios] = useState({
    'posts-comment': {
      useInputExcel: true,
      filePath: '',
      numThreads: 5,
      windowWidth: 800,
      windowHeight: 600,
      scalePercent: 100,
      schedules: [] as ScheduleItem[],
      csvData: [] as CsvRow[]
    },
    'login': {
      useInputExcel: true,
      filePath: '',
      numThreads: 5,
      windowWidth: 800,
      windowHeight: 600,
      scalePercent: 100,
      schedules: [] as ScheduleItem[],
      csvData: [] as CsvRow[]
    },
    'interactive': {
      useInputExcel: true,
      filePath: '',
      numThreads: '5',
      windowWidth: '800',
      windowHeight: '600',
      scalePercent: '100',
      schedules: [] as ScheduleItem[],
      csvData: [] as CsvRow[]
    }
  })
  
  type ScheduleItem = { id: string, value: DateTimeValue, saved: boolean }
  
  // Get current scenario data - using posts-comment as default since we removed scenario selection
  const currentScenario = scenarios['posts-comment']

  // Helper function to update scenario data
  const updateScenario = (key: string, value: any) => {
    setScenarios(prev => ({
      ...prev,
      'posts-comment': {
        ...prev['posts-comment'],
        [key]: value
      }
    }))
  }

  const handleAddSchedule = () => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const initial: ScheduleItem = { id, value: { date: undefined, time: '06:30:00' }, saved: false }
    updateScenario('schedules', [...currentScenario.schedules, initial])
  }

  const handleChangeSchedule = (id: string, value: DateTimeValue) => {
    const updatedSchedules = currentScenario.schedules.map((s) => (s.id === id ? { ...s, value } : s))
    updateScenario('schedules', updatedSchedules)
  }

  const handleSaveSchedule = (id: string) => {
    const updatedSchedules = currentScenario.schedules.map((s) => (s.id === id ? { ...s, saved: true } : s))
    updateScenario('schedules', updatedSchedules)
  }

  const handleEditSchedule = (id: string) => {
    const updatedSchedules = currentScenario.schedules.map((s) => (s.id === id ? { ...s, saved: false } : s))
    updateScenario('schedules', updatedSchedules)
  }

  const handleDeleteSchedule = (id: string) => {
    const updatedSchedules = currentScenario.schedules.filter((s) => s.id !== id)
    updateScenario('schedules', updatedSchedules)
  }

  const handleFileSelect = async () => {
    const api = window.api as any
    if (!api?.selectFile) {
      console.warn('File picker API is not available')
      return
    }
    const selectedFile = await api.selectFile()
    if (!selectedFile) return
    
    updateScenario('filePath', selectedFile)
    
    // Reset preview state when new file is selected
    setViewAsObject(false)
    
    // Auto-parse file if it's a supported format (CSV, XLSX, XLS, XLSM)
    const fileExtension = selectedFile.toLowerCase().split('.').pop()
    if (['csv', 'xlsx', 'xls', 'xlsm'].includes(fileExtension || '')) {
      try {
        const csvData = await api.parseCsv(selectedFile)
        updateScenario('csvData', csvData.rows)
      } catch (err) {
        console.error('Failed to parse file:', err)
      }
    }
  }

  // Group CSV data by profile name for object view
  const getGroupedData = (csvData: CsvRow[]) => {
    const groups: Record<string, CsvRow[]> = {}
    
    for (const row of csvData) {
      // Find profile column (case-insensitive)
      const rowKeys = Object.keys(row)
      const profileKey = rowKeys.find(key => key.toLowerCase() === 'profile')
      
      if (profileKey) {
        const profileName = (row[profileKey] || '').toString().trim()
        if (profileName) {
          if (!groups[profileName]) groups[profileName] = []
          groups[profileName].push(row)
        }
      }
    }
    
    return groups
  }

  // Copy raw object to clipboard
  const handleCopyToClipboard = async (data: any) => {
    try {
      const jsonString = JSON.stringify(data, null, 2)
      await navigator.clipboard.writeText(jsonString)
      console.log('Raw object copied to clipboard!')
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const tabItems = [
    { id: 'input-from-application', label: 'Input from application', icon: '📝' },
    { id: 'run-configuration', label: 'Run Configuration', icon: '⚙️' },
    { id: 'schedule', label: 'Schedule', icon: '📅' }
  ]

  // Available automation scripts
  const availableScripts = [
    { id: 'posts-comment', name: 'Posts and Comments', description: 'Automate posting and commenting on threads' },
    { id: 'login', name: 'Login Automation', description: 'Automate user login process' },
    { id: 'interactive', name: 'Interactive Automation', description: 'Interactive automation with user input' },
    { id: 'custom', name: 'Custom Script', description: 'Import your own custom automation script' }
  ]

  const handleImportCustomScript = async () => {
    const api = window.api as any
    if (!api?.selectFile) {
      console.warn('File picker API is not available')
      return
    }

    try {
      const filePath = await api.selectFile()
      if (filePath) {
        console.log('Custom script selected:', filePath)
        setSelectedScript('custom')
        // Here you would typically load and parse the custom script
        // For now, just show a success message
        alert(`Custom script imported: ${filePath}`)
      }
    } catch (error) {
      console.error('Failed to import custom script:', error)
      alert('Failed to import custom script. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Left Sidebar */}
        <div className="w-64 bg-card border-r border-border min-h-screen">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-blue-600 mb-8">Automation Configuration</h1>
            <nav className="space-y-2">
              {tabItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
                    activeTab === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="max-w-4xl">
            {/* Content based on active tab */}
            {activeTab === 'input-from-application' && (
                <section aria-labelledby="input-from-application-heading" className="space-y-6">
                  <h2 id="input-from-application-heading" className="text-2xl font-semibold">
                    Input from application
                  </h2>

                  {/* Automation Script Selection */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="script-select">
                        Select Automation Script
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleImportCustomScript}
                      >
                        <Upload className="h-4 w-4" />
                        Import Custom Script
                      </Button>
                    </div>
                    
                    <Select value={selectedScript} onValueChange={setSelectedScript}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an automation script..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableScripts.map((script) => (
                          <SelectItem key={script.id} value={script.id}>
                            <span className="font-semibold">{script.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                  </div>

                  {/* Use input Excel option */}
                     <div className="flex items-center space-x-3">
                       <Checkbox 
                         id="use-input-excel" 
                         checked={currentScenario.useInputExcel}
                         onCheckedChange={(checked) => updateScenario('useInputExcel', checked === true)}
                       />
                      <div className="flex items-center space-x-2">
                        <Label 
                          htmlFor="use-input-excel" 
                          className="text-base font-normal underline decoration-dotted cursor-pointer"
                        >
                          Use input Excel
                        </Label>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                     {currentScenario.useInputExcel && (
                      <div className="space-y-6" aria-live="polite" aria-expanded={currentScenario.useInputExcel}>
                        {/* File input field */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Input
                              type="text"
                              placeholder="Select a CSV or Excel file..."
                              value={currentScenario.filePath}
                              onChange={(e) => updateScenario('filePath', e.target.value)}
                              className="flex-1"
                              aria-label="Selected file path"
                            />
                            <Button 
                              variant="outline"
                              onClick={handleFileSelect}
                              className="h-9 px-3"
                              aria-label="Select CSV or Excel file"
                            >
                              Select
                            </Button>
                          </div>
                        </div>

                        {/* Data Preview */}
                        {currentScenario.csvData.length > 0 && (() => {
                          const fileExtension = currentScenario.filePath.toLowerCase().split('.').pop()
                          const fileType = fileExtension === 'csv' ? 'CSV' : 
                                          ['xlsx', 'xls', 'xlsm'].includes(fileExtension || '') ? 'Excel' : 'Data'
                          const groupedData = getGroupedData(currentScenario.csvData)
                          
                          return (
                            <div className="mt-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium">
                                  {fileType} Preview ({currentScenario.csvData.length} rows total)
                                  {viewAsObject && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      - Grouped by profile ({Object.keys(groupedData).length} profiles)
                                    </span>
                                  )}
                                </h4>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <Label htmlFor="view-toggle" className="text-xs text-muted-foreground">
                                      {viewAsObject ? 'Object View' : 'Table View'}
                                    </Label>
                                    <Switch
                                      id="view-toggle"
                                      checked={viewAsObject}
                                      onCheckedChange={setViewAsObject}
                                    />
                                  </div>
                                </div>
                              </div>
                              
                              <div className="border rounded-md overflow-auto bg-background max-h-96">
                                {viewAsObject ? (
                                  // Object view - raw JSON format for dev
                                  <div className="p-4">
                                    {Object.keys(groupedData).length === 0 ? (
                                      <div className="text-center text-muted-foreground py-8">
                                        <p>No profile column found in data</p>
                                        <p className="text-xs mt-1">Data will be processed as-is</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-4">
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <h5 className="font-medium text-sm text-blue-800 mb-1">
                                                📋 Raw Object Data (for dev mapping)
                                              </h5>
                                              <p className="text-xs text-blue-600">
                                                Copy this object structure to use in your automation scripts
                                              </p>
                                            </div>
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() => handleCopyToClipboard(groupedData)}
                                              className="h-7 px-2 text-xs"
                                              title="Copy raw object to clipboard"
                                            >
                                              <Copy className="h-3 w-3 mr-1" />
                                              Copy
                                            </Button>
                                          </div>
                                        </div>
                                        
                                        <div className="bg-gray-200 text-black p-4 rounded-lg font-mono text-xs overflow-auto">
                                          <pre>{JSON.stringify(groupedData, null, 2)}</pre>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  // Table view - all rows
                                  <table className="w-full text-xs">
                                    <thead className="bg-muted sticky top-0 z-10">
                                      <tr>
                                        {Object.keys(currentScenario.csvData[0] || {}).map(header => (
                                          <th key={header} className="px-3 py-2 text-left font-medium border-r border-border last:border-r-0">
                                            {header}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {currentScenario.csvData.map((row, i) => (
                                        <tr key={i} className="border-t border-border hover:bg-muted/50">
                                          {Object.values(row).map((cell, j) => (
                                            <td key={j} className="px-3 py-2 border-r border-border last:border-r-0">
                                              <div className="max-w-40 truncate" title={String(cell || '')}>
                                                {cell}
                                              </div>
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </div>
                          )
                      })()}

                    </div>
                  )}
                </section>
            )}

            {activeTab === 'run-configuration' && (
                <section aria-labelledby="run-configuration-heading" className="space-y-6">
                  <h2 id="run-configuration-heading" className="text-2xl font-semibold">Run Configuration</h2>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    {/* Number of Threads */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="num-threads" className="text-sm font-medium">Number of Threads</Label>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </div>
                       <Input
                         id="num-threads"
                         type="text"
                         inputMode="numeric"
                         value={currentScenario.numThreads}
                         onChange={(e) => updateScenario('numThreads', e.target.value)}
                         aria-label="Number of threads"
                         className="w-20 h-8 text-sm"
                       />
                    </div>

                    {/* Window Size */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium">Window</Label>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-3">
                        <Input
                          id="window-width"
                          type="text"
                          inputMode="numeric"
                          value={currentScenario.windowWidth}
                          onChange={(e) => updateScenario('windowWidth', e.target.value)}
                          aria-label="Window width"
                          className="w-20 h-8 text-sm"
                        />
                        <span className="text-muted-foreground select-none">x</span>
                        <Input
                          id="window-height"
                          type="text"
                          inputMode="numeric"
                          value={currentScenario.windowHeight}
                          onChange={(e) => updateScenario('windowHeight', e.target.value)}
                          aria-label="Window height"
                          className="w-20 h-8 text-sm"
                        />
                      </div>
                    </div>

                    {/* Scale (%) */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="scale-percent" className="text-sm font-medium">Scale (%)</Label>
                        <HelpCircle className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        id="scale-percent"
                        type="text"
                        inputMode="numeric"
                        value={currentScenario.scalePercent}
                        onChange={(e) => updateScenario('scalePercent', e.target.value)}
                        aria-label="Scale percentage"
                        className="w-20 h-8 text-sm"
                      />
                    </div>
                  </div>
                </section>
            )}

            {activeTab === 'schedule' && (
                <section aria-labelledby="schedule-heading" className="space-y-4">
                  <h2 id="schedule-heading" className="text-2xl font-semibold">Schedule Configuration</h2>

                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      onClick={handleAddSchedule}
                      className="h-8 w-8 rounded-full p-0 bg-blue-600 hover:bg-blue-700 text-white"
                      aria-label="Add schedule"
                      title="Add schedule"
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <span className="text-sm text-muted-foreground select-none">Add schedule</span>
                  </div>

                   {currentScenario.schedules.length > 0 && (
                    <div className="mt-2 space-y-4" aria-live="polite">
                      {currentScenario.schedules.map((item, index) => (
                        <div
                          key={item.id}
                          id={`schedule-picker-${item.id}`}
                          role={item.saved ? 'button' : 'group'}
                          tabIndex={item.saved ? 0 : -1}
                          onClick={() => item.saved && handleEditSchedule(item.id)}
                          onKeyDown={(e) => {
                            if (!item.saved) return
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handleEditSchedule(item.id)
                            }
                          }}
                          aria-label={`Schedule ${index + 1}${item.saved ? ' (click to edit)' : ''}`}
                          className={`rounded-md border border-border p-3 flex items-start justify-between gap-4 ${item.saved ? 'cursor-pointer hover:bg-muted/40' : ''}`}
                        >
                          <DatePickerAndTimePickerDemo
                            value={item.value}
                            onChange={(v) => handleChangeSchedule(item.id, v)}
                            readOnly={item.saved}
                          />
                          {item.saved ? (
                            <Button
                              type="button"
                              variant="ghost"
                              className="ml-4 h-8 w-8 p-0"
                              aria-label={`Delete schedule ${index + 1}`}
                              title="Delete"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteSchedule(item.id)
                              }}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              onClick={() => handleSaveSchedule(item.id)}
                              className="ml-auto bg-green-600 hover:bg-green-700 text-white"
                              aria-label={`Save schedule ${index + 1}`}
                            >
                              Save
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                 </section>
            )}

            {/* Continue Button */}
            <div className="flex justify-end mt-8">
              <Button 
                type="button"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2" 
                onClick={() => {
                  const toInt = (v: unknown, fallback: number) => {
                    const s = String(v ?? '')
                    const n = parseInt(s.replace(/\D+/g, ''), 10)
                    return Number.isFinite(n) ? n : fallback
                  }
                  const width = toInt(currentScenario.windowWidth, 800)
                  const height = toInt(currentScenario.windowHeight, 600)
                  const scale = toInt(currentScenario.scalePercent, 100)
                  const threads = toInt(currentScenario.numThreads, 5)
                  const config = {
                    windowWidth: Math.max(100, width),
                    windowHeight: Math.max(100, height),
                    scalePercent: Math.min(200, Math.max(10, scale)),
                    numThreads: Math.max(1, threads),
                    csvData: currentScenario.csvData
                  }
                  onContinue?.(config)
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
