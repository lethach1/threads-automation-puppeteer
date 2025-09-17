export type ProfileListItem = {
  id: string
  name: string
  location?: string
  isRunning: boolean
}

type GetProfilesSuccess = { success: true; profiles: ProfileListItem[] }
type GetProfilesFailure = { success: false; error: string }

export const getListProfiles = async (apiUrl: string): Promise<ProfileListItem[]> => {
  try {
    const res = await fetch(apiUrl, { method: 'GET' })
    if (!res.ok) {
      console.error('getListProfiles: bad status', res.status, res.statusText)
      return []
    }
    const data = (await res.json()) as GetProfilesSuccess | GetProfilesFailure
    if (!data || data.success !== true || !('profiles' in data)) {
      console.error('getListProfiles: invalid response', data)
      return []
    }
    // Keep all rows as returned by API (no de-dup), preserving order
    return (data.profiles || [])
      .filter(p => !!p?.id)
      .map(p => ({ id: p.id, name: p.name ?? p.id, location: p.location, isRunning: !!p.isRunning }))
  } catch (err) {
    console.error('getListProfiles: error', err)
    return []
  }
}





