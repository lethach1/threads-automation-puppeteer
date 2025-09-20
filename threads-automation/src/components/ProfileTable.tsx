import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowUpDown, FolderOpen } from 'lucide-react'
import { getListProfiles } from '@/services/profileApi'
import { groupCsvDataByProfile, mapProfileNamesToIds, getCsvSummary } from '@/utils/csvReader'

type Profile = {
  id: string
  name: string
  displayName?: string
  notes?: string
  location?: string
  isCompleted?: boolean
}

type Props = {
  onBack?: () => void
  settings?: {
    windowWidth: number
    windowHeight: number
    scalePercent: number
    numThreads: number
  }
  csvData?: Array<Record<string, string>>
}

export default function ProfileTable({ onBack, settings, csvData }: Props) {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [sortAsc, setSortAsc] = useState(true)
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set())
  const [showCheckbox] = useState(true)
  const [proxyActive] = useState<boolean | null>(null)
  const [completedProfiles, setCompletedProfiles] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [renamedNames, setRenamedNames] = useState<Map<string, string>>(new Map())
  const [isProcessingCsv, setIsProcessingCsv] = useState(false)
  const [csvProgress, setCsvProgress] = useState<{ current: number; total: number; profile: string } | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus()
  }, [editingId])

  const fetchProfiles = async () => {
    try {
      setIsLoading(true)
      const api = 'http://127.0.0.1:5424/api/profiles'
      const list = await getListProfiles(api)
      setProfiles(list.map(p => ({ id: p.id, name: p.name, location: p.location, isCompleted: p.isCompleted })))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Load profiles when this screen mounts (after Continue from config)
    fetchProfiles()
  }, [])

  const sortedProfiles = useMemo(() => {
    const items = [...profiles]
    items.sort((a, b) => {
      const an = (renamedNames.get(a.id) || a.displayName || a.name).toLowerCase()
      const bn = (renamedNames.get(b.id) || b.displayName || b.name).toLowerCase()
      return sortAsc ? an.localeCompare(bn) : bn.localeCompare(an)
    })
    return items
  }, [profiles, renamedNames, sortAsc])

  const handleSort = () => setSortAsc((v) => !v)
  
  const handleSelectAll = () => {
    if (selectedProfiles.size === profiles.length) {
      setSelectedProfiles(new Set())
    } else {
      setSelectedProfiles(new Set(profiles.map(p => p.id)))
    }
  }
  
  const handleProfileSelect = (id: string) => {
    setSelectedProfiles((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  
  // CSV Processing Functions - using csvReader utilities

  const openProfile = async (profileId: string) => {
    const result = await window.automationApi.runOpenProfiles({
      profileIds: [profileId],
      windowWidth: settings?.windowWidth || 800,
      windowHeight: settings?.windowHeight || 600,
      scalePercent: settings?.scalePercent || 100,
      concurrency: 1
    })
    
    if (!result.success) {
      throw new Error(`Failed to open profile ${profileId}`)
    }
  }

  const postContentForProfile = async (profileId: string, posts: Array<Record<string, string>>, profileName: string) => {
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i]
      
      setCsvProgress({ current: i + 1, total: posts.length, profile: profileName })
      
      try {
        const result = await window.automationApi.runAutomationForProfile({
          profileId,
          input: {
            post: post.post,
            tag: post.tag,
            image: post.image,
            schedule: post.Schedule
          }
        })
        
        if (result.success) {
          console.log(`✅ Post ${i + 1}/${posts.length} posted successfully for ${profileName}`)
        } else {
          console.log(`❌ Post ${i + 1}/${posts.length} failed for ${profileName}: ${result.error}`)
        }
        
        // Delay between posts
        if (i < posts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
      } catch (error) {
        console.log(`❌ Post ${i + 1}/${posts.length} error for ${profileName}: ${error}`)
      }
    }
  }

  const processCsvAutomation = async () => {
    if (!csvData || csvData.length === 0) return
    
    setIsProcessingCsv(true)
    setCsvProgress(null)
    
    try {
      // Convert csvData to CsvParseResult format for csvReader functions
      const csvParseResult = {
        headers: Object.keys(csvData[0] || {}),
        rows: csvData,
        totalRows: csvData.length
      }
      
      // Group CSV data by profile using csvReader utility
      const profileGroups = groupCsvDataByProfile(csvParseResult)
      console.log('📊 Profile groups:', profileGroups)
      
      // Map profile names to actual profile IDs using csvReader utility
      const profileMapping = mapProfileNamesToIds(profileGroups, profiles)
      console.log('🔗 Profile mapping:', profileMapping)
      
      // Process each profile group
      for (const [profileName, posts] of Object.entries(profileGroups)) {
        const profileId = profileMapping[profileName]
        
        if (!profileId) {
          console.log(`❌ Profile "${profileName}" not found, skipping...`)
          continue
        }
        
        console.log(`🚀 Starting automation for ${profileName} (${posts.length} posts)`)
        
        try {
          // Open profile
          await openProfile(profileId)
          console.log(`✅ Profile ${profileName} opened successfully`)
          
          // Post all content for this profile
          await postContentForProfile(profileId, posts, profileName)
          
          // Mark profile as completed
          setCompletedProfiles(prev => new Set(prev).add(profileId))
          setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, isCompleted: true } : p))
          
          console.log(`🎉 Completed all posts for profile ${profileName}`)
          
        } catch (error) {
          console.log(`❌ Failed to process profile ${profileName}: ${error}`)
        }
      }
      
      console.log('🎉 All CSV automation completed!')
      
    } catch (error) {
      console.error('❌ CSV processing error:', error)
    } finally {
      setIsProcessingCsv(false)
      setCsvProgress(null)
    }
  }

  const handleRunSelected = async () => {
    // If CSV data exists, process CSV automation
    if (csvData && csvData.length > 0) {
      await processCsvAutomation()
      return
    }
    
    // Otherwise, use manual profile selection
    const selectedProfileIds = Array.from(selectedProfiles)
    if (selectedProfileIds.length === 0) return
    
    try {
      // Check if Electron API is available
      if (!window.automationApi) {
        console.error('Automation API not available - make sure preload script is loaded')
        return
      }

      // Use settings from AutomationConfig or fallback to defaults
      const payload = {
        profileIds: selectedProfileIds,
        windowWidth: settings?.windowWidth || 800,
        windowHeight: settings?.windowHeight || 600,
        scalePercent: settings?.scalePercent || 100,
        concurrency: Math.min(settings?.numThreads || 3, selectedProfileIds.length)
      }

      const result = await window.automationApi.runOpenProfiles(payload)
      console.log('Run selected result:', result)
      
      if (result.success) {
        console.log(`Successfully opened ${result.opened?.length || 0} profiles`)

        // Trigger automation for each selected profile after successful open
        for (const profileId of selectedProfileIds) {
          try {
            const autoRes = await window.automationApi.runAutomationForProfile({
              profileId
            })
            if (!autoRes?.success) {
              console.error('Automation failed for profile', profileId, autoRes?.error)
            } else {
              console.log('Automation started for profile', profileId)
              // Mark completion when automation signals success
              setCompletedProfiles((prev) => {
                const next = new Set(prev)
                next.add(profileId)
                return next
              })
              setProfiles((prev) => prev.map(p => p.id === profileId ? { ...p, isCompleted: true } : p))
            }
          } catch (e) {
            console.error('Automation error for profile', profileId, e)
          }
        }
      } else {
        console.error('Failed to open profiles:', result.error)
      }
    } catch (err) {
      console.error('Run selected: error', err)
    }
  }
  const startInlineEdit = (p: Profile) => {
    setEditingId(p.id)
    setEditingValue(renamedNames.get(p.id) || p.displayName || p.name)
  }
  const cancelInlineEdit = () => setEditingId(null)
  const saveInlineEdit = (p: Profile) => {
    setRenamedNames((prev) => new Map(prev).set(p.id, editingValue))
    setEditingId(null)
  }
  // Removed run-related handlers
  const openProxyDialog = (_p: Profile) => {}
  const testProxyNow = (_p: Profile) => {}

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Checkbox 
            checked={selectedProfiles.size > 0 && selectedProfiles.size === profiles.length} 
            onCheckedChange={handleSelectAll} 
          />
          <span className="text-sm text-muted-foreground">{selectedProfiles.size} of {profiles.length} selected</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchProfiles}
            disabled={isLoading}
            title="Reload profiles"
          >
            {isLoading ? 'Reloading...' : 'Reload'}
          </Button>
          {(selectedProfiles.size > 0 || (csvData && csvData.length > 0)) && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleRunSelected}
              disabled={isProcessingCsv}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessingCsv ? 'Processing...' : (csvData && csvData.length > 0 ? 'Run CSV Automation' : 'Run')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onBack}>Back</Button>
        </div>
      </div>

      {/* CSV Processing Progress */}
      {isProcessingCsv && csvProgress && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">
                Processing {csvProgress.profile} ({csvProgress.current}/{csvProgress.total} posts)
              </p>
              <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(csvProgress.current / csvProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Data Summary */}
      {csvData && csvData.length > 0 && !isProcessingCsv && (() => {
        const csvParseResult = {
          headers: Object.keys(csvData[0] || {}),
          rows: csvData,
          totalRows: csvData.length
        }
        const summary = getCsvSummary(csvParseResult)
        
        return (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-sm font-medium text-green-900 mb-2">CSV Data Ready</h3>
            <p className="text-sm text-green-700">
              {summary.totalPosts} posts found across {summary.uniqueProfiles} profiles
            </p>
          </div>
        )
      })()}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSort}
                  className="h-auto p-0 font-medium hover:bg-transparent"
                >
                  Name
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Location</TableHead>
          <TableHead>Completed</TableHead>
            {/* Removed actions/download column */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProfiles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-32 text-center">
                <div className="flex flex-col items-center gap-3">
                  <FolderOpen className="h-12 w-12 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-lg font-medium">No profiles found</p>
                    <p className="text-sm text-muted-foreground">Create your first profile to get started</p>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            sortedProfiles.map((profile) => (
              <TableRow key={profile.id} className="hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    {showCheckbox && (
                      <Checkbox
                        checked={selectedProfiles.has(profile.id)}
                        onCheckedChange={() => handleProfileSelect(profile.id)}
                      />
                    )}
                    <div className="flex items-center gap-2">
                      {editingId === profile.id ? (
                        <input
                          ref={inputRef}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => saveInlineEdit(profile)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveInlineEdit(profile);
                            if (e.key === 'Escape') cancelInlineEdit();
                          }}
                          className="px-2 py-1 h-7 text-sm border rounded outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : (
                        <span
                          className="font-medium cursor-text select-text"
                          title="Double-click to rename"
                          onDoubleClick={() => startInlineEdit(profile)}
                        >
                          {renamedNames.get(profile.id) || profile.displayName || profile.name || profile.id}
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{profile.notes || '-'}</TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${proxyActive === true ? 'bg-green-500' : proxyActive === false ? 'bg-red-500' : 'bg-muted-foreground'}`}></div>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Open proxy settings"
                      className="cursor-pointer hover:underline"
                      onClick={() => openProxyDialog(profile)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') openProxyDialog(profile)
                      }}
                    >
                      {profile.location || '-'}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      title="Reload proxy status"
                      onClick={() => testProxyNow(profile)}
                    >
                      ↻
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center gap-2 text-sm ${(profile.isCompleted || completedProfiles.has(profile.id)) ? 'text-green-700' : 'text-muted-foreground'}`}
                    aria-label={(profile.isCompleted || completedProfiles.has(profile.id)) ? 'Automation completed' : 'Automation not completed'}
                  >
                    <span className={`w-2 h-2 rounded-full ${(profile.isCompleted || completedProfiles.has(profile.id)) ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                    {(profile.isCompleted || completedProfiles.has(profile.id)) ? 'Done' : '—'}
                  </span>
                </TableCell>
                {/* Removed download cell */}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

    </div>
  )
}