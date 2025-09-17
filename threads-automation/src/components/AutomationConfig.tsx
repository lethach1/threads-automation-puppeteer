import { useState } from 'react'
import { Button } from '@/components/ui/button'
// Removed Card wrappers; using plain sections instead
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HelpCircle, Plus, Trash2 } from 'lucide-react'
import DatePickerAndTimePickerDemo, { type DateTimeValue } from '@/components/ui/datetime-picker'

type Props = { 
  onContinue?: (config: {
    windowWidth: number
    windowHeight: number
    scalePercent: number
    numThreads: number
  }) => void 
}

export default function AutomationConfig({ onContinue }: Props) {
  const [activeSidebar, setActiveSidebar] = useState('posts-comment')
  const [activeTab, setActiveTab] = useState('input-from-application')
  
  // Separate state for each scenario
  const [scenarios, setScenarios] = useState({
    'posts-comment': {
      useInputExcel: true,
      writeOkStatus: false,
      filePath: '',
      sheetId: '0',
      readType: 'all-rows',
      okStatusColumn: '',
      numThreads: 5,
      windowWidth: 800,
      windowHeight: 600,
      scalePercent: 100,
      schedules: [] as ScheduleItem[]
    },
    'login': {
      useInputExcel: true,
      writeOkStatus: false,
      filePath: '',
      sheetId: '0',
      readType: 'all-rows',
      okStatusColumn: '',
      numThreads: 5,
      windowWidth: 800,
      windowHeight: 600,
      scalePercent: 100,
      schedules: [] as ScheduleItem[]
    },
    'interactive': {
      useInputExcel: true,
      writeOkStatus: false,
      filePath: '',
      sheetId: '0',
      readType: 'all-rows',
      okStatusColumn: '',
      numThreads: 5,
      windowWidth: 800,
      windowHeight: 600,
      scalePercent: 100,
      schedules: [] as ScheduleItem[]
    }
  })
  
  type ScheduleItem = { id: string, value: DateTimeValue, saved: boolean }
  
  // Get current scenario data
  const currentScenario = scenarios[activeSidebar as keyof typeof scenarios]

  // Helper function to update scenario data
  const updateScenario = (key: string, value: any) => {
    setScenarios(prev => ({
      ...prev,
      [activeSidebar]: {
        ...prev[activeSidebar as keyof typeof prev],
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
    if (!window?.api?.selectDirectory) {
      console.warn('Directory picker API is not available')
      return
    }
    const selectedDir = await window.api.selectDirectory()
    if (!selectedDir) return
    updateScenario('filePath', selectedDir)
  }

  const sidebarItems = [
    { id: 'posts-comment', label: 'Posts and comment', icon: '📝' },
    { id: 'login', label: 'Login', icon: '🔐' },
    { id: 'interactive', label: 'Interactive', icon: '🎮' }
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Left Sidebar */}
        <div className="w-64 bg-card border-r border-border min-h-screen">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-blue-600 mb-8">Automation Configuration</h1>
            <nav className="space-y-2">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSidebar(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg transition-colors ${
                    activeSidebar === item.id
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
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="input-from-application">Input from application</TabsTrigger>
                <TabsTrigger value="run-configuration">Run Configuration</TabsTrigger>
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
              </TabsList>

              <TabsContent value="input-from-application" className="mt-6">
                <section aria-labelledby="input-from-application-heading" className="space-y-6">
                  <h2 id="input-from-application-heading" className="text-2xl font-semibold">
                    Input from application
                  </h2>
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
                              placeholder="Select a directory..."
                              value={currentScenario.filePath}
                              onChange={(e) => updateScenario('filePath', e.target.value)}
                              className="flex-1"
                              aria-label="Selected directory path"
                            />
                            <Button 
                              variant="outline"
                              onClick={handleFileSelect}
                              className="h-9 px-3"
                              aria-label="Select directory"
                            >
                              Select
                            </Button>
                          </div>
                        </div>

                        {/* Sheet ID and Read Type */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label htmlFor="sheet-id" className="text-sm font-medium">
                              Sheet ID
                            </Label>
                            <Input
                              id="sheet-id"
                              type="text"
                              value={currentScenario.sheetId}
                              onChange={(e) => updateScenario('sheetId', e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="read-type" className="text-sm font-medium">
                              Read Type
                            </Label>
                            <Select value={currentScenario.readType} onValueChange={(value) => updateScenario('readType', value)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select read type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all-rows">Each profile reads all rows</SelectItem>
                                <SelectItem value="single-row">Each profile reads single row</SelectItem>
                                <SelectItem value="custom">Custom read pattern</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        {/* Write OK status option */}
                         <div className="flex items-center space-x-3">
                           <Checkbox 
                             id="write-ok-status" 
                             checked={currentScenario.writeOkStatus}
                             onCheckedChange={(checked) => updateScenario('writeOkStatus', checked === true)}
                           />
                          <Label 
                            htmlFor="write-ok-status" 
                            className="text-base font-normal"
                          >
                            Write 'OK' status to the Excel file upon completion
                          </Label>
                          <div className="ml-auto">
                            <Input
                              type="text"
                              value={currentScenario.okStatusColumn}
                              onChange={(e) => updateScenario('okStatusColumn', e.target.value)}
                              placeholder="Column (e.g., Z)"
                              className="w-28 h-8 text-sm"
                              aria-label="OK status column"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                </section>
              </TabsContent>

              <TabsContent value="run-configuration" className="mt-6">
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
                         type="number"
                         inputMode="numeric"
                         min={1}
                         step={1}
                         value={currentScenario.numThreads}
                         onChange={(e) => {
                           const n = Number(e.target.value)
                           if (Number.isNaN(n)) return
                           updateScenario('numThreads', Math.max(1, Math.floor(n)))
                         }}
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
                          type="number"
                          inputMode="numeric"
                          min={100}
                          step={10}
                          value={currentScenario.windowWidth}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            if (Number.isNaN(n)) return
                            updateScenario('windowWidth', Math.max(100, Math.floor(n)))
                          }}
                          aria-label="Window width"
                          className="w-20 h-8 text-sm"
                        />
                        <span className="text-muted-foreground select-none">x</span>
                        <Input
                          id="window-height"
                          type="number"
                          inputMode="numeric"
                          min={100}
                          step={10}
                          value={currentScenario.windowHeight}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            if (Number.isNaN(n)) return
                            updateScenario('windowHeight', Math.max(100, Math.floor(n)))
                          }}
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
                        type="number"
                        inputMode="numeric"
                        min={50}
                        max={200}
                        step={1}
                        value={currentScenario.scalePercent}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          if (Number.isNaN(n)) return
                          const clamped = Math.min(200, Math.max(50, Math.floor(n)))
                          updateScenario('scalePercent', clamped)
                        }}
                        aria-label="Scale percentage"
                        className="w-20 h-8 text-sm"
                      />
                    </div>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="schedule" className="mt-6">
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
              </TabsContent>
            </Tabs>

            {/* Continue Button */}
            <div className="flex justify-end mt-8">
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2" 
                onClick={() => {
                  const config = {
                    windowWidth: currentScenario.windowWidth,
                    windowHeight: currentScenario.windowHeight,
                    scalePercent: currentScenario.scalePercent,
                    numThreads: currentScenario.numThreads
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
