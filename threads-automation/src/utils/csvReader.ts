export interface CsvRow {
  [key: string]: string
}

export interface CsvParseResult {
  headers: string[]
  rows: CsvRow[]
  totalRows: number
}

/**
 * Parse CSV content from text string
 * @param csvText Raw CSV content as string
 * @returns Parsed CSV data with headers and rows
 */
export const parseCsvText = (csvText: string): CsvParseResult => {
  const lines = csvText.split('\n').filter(line => line.trim())
  
  if (lines.length === 0) {
    return { headers: [], rows: [], totalRows: 0 }
  }
  
  const headers = lines[0].split(',').map(h => h.trim())
  const rows: CsvRow[] = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim())
    const row: CsvRow = {}
    headers.forEach((header, i) => {
      row[header] = values[i] || ''
    })
    return row
  })
  
  return {
    headers,
    rows,
    totalRows: rows.length
  }
}

/**
 * Load and parse CSV file from file path
 * @param filePath Path to CSV file
 * @returns Promise with parsed CSV data
 */
export const loadCsvFile = async (filePath: string): Promise<CsvParseResult> => {
  try {
    const response = await fetch(filePath)
    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.statusText}`)
    }
    const text = await response.text()
    return parseCsvText(text)
  } catch (error) {
    console.error('Failed to load CSV file:', error)
    throw error
  }
}

/**
 * Validate CSV data structure
 * @param csvData Parsed CSV data
 * @param requiredColumns Array of required column names
 * @returns Validation result with success flag and error message
 */
export const validateCsvData = (
  csvData: CsvParseResult, 
  requiredColumns: string[] = []
): { isValid: boolean; error?: string } => {
  if (csvData.totalRows === 0) {
    return { isValid: false, error: 'CSV file is empty' }
  }
  
  if (requiredColumns.length > 0) {
    const missingColumns = requiredColumns.filter(col => !csvData.headers.includes(col))
    if (missingColumns.length > 0) {
      return { 
        isValid: false, 
        error: `Missing required columns: ${missingColumns.join(', ')}` 
      }
    }
  }
  
  return { isValid: true }
}

/**
 * Get preview of CSV data (first N rows)
 * @param csvData Parsed CSV data
 * @param maxRows Maximum number of rows to show (default: 5)
 * @returns Preview data with limited rows
 */
export const getCsvPreview = (csvData: CsvParseResult, maxRows: number = 5) => {
  return {
    headers: csvData.headers,
    rows: csvData.rows.slice(0, maxRows),
    totalRows: csvData.totalRows,
    hasMore: csvData.totalRows > maxRows,
    remainingRows: Math.max(0, csvData.totalRows - maxRows)
  }
}

/**
 * Group CSV data by profile name
 * @param csvData Parsed CSV data
 * @param profileColumn Name of the profile column (default: 'profile')
 * @returns Object with profile names as keys and their posts as values
 */
export const groupCsvDataByProfile = (
  csvData: CsvParseResult, 
  profileColumn: string = 'profile'
): Record<string, CsvRow[]> => {
  const profileGroups: Record<string, CsvRow[]> = {}
  
  csvData.rows.forEach(row => {
    const profileName = row[profileColumn]
    if (!profileName) return
    
    if (!profileGroups[profileName]) {
      profileGroups[profileName] = []
    }
    profileGroups[profileName].push(row)
  })
  
  return profileGroups
}

/**
 * Map profile names to profile IDs
 * @param profileGroups Grouped CSV data by profile
 * @param availableProfiles List of available profiles
 * @returns Mapping object with profile names as keys and profile IDs as values
 */
export const mapProfileNamesToIds = (
  profileGroups: Record<string, CsvRow[]>,
  availableProfiles: Array<{ id: string; name: string }>
): Record<string, string> => {
  const mapping: Record<string, string> = {}
  
  Object.keys(profileGroups).forEach(profileName => {
    const profile = availableProfiles.find(p => p.name === profileName)
    if (profile) {
      mapping[profileName] = profile.id
    }
  })
  
  return mapping
}

/**
 * Get CSV processing summary
 * @param csvData Parsed CSV data
 * @param profileColumn Name of the profile column
 * @returns Summary with total posts and unique profiles
 */
export const getCsvSummary = (
  csvData: CsvParseResult,
  profileColumn: string = 'profile'
): { totalPosts: number; uniqueProfiles: number; profileGroups: Record<string, CsvRow[]> } => {
  const profileGroups = groupCsvDataByProfile(csvData, profileColumn)
  
  return {
    totalPosts: csvData.totalRows,
    uniqueProfiles: Object.keys(profileGroups).length,
    profileGroups
  }
}
