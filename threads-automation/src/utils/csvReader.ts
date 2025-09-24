import * as XLSX from 'xlsx'

export interface FlexibleRow {
  [key: string]: string | number | boolean | null
}

export interface FlexibleParseResult {
  headers: string[]
  rows: FlexibleRow[]
  totalRows: number
  metadata: {
    fileName?: string
    sheetName?: string
    originalHeaders: string[]
    dataTypes: Record<string, string>
  }
}

export interface DataProcessingOptions {
  skipEmptyRows?: boolean
  trimWhitespace?: boolean
  convertToLowerCase?: boolean
  customHeaderMapping?: Record<string, string>
}

export interface ColumnInfo {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date' | 'mixed'
  sampleValues: any[]
  hasEmptyValues: boolean
  uniqueValues: number
}

/**
 * Detect data type of a value
 * @param value Value to analyze
 * @returns Detected data type
 */
const detectDataType = (value: any): string => {
  if (value === null || value === undefined || value === '') {
    return 'empty'
  }
  if (typeof value === 'number') {
    return 'number'
  }
  if (typeof value === 'boolean') {
    return 'boolean'
  }
  if (value instanceof Date) {
    return 'date'
  }
  if (typeof value === 'string') {
    // Check if it's a number string
    if (!isNaN(Number(value)) && !isNaN(parseFloat(value))) {
      return 'number'
    }
    // Check if it's a boolean string
    if (['true', 'false', 'yes', 'no', '1', '0'].includes(value.toLowerCase())) {
      return 'boolean'
    }
    // Check if it's a date string
    if (!isNaN(Date.parse(value))) {
      return 'date'
    }
  }
  return 'string'
}

/**
 * Parse workbook data using SheetJS with flexible structure
 * @param workbook XLSX workbook object
 * @param options Processing options
 * @param fileName Optional file name for metadata
 * @returns Parsed data with headers and rows
 */
const parseWorkbookFlexible = (
  workbook: XLSX.WorkBook, 
  options: DataProcessingOptions = {},
  fileName?: string
): FlexibleParseResult => {
  // Get the first worksheet
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { 
      headers: [], 
      rows: [], 
      totalRows: 0,
      metadata: {
        fileName,
        originalHeaders: [],
        dataTypes: {}
      }
    }
  }
  
  const worksheet = workbook.Sheets[sheetName]
  
  // Convert worksheet to JSON array with raw data types
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: null,
    raw: true, // Keep original data types
    dateNF: 'yyyy-mm-dd'
  }) as any[][]
  
  if (jsonData.length === 0) {
    return { 
      headers: [], 
      rows: [], 
      totalRows: 0,
      metadata: {
        fileName,
        sheetName,
        originalHeaders: [],
        dataTypes: {}
      }
    }
  }
  
  // First row is headers
  const originalHeaders = jsonData[0].map((h: any) => String(h || ''))
  let headers = [...originalHeaders]
  
  // Apply header processing options
  if (options.trimWhitespace) {
    headers = headers.map(h => h.trim())
  }
  if (options.convertToLowerCase) {
    headers = headers.map(h => h.toLowerCase())
  }
  if (options.customHeaderMapping) {
    headers = headers.map(h => options.customHeaderMapping![h] || h)
  }
  
  // Analyze data types for each column
  const dataTypes: Record<string, string> = {}
  headers.forEach((header, colIndex) => {
    const columnValues = jsonData.slice(1).map(row => row[colIndex]).filter(val => val !== null && val !== undefined && val !== '')
    if (columnValues.length > 0) {
      const types = columnValues.map(detectDataType)
      const mostCommonType = types.reduce((a, b, _, arr) => 
        arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
      )
      dataTypes[header] = mostCommonType
    } else {
      dataTypes[header] = 'empty'
    }
  })
  
  // Process data rows
  let rows: FlexibleRow[] = jsonData.slice(1).map((row: any[]) => {
    const rowData: FlexibleRow = {}
    headers.forEach((header, index) => {
      let value = row[index]
      
      // Skip empty rows if option is enabled
      if (options.skipEmptyRows && (value === null || value === undefined || value === '')) {
        return
      }
      
      // Process value based on detected type
      if (value !== null && value !== undefined) {
        if (options.trimWhitespace && typeof value === 'string') {
          value = value.trim()
        }
        
        // Convert value based on detected type
        const detectedType = dataTypes[header]
        switch (detectedType) {
          case 'number':
            if (typeof value === 'string') {
              value = isNaN(Number(value)) ? value : Number(value)
            }
            break
          case 'boolean':
            if (typeof value === 'string') {
              const lowerValue = value.toLowerCase()
              if (['true', 'yes', '1'].includes(lowerValue)) {
                value = true
              } else if (['false', 'no', '0'].includes(lowerValue)) {
                value = false
              }
            }
            break
          case 'date':
            if (typeof value === 'string' && !isNaN(Date.parse(value))) {
              value = new Date(value)
            }
            break
        }
      }
      
      rowData[header] = value
    })
    return rowData
  })
  
  // Filter out empty rows if option is enabled
  if (options.skipEmptyRows) {
    rows = rows.filter(row => Object.values(row).some(val => val !== null && val !== undefined && val !== ''))
  }
  
  return {
    headers,
    rows,
    totalRows: rows.length,
    metadata: {
      fileName,
      sheetName,
      originalHeaders,
      dataTypes
    }
  }
}

