import { useState } from 'react'
import { Button } from '@/components/ui/button'
// Removed Card wrappers; using plain sections instead
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HelpCircle } from 'lucide-react'
import DatePickerAndTimePickerDemo from '@/components/ui/datetime-picker'

export default function AutomationConfig() {
  const [useInputExcel, setUseInputExcel] = useState(true)
  const [writeOkStatus, setWriteOkStatus] = useState(false)
  const [filePath, setFilePath] = useState('')
  const [sheetId, setSheetId] = useState('0')
  const [readType, setReadType] = useState('all-rows')
  const [activeSidebar, setActiveSidebar] = useState('posts-comment')
  const [activeTab, setActiveTab] = useState('input-from-application')
  const [okStatusColumn, setOkStatusColumn] = useState('')
  const [numThreads, setNumThreads] = useState(5)
  const [windowWidth, setWindowWidth] = useState(800)
  const [windowHeight, setWindowHeight] = useState(600)
  const [scalePercent, setScalePercent] = useState(100)

  const handleFileSelect = async () => {
    if (!window?.api?.selectDirectory) {
      console.warn('Directory picker API is not available')
      return
    }
    const selectedDir = await window.api.selectDirectory()
    if (!selectedDir) return
    setFilePath(selectedDir)
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
                        checked={useInputExcel}
                        onCheckedChange={(checked) => setUseInputExcel(checked === true)}
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

                    {useInputExcel && (
                      <div className="space-y-6" aria-live="polite" aria-expanded={useInputExcel}>
                        {/* File input field */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <Input
                              type="text"
                              placeholder="Select a directory..."
                              value={filePath}
                              onChange={(e) => setFilePath(e.target.value)}
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
                              value={sheetId}
                              onChange={(e) => setSheetId(e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="read-type" className="text-sm font-medium">
                              Read Type
                            </Label>
                            <Select value={readType} onValueChange={setReadType}>
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
                            checked={writeOkStatus}
                            onCheckedChange={(checked) => setWriteOkStatus(checked === true)}
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
                              value={okStatusColumn}
                              onChange={(e) => setOkStatusColumn(e.target.value)}
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
                        value={numThreads}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          if (Number.isNaN(n)) return
                          setNumThreads(Math.max(1, Math.floor(n)))
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
                          value={windowWidth}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            if (Number.isNaN(n)) return
                            setWindowWidth(Math.max(100, Math.floor(n)))
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
                          value={windowHeight}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            if (Number.isNaN(n)) return
                            setWindowHeight(Math.max(100, Math.floor(n)))
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
                        value={scalePercent}
                        onChange={(e) => {
                          const n = Number(e.target.value)
                          if (Number.isNaN(n)) return
                          const clamped = Math.min(200, Math.max(50, Math.floor(n)))
                          setScalePercent(clamped)
                        }}
                        aria-label="Scale percentage"
                        className="w-20 h-8 text-sm"
                      />
                    </div>
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="schedule" className="mt-6">
                <section aria-labelledby="schedule-heading" className="space-y-6">
                  <h2 id="schedule-heading" className="text-2xl font-semibold">Schedule Configuration</h2>
                  <DatePickerAndTimePickerDemo />
                </section>
              </TabsContent>
            </Tabs>

            {/* Continue Button */}
            <div className="flex justify-end mt-8">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2">
                Continue
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
