import { useEffect } from 'react'

export default function AlertModal({ packageId, onDismiss }) {
  useEffect(() => {
    const handle = (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [onDismiss])

  return (
    <div className="alert-overlay" role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
      <div className="alert-modal">
        <div className="alert-icon-wrap" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h2 id="alert-title" className="alert-title">Paquete ruteado detectado</h2>
        <p className="alert-package">{packageId}</p>
        <p className="alert-body">
          Este paquete está asignado a una ruta activa.<br />
          <strong>No debe ser ubicado en buffer.</strong>
        </p>
        <button className="alert-btn" onClick={onDismiss} autoFocus>
          Entendido — presiona Enter para continuar
        </button>
      </div>
    </div>
  )
}
