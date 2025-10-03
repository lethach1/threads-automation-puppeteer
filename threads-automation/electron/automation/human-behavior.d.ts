import type { Page, ElementHandle } from 'puppeteer-core'

export function humanDelay(minMs: number, maxMs: number): Promise<void>
export function humanTypeWithMistakes(page: Page, selectorOrElement: string | ElementHandle<Node>, text: string, mistakeRate?: number): Promise<void>
export function humanClick(page: Page, selectorOrElement: string | ElementHandle<Node>): Promise<void>
export function waitForElements(page: Page, selector: string, timeoutMs?: number): Promise<void>

export type AutoScrollFeedOptions = {
  maxScrolls?: number
  minDistance?: number
  maxDistance?: number
  pauseChance?: number
  minPauseMs?: number
  maxPauseMs?: number
  occasionalUpChance?: number
  stopOnSelector?: string
  timeoutMs?: number
}

export function humanAutoScrollFeed(page: Page, options?: AutoScrollFeedOptions): Promise<void>

export type ScrollUntilClickOptions = {
  maxScrolls?: number
  minDistance?: number
  maxDistance?: number
  pauseChance?: number
  minPauseMs?: number
  maxPauseMs?: number
  occasionalUpChance?: number
  clickSelectorWithin?: string
  timeoutMs?: number
}

export function humanScrollFeedUntilAndClick(page: Page, targetSelector: string, options?: ScrollUntilClickOptions): Promise<boolean>

export function humanScrollToElement(page: Page, selectorOrElement: string | ElementHandle<Node>, options?: any): Promise<void>