/**
 * Load and parse CSV/XLSX file from file path using SheetJS (Flexible version)
 * @param filePath Path to CSV or XLSX file
 * @param options Processing options
 * @returns Promise with parsed data
 */
export const loadFlexibleFile = async (
  filePath: string, 
  options: DataProcessingOptions = {}
): Promise<FlexibleParseResult> => {
  try {
    // Fetch file as array buffer
    const response = await fetch(filePath)
    if (!response.ok) {
      throw new Error(`Failed to load file: ${response.statusText}`)
    }
    
    // Get file extension to determine file type
    const fileExtension = filePath.toLowerCase().split('.').pop()
    
    // Read file as array buffer
    const arrayBuffer = await response.arrayBuffer()
    
    // Parse workbook based on file type
    let workbook: XLSX.WorkBook
    if (fileExtension === 'csv') {
      // For CSV files, try multiple encodings to handle Vietnamese text properly
      const decoder = new TextDecoder('utf-8')
      let csvText = decoder.decode(arrayBuffer)
      
      // If UTF-8 fails, try with BOM detection
      try {
        // Check for UTF-8 BOM and remove it if present
        if (csvText.charCodeAt(0) === 0xFEFF) {
          csvText = csvText.slice(1)
        }
        workbook = XLSX.read(csvText, { type: 'string' })
      } catch (encodingError) {
        console.warn('UTF-8 decoding failed, trying alternative encoding:', encodingError)
        // Fallback: try with different encoding
        const fallbackDecoder = new TextDecoder('utf-8', { fatal: false })
        csvText = fallbackDecoder.decode(arrayBuffer)
        workbook = XLSX.read(csvText, { type: 'string' })
      }
    } else if (['xlsx', 'xls', 'xlsm'].includes(fileExtension || '')) {
      // For Excel files, read directly from buffer
      workbook = XLSX.read(arrayBuffer, { type: 'array' })
    } else {
      throw new Error(`Unsupported file format: ${fileExtension}`)
    }
    
    return parseWorkbookFlexible(workbook, options, filePath)
  } catch (error) {
    console.error('Failed to load file:', error)
    throw error
  }
}

/**
 * Parse CSV/XLSX content from buffer or string (Flexible version)
 * @param data File data as buffer, string, or array buffer
 * @param fileType Type of file ('csv', 'xlsx', 'xls', 'xlsm')
 * @param options Processing options
 * @param fileName Optional file name for metadata
 * @returns Parsed data with headers and rows
 */
export const parseFlexibleFileData = (
  data: ArrayBuffer | string, 
  fileType: string,
  options: DataProcessingOptions = {},
  fileName?: string
): FlexibleParseResult => {
  try {
    let workbook: XLSX.WorkBook
    
    if (fileType === 'csv') {
      if (data instanceof ArrayBuffer) {
        // Convert ArrayBuffer to UTF-8 string
        const decoder = new TextDecoder('utf-8')
        const csvText = decoder.decode(data)
        workbook = XLSX.read(csvText, { type: 'string' })
      } else {
        // Already a string
        workbook = XLSX.read(data, { type: 'string' })
      }
    } else if (['xlsx', 'xls', 'xlsm'].includes(fileType)) {
      if (data instanceof ArrayBuffer) {
        workbook = XLSX.read(data, { type: 'array' })
      } else {
        throw new Error(`Expected ArrayBuffer for ${fileType} files`)
      }
    } else {
      throw new Error(`Unsupported file format: ${fileType}`)
    }
    
    return parseWorkbookFlexible(workbook, options, fileName)
  } catch (error) {
    console.error('Failed to parse file data:', error)
    throw error
  }
}

