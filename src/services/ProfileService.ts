import puppeteer, { Browser } from "puppeteer-core";
import fetch from "node-fetch";
import { URLSearchParams } from "url";
import { readdir } from "fs/promises";
import { join } from "path";



// =========================
// Backend profile opener API
// =========================

export type OpenProfileOptions = {
  windowWidth: number
  windowHeight: number
  scalePercent: number
}

type OpenProfileSuccessNew = {
  success: true
  profileId: string
  browserPort: number
  wsUrl: string
  message: string // "Profile opened successfully"
}

type OpenProfileSuccessExisting = {
  success: true
  message: string // "Profile already running"
  profileId: string
  browserPort: number
  wsUrl: string
}

type OpenProfileFailure = { success: false; error: string }

type OpenProfileResponse = OpenProfileSuccessNew | OpenProfileSuccessExisting | OpenProfileFailure

const OPEN_PROFILE_API = "http://127.0.0.1:5424/api/open-profile"

export type OpenedSession = {
  profileId: string
  wsUrl: string
  browser: Browser
}


const openProfile = async (
  profileId: string,
  options: OpenProfileOptions
): Promise<OpenedSession | null> => {
  try {
    const response = await fetch(OPEN_PROFILE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId, options })
    })

    if (!response.ok) {
      console.error("openSingleProfile: bad status", response.status, response.statusText)
      return null
    }

    const data = (await response.json()) as OpenProfileResponse
    if (!data.success || !("wsUrl" in data) || !data.wsUrl) {
      console.error("openSingleProfile: backend failure", data)
      return null
    }

    const browser = await puppeteer.connect({ browserWSEndpoint: data.wsUrl, defaultViewport: null })
    return { profileId, wsUrl: data.wsUrl, browser }
  } catch (error) {
    console.error("openSingleProfile: error", error)
    return null
  }
}

export const openProfiles = async (
  profileIds: string[],
  options: OpenProfileOptions
): Promise<OpenedSession[]> => {
  if (profileIds.length === 0) return []
  const results: OpenedSession[] = []
  for (const id of profileIds) {
    const session = await openProfile(id, options)
    if (session) results.push(session)
  }
  return results
}

/**
 * Open multiple profiles with limited concurrency (pool pattern).
 * Each worker opens a profile, then picks the next until queue is empty.
 */
export const openProfilesWithConcurrency = async (
  profileIds: string[],
  options: OpenProfileOptions,
  concurrency: number
): Promise<OpenedSession[]> => {
  if (profileIds.length === 0) return []
  const limit = Math.max(1, Math.min(concurrency, profileIds.length))
  const results: OpenedSession[] = []

  let cursor = 0
  const workers = Array.from({ length: limit }, async () => {
    while (cursor < profileIds.length) {
      const index = cursor++
      const id = profileIds[index]
      const session = await openProfile(id, options)
      if (session) results.push(session)
    }
  })

  await Promise.all(workers)
  return results
}

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




