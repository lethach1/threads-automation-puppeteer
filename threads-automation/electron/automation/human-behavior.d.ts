import type { Page, ElementHandle } from 'puppeteer-core'

export function humanDelay(minMs: number, maxMs: number): Promise<void>
export function humanTypeWithMistakes(page: Page, selectorOrElement: string | ElementHandle, text: string, mistakeRate?: number): Promise<void>
export function humanClick(page: Page, selectorOrElement: string | ElementHandle): Promise<void>
export function waitForElements(page: Page, selector: string, timeoutMs?: number): Promise<void>


