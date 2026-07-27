import { useState, useRef, useEffect, useCallback } from 'react'
import { registerPackage, getOutputSheetUrl } from '../services/sheetsService'
import { playSuccess, playAlarm } from '../services/audioService'
import AlertModal from './AlertModal'

function generateSessionId() {
  return `S-${Date.now().toString(36).toUpperCase()}`
}

export default function Scanner({ user, accessToken, routedPackages, loadingRoutes, routesError, onSignOut, onRefreshRoutes }) {
  const [input, setInput] = useState('')
  const [scanned, setScanned] = useState([])
  const [alertPackage, setAlertPackage] = useState(null)
  const [outputUrl, setOutputUrl] = useState(getOutputSheetUrl)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const sessionId = useRef(generateSessionId())
  const inputRef = useRef(null)

  useEffect(() => {
    if (!alertPackage) inputRef.current?.focus()
  }, [alertPackage])

  const handleScan = useCallback(async (rawId) => {
    const id = rawId.trim().toUpperCase()
    if (!id) return

    const isRouted = routedPackages.has(id)
    const time = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    const status = isRouted ? 'RUTEADO' : 'BUFFERED'

    if (isRouted) {
      playAlarm()
      setAlertPackage(id)
    } else {
      playSuccess()
      setInput('')
    }

    setScanned(prev => [{ id, status, time }, ...prev].slice(0, 100))

    setSaveError(null)
    setSaving(true)
    try {
      const sheetId = await registerPackage(
        accessToken,
        id,
        user.email,
        isRouted ? 'RUTEADO-ALERTA' : 'BUFFERED',
        sessionId.current,
      )
      setOutputUrl(`https://docs.google.com/spreadsheets/d/${sheetId}`)
    } catch (err) {
      setSaveError(err.status === 401 ? 'Sesión vencida — recarga la página' : 'Error al guardar en Sheet')
    } finally {
      setSaving(false)
    }
  }, [routedPackages, accessToken, user.email])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleScan(input)
  }

  const handleDismiss = () => {
    setAlertPackage(null)
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const buffered = scanned.filter(s => s.status === 'BUFFERED').length
  const alerts = scanned.filter(s => s.status === 'RUTEADO').length

  return (
    <div className="scanner-wrap">
      <header className="app-header">
        <div className="header-left">
          <div className="app-logo" aria-hidden="true">
            <svg viewBox="0 0 28 28" width="28" height="28">
              <rect width="28" height="28" rx="8" fill="#d85a30"/>
              <path d="M7 14h14M14 7v14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <rect x="5" y="5" width="8" height="8" rx="1.5" fill="none" stroke="white" strokeWidth="1.2"/>
              <rect x="15" y="15" width="8" height="8" rx="1.5" fill="none" stroke="white" strokeWidth="1.2"/>
            </svg>
          </div>
          <div>
            <h1 className="app-title">Cherry Picking</h1>
            <p className="app-sub">
              {loadingRoutes
                ? 'Cargando ruteados...'
                : routesError
                  ? 'Error al cargar ruteados'
                  : `${routedPackages.size.toLocaleString('es-CO')} ruteados cargados`}
            </p>
          </div>
        </div>
        <div className="header-right">
          {outputUrl && (
            <a href={outputUrl} target="_blank" rel="noopener noreferrer" className="btn-link">
              Ver Sheet
            </a>
          )}
          <button onClick={onRefreshRoutes} className="btn-icon" title="Recargar ruteados" aria-label="Recargar lista de ruteados">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3.5 10A6.5 6.5 0 1010 16.5H10"/>
              <path d="M3.5 6.5V10H7"/>
            </svg>
          </button>
          {user.photoURL && (
            <img src={user.photoURL} alt="" className="user-avatar" title={user.email} />
          )}
          <button onClick={onSignOut} className="btn-signout">Salir</button>
        </div>
      </header>

      {routesError && (
        <div className="banner-error" role="alert">
          No se pudo cargar la base de ruteados: {routesError}. Los paquetes no se validarán correctamente.
        </div>
      )}

      <main className="scanner-main">
        <div className="scan-card">
          <label className="scan-label" htmlFor="scan-input">Escanear o digitar ID de paquete</label>
          <input
            ref={inputRef}
            id="scan-input"
            className={`scan-input${alertPackage ? ' scan-input--blocked' : ''}`}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bipa o digita el ID y presiona Enter..."
            disabled={!!alertPackage || loadingRoutes}
            autoComplete="off"
            spellCheck="false"
          />
          <p className="scan-hint">
            {saving
              ? 'Guardando en Sheet...'
              : saveError
                ? saveError
                : 'Presiona Enter o bipa para validar'}
          </p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-num stat-green">{buffered}</span>
            <span className="stat-lbl">Buffereados</span>
          </div>
          <div className="stat-card">
            <span className="stat-num stat-red">{alerts}</span>
            <span className="stat-lbl">Alertas</span>
          </div>
          <div className="stat-card">
            <span className="stat-num">{scanned.length}</span>
            <span className="stat-lbl">Total bipeados</span>
          </div>
        </div>

        {scanned.length > 0 && (
          <div className="history">
            <div className="history-header">Últimos escaneados</div>
            {scanned.map((item, i) => (
              <div key={i} className={`history-row history-row--${item.status.toLowerCase()}`}>
                <span className="history-id">{item.id}</span>
                <span className="history-meta">
                  {item.time} · {item.status === 'BUFFERED' ? 'buffereado ✓' : '⚠ RUTEADO'}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="session-id">Sesión: {sessionId.current}</p>
      </main>

      {alertPackage && <AlertModal packageId={alertPackage} onDismiss={handleDismiss} />}
    </div>
  )
}
