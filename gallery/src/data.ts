import Papa from 'papaparse'
import { config } from './config'

export interface Dataset {
  id: string
  projectName: string
  dataset: string
  title: string
  organism: string
  contact: string
  organization: string
  imagingMethod: string
  paperInfo: string
  paperDOI: string
  license: string
  filePath: string
  dimensions: string
}

export interface Study {
  id: string
  name: string
  title: string
  organisms: string[]
  contact: string
  organization: string
  imagingMethod: string
  paperInfo: string
  paperDOI: string
  license: string
  datasets: Dataset[]
}

export interface Filters {
  dims: string
  organism: string
  method: string
  license: string
}

export const EMPTY_FILTERS: Filters = { dims: '', organism: '', method: '', license: '' }

export function isFiltersEmpty(f: Filters): boolean {
  return !f.dims && !f.organism && !f.method && !f.license
}

export function filtersToSearch(f: Filters): string {
  const params = new URLSearchParams()
  if (f.dims)     params.set('dims', f.dims)
  if (f.organism) params.set('organism', f.organism)
  if (f.method)   params.set('method', f.method)
  if (f.license)  params.set('license', f.license)
  const s = params.toString()
  return s ? '?' + s : ''
}

export function filtersFromSearch(search: string): Filters {
  const p = new URLSearchParams(search)
  return {
    dims:     p.get('dims')     ?? '',
    organism: p.get('organism') ?? '',
    method:   p.get('method')   ?? '',
    license:  p.get('license')  ?? '',
  }
}

/** Parse "X x Y x Z x C x T" → dimension term like "3D+C". */
export function parseDimTerm(dimensions: string): string {
  if (!dimensions?.trim()) return ''
  const parts = dimensions.split(/\s*x\s*/i).map(Number)
  if (parts.length < 5 || parts.some(isNaN)) return ''
  const [, , z, c, t] = parts
  const base = z >= 2 ? '3D' : '2D'
  return base + (c >= 2 ? '+C' : '') + (t >= 2 ? '+T' : '')
}

/** Split "LSCM/TIRF" → ["LSCM", "TIRF"]. */
export function getMethodTerms(imagingMethod: string): string[] {
  if (!imagingMethod?.trim()) return []
  return imagingMethod.split('/').map(s => s.trim()).filter(Boolean)
}

export function datasetMatchesText(ds: Dataset, q: string): boolean {
  return ds.title.toLowerCase().includes(q) ||
    ds.dataset.toLowerCase().includes(q) ||
    ds.organism.toLowerCase().includes(q) ||
    ds.imagingMethod.toLowerCase().includes(q) ||
    ds.contact.toLowerCase().includes(q) ||
    ds.organization.toLowerCase().includes(q) ||
    ds.paperInfo.toLowerCase().includes(q)
}

export function datasetMatchesFilters(ds: Dataset, f: Filters): boolean {
  if (f.dims     && parseDimTerm(ds.dimensions) !== f.dims) return false
  if (f.organism && ds.organism.trim() !== f.organism) return false
  if (f.method   && !getMethodTerms(ds.imagingMethod).includes(f.method)) return false
  if (f.license  && ds.license.trim() !== f.license) return false
  return true
}

const DIM_ORDER = ['2D', '2D+C', '2D+T', '2D+C+T', '3D', '3D+C', '3D+T', '3D+C+T']

export function getFilterOptions(studies: Study[]) {
  const dimsSet   = new Set<string>()
  const orgSet    = new Set<string>()
  const methodSet = new Set<string>()
  const licSet    = new Set<string>()

  for (const s of studies) {
    for (const ds of s.datasets) {
      const dt = parseDimTerm(ds.dimensions)
      if (dt) dimsSet.add(dt)
      if (ds.organism?.trim())  orgSet.add(ds.organism.trim())
      for (const m of getMethodTerms(ds.imagingMethod)) methodSet.add(m)
      if (ds.license?.trim())   licSet.add(ds.license.trim())
    }
  }

  return {
    dims:      DIM_ORDER.filter(d => dimsSet.has(d)),
    organisms: [...orgSet].sort(),
    methods:   [...methodSet].sort(),
    licenses:  [...licSet].sort(),
  }
}

export function getZarrGroupUrl(filePath: string): string {
  return filePath
}

type CsvRow = Record<string, string>

function col(row: CsvRow, ...keys: string[]): string {
  for (const k of keys) if (row[k] != null) return row[k]
  return ''
}

export async function loadStudies(): Promise<Study[]> {
  const response = await fetch(config.csvPath)
  const text = await response.text()

  const result = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  })

  const studyMap = new Map<string, Study>()

  for (const row of result.data) {
    const id          = col(row, 'SSBD:database ID', 'Study ID', 'Project ID').trim()
    const projectName = col(row, 'Project Name', 'Study Name').trim()
    if (!id || !projectName) continue

    const dataset       = col(row, 'Dataset')
    const title         = col(row, 'Title')
    const organism      = col(row, 'Organism', 'Species')
    const contact       = col(row, 'Contact')
    const organization  = col(row, 'Organization')
    const imagingMethod = col(row, 'Biological Imaging Method')
    const paperInfo     = col(row, 'Paper Information')
    const paperDOI      = col(row, 'Paper DOI')
    const license       = col(row, 'Dataset License', 'License')
    const filePath      = col(row, 'File Path')
    const dimensions    = col(row, 'Dimensions')

    const datasetObj: Dataset = {
      id, projectName, dataset, title, organism, contact,
      organization, imagingMethod, paperInfo, paperDOI, license, filePath,
      dimensions,
    }

    if (!studyMap.has(id)) {
      studyMap.set(id, {
        id,
        name: projectName,
        title,
        organisms: [],
        contact,
        organization,
        imagingMethod,
        paperInfo,
        paperDOI,
        license,
        datasets: [],
      })
    }

    const study = studyMap.get(id)!
    study.datasets.push(datasetObj)
    const org = organism.trim()
    if (org && !study.organisms.includes(org)) study.organisms.push(org)
  }

  return Array.from(studyMap.values())
}
