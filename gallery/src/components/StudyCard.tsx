import { useNavigate } from 'react-router-dom'
import type { Study, Filters } from '../data'
import { datasetMatchesFilters, isFiltersEmpty } from '../data'
import Thumbnail from './Thumbnail'

interface Props {
  study: Study
  filterSearch?: string
  filters?: Filters
}

export default function StudyCard({ study, filterSearch = '', filters }: Props) {
  const navigate = useNavigate()
  const firstDataset = !filters || isFiltersEmpty(filters)
    ? study.datasets[0]
    : (study.datasets.find(ds => datasetMatchesFilters(ds, filters)) ?? study.datasets[0])

  const handleClick = () =>
    navigate(`/study/${encodeURIComponent(study.id)}${filterSearch}`)

  return (
    <div className="study-card" onClick={handleClick}>
      <div className="study-card-thumb">
        {firstDataset && (
          <Thumbnail filePath={firstDataset.filePath} size={180} />
        )}
      </div>
      <div className="study-card-body">
        <div className="study-card-id">{study.id}</div>
        <h2 className="study-card-name">{study.name}</h2>
        <div className="study-card-meta">
          {study.organisms.map(o => (
            <span key={o} className="meta-tag">{o}</span>
          ))}
          {study.license && (
            <span className="meta-tag meta-license">{study.license}</span>
          )}
        </div>
        <div className="study-card-details">
          {study.contact && <span>{study.contact}</span>}
          {study.organization && <span className="org">{study.organization}</span>}
        </div>
        {study.paperDOI && (
          <a
            className="study-card-doi"
            href={study.paperDOI}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {study.paperDOI.replace('https://doi.org/', 'DOI: ')}
          </a>
        )}
        <div className="study-card-count">
          {study.datasets.length} dataset{study.datasets.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
