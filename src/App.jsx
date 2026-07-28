import { useState } from 'react'
import Scanner from './components/Scanner'
import HistoryView from './components/HistoryView'

export default function App() {
  const [view, setView] = useState('scanner')

  if (view === 'history') {
    return <HistoryView onBack={() => setView('scanner')} />
  }

  return <Scanner onShowHistory={() => setView('history')} />
}
