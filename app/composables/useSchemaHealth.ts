export type SchemaHealthStatus = 'unknown' | 'checking' | 'ok' | 'missing' | 'error'

export type SchemaHealthResult = {
  status: SchemaHealthStatus
  message: string | null
  checkedAt: number | null
}

const SCHEMA_SQL_URL = '/tanklog-schema.sql'

export function useSchemaHealth() {
  const status = useState<SchemaHealthStatus>('tanklog.schema.status', () => 'unknown')
  const message = useState<string | null>('tanklog.schema.message', () => null)
  const checkedAt = useState<number | null>('tanklog.schema.checkedAt', () => null)

  const isHealthy = computed(() => status.value === 'ok')
  const needsSetup = computed(() => status.value === 'missing' || status.value === 'error')

  async function check(options?: { force?: boolean }) {
    if (!options?.force && status.value === 'checking') return

    const auth = useAuth()
    if (!auth.isAuthenticated.value) {
      status.value = 'unknown'
      message.value = null
      return
    }

    const client = useSupabaseClient()
    if (!client) {
      status.value = 'error'
      message.value = 'Supabase is not configured'
      checkedAt.value = Date.now()
      return
    }

    status.value = 'checking'
    message.value = null

    const { error } = await client.from('tanks').select('id').limit(1)

    if (!error) {
      status.value = 'ok'
      message.value = null
      checkedAt.value = Date.now()
      return
    }

    const code = error.code || ''
    const text = error.message || String(error)
    const missing
      = code === '42P01'
        || code === 'PGRST205'
        || /relation .* does not exist/i.test(text)
        || /could not find the table/i.test(text)
        || /schema cache/i.test(text)

    status.value = missing ? 'missing' : 'error'
    message.value = text
    checkedAt.value = Date.now()
  }

  async function fetchSchemaSql(): Promise<string> {
    const res = await fetch(SCHEMA_SQL_URL)
    if (!res.ok) {
      throw new Error(`Failed to load schema.sql (${res.status})`)
    }
    return await res.text()
  }

  async function copySchemaSql(): Promise<void> {
    const sql = await fetchSchemaSql()
    await navigator.clipboard.writeText(sql)
  }

  return {
    status,
    message,
    checkedAt,
    isHealthy,
    needsSetup,
    schemaSqlUrl: SCHEMA_SQL_URL,
    check,
    fetchSchemaSql,
    copySchemaSql
  }
}