/**
 * Get detailed column information for flexible data processing
 * @param data Parsed flexible data
 * @returns Array of column information objects
 */
export const getColumnInfo = (data: FlexibleParseResult): ColumnInfo[] => {
  return data.headers.map(header => {
    const columnValues = data.rows.map(row => row[header]).filter(val => val !== null && val !== undefined && val !== '')
    const uniqueValues = new Set(columnValues).size
    const sampleValues = columnValues.slice(0, 5)
    const hasEmptyValues = data.rows.some(row => row[header] === null || row[header] === undefined || row[header] === '')
    
    return {
      name: header,
      type: data.metadata.dataTypes[header] as any || 'mixed',
      sampleValues,
      hasEmptyValues,
      uniqueValues
    }
  })
}

/**
 * Display raw data in a structured format for debugging/inspection
 * @param data Parsed flexible data
 * @param maxRows Maximum rows to display (default: 10)
 * @returns Formatted raw data display
 */
export const displayRawData = (data: FlexibleParseResult, maxRows: number = 10) => {
  const displayRows = data.rows.slice(0, maxRows)
  
  return {
    metadata: {
      fileName: data.metadata.fileName,
      sheetName: data.metadata.sheetName,
      totalRows: data.totalRows,
      headers: data.headers,
      dataTypes: data.metadata.dataTypes
    },
    preview: {
      rows: displayRows,
      hasMore: data.totalRows > maxRows,
      remainingRows: Math.max(0, data.totalRows - maxRows)
    },
    columnInfo: getColumnInfo(data)
  }
}

/**
 * Validate flexible data structure
 * @param data Parsed flexible data
 * @param requiredColumns Array of required column names (optional)
 * @returns Validation result with success flag and error message
 */
export const validateFlexibleData = (
  data: FlexibleParseResult, 
  requiredColumns: string[] = []
): { isValid: boolean; error?: string; warnings?: string[] } => {
  const warnings: string[] = []
  
  if (data.totalRows === 0) {
    return { isValid: false, error: 'File is empty' }
  }
  
  if (requiredColumns.length > 0) {
    const missingColumns = requiredColumns.filter(col => !data.headers.includes(col))
    if (missingColumns.length > 0) {
      return { 
        isValid: false, 
        error: `Missing required columns: ${missingColumns.join(', ')}` 
      }
    }
  }
  
  // Check for potential data quality issues
  data.headers.forEach(header => {
    const columnValues = data.rows.map(row => row[header])
    const emptyCount = columnValues.filter(val => val === null || val === undefined || val === '').length
    const emptyPercentage = (emptyCount / columnValues.length) * 100
    
    if (emptyPercentage > 50) {
      warnings.push(`Column "${header}" has ${emptyPercentage.toFixed(1)}% empty values`)
    }
  })
  
  return { isValid: true, warnings: warnings.length > 0 ? warnings : undefined }
}

/**
 * Get preview of flexible data (first N rows)
 * @param data Parsed flexible data
 * @param maxRows Maximum number of rows to show (default: 10)
 * @returns Preview data with limited rows
 */
export const getFlexiblePreview = (data: FlexibleParseResult, maxRows: number = 10) => {
  return {
    headers: data.headers,
    rows: data.rows.slice(0, maxRows),
    totalRows: data.totalRows,
    hasMore: data.totalRows > maxRows,
    remainingRows: Math.max(0, data.totalRows - maxRows),
    metadata: data.metadata
  }
}

/**
 * Filter rows based on custom criteria
 * @param data Parsed flexible data
 * @param filterFn Custom filter function
 * @returns Filtered data
 */
export const filterRows = (
  data: FlexibleParseResult, 
  filterFn: (row: FlexibleRow, index: number) => boolean
): FlexibleParseResult => {
  const filteredRows = data.rows.filter(filterFn)
  
  return {
    ...data,
    rows: filteredRows,
    totalRows: filteredRows.length
  }
}

/**
 * Sort rows by specified column
 * @param data Parsed flexible data
 * @param columnName Column name to sort by
 * @param ascending Sort order (default: true)
 * @returns Sorted data
 */
