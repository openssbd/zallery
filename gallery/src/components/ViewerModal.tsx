import { useEffect } from 'react'
import VivViewer from './VivViewer'

interface Props {
  filePath: string
  datasetName: string
  onClose: () => void
}

export default function ViewerModal({ filePath, datasetName, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{datasetName}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          <VivViewer filePath={filePath} datasetName={datasetName} />
        </div>
      </div>
    </div>
  )
}
