import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowUpDown, FolderOpen, RefreshCw } from 'lucide-react'
import { getListProfiles } from '@/services/profileApi'
// getRowValue no longer needed with flexible headers
// CSV is now provided by config screen; no direct CSV parsing here

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
    // windowWidth: number  // Không cần sử dụng
    // windowHeight: number // Không cần sử dụng
    // scalePercent: number // Không cần sử dụng
    numThreads: number
    showConsole?: boolean
  }
  csvData?: Array<Record<string, string>>
  selectedScenario?: string
}

export default function ProfileTable({ onBack, settings, csvData, selectedScenario }: Props) {
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
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Removed direct CSV upload, inputs come from config
  const [inputByProfileId, setInputByProfileId] = useState<Map<string, { [key: string]: any; items?: Array<{ [key: string]: any }> }>>(new Map())

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


  // When csvData is provided from the config screen, auto-map it to inputs
  useEffect(() => {
    if (!csvData || csvData.length === 0 || profiles.length === 0) return
    try {
      const map = new Map<string, { [key: string]: any; items?: Array<{ [key: string]: any }> }>()
      const nameToId = new Map<string, string>()
        for (const p of profiles) {
          const profileName = (p.displayName || p.name || '').trim()
          nameToId.set(profileName, p.id)
          // Also add lowercase version for case-insensitive matching
          nameToId.set(profileName.toLowerCase(), p.id)
        }
      // Check if data has profile column
      const hasProfileColumn = csvData.some(row => 
        Object.keys(row).some(key => key.toLowerCase() === 'profile')
      )
      
      if (hasProfileColumn) {
        // Group by profile name (flexible header matching)
        const groups: Record<string, Array<Record<string, string>>> = {}
        for (const row of csvData) {
          // Try to find profile column with flexible matching
          let profileName = ''
          const rowKeys = Object.keys(row)
          
          // Look for profile column (case-insensitive)
          const profileKey = rowKeys.find(key => key.toLowerCase() === 'profile')
          if (profileKey) {
            profileName = (row[profileKey] || '').toString().trim()
          }
          
          if (!profileName) continue
          if (!groups[profileName]) groups[profileName] = []
          groups[profileName].push(row)
        }
          Object.entries(groups).forEach(([profileName, rows]) => {
            const id = nameToId.get(profileName.trim()) || nameToId.get(profileName.trim().toLowerCase())
            if (!id) {
              console.log(`❌ No profile ID found for "${profileName}". Available:`, Array.from(nameToId.keys()))
              return
            }
            console.log(`✅ Mapped "${profileName}" -> ${id}`)
          
          // Get all available headers from the first row (excluding profile column)
          const availableHeaders = rows.length > 0 ? Object.keys(rows[0]).filter(key => 
            key.toLowerCase() !== 'profile'
          ) : []
          
          const items = rows.map((r) => {
            // Create dynamic object with all available columns
            const dynamicData: any = {}
            availableHeaders.forEach(header => {
              dynamicData[header] = r[header] || ''
            })
            return dynamicData
          })
          
          const first = items[0] || {}
          map.set(id, { ...first, items })
        })
      } else {
        // No profile column - distribute data to all profiles
        console.log('[csv] No profile column found, distributing data to all profiles')
        const items = csvData.map((r) => {
          // Create dynamic object with all available columns
          const dynamicData: any = {}
          Object.keys(r).forEach(header => {
            dynamicData[header] = r[header] || ''
          })
          return dynamicData
        })
        
        // Assign same data to all profiles
        profiles.forEach(profile => {
          map.set(profile.id, { items })
        })
      }
      setInputByProfileId(map)
      console.log('[csv] mapped inputs from config for profiles:', Array.from(map.keys()))
    } catch (err) {
      console.error('Map csvData from config failed:', err)
    }
  }, [csvData, profiles])

  const sortedProfiles = useMemo(() => {
    const items = [...profiles]
    items.sort((a, b) => {
      const an = (renamedNames.get(a.id) || a.displayName || a.name || '').trim().toLowerCase()
      const bn = (renamedNames.get(b.id) || b.displayName || b.name || '').trim().toLowerCase()
      
      // Extract numbers from profile names for natural sorting
      const extractNumbers = (name: string) => {
        const match = name.match(/(\d+)/)
        return match ? parseInt(match[1], 10) : 0
      }
      
      const aNum = extractNumbers(an)
      const bNum = extractNumbers(bn)
      
      // If both have numbers, sort by number
      if (aNum > 0 && bNum > 0) {
        return sortAsc ? aNum - bNum : bNum - aNum
      }
      
      // Otherwise sort alphabetically
      const nameComparison = sortAsc ? an.localeCompare(bn) : bn.localeCompare(an)
      return nameComparison
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
  
  // Removed CSV handlers
  

  const handleRunSelected = async () => {
    const selectedProfileIds = Array.from(selectedProfiles)
    if (selectedProfileIds.length === 0) return
    
    try {
      // Check if Electron API is available
      if (!window.automationApi) {
        console.error('Automation API not available - make sure preload script is loaded')
        return
      }

      const concurrency = settings?.numThreads || 3
      console.log(`🚀 Starting batch processing: ${selectedProfileIds.length} profiles with concurrency ${concurrency}`)

      // Chia profiles thành batches
      const batches: string[][] = []
      for (let i = 0; i < selectedProfileIds.length; i += concurrency) {
        batches.push(selectedProfileIds.slice(i, i + concurrency))
      }

      console.log(`📦 Created ${batches.length} batches:`, batches.map(batch => `[${batch.join(', ')}]`))

      // Xử lý từng batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex]
        console.log(`Processing batch ${batchIndex + 1}/${batches.length}: [${batch.join(', ')}]`)

        try {
          // Bước 1: Mở profiles trong batch này
          const openPayload = { profileIds: batch }
          const openResult = await window.automationApi.runOpenProfiles(openPayload)
          console.log(`Batch ${batchIndex + 1} open result:`, openResult)

          if (!openResult.success) {
            console.error(`❌ Failed to open batch ${batchIndex + 1}:`, openResult.error)
            continue // Bỏ qua batch này, chuyển sang batch tiếp theo
          }

          const openedIds: string[] = Array.isArray(openResult.opened)
            ? openResult.opened
                .map((v: any) => (typeof v === 'string' ? v : (v?.profileId || v?.id)))
                .filter((v: any) => typeof v === 'string' && v.length > 0)
            : []

          console.log(`✅ Successfully opened ${openedIds.length} profiles in batch ${batchIndex + 1}`)

          // Bước 2: Chạy automation cho tất cả profiles trong batch
          const automationPromises = openedIds.map(async (profileId) => {
            try {
                const input = inputByProfileId.get(profileId) || {}
                console.log(`🎯 Running automation for profile: ${profileId}`)
                console.log(`📝 Input data for ${profileId}:`, input)
              
              const autoRes = await window.automationApi.runAutomationForProfile({
                profileId,
                scenario: selectedScenario || 'postAndComment',
                input
              })

              if (!autoRes?.success) {
                console.error(`❌ Automation failed for profile ${profileId}:`, autoRes?.error)
                return { profileId, success: false, error: autoRes?.error }
              } else {
                console.log(`✅ Automation completed for profile: ${profileId}`)
                return { profileId, success: true }
              }
            } catch (e) {
              console.error(`❌ Automation error for profile ${profileId}:`, e)
              return { profileId, success: false, error: e }
            }
          })

          // Chờ tất cả automation trong batch hoàn thành
          const batchResults = await Promise.all(automationPromises)
          const successfulProfiles = batchResults.filter(r => r.success).map(r => r.profileId)

          // Cập nhật UI cho profiles thành công
          successfulProfiles.forEach(profileId => {
            setCompletedProfiles((prev) => {
              const next = new Set(prev)
              next.add(profileId)
              return next
            })
            setProfiles((prev) => prev.map(p => p.id === profileId ? { ...p, isCompleted: true } : p))
          })

          console.log(`✅ Batch ${batchIndex + 1} completed: ${successfulProfiles.length}/${openedIds.length} profiles successful`)

          // Bước 3: Đóng tất cả profiles trong batch này
          console.log(`🔒 Closing profiles in batch ${batchIndex + 1}...`)
          const closePromises = openedIds.map(profileId => 
            window.automationApi.closeProfile(profileId).catch(err => 
              console.warn(`Warning: Failed to close profile ${profileId}:`, err)
            )
          )
          await Promise.all(closePromises)
          console.log(`✅ Batch ${batchIndex + 1} profiles closed`)

        } catch (batchError) {
          console.error(`❌ Batch ${batchIndex + 1} failed:`, batchError)
          // Tiếp tục với batch tiếp theo thay vì dừng hoàn toàn
        }

        // Thêm delay giữa các batches để tránh overload
        if (batchIndex < batches.length - 1) {
          console.log('⏳ Waiting 2 seconds before next batch...')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      console.log('🎉 All batches completed!')

    } catch (err) {
      console.error('❌ Run selected: error', err)
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
          {/* CSV loading removed; inputs come from config */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchProfiles}
            disabled={isLoading}
            title="Reload profiles"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Reloading...' : 'Reload'}
          </Button>
          {selectedProfiles.size > 0 && (
            <Button 
              variant="default" 
              size="sm" 
              onClick={handleRunSelected}
              className="bg-green-600 hover:bg-green-700"
            >
              Run
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onBack}>Back</Button>
        </div>
      </div>


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