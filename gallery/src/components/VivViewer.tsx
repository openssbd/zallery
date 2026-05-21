import { useEffect, useState } from 'react'
import DeckGL from '@deck.gl/react'
import { OrthographicView, OrbitView } from '@deck.gl/core'
import {
  MultiscaleImageLayer,
  VolumeLayer,
  ColorPaletteExtension,
  ColorPalette3DExtensions,
} from '@hms-dbmi/viv'
import { loadOmeZarr, getChannelStats } from '@vivjs/loaders'

type Color3 = [number, number, number]
type Contrast = [number, number]

const CH_COLORS: Color3[] = [
  [255, 255, 255],
  [0, 160, 255],
  [0, 255, 160],
  [255, 160, 0],
  [255, 0, 160],
  [255, 255, 0],
]

function dtypeMax(dtype: string): number {
  if (/uint8|u1\b/.test(dtype)) return 255
  if (/uint32|u4\b/.test(dtype)) return 4294967295
  if (/float/.test(dtype)) return 1
  return 65535
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dimOf(src: any, name: string): number {
  const i = (src.labels as string[]).indexOf(name)
  return i >= 0 ? (src.shape as number[])[i] : 1
}

/** Extract physical voxel size from OME-Zarr .zattrs metadata. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function physicalScaleFromMetadata(metadata: any): { x: number; y: number; z: number } | null {
  try {
    const multiscale = metadata?.multiscales?.[0]
    if (!multiscale) return null

    const axes: { name: string; type: string }[] = multiscale.axes ?? []
    const localT: { type: string; scale?: number[] }[] =
      multiscale.datasets?.[0]?.coordinateTransformations ?? []
    const globalT: { type: string; scale?: number[] }[] =
      multiscale.coordinateTransformations ?? []

    const local = localT.find(t => t.type === 'scale')?.scale ?? []
    const global = globalT.find(t => t.type === 'scale')?.scale ?? []
    if (local.length === 0) return null

    const combined = local.map((v, i) => v * (global[i] ?? 1))
    const byName: Record<string, number> = {}
    axes.forEach((ax, i) => { if (ax.type === 'space') byName[ax.name] = combined[i] ?? 1 })

    const x = byName['x'], y = byName['y'], z = byName['z']
    if (!x || !y) return null
    return { x, y, z: z ?? x }
  } catch { return null }
}

interface ZarrInfo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loader: any[]
  sizeZ: number
  sizeT: number
  sizeC: number
  width: number
  height: number
  hasZ: boolean
  hasT: boolean
  dtype: string
  autoContrast: Contrast[]
  resolution3D: number
  physicalScale: { x: number; y: number; z: number } | null
}

interface Props {
  filePath: string
  datasetName: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadStats(loader: any[], sizeC: number, hasZ: boolean): Promise<Contrast[]> {
  const lowSrc = loader[loader.length - 1]
  const midZ = hasZ ? Math.floor(dimOf(lowSrc, 'z') / 2) : 0
  return Promise.all(
    Array.from({ length: sizeC }, async (_, c) => {
      try {
        const sel: Record<string, number> = { c }
        if (hasZ) sel.z = midZ
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await lowSrc.getRaster({ selection: sel }) as { data: any }
        const stats = getChannelStats(data.slice())
        const [lo, hi] = stats.contrastLimits as [number, number]
        return hi > lo ? [lo, hi] as Contrast : stats.domain as Contrast
      } catch { return [0, dtypeMax('uint16')] as Contrast }
    })
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickResolution3D(loader: any[]): number {
  const TARGET = 512
  let best = loader.length - 1, bestDist = Infinity
  for (let i = 0; i < loader.length; i++) {
    const dist = Math.abs(Math.max(dimOf(loader[i], 'x'), dimOf(loader[i], 'y')) - TARGET)
    if (dist < bestDist) { bestDist = dist; best = i }
  }
  return best
}

export default function VivViewer({ filePath }: Props) {
  const [info, setInfo] = useState<ZarrInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [is3D, setIs3D] = useState(false)
  const [z, setZ] = useState(0)
  const [t, setT] = useState(0)
  const [brightness, setBrightness] = useState(1.0)
  // clip: fraction of signal range clipped from below (cuts black background in 3D)
  const [clip, setClip] = useState(0.0)

  useEffect(() => {
    setLoading(true); setLoadError(null); setInfo(null); setIs3D(false)
    setBrightness(1.0); setClip(0.0)

    loadOmeZarr(filePath, { type: 'multiscales' })
      .then(async ({ data, metadata }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const src0 = data[0] as any
        const getSize = (n: string) => dimOf(src0, n)

        const sizeZ = getSize('z')
        const sizeT = getSize('t')
        const sizeC = getSize('c')
        const hasZ = (src0.labels as string[]).includes('z') && sizeZ > 1
        const hasT = (src0.labels as string[]).includes('t') && sizeT > 1
        const dtype: string = src0.dtype ?? '<u2'
        const resolution3D = pickResolution3D(data)
        const physicalScale = physicalScaleFromMetadata(metadata)

        const autoContrast = await loadStats(data, sizeC, hasZ)

        setInfo({
          loader: data, sizeZ, sizeT, sizeC,
          width: getSize('x'), height: getSize('y'),
          hasZ, hasT, dtype, autoContrast, resolution3D, physicalScale,
        })
        setZ(hasZ ? Math.floor(sizeZ / 2) : 0)
      })
      .catch((e) => setLoadError(String(e)))
      .finally(() => setLoading(false))
  }, [filePath])

  if (loading) return (
    <div className="viv-center">
      <div className="spinner large" /><span className="viv-hint">Loading…</span>
    </div>
  )
  if (loadError) return (
    <div className="viv-center viv-error">
      <p>Failed to load OME-Zarr</p><code>{loadError}</code>
    </div>
  )
  if (!info) return null

  const { loader, sizeC, sizeZ, sizeT, hasZ, hasT, autoContrast, resolution3D, physicalScale } = info

  // ── Physical scale → model matrix ───────────────────────────────────────
  const src3D = loader[resolution3D]
  const w3D = dimOf(src3D, 'x')

  // Physical size per voxel at resolution3D level (x/y downsampled, z usually not)
  const downscale = info.width > 0 ? info.width / w3D : 1
  let yScale = 1, zScale = 1
  if (physicalScale) {
    const physX = physicalScale.x * downscale
    yScale = (physicalScale.y * downscale) / physX   // ≈1 for isotropic xy
    zScale = physicalScale.z / physX                  // >1 for coarser z spacing
  }

  // Column-major 4×4 diagonal scale matrix
  const modelMatrix: number[] = [
    1,      0,      0,      0,
    0,      yScale, 0,      0,
    0,      0,      zScale, 0,
    0,      0,      0,      1,
  ]

  // ── Contrast ────────────────────────────────────────────────────────────
  const colors: Color3[] = Array.from({ length: sizeC }, (_, i) =>
    sizeC === 1 ? [255, 255, 255] : CH_COLORS[(i + 1) % CH_COLORS.length]
  ) as Color3[]

  const contrastLimits: Contrast[] = autoContrast.map(([lo, hi]) => {
    const clipped = lo + clip * (hi - lo)   // raise lower bound by clip fraction
    return [clipped, Math.max(clipped + 1, hi * brightness)] as Contrast
  })

  // ── Selections ──────────────────────────────────────────────────────────
  const sel2D = Array.from({ length: sizeC }, (_, c) => ({ t: hasT ? t : 0, z: hasZ ? z : 0, c }))
  const sel3D = Array.from({ length: sizeC }, (_, c) => ({ t: hasT ? t : 0, c }))

  // ── Layers ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layers: any[] = is3D
    ? [new VolumeLayer({
        id: 'volume', loader, selections: sel3D,
        channelsVisible: Array(sizeC).fill(true),
        contrastLimits, colors,
        resolution: resolution3D,
        modelMatrix,
        useProgressIndicator: false,
        extensions: [new ColorPalette3DExtensions.AdditiveBlendExtension({})],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)]
    : [new MultiscaleImageLayer({
        id: 'image', loader, selections: sel2D,
        channelsVisible: Array(sizeC).fill(true),
        contrastLimits, colors,
        extensions: [new ColorPaletteExtension()],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)]

  // ── View state ──────────────────────────────────────────────────────────
  // VolumeLayer applies resolutionMatrix=scale(2^resolution) internally, so world-space
  // extent is info.width × info.height × sizeZ (not the resolution-level w3D/h3D/d3D).
  const target3D: [number, number, number] = [
    info.width / 2,
    (info.height / 2) * yScale,
    (sizeZ / 2) * zScale,
  ]

  // Fit XY footprint to ~480px; use full-res dimensions to match VolumeLayer world space
  const zoom3D = Math.log2(480 / Math.max(info.width, info.height * yScale))

  const initState2D = {
    target: [info.width / 2, info.height / 2, 0] as [number, number, number],
    zoom: Math.log2(400 / Math.max(info.width, info.height)),
  }
  const initState3D = {
    target: target3D,
    zoom: zoom3D,
    rotationX: 30,
    rotationOrbit: 0,
    orbitAxis: 'Y' as const,
  }

  // ── Hint ─────────────────────────────────────────────────────────────
  const scaleHint = physicalScale ? ` · z×${zScale.toFixed(1)}` : ''

  return (
    <div className="viv-wrap">
      <DeckGL
        key={is3D ? '3d' : '2d'}
        views={is3D
          ? new OrbitView({ id: 'orbit', controller: true })
          : new OrthographicView({ id: 'ortho', controller: true })
        }
        initialViewState={is3D ? initState3D : initState2D}
        layers={layers}
        controller
      />
      <div className="viv-controls">
        {hasZ && (
          <button className="viv-btn viv-mode-btn" onClick={() => setIs3D(v => !v)}>
            {is3D ? '2D' : '3D'}
          </button>
        )}
        {hasZ && !is3D && (
          <div className="viv-slider-row">
            <span className="viv-axis-label">Z</span>
            <input type="range" min={0} max={sizeZ - 1} value={z}
              onChange={e => setZ(+e.target.value)} />
            <span className="viv-axis-val">{z + 1}/{sizeZ}</span>
          </div>
        )}
        {hasT && (
          <div className="viv-slider-row">
            <span className="viv-axis-label">T</span>
            <input type="range" min={0} max={sizeT - 1} value={t}
              onChange={e => setT(+e.target.value)} />
            <span className="viv-axis-val">{t + 1}/{sizeT}</span>
          </div>
        )}
        <div className="viv-slider-row">
          <span className="viv-axis-label">Clip</span>
          <input type="range" min={0} max={0.99} step={0.01} value={clip}
            onChange={e => setClip(+e.target.value)} />
          <span className="viv-axis-val">{Math.round(clip * 100)}%</span>
        </div>
        <div className="viv-slider-row">
          <span className="viv-axis-label">Bright</span>
          <input type="range" min={0.1} max={4} step={0.05} value={brightness}
            onChange={e => setBrightness(+e.target.value)} />
          <span className="viv-axis-val">{brightness.toFixed(2)}×</span>
        </div>
        {is3D && (
          <span className="viv-hint">drag=rotate · scroll=zoom{scaleHint}</span>
        )}
      </div>
    </div>
  )
}
