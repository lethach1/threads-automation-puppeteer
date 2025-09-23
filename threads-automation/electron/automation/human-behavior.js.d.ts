import type { Page } from 'puppeteer-core'

export function humanDelay(minMs: number, maxMs: number): Promise<void>
export function humanTypeWithMistakes(page: Page, selector: string, text: string, mistakeRate?: number): Promise<void>
export function humanClick(page: Page, selector: string): Promise<void>


