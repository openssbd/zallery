import { useState } from 'react'
import type { Dataset } from '../data'
import Thumbnail from './Thumbnail'
import ViewerModal from './ViewerModal'

interface Props {
  dataset: Dataset
}

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}


function IconLoading() {
  return <div className="spinner tool-spinner" />
}

interface ZarrAxis {
  name: string
  type: string
  unit?: string
}

async function buildNeuroglancerUrl(filePath: string, datasetName: string): Promise<string> {
  const base = 'https://neuroglancer-demo.appspot.com/#!'

  try {
    const resp = await fetch(`${filePath}/.zattrs`)
    if (!resp.ok) throw new Error('fetch failed')
    const attrs = await resp.json()

    const multiscale = attrs.multiscales?.[0]
    const axes: ZarrAxis[] = multiscale?.axes ?? []
    const scaleArr: number[] = multiscale?.datasets?.[0]?.coordinateTransformations?.[0]?.scale ?? []

    const rawDimensions: Record<string, [number, string]> = {}
    axes.forEach((axis, i) => {
      if (axis.type === 'space') {
        const factor = axis.unit === 'micrometer' ? 1e-6
          : axis.unit === 'nanometer' ? 1e-9
          : 1
        rawDimensions[axis.name] = [factor * (scaleArr[i] ?? 1), 'm']
      }
    })

    // Order dimensions as x, y, z so neuroglancer's upper-left panel shows the XY plane.
    // Neuroglancer assigns panels based on dimension order in the dict:
    //   dims[0] & dims[1] → upper-left, dims[0] & dims[2] → upper-right, etc.
    const dimensions: Record<string, [number, string]> = {}
    for (const name of ['x', 'y', 'z']) {
      if (name in rawDimensions) dimensions[name] = rawDimensions[name]
    }
    for (const [k, v] of Object.entries(rawDimensions)) {
      if (!(k in dimensions)) dimensions[k] = v
    }

    const config: Record<string, unknown> = {
      layers: [{ type: 'image', source: `zarr://${filePath}`, name: datasetName }],
    }
    if (Object.keys(dimensions).length > 0) config.dimensions = dimensions

    return base + JSON.stringify(config)
  } catch {
    // Fallback: no dimension info
    const config = {
      layers: [{ type: 'image', source: `zarr://${filePath}`, name: datasetName }],
    }
    return base + JSON.stringify(config)
  }
}

const BASE = import.meta.env.BASE_URL

export default function DatasetCard({ dataset }: Props) {
  const [copied, setCopied] = useState(false)
  const [ngLoading, setNgLoading] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(dataset.filePath).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  const handleNeuroglancer = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (ngLoading) return
    setNgLoading(true)
    try {
      const url = await buildNeuroglancerUrl(dataset.filePath, dataset.dataset)
      window.open(url, '_blank', 'noopener,noreferrer')
    } finally {
      setNgLoading(false)
    }
  }

  const vizarrUrl = `https://hms-dbmi.github.io/vizarr/?source=${encodeURIComponent(dataset.filePath)}`
  const validatorUrl = `https://ome.github.io/ome-ngff-validator/?source=${encodeURIComponent(dataset.filePath)}`
  const voleUrl = `https://vole.allencell.org/viewer?url=${encodeURIComponent(dataset.filePath)}`

  return (
    <>
    <div className="dataset-card">
      <div
        className="dataset-thumb-wrap dataset-thumb-clickable"
        onClick={() => setViewerOpen(true)}
        title="Click to open viewer"
      >
        <Thumbnail filePath={dataset.filePath} fill />
        <div className="thumb-open-hint">▶ Open</div>
      </div>
      <div className="dataset-card-body">
        <div className="dataset-name">{dataset.dataset}</div>
        {dataset.title && (
          <div className="dataset-title">{dataset.title}</div>
        )}
        {dataset.imagingMethod && (
          <div className="dataset-imaging">{dataset.imagingMethod}</div>
        )}
        {dataset.organism && (
          <div className="dataset-meta">{dataset.organism}</div>
        )}
      </div>
      <div className="dataset-tools">
        <button className="tool-btn" onClick={handleCopy} title={copied ? 'Copied!' : 'Copy URL'}>
          <IconCopy />
        </button>
        <a
          className="tool-btn tool-btn-img"
          href={vizarrUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Vizarr"
        >
          <img src={`${BASE}vizarr.png`} alt="Vizarr" />
        </a>
        <button
          className="tool-btn tool-btn-img"
          onClick={handleNeuroglancer}
          disabled={ngLoading}
          title="Neuroglancer"
        >
          {ngLoading ? <IconLoading /> : <img src={`${BASE}neuroglancer.png`} alt="Neuroglancer" />}
        </button>
        <a
          className="tool-btn tool-btn-img"
          href={validatorUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="OME-NGFF-Validator"
        >
          <img src={`${BASE}ome-ngff-validator.png`} alt="OME-NGFF-Validator" />
        </a>
        <a
          className="tool-btn tool-btn-img"
          href={voleUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Vol-E"
        >
          <img src={`${BASE}vol-e.jpeg`} alt="Vol-E" />
        </a>
      </div>
    </div>
    {viewerOpen && (
      <ViewerModal
        filePath={dataset.filePath}
        datasetName={dataset.dataset}
        onClose={() => setViewerOpen(false)}
      />
    )}
    </>
  )
}
