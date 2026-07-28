import { useState, useEffect, useRef } from 'react'
import FileLoader from './FileLoader'
import AlertModal from './AlertModal'
import { playSuccess, playAlarm } from '../services/audioService'
import { saveRecord, getRecords, downloadCsv, todayDateStr } from '../services/storageService'

const ROUTES_KEY = () => 'cp_routes_' + todayDateStr()

function loadTodayRoutes() {
  try {
    const raw = localStorage.getItem(ROUTES_KEY())
    if (raw) {
      const { ids, name } = JSON.parse(raw)
      return { packages: new Set(ids), fileName: name }
    }
  } catch {}
  return null
}

function saveTodayRoutes(ids, name) {
  localStorage.setItem(ROUTES_KEY(), JSON.stringify({ ids: [...ids], name }))
}

function getInitialRouteState() {
  const saved = loadTodayRoutes()
  return saved
    ? { packages: saved.packages, fileName: saved.fileName }
    : { packages: null, fileName: '' }
}

export default function Scanner({ onShowHistory }) {
  const [{ packages: routedPackages, fileName: routedFileName }, setRouteState] = useState(getInitialRouteState)
  const [inputVal, setInputVal] = useState('')
  const [alertPackage, setAlertPackage] = useState(null)
  const [scans, setScans] = useState([])
  const [sessionId] = useState('S-' + Date.now().toString(36).toUpperCase())
  const inputRef = useRef()

  useEffect(() => {
    if (routedPackages && !alertPackage) {
      inputRef.current?.focus()
    }
  }, [routedPackages, alertPackage])

  const handleLoad = (ids, name) => {
    saveTodayRoutes(ids, name)
    setRouteState({ packages: ids, fileName: name })
    setScans([])
  }

  const handleClearRoutes = () => {
    localStorage.removeItem(ROUTES_KEY())
    setRouteState({ packages: null, fileName: '' })
    setScans([])
  }

  const processScan = (id) => {
    if (!id) return
    const isRouted = routedPackages.has(id)
    const record = {
      ts: new Date().toISOString(),
      id,
      status: isRouted ? 'RUTEADO-ALERTA' : 'BUFFERED',
      session: sessionId,
    }
    saveRecord(record)
    setScans(prev => [record, ...prev].slice(0, 100))
    if (isRouted) {
      playAlarm()
      setAlertPackage(id)
    } else {
      playSuccess()
    }
  }

  const handleChange = (e) => {
    const val = e.target.value
    // biper sends ID + whitespace (space, tab, newline) as terminator
    if (/\s$/.test(val)) {
      const id = val.trim().toUpperCase()
      setInputVal('')
      if (id) processScan(id)
    } else {
      setInputVal(val)
    }
  }

  const handleScan = (e) => {
    e.preventDefault()
    const id = inputVal.trim().toUpperCase()
    if (!id) return
    setInputVal('')
    processScan(id)
  }

  const handleDismissAlert = () => {
    setAlertPackage(null)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleDownload = () => {
    const today = todayDateStr()
    downloadCsv(getRecords(today), `cherry-picking-${today}.csv`)
  }

  const buffered = scans.filter(s => s.status === 'BUFFERED').length
  const alerts = scans.filter(s => s.status === 'RUTEADO-ALERTA').length

  return (
    <div className="scanner-wrap">
      <div className="app-header">
        <div className="header-left">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="var(--red-vivid)"/>
            <text x="12" y="17" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="system-ui">CP</text>
          </svg>
          <div>
            <div className="app-title">Cherry Picking</div>
            {routedPackages
              ? <div className="app-sub">{routedFileName} · {routedPackages.size} ruteados</div>
              : <div className="app-sub">Carga la base de ruteados para comenzar</div>
            }
          </div>
        </div>
        <div className="header-right">
          {scans.length > 0 && (
            <button className="btn-link" onClick={handleDownload}>
              Descargar CSV
            </button>
          )}
          <button className="btn-icon" onClick={onShowHistory} title="Ver historial">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
          {routedPackages && (
            <button className="btn-icon" title="Cambiar base de ruteados" onClick={handleClearRoutes}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {!routedPackages ? (
        <div className="scanner-main">
          <div className="scan-card">
            <p className="scan-label" style={{ marginBottom: '1rem', fontSize: '14px' }}>
              Carga la base de paquetes ruteados para comenzar a escanear
            </p>
            <FileLoader onLoad={handleLoad} />
          </div>
        </div>
      ) : (
        <div className="scanner-main">
          <div className="scan-card">
            <label className="scan-label">Escanea o escribe el ID del paquete</label>
            <form onSubmit={handleScan}>
              <input
                ref={inputRef}
                className={`scan-input${alertPackage ? ' scan-input--blocked' : ''}`}
                value={inputVal}
                onChange={handleChange}
                placeholder="ID del paquete..."
                disabled={!!alertPackage}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </form>
            <p className="scan-hint">
              Bipa el paquete · el biper registra automáticamente · {routedPackages.size} ruteados cargados
            </p>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-num">{scans.length}</span>
              <span className="stat-lbl">Total bipeados</span>
            </div>
            <div className="stat-card">
              <span className="stat-num stat-green">{buffered}</span>
              <span className="stat-lbl">Buffered</span>
            </div>
            <div className="stat-card">
              <span className="stat-num stat-red">{alerts}</span>
              <span className="stat-lbl">Alertas</span>
            </div>
          </div>

          {scans.length > 0 && (
            <div className="history">
              <div className="history-header">Últimos bipes — sesión actual</div>
              {scans.map((s, i) => (
                <div key={i} className={`history-row${s.status === 'RUTEADO-ALERTA' ? ' history-row--ruteado' : ''}`}>
                  <span className="history-id">{s.id}</span>
                  <span className="history-meta">
                    {new Date(s.ts).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {s.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="session-id">Sesión: {sessionId}</div>
        </div>
      )}

      {alertPackage && (
        <AlertModal packageId={alertPackage} onDismiss={handleDismissAlert} />
      )}
    </div>
  )
}
