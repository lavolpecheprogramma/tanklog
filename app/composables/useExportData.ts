export type TankLogExportV2 = {
  version: 2
  exportedAt: string
  note: string
  tanks: unknown[]
  livestock: unknown[]
  parameter_ranges: unknown[]
  water_tests: unknown[]
  events: unknown[]
  reminders: unknown[]
  equipment: unknown[]
  photos: unknown[]
}

async function selectAll(table: string) {
  const client = useSupabaseClient()
  if (!client) throw new Error('Supabase is not configured')

  const { data, error } = await client.from(table).select('*')
  if (error) throw error
  return data ?? []
}

export function useExportData() {
  const busy = useState<boolean>('tanklog.export.busy', () => false)
  const error = useState<string | null>('tanklog.export.error', () => null)

  async function buildExport(): Promise<TankLogExportV2> {
    const [
      tanks,
      livestock,
      parameter_ranges,
      water_tests,
      events,
      reminders,
      equipment,
      photos
    ] = await Promise.all([
      selectAll('tanks'),
      selectAll('livestock'),
      selectAll('parameter_ranges'),
      selectAll('water_tests'),
      selectAll('events'),
      selectAll('reminders'),
      selectAll('equipment'),
      selectAll('photos')
    ])

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      note: 'Portable TankLog backup. Photo binaries are not included; see photos[].storage_path in your Supabase Storage bucket.',
      tanks,
      livestock,
      parameter_ranges,
      water_tests,
      events,
      reminders,
      equipment,
      photos
    }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  async function downloadJson() {
    busy.value = true
    error.value = null
    try {
      const payload = await buildExport()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const stamp = payload.exportedAt.slice(0, 10)
      triggerDownload(blob, `tanklog-export-${stamp}.json`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      busy.value = false
    }
  }

  function escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function buildHtmlSnapshot(payload: TankLogExportV2): string {
    const tanks = payload.tanks as Array<Record<string, unknown>>
    const reminders = payload.reminders as Array<Record<string, unknown>>
    const livestock = payload.livestock as Array<Record<string, unknown>>
    const equipment = payload.equipment as Array<Record<string, unknown>>
    const waterTests = payload.water_tests as Array<Record<string, unknown>>

    const tankBlocks = tanks.map((tank) => {
      const id = String(tank.id ?? '')
      const name = escapeHtml(tank.name ?? 'Tank')
      const tankReminders = reminders.filter(r => String(r.tank_id) === id).slice(0, 12)
      const tankLivestock = livestock.filter(l => String(l.tank_id) === id)
      const tankEquipment = equipment.filter(e => String(e.tank_id) === id)
      const tankTests = waterTests
        .filter(w => String(w.tank_id) === id)
        .sort((a, b) => String(b.measured_at).localeCompare(String(a.measured_at)))
        .slice(0, 20)

      return `
        <section>
          <h2>${name}</h2>
          <p class="meta">${escapeHtml(tank.type)} · ${escapeHtml(tank.volume_liters ?? '—')} L</p>
          <h3>Recent measurements</h3>
          <ul>
            ${tankTests.length
              ? tankTests.map(w => `<li>${escapeHtml(w.measured_at)} — ${escapeHtml(w.parameter)}: ${escapeHtml(w.value)} ${escapeHtml(w.unit)}</li>`).join('')
              : '<li>None</li>'}
          </ul>
          <h3>Reminders</h3>
          <ul>
            ${tankReminders.length
              ? tankReminders.map(r => `<li>${escapeHtml(r.title)} · due ${escapeHtml(r.next_due)}</li>`).join('')
              : '<li>None</li>'}
          </ul>
          <h3>Livestock (${tankLivestock.length})</h3>
          <ul>
            ${tankLivestock.length
              ? tankLivestock.map(l => `<li>${escapeHtml(l.name_common)} (${escapeHtml(l.status)})</li>`).join('')
              : '<li>None</li>'}
          </ul>
          <h3>Equipment (${tankEquipment.length})</h3>
          <ul>
            ${tankEquipment.length
              ? tankEquipment.map(e => `<li>${escapeHtml(e.type)} — ${escapeHtml(e.brand_model)}</li>`).join('')
              : '<li>None</li>'}
          </ul>
        </section>`
    }).join('\n')

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TankLog snapshot</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; color: #0f172a; background: #f8fafc; }
    h1, h2, h3 { color: #0e7490; }
    section { margin: 2rem 0; padding: 1.25rem; border: 1px solid #cbd5e1; border-radius: 12px; background: #fff; }
    .meta, .note { color: #64748b; font-size: 0.9rem; }
    ul { padding-left: 1.2rem; }
  </style>
</head>
<body>
  <h1>TankLog snapshot</h1>
  <p class="note">Exported ${escapeHtml(payload.exportedAt)}. Offline file — no live Supabase data. Photo binaries not included.</p>
  ${tankBlocks || '<p>No tanks.</p>'}
</body>
</html>`
  }

  async function downloadHtml() {
    busy.value = true
    error.value = null
    try {
      const payload = await buildExport()
      const html = buildHtmlSnapshot(payload)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const stamp = payload.exportedAt.slice(0, 10)
      triggerDownload(blob, `tanklog-snapshot-${stamp}.html`)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      busy.value = false
    }
  }

  return {
    busy,
    error,
    buildExport,
    downloadJson,
    downloadHtml
  }
}
