import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import StudyPage from './pages/StudyPage'
import { config } from './config'

export default function App() {
  useEffect(() => { document.title = config.siteTitle }, [])
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/study/:studyId" element={<StudyPage />} />
      </Routes>
    </HashRouter>
  )
}
