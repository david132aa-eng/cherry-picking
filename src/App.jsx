import { useState } from 'react'
import Scanner from './components/Scanner'
import HistoryView from './components/HistoryView'
import ReinjectView from './components/ReinjectView'

export default function App() {
  const [view, setView] = useState('scanner')

  if (view === 'history') return <HistoryView onBack={() => setView('scanner')} />
  if (view === 'reinject') return <ReinjectView onBack={() => setView('scanner')} />

  return (
    <Scanner
      onShowHistory={() => setView('history')}
      onShowReinject={() => setView('reinject')}
    />
  )
}
