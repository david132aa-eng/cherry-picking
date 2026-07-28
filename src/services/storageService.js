const PREFIX = 'cp_records_'

function localDateKey() {
  const d = new Date()
  return PREFIX + `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function saveRecord(record) {
  const key = localDateKey()
  const existing = JSON.parse(localStorage.getItem(key) || '[]')
  existing.push(record)
  localStorage.setItem(key, JSON.stringify(existing))
}

export function getRecords(date) {
  return JSON.parse(localStorage.getItem(PREFIX + date) || '[]')
}

export function getAllDates() {
  return Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .map(k => k.slice(PREFIX.length))
    .sort((a, b) => b.localeCompare(a))
}

export function todayDateStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function downloadCsv(records, filename) {
  const header = 'Timestamp,Shipment ID,Estado,Sesión'
  const rows = records.map(r =>
    [r.ts, r.id, r.status, r.session].map(v => `"${v}"`).join(',')
  )
  const csv = [header, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
