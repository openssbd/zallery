import { useEffect, useMemo, useState } from 'react'
import { config } from '../config'
import { useSearchParams } from 'react-router-dom'
import type { Study, Filters } from '../data'
import {
  loadStudies, EMPTY_FILTERS, isFiltersEmpty, filtersToSearch, filtersFromSearch,
  getFilterOptions, datasetMatchesFilters, datasetMatchesText,
} from '../data'
import StudyCard from '../components/StudyCard'
import Pagination from '../components/Pagination'

const PER_PAGE = 10

interface FilterSelectProps {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}

function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      <span className="filter-divider" />
      <select
        className="filter-select"
        value={value}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [studies, setStudies] = useState<Study[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  // Initialise state from URL so Back restores everything
  const [query, setQuery]     = useState(() => searchParams.get('q') ?? '')
  const [filters, setFilters] = useState<Filters>(() => filtersFromSearch('?' + searchParams.toString()))
  const [page, setPage]       = useState(() => Number(searchParams.get('page') ?? '1'))

  // Keep URL in sync (replace so filter changes don't pollute history)
  useEffect(() => {
    const params = new URLSearchParams()
    if (query)           params.set('q', query)
    if (filters.dims)     params.set('dims', filters.dims)
    if (filters.organism) params.set('organism', filters.organism)
    if (filters.method)   params.set('method', filters.method)
    if (filters.license)  params.set('license', filters.license)
    if (page > 1)         params.set('page', String(page))
    setSearchParams(params, { replace: true })
  }, [query, filters, page, setSearchParams])

  useEffect(() => {
    loadStudies()
      .then(setStudies)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  const filterOpts = useMemo(() => getFilterOptions(studies), [studies])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return studies.filter(s => {
      if (!isFiltersEmpty(filters)) {
        // filters must match at least one dataset
        const filterMatches = s.datasets.some(ds => datasetMatchesFilters(ds, filters))
        if (!filterMatches) return false
        if (!q) return true
        // text: study-level fields OR a filter-matching dataset also matches text
        const studyHit =
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.contact.toLowerCase().includes(q) ||
          s.organization.toLowerCase().includes(q) ||
          s.paperInfo.toLowerCase().includes(q)
        return studyHit || s.datasets.some(ds => datasetMatchesFilters(ds, filters) && datasetMatchesText(ds, q))
      }
      if (q) {
        // text only: study-level fields OR any dataset field
        const studyHit =
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.contact.toLowerCase().includes(q) ||
          s.organization.toLowerCase().includes(q) ||
          s.paperInfo.toLowerCase().includes(q)
        return studyHit || s.datasets.some(ds => datasetMatchesText(ds, q))
      }
      return true
    })
  }, [studies, query, filters])

  useEffect(() => { setPage(1) }, [query, filters])

  const totalPages   = Math.ceil(filtered.length / PER_PAGE)
  const paginated    = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const filterSearch = (() => {
    const s = filtersToSearch(filters)
    if (!query.trim()) return s
    const params = new URLSearchParams(s ? s.slice(1) : '')
    params.set('q', query.trim())
    return '?' + params.toString()
  })()
  const filtersActive = !isFiltersEmpty(filters)

  const setFilter = <K extends keyof Filters>(key: K, val: string) =>
    setFilters(f => ({ ...f, [key]: val }))

  return (
    <div className="page">
      <header className="site-header">
        <div className="header-inner">
          <div>
            <h1 className="site-title">{config.siteHeading}</h1>
            <p className="site-subtitle">
              {config.siteSubtitle}
              {config.subtitleLink && (
                <>{' '}To browse via <a href={config.subtitleLink.url} target="_blank" rel="noopener noreferrer" className="subtitle-link">{config.subtitleLink.text}</a>.</>
              )}
            </p>
          </div>
          {!loading && (
            <div className="header-stats">
              <span>{studies.length} studies</span>
              <span>{studies.reduce((n, s) => n + s.datasets.length, 0)} datasets</span>
            </div>
          )}
        </div>
      </header>

      <div className="search-bar-wrap">
        <input
          className="search-input"
          type="search"
          placeholder="Search by study name, organism, contact, imaging method…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {query && (
          <div className="search-results-count">
            {filtered.length} / {studies.length} studies
          </div>
        )}
      </div>

      <div className="filter-bar">
        <button
          className={`filter-clear-btn${filtersActive ? ' active' : ''}`}
          onClick={() => setFilters(EMPTY_FILTERS)}
          disabled={!filtersActive}
        >
          Clear all
        </button>
        {filterOpts.dims.length > 0 && (
          <FilterSelect
            label="Dims"
            value={filters.dims}
            options={filterOpts.dims}
            onChange={v => setFilter('dims', v)}
          />
        )}
        {filterOpts.organisms.length > 0 && (
          <FilterSelect
            label="Organism"
            value={filters.organism}
            options={filterOpts.organisms}
            onChange={v => setFilter('organism', v)}
          />
        )}
        {filterOpts.methods.length > 0 && (
          <FilterSelect
            label="Imaging Method"
            value={filters.method}
            options={filterOpts.methods}
            onChange={v => setFilter('method', v)}
          />
        )}
        <FilterSelect
          label="License"
          value={filters.license}
          options={filterOpts.licenses}
          onChange={v => setFilter('license', v)}
        />
      </div>

      <main className="main-content">
        {loading && (
          <div className="center-message">
            <div className="spinner large" />
            <p>Loading dataset…</p>
          </div>
        )}
        {error && (
          <div className="center-message error">Failed to load data: {error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="center-message">No studies match your search.</div>
        )}
        {!loading && !error && filtered.length > 0 && (
          <>
            <div className="page-info">
              {filtered.length} studies — page {page} / {totalPages}
            </div>
            <div className="study-list">
              {paginated.map((study) => (
                <StudyCard key={study.id} study={study} filterSearch={filterSearch} filters={filters} />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={(p) => { setPage(p); window.scrollTo(0, 0) }} />
          </>
        )}
      </main>
    </div>
  )
}