export const sortRows = (
  data: FlexibleParseResult, 
  columnName: string, 
  ascending: boolean = true
): FlexibleParseResult => {
  if (!data.headers.includes(columnName)) {
    throw new Error(`Column "${columnName}" not found`)
  }
  
  const sortedRows = [...data.rows].sort((a, b) => {
    const aVal = a[columnName]
    const bVal = b[columnName]
    
    if (aVal === null || aVal === undefined) return ascending ? 1 : -1
    if (bVal === null || bVal === undefined) return ascending ? -1 : 1
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return ascending ? aVal - bVal : bVal - aVal
    }
    
    const aStr = String(aVal).toLowerCase()
    const bStr = String(bVal).toLowerCase()
    
    if (aStr < bStr) return ascending ? -1 : 1
    if (aStr > bStr) return ascending ? 1 : -1
    return 0
  })
  
  return {
    ...data,
    rows: sortedRows
  }
}

/**
 * Transform column values using custom function
 * @param data Parsed flexible data
 * @param columnName Column to transform
 * @param transformFn Transformation function
 * @returns Data with transformed column
 */
export const transformColumn = (
  data: FlexibleParseResult,
  columnName: string,
  transformFn: (value: any, row: FlexibleRow, index: number) => any
): FlexibleParseResult => {
  if (!data.headers.includes(columnName)) {
    throw new Error(`Column "${columnName}" not found`)
  }
  
  const transformedRows = data.rows.map((row, index) => ({
    ...row,
    [columnName]: transformFn(row[columnName], row, index)
  }))
  
  return {
    ...data,
    rows: transformedRows
  }
}

/**
 * Group rows by specified column(s)
 * @param data Parsed flexible data
 * @param groupBy Column name(s) to group by
 * @returns Grouped data object
 */
export const groupByColumns = (
  data: FlexibleParseResult,
  groupBy: string | string[]
): Record<string, FlexibleRow[]> => {
  const groupKeys = Array.isArray(groupBy) ? groupBy : [groupBy]
  
  // Validate all group keys exist
  groupKeys.forEach(key => {
    if (!data.headers.includes(key)) {
      throw new Error(`Column "${key}" not found`)
    }
  })
  
  const groups: Record<string, FlexibleRow[]> = {}
  
  data.rows.forEach(row => {
    const groupKey = groupKeys.map(key => String(row[key] || '')).join('|')
    
    if (!groups[groupKey]) {
      groups[groupKey] = []
    }
    groups[groupKey].push(row)
  })
  
  return groups
}

/**
 * Extract unique values from a column
 * @param data Parsed flexible data
 * @param columnName Column name
 * @returns Array of unique values
 */
export const getUniqueValues = (data: FlexibleParseResult, columnName: string): any[] => {
  if (!data.headers.includes(columnName)) {
    throw new Error(`Column "${columnName}" not found`)
  }
  
  const values = data.rows.map(row => row[columnName])
  return [...new Set(values)].filter(val => val !== null && val !== undefined && val !== '')
}

/**
 * Get data statistics for numeric columns
 * @param data Parsed flexible data
 * @returns Statistics object
 */
export const getDataStatistics = (data: FlexibleParseResult) => {
  const stats: Record<string, any> = {}
  
  data.headers.forEach(header => {
    const values = data.rows.map(row => row[header]).filter(val => 
      typeof val === 'number' || (!isNaN(Number(val)) && val !== '')
    )
    
    if (values.length > 0) {
      const numericValues = values.map(val => typeof val === 'number' ? val : Number(val))
      const sorted = numericValues.sort((a, b) => a - b)
      
      stats[header] = {
        count: numericValues.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        sum: numericValues.reduce((sum, val) => sum + val, 0),
        average: numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length,
        median: sorted.length % 2 === 0 
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)]
      }
    }
  })
  
  return stats
}

/**
 * Export data to different formats
 * @param data Parsed flexible data
 * @param format Export format ('json', 'csv')
 * @returns Exported data string
 */
export const exportData = (data: FlexibleParseResult, format: 'json' | 'csv' = 'json'): string => {
  if (format === 'json') {
    return JSON.stringify({
      headers: data.headers,
      rows: data.rows,
      metadata: data.metadata
    }, null, 2)
  }
  
  if (format === 'csv') {
    const csvHeaders = data.headers.join(',')
    const csvRows = data.rows.map(row => 
      data.headers.map(header => {
        const value = row[header]
        if (value === null || value === undefined) return ''
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return String(value)
      }).join(',')
    )
    return [csvHeaders, ...csvRows].join('\n')
  }
  
  throw new Error(`Unsupported export format: ${format}`)
}

