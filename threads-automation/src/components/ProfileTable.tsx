import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowUpDown, Circle, FolderOpen } from 'lucide-react'

type Profile = {
  id: string
  name: string
  displayName?: string
  notes?: string
  location?: string
}

type Props = {
  onBack?: () => void
}

export default function ProfileTable({ onBack }: Props) {
  const [profiles] = useState<Profile[]>(() =>
    Array.from({ length: 8 }).map((_, i) => ({ id: `p-${i + 1}`, name: `Person ${i + 1}`, location: 'Hanoi, Vietnam' }))
  )
  const [sortAsc, setSortAsc] = useState(true)
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set())
  const [showCheckbox] = useState(true)
  const [runningProfiles] = useState<Set<string>>(new Set())
  const [proxyActive] = useState<boolean | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [renamedNames, setRenamedNames] = useState<Map<string, string>>(new Map())
  const inputRef = useRef<HTMLInputElement | null>(null)
  const profileStates = new Map<string, { state: 'error' | 'launching' | 'ready'; error?: string }>()

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus()
  }, [editingId])

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
  
  const handleRunSelected = () => {
    const selectedProfileIds = Array.from(selectedProfiles)
    console.log('Running automation for profiles:', selectedProfileIds)
    // TODO: Implement actual automation logic here
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
            <TableHead>State</TableHead>
            <TableHead>Notes</TableHead>
            <TableHead>Location</TableHead>
            {/* Removed actions/download column */}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedProfiles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-32 text-center">
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
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const profileState = profileStates.get(profile.id)
                        if (profileState?.state === 'error') {
                          return (
                            <>
                              <Circle className="h-4 w-4 text-red-500" />
                              <span className="text-sm text-red-600" title={profileState.error}>error</span>
                            </>
                          )
                        } else if (profileState?.state === 'launching') {
                          return (
                            <>
                              <Circle className="h-4 w-4 text-yellow-500 animate-pulse" />
                              <span className="text-sm text-yellow-600">launching</span>
                            </>
                          )
                        } else if (runningProfiles.has(profile.id)) {
                          return (
                            <>
                              <Circle className="h-4 w-4 text-green-500" />
                              <span className="text-sm text-green-600">running</span>
                            </>
                          )
                        } else {
                          return (
                            <>
                              <Circle className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-muted-foreground">ready</span>
                            </>
                          )
                        }
                      })()}
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
                {/* Removed download cell */}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}