import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HelpCircle, FileText, MoreHorizontal } from 'lucide-react'

export default function AutomationConfig() {
  const [useInputExcel, setUseInputExcel] = useState(true)
  const [writeOkStatus, setWriteOkStatus] = useState(false)
  const [filePath, setFilePath] = useState('')
  const [sheetId, setSheetId] = useState('0')
  const [readType, setReadType] = useState('all-rows')
  const [activeSidebar, setActiveSidebar] = useState('posts-comment')
  const [activeTab, setActiveTab] = useState('input-from-application')

  const handleFileSelect = () => {
    // In a real app, this would open a file dialog
    console.log('File dialog would open here')
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
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Input from application</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Use input Excel option */}
                    <div className="flex items-center space-x-3">
                      <Checkbox 
                        id="use-input-excel" 
                        checked={useInputExcel}
                        onCheckedChange={setUseInputExcel}
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

                    {/* File input field */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Input
                          type="text"
                          placeholder="Enter file path or select file..."
                          value={filePath}
                          onChange={(e) => setFilePath(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          variant="outline" 
                          size="icon"
                          onClick={handleFileSelect}
                          className="h-9 w-9"
                        >
                          <MoreHorizontal className="h-4 w-4" />
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
                        onCheckedChange={setWriteOkStatus}
                      />
                      <Label 
                        htmlFor="write-ok-status" 
                        className="text-base font-normal"
                      >
                        Write 'OK' status to the Excel file upon completion
                      </Label>
                      <div className="ml-auto">
                        <div className="w-6 h-4 bg-muted rounded text-xs flex items-center justify-center text-muted-foreground">
                          Z
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="run-configuration" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Run Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Configure run settings here.</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="schedule" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Schedule Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">Configure schedule settings here.</p>
                  </CardContent>
                </Card>
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