/**
 * Legacy compatibility: Convert flexible data to old format
 * @param data Flexible data
 * @returns Legacy CsvParseResult format
 */
export const toLegacyFormat = (data: FlexibleParseResult): any => {
  return {
    headers: data.headers,
    rows: data.rows.map(row => {
      const legacyRow: any = {}
      Object.entries(row).forEach(([key, value]) => {
        legacyRow[key] = String(value || '')
      })
      return legacyRow
    }),
    totalRows: data.totalRows
  }
}

/**
 * Map profile names to profile IDs
 * @param profileGroups Grouped data by profile
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
 * Get processing summary
 * @param csvData Parsed data
 * @param profileColumn Name of the profile column
 * @returns Summary with total posts and unique profiles
 */
export const getCsvSummary = (
  csvData: CsvParseResult,
  profileColumn: string = 'profile'
): { totalPosts: number; uniqueProfiles: number; profileGroups: Record<string, CsvRow[]> } => {
  const profileGroups = groupByColumns(csvData, profileColumn)
  
  return {
    totalPosts: csvData.totalRows,
    uniqueProfiles: Object.keys(profileGroups).length,
    profileGroups
  }
}

/**
 * Get supported file extensions
 * @returns Array of supported file extensions
 */
export const getSupportedExtensions = (): string[] => {
  return ['csv', 'xlsx', 'xls', 'xlsm']
}

/**
 * Check if file extension is supported
 * @param filePath Path to file
 * @returns True if file extension is supported
 */
export const isSupportedFile = (filePath: string): boolean => {
  const extension = filePath.toLowerCase().split('.').pop()
  return extension ? getSupportedExtensions().includes(extension) : false
}

/**
 * Get value from row with case-insensitive header matching
 * @param row Data row
 * @param possibleKeys Array of possible header names (case variants)
 * @returns First matching value or empty string
 */
export const getRowValue = (row: Record<string, string>, possibleKeys: string[]): string => {
  for (const key of possibleKeys) {
    if (row[key]) return row[key]
  }
  return ''
}

/**
 * Create a flexible data processor with chainable operations
 * @param data Parsed flexible data
 * @returns Data processor object with chainable methods
 */
export const createDataProcessor = (data: FlexibleParseResult) => {
  return {
    data,
    
    filter: (filterFn: (row: FlexibleRow, index: number) => boolean) => {
      return createDataProcessor(filterRows(data, filterFn))
    },
    
    sort: (columnName: string, ascending: boolean = true) => {
      return createDataProcessor(sortRows(data, columnName, ascending))
    },
    
    transform: (columnName: string, transformFn: (value: any, row: FlexibleRow, index: number) => any) => {
      return createDataProcessor(transformColumn(data, columnName, transformFn))
    },
    
    groupBy: (groupBy: string | string[]) => {
      return groupByColumns(data, groupBy)
    },
    
    getUnique: (columnName: string) => {
      return getUniqueValues(data, columnName)
    },
    
    getStats: () => {
      return getDataStatistics(data)
    },
    
    preview: (maxRows: number = 10) => {
      return getFlexiblePreview(data, maxRows)
    },
    
    display: (maxRows: number = 10) => {
      return displayRawData(data, maxRows)
    },
    
    export: (format: 'json' | 'csv' = 'json') => {
      return exportData(data, format)
    },
    
    toLegacy: () => {
      return toLegacyFormat(data)
    }
  }
}

/**
 * Utility function to create processing options
 * @param options Partial options object
 * @returns Complete DataProcessingOptions object
 */
export const createProcessingOptions = (options: Partial<DataProcessingOptions> = {}): DataProcessingOptions => {
  return {
    skipEmptyRows: false,
    trimWhitespace: true,
    convertToLowerCase: false,
    customHeaderMapping: undefined,
    ...options
  }
}

// dùng alias cũ cho tương thích với code cũ
export type CsvRow = FlexibleRow
export type CsvParseResult = FlexibleParseResult

// Legacy function aliases
export const loadCsvFile = loadFlexibleFile
export const parseFileData = parseFlexibleFileData
export const validateCsvData = validateFlexibleData
export const getCsvPreview = getFlexiblePreview