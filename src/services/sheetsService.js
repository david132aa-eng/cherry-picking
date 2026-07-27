const SOURCE_ID = '1QA0iv_JUBcT_cUkB7HmMVJR5Pp5x0tH1VqQxObIC06k'
const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const OUTPUT_KEY = 'cp_output_sheet_id'

async function req(url, token, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  })
  if (!res.ok) {
    const err = new Error(`Sheets API error ${res.status}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

export async function loadRoutedPackages(token) {
  const range = encodeURIComponent('Detalle!E2:E')
  const data = await req(`${BASE}/${SOURCE_ID}/values/${range}`, token)
  if (!data.values) return []
  return data.values
    .flat()
    .map(v => String(v).trim().toUpperCase())
    .filter(Boolean)
}

async function ensureOutputSheet(token) {
  const stored = localStorage.getItem(OUTPUT_KEY)
  if (stored) return stored

  const sheet = await req(BASE, token, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: 'Cherry Picking - Buffered' },
      sheets: [{ properties: { title: 'Registros' } }],
    }),
  })

  const id = sheet.spreadsheetId
  localStorage.setItem(OUTPUT_KEY, id)

  // Write header row
  const headerRange = encodeURIComponent('Registros!A1:E1')
  await req(
    `${BASE}/${id}/values/${headerRange}:append?valueInputOption=RAW`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [['Timestamp', 'Shipment ID', 'Operador', 'Estado', 'Sesión']],
      }),
    },
  )

  return id
}

export async function registerPackage(token, shipmentId, userEmail, status, sessionId) {
  const sheetId = await ensureOutputSheet(token)

  const ts = new Date().toLocaleString('es-CO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })

  const range = encodeURIComponent('Registros!A:E')
  await req(
    `${BASE}/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [[ts, shipmentId.trim().toUpperCase(), userEmail, status, sessionId]],
      }),
    },
  )

  return sheetId
}

export function getOutputSheetUrl() {
  const id = localStorage.getItem(OUTPUT_KEY)
  return id ? `https://docs.google.com/spreadsheets/d/${id}` : null
}

export function clearOutputSheetCache() {
  localStorage.removeItem(OUTPUT_KEY)
}
