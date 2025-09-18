import fetch from "node-fetch";

// =========================
// Fetch list of profiles from backend API
// =========================

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
    const res = await fetch(apiUrl, { method: "GET" })
    if (!res.ok) {
      console.error("getListProfiles: bad status", res.status, res.statusText)
      return []
    }
    const data = (await res.json()) as GetProfilesSuccess | GetProfilesFailure
    if (!data || data.success !== true || !("profiles" in data)) {
      console.error("getListProfiles: invalid response", data)
      return []
    }
    // Basic normalization and de-dup by id
    const seen = new Set<string>()
    const list: ProfileListItem[] = []
    for (const p of data.profiles) {
      if (!p?.id || seen.has(p.id)) continue
      seen.add(p.id)
      list.push({ id: p.id, name: p.name ?? p.id, location: p.location, isRunning: !!p.isRunning })
    }
    return list
  } catch (err) {
    console.error("getListProfiles: error", err)
    return []
  }
}

