import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
// Removed Card wrappers; using plain sections instead
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
// Tabs components no longer needed - using sidebar instead
import { HelpCircle, Trash2, Copy, Upload, FileText, Settings } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
// import DatePickerAndTimePickerDemo, { type DateTimeValue } from '@/components/ui/datetime-picker' // Không sử dụng
import { type CsvRow } from '@/utils/csvReader'

type Props = { 
  // Truyền session data để restore state
  initialSettings?: {
    numThreads?: number
    csvData?: CsvRow[]
    selectedScenario?: string
    filePath?: string
  }
  onContinue?: (config: {
    numThreads: number
    csvData?: CsvRow[]
    selectedScenario?: string
    filePath?: string
  }) => void 
}

export default function AutomationConfig({ initialSettings, onContinue }: Props) {
  const [activeTab, setActiveTab] = useState('input-from-application')
  const [viewAsObject, setViewAsObject] = useState(false) // Toggle between table and object view
  const [selectedScript, setSelectedScript] = useState('')
  const [customScripts, setCustomScripts] = useState<Array<{id: string, name: string, fileName: string}>>([])
  const [showScriptUpload, setShowScriptUpload] = useState(false)
  const [scriptContent, setScriptContent] = useState('')
  const [scriptFileName, setScriptFileName] = useState('')
  const [scriptValidation, setScriptValidation] = useState<{
    isValid: boolean
    errors: string[]
  }>({ isValid: true, errors: [] })
  
  // Separate state for each scenario
  const [scenarios, setScenarios] = useState({
    'postAndComment': {
      useInputExcel: true,
      filePath: '',
      numThreads: 3,
      schedules: [] as ScheduleItem[],
      csvData: [] as CsvRow[]
    },
    'login': {
      useInputExcel: true,
      filePath: '',
      numThreads: 3,
      schedules: [] as ScheduleItem[],
      csvData: [] as CsvRow[]
    },
    'interactive': {
      useInputExcel: true,
      filePath: '',
      numThreads: '3',
      schedules: [] as ScheduleItem[],
      csvData: [] as CsvRow[]
    }
  })
  
  type ScheduleItem = { id: string, value: any, saved: boolean }
  
  // Get current scenario data - using postAndComment as default since we removed scenario selection
  const currentScenario = scenarios['postAndComment']

  // Restore state từ session data khi component mount
  useEffect(() => {
    if (initialSettings) {
      console.log('🔄 Restoring session data:', initialSettings)
      
      // Restore selected script
      if (initialSettings.selectedScenario) {
        setSelectedScript(initialSettings.selectedScenario)
      }
      
      // Restore CSV data, numThreads và filePath
      setScenarios(prev => ({
        ...prev,
        'postAndComment': {
          ...prev['postAndComment'],
          csvData: initialSettings.csvData || prev['postAndComment'].csvData,
          numThreads: initialSettings.numThreads || prev['postAndComment'].numThreads,
          filePath: initialSettings.filePath || prev['postAndComment'].filePath
        }
      }))
    }
  }, [initialSettings]) // Chạy khi initialSettings thay đổi

  // Function to refresh data from saved Excel file
  const handleRefreshData = async () => {
    if (!currentScenario.filePath) {
      alert('No Excel file selected. Please select a file first.')
      return
    }

    try {
      const api = window.api as any
      if (!api?.parseCsv) {
        console.warn('CSV parsing API is not available')
        return
      }

      // Parse the saved file path again
      const csvData = await api.parseCsv(currentScenario.filePath)
      updateScenario('csvData', csvData.rows)
      console.log('✅ Data refreshed from file:', currentScenario.filePath)
      
      // Show success message
      alert(`Data refreshed successfully! Loaded ${csvData.rows.length} rows from file.`)
    } catch (err) {
      console.error('Failed to refresh data from file:', err)
      alert(`Failed to refresh data from file: ${err}`)
    }
  }

  // Helper function to update scenario data
  const updateScenario = (key: string, value: any) => {
    setScenarios(prev => ({
      ...prev,
      'postAndComment': {
        ...prev['postAndComment'],
        [key]: value
      }
    }))
  }

  // const handleAddSchedule = () => {
  //   const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  //   const initial: ScheduleItem = { id, value: { date: undefined, time: '06:30:00' }, saved: false }
  //   updateScenario('schedules', [...currentScenario.schedules, initial])
  // }

  // const handleChangeSchedule = (id: string, value: DateTimeValue) => {
  //   const updatedSchedules = currentScenario.schedules.map((s) => (s.id === id ? { ...s, value } : s))
  //   updateScenario('schedules', updatedSchedules)
  // }

  // const handleSaveSchedule = (id: string) => {
  //   const updatedSchedules = currentScenario.schedules.map((s) => (s.id === id ? { ...s, saved: true } : s))
  //   updateScenario('schedules', updatedSchedules)
  // }

  // const handleEditSchedule = (id: string) => {
  //   const updatedSchedules = currentScenario.schedules.map((s) => (s.id === id ? { ...s, saved: false } : s))
  //   updateScenario('schedules', updatedSchedules)
  // }

  // const handleDeleteSchedule = (id: string) => {
  //   const updatedSchedules = currentScenario.schedules.filter((s) => s.id !== id)
  //   updateScenario('schedules', updatedSchedules)
  // }

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
    { id: 'input-from-application', label: 'Input from application', icon: FileText },
    { id: 'run-configuration', label: 'Run Configuration', icon: Settings },
    // { id: 'schedule', label: 'Schedule', icon: '📅' } // temporarily hidden
  ]

  // Available automation scripts (built-in + custom)
  const availableScripts = [
    { id: 'postAndComment', name: 'Posts and Comments', description: 'Automate posting and commenting on threads' },
    { id: 'login', name: 'Login Automation', description: 'Automate user login process' },
    { id: 'spamComments', name: 'Spam Comments', description: 'Spam comments automation with user input' },
    { id: 'downloadStatusAndImages', name: 'Download Status & Images', description: 'Download posts\' statuses and media from profiles' },
    ...customScripts.map(script => ({
      id: script.id,
      name: script.name,
      description: `Custom script: ${script.name}`
    }))
  ]

  // Load custom scripts on component mount
  const loadCustomScripts = async () => {
    try {
      if (window.customScriptApi) {
        const result = await window.customScriptApi.getCustomScripts()
        if (result.success) {
          setCustomScripts(result.scripts || [])
        }
      }
    } catch (error) {
      console.error('Failed to load custom scripts:', error)
    }
  }

  // Load custom scripts when component mounts
  useEffect(() => {
    loadCustomScripts()
  }, [])

  const handleImportCustomScript = async () => {
    const api = window.api as any
    if (!api?.selectScriptFile) {
      console.warn('Script file picker API is not available')
      return
    }

    try {
      const filePath = await api.selectScriptFile()
      if (filePath) {
        // Read file content
        const content = await api.readFile(filePath)
        const fileName = filePath.split(/[\\\/]/).pop()?.replace(/\.(ts|js)$/, '') || 'custom-script'
        
        setScriptContent(content)
        setScriptFileName(fileName)
        setShowScriptUpload(true)
      }
    } catch (error: any) {
      console.error('Failed to import custom script:', error)
      const errorMessage = error?.message || 'Failed to import custom script'
      if (errorMessage.includes('Only TypeScript') && errorMessage.includes('JavaScript')) {
        alert('Only TypeScript (.ts) and JavaScript (.js) files are allowed')
      } else {
        alert(`Failed to import custom script: ${errorMessage}`)
      }
    }
  }

  const handleUploadScript = async () => {
    try {
      if (!window.customScriptApi) {
        alert('Custom script API not available')
        return
      }

      const result = await window.customScriptApi.uploadScript(scriptFileName, scriptContent)
      if (result.success) {
        alert('Custom script uploaded successfully!')
        setShowScriptUpload(false)
        setScriptContent('')
        setScriptFileName('')
        await loadCustomScripts() // Reload the list
      } else {
        alert(`Failed to upload script: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to upload script:', error)
      alert('Failed to upload script. Please try again.')
    }
  }

  const handleDeleteCustomScript = async (scriptId: string) => {
    try {
      if (!window.customScriptApi) {
        alert('Custom script API not available')
        return
      }

      const result = await window.customScriptApi.deleteCustomScript(scriptId)
      if (result.success) {
        await loadCustomScripts() // Reload the list
      } else {
        alert(`Failed to delete script: ${result.error}`)
      }
    } catch (error) {
      console.error('Failed to delete script:', error)
      alert('Failed to delete script. Please try again.')
    }
  }

  // Removed script template helper per user request

  // Validate script content (user logic only)
  const validateScript = (content: string) => {
    const errors: string[] = []
    
    if (!content.trim()) {
      errors.push('Script content cannot be empty')
      return { isValid: false, errors }
    }
    
    // Warn about imports (should not be used - backend handles them)
    if (content.includes('import ') || content.includes('require(')) {
      errors.push('Warning: Avoid imports - backend handles all dependencies')
    }
    
    // Removed validation warnings for run function and module.exports
    
    return { isValid: errors.length === 0, errors }
  }

  // Update validation when script content changes
  useEffect(() => {
    if (scriptContent) {
      const validation = validateScript(scriptContent)
      setScriptValidation(validation)
    } else {
      setScriptValidation({ isValid: true, errors: [] })
    }
  }, [scriptContent])

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Left Sidebar */}
        <div className="w-64 bg-card border-r border-border min-h-screen">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-blue-600 mb-8">Automation Configuration</h1>
            <nav className="space-y-2">
              {tabItems.map((item) => {
                const IconComponent = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors cursor-pointer ${
                      activeTab === item.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <IconComponent className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              })}
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
                      <div className="flex gap-2">
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
                    </div>
                    
                    <Select value={selectedScript} onValueChange={setSelectedScript}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an automation script..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableScripts.map((script) => (
                          <div key={script.id} className="relative">
                            <SelectItem value={script.id} className="pr-12">
                              <span className="font-semibold pr-2">{script.name}</span>
                            </SelectItem>
                            {customScripts.some(cs => cs.id === script.id) && (
                              <button
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-red-100 rounded flex items-center justify-center z-10"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  if (confirm('Are you sure you want to delete this custom script?')) {
                                    handleDeleteCustomScript(script.id)
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3 text-red-500 hover:text-red-700" />
                              </button>
                            )}
                          </div>
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
                            {currentScenario.filePath && (
                              <Button 
                                variant="outline"
                                onClick={handleRefreshData}
                                className="h-9 px-3"
                                aria-label="Refresh data from selected file"
                                title="Refresh data from selected file"
                              >
                                🔄 Refresh
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Data Preview */}
                        {currentScenario.csvData.length > 0 && (() => {
                          const fileExtension = currentScenario.filePath.toLowerCase().split('.').pop()
                          const fileType = fileExtension === 'csv' ? 'CSV' : 
                                          ['xlsx', 'xls', 'xlsm'].includes(fileExtension || '') ? 'Excel' : 'Data'
                          const headers = Object.keys(currentScenario.csvData[0] || {})
                          const hasProfile = headers.some(h => String(h).toLowerCase().includes('profile'))
                          const groupedData = hasProfile ? getGroupedData(currentScenario.csvData) : {}
                          
                          return (
                            <div className="mt-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium">
                                  {fileType} Preview ({currentScenario.csvData.length} rows total)
                                  {viewAsObject && hasProfile && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      - Grouped by profile ({Object.keys(groupedData).length} profiles)
                                    </span>
                                  )}
                                </h4>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-2">
                                    <Label htmlFor="view-toggle" className="text-xs text-muted-foreground">
                                      {viewAsObject ? 'Table View' : 'Object View'}
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
                                  // Object view - grouped if profile exists, else plain rows
                                  <div className="p-4">
                                    <div className="space-y-4">
                                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <h5 className="font-medium text-sm text-blue-800 mb-1">
                                              📋 {hasProfile ? 'Grouped Object Data' : 'Raw Object Data'} (for dev mapping)
                                            </h5>
                                            <p className="text-xs text-blue-600">
                                              Copy this object structure to use in your automation scripts
                                            </p>
                                          </div>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleCopyToClipboard(hasProfile ? groupedData : currentScenario.csvData)}
                                            className="h-7 px-2 text-xs"
                                            title="Copy raw object to clipboard"
                                          >
                                            <Copy className="h-3 w-3 mr-1" />
                                            Copy
                                          </Button>
                                        </div>
                                      </div>
                                      
                                      <div className="bg-gray-200 text-black p-4 rounded-lg font-mono text-xs overflow-auto">
                                        <pre>{JSON.stringify(hasProfile ? groupedData : currentScenario.csvData, null, 2)}</pre>
                                      </div>
                                    </div>
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
                  </div>
                </section>
            )}

            {/* {activeTab === 'schedule' && (
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
            )} */}

             {/* Continue Button */}
             <div className="flex justify-end mt-8">
               <Button 
                 type="button"
                 className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2" 
                 onClick={() => {
                   // Check if script is selected
                   if (!selectedScript) {
                     alert('Please select an automation script before continuing.')
                     return
                   }

                   const toInt = (v: unknown, fallback: number) => {
                     const s = String(v ?? '')
                     const n = parseInt(s.replace(/\D+/g, ''), 10)
                     return Number.isFinite(n) ? n : fallback
                   }
                  const threads = toInt(currentScenario.numThreads, 3)
                  const config = {
                     numThreads: Math.max(1, threads),
                     csvData: currentScenario.csvData,
                     selectedScenario: selectedScript,
                     filePath: currentScenario.filePath
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

      {/* Custom Script Upload Modal */}
      {showScriptUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-[70vw] h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
              <h3 className="text-xl font-semibold">Upload Custom Script</h3>
              <button
                onClick={() => {
                  setShowScriptUpload(false)
                  setScriptContent('')
                  setScriptFileName('')
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6 flex-1 flex flex-col overflow-hidden">
              <div className="space-y-6 flex-1 flex flex-col">
                <div className="flex-shrink-0">
                  <Label htmlFor="script-name">Script Name</Label>
                  <Input
                    id="script-name"
                    value={scriptFileName}
                    onChange={(e) => setScriptFileName(e.target.value)}
                    placeholder="Enter script name (without extension)"
                    className={!scriptFileName.trim() ? 'border-red-500' : ''}
                  />
                  {!scriptFileName.trim() && (
                    <p className="text-sm text-red-500 mt-1">Script name is required</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Supported file types: TypeScript (.ts) and JavaScript (.js)
                  </p>
                </div>
                
                 <div className="space-y-2 flex-1 flex flex-col">
                   <div className="flex items-center justify-between">
                     <Label htmlFor="script-content">Automation Logic</Label>
                   </div>
                   <textarea
                     id="script-content"
                     value={scriptContent}
                     onChange={(e) => setScriptContent(e.target.value)}
                     placeholder="Paste your automation logic here or click 'Use Template'..."
                     className={`w-full flex-1 p-4 border rounded-md font-mono text-sm resize-none ${
                       !scriptValidation.isValid ? 'border-red-500' : ''
                     }`}
                   />
                  <div className="flex-shrink-0">
                    {!scriptValidation.isValid && (
                      <div className="space-y-1">
                        {scriptValidation.errors.map((error, index) => (
                          <p key={index} className="text-sm text-red-500">• {error}</p>
                        ))}
                      </div>
                    )}
                    {scriptValidation.isValid && scriptContent && (
                      <p className="text-sm text-green-600">✓ Script validation passed</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => {
                  setShowScriptUpload(false)
                  setScriptContent('')
                  setScriptFileName('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUploadScript}
                disabled={!scriptFileName.trim() || !scriptContent.trim()}
              >
                Save Script
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
