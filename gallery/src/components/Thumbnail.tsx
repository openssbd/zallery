import { useEffect, useRef, useState } from 'react'
import { renderThumbnail } from 'ome-zarr.js'
import { getZarrGroupUrl } from '../data'

interface Props {
  filePath: string
  size?: number
  fill?: boolean
}

export default function Thumbnail({ filePath, size = 140, fill = false }: Props) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (!filePath) return

    loadedRef.current = false
    setSrc(null)
    setError(false)

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadedRef.current) {
          loadedRef.current = true
          setLoading(true)
          const url = getZarrGroupUrl(filePath)
          const targetSize = fill ? 256 : size
          renderThumbnail(url, targetSize, true)
            .then((dataUrl) => setSrc(dataUrl))
            .catch(() => setError(true))
            .finally(() => setLoading(false))
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )

    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [filePath, size, fill])

  const containerStyle = fill
    ? undefined
    : { width: size, height: size }

  return (
    <div
      ref={containerRef}
      className={`thumbnail-container${fill ? ' thumbnail-fill' : ''}`}
      style={containerStyle}
    >
      {src && <img src={src} alt="thumbnail" className="thumbnail-img" />}
      {loading && (
        <div className="thumbnail-placeholder">
          <div className="spinner" />
        </div>
      )}
      {!loading && !src && !error && (
        <div className="thumbnail-placeholder thumbnail-empty" />
      )}
      {error && (
        <div className="thumbnail-placeholder thumbnail-error">
          <span>No preview</span>
        </div>
      )}
    </div>
  )
}
