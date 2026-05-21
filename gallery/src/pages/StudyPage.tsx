import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { Study } from '../data'
import { loadStudies, filtersFromSearch, datasetMatchesFilters, isFiltersEmpty } from '../data'
import DatasetCard from '../components/DatasetCard'
import Pagination from '../components/Pagination'

const PER_PAGE = 16

export default function StudyPage() {
  const { studyId } = useParams<{ studyId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [study, setStudy] = useState<Study | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const filters = filtersFromSearch('?' + searchParams.toString())
  const filtersOn = !isFiltersEmpty(filters)

  useEffect(() => {
    loadStudies().then((studies) => {
      const found = studies.find((s) => s.id === decodeURIComponent(studyId ?? ''))
      setStudy(found ?? null)
      setLoading(false)
    })
  }, [studyId])

  if (loading) {
    return (
      <div className="page center-message">
        <div className="spinner large" />
      </div>
    )
  }

  if (!study) {
    return (
      <div className="page center-message">
        Study not found.{' '}
        <button className="back-btn" onClick={() => navigate('/')}>Back</button>
      </div>
    )
  }

  const datasets = filtersOn
    ? study.datasets.filter(ds => datasetMatchesFilters(ds, filters))
    : study.datasets

  const totalPages = Math.ceil(datasets.length / PER_PAGE)
  const paginated  = datasets.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <div className="page">
      <header className="site-header">
        <div className="header-inner">
          <button className="back-btn" onClick={() => navigate(-1)}>
            ← Back to Gallery
          </button>
        </div>
      </header>

      <div className="study-detail-header">
        <div className="study-card-id">{study.id}</div>
        <h1 className="study-detail-name">{study.name}</h1>
        <div className="study-card-meta">
          {study.organisms.map(o => (
            <span key={o} className="meta-tag">{o}</span>
          ))}
          {study.license && <span className="meta-tag meta-license">{study.license}</span>}
        </div>
        <div className="study-detail-info">
          {study.contact && (
            <div><strong>Contact:</strong> {study.contact}</div>
          )}
          {study.organization && (
            <div><strong>Organization:</strong> {study.organization}</div>
          )}
          {study.paperInfo && (
            <div className="paper-info">{study.paperInfo}</div>
          )}
          {study.paperDOI && (
            <div>
              <a href={study.paperDOI} target="_blank" rel="noopener noreferrer">
                {study.paperDOI}
              </a>
            </div>
          )}
        </div>
        <div className="dataset-count-label">
          {filtersOn
            ? <>{datasets.length} / {study.datasets.length} datasets <span className="filter-active-badge">filtered</span></>
            : <>{study.datasets.length} dataset{study.datasets.length !== 1 ? 's' : ''}</>
          }
        </div>
      </div>

      <main className="main-content">
        {datasets.length === 0 ? (
          <div className="center-message">No datasets match the current filters.</div>
        ) : (
          <>
            <div className="dataset-grid">
              {paginated.map((ds) => (
                <DatasetCard key={ds.dataset} dataset={ds} />
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onChange={(p) => { setPage(p); window.scrollTo(0, 0) }} />
          </>
        )}
      </main>
    </div>
  )
}
