import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

type Profile = {
  id: number
  name: string
  object_name?: string | null
  direction: 'in' | 'out'
  tl_column_letter?: string | null
  status_filters: string[]
  is_active: boolean
}

type RunRow = {
  id: number
  tl_number_original?: string | null
  tl_number_normalized: string
  status: string
  file_row_number?: number | null
  booking_id?: number | null
  file_data?: Record<string, unknown> | null
  yms_data?: Record<string, unknown> | Record<string, unknown>[] | null
}

type ComparisonRun = {
  id: number
  profile_id: number
  profile_name?: string | null
  date_from: string
  date_to: string
  extended_date_from: string
  extended_date_to: string
  source_file_name: string
  status: string
  summary: Record<string, number>
  created_at?: string | null
  rows?: RunRow[]
}

type ExtraColumn = {
  key: string
  source: 'file' | 'yms'
  field: string
  label: string
}

const statusLabels: Record<string, string> = {
  matched: 'Совпало',
  found_in_yms_extended_period: 'Найдено в YMS в ±2 дня',
  missing_in_yms: 'Есть в файле, нет в YMS',
  missing_in_file: 'Есть в YMS, нет в файле',
  duplicate_in_file: 'Дубль в файле',
  duplicate_in_yms: 'Дубль в YMS',
  field_mismatch: 'Расхождение по полям',
  error: 'Ошибка',
}

const summaryOrder = [
  'file_rows',
  'unique_file_tl',
  'yms_rows',
  'matched',
  'found_in_yms_extended_period',
  'missing_in_yms',
  'missing_in_file',
  'duplicate_in_file',
  'duplicate_in_yms',
]

const summaryLabels: Record<string, string> = {
  file_rows: 'Строк в файле',
  unique_file_tl: 'Уникальных ТЛ в файле',
  yms_rows: 'Строк YMS в периоде',
  matched: 'Совпало',
  found_in_yms_extended_period: 'Найдено в ±2 дня',
  missing_in_yms: 'Есть в файле, нет в YMS',
  missing_in_file: 'Есть в YMS, нет в файле',
  duplicate_in_file: 'Дубли в файле',
  duplicate_in_yms: 'Дубли в YMS',
}

const todayYmd = () => new Date().toISOString().slice(0, 10)

const isPlainRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const extraColumnKey = (source: 'file' | 'yms', field: string) => `${source}:${field}`

const extraColumnLabel = (source: 'file' | 'yms', field: string) => `${source === 'file' ? 'Excel' : 'YMS'}: ${field}`

const collectExtraFields = (value: unknown, fields: Set<string>) => {
  if (Array.isArray(value)) {
    value.forEach(item => collectExtraFields(item, fields))
    return
  }
  if (!isPlainRecord(value)) return
  Object.keys(value).forEach(field => {
    if (!field || field === 'id' || field === 'transport_sheet') return
    fields.add(field)
  })
}

const buildAvailableExtraColumns = (rows: RunRow[]): ExtraColumn[] => {
  const fileFields = new Set<string>()
  const ymsFields = new Set<string>()
  rows.forEach(row => {
    collectExtraFields(row.file_data, fileFields)
    collectExtraFields(row.yms_data, ymsFields)
  })
  const columns: ExtraColumn[] = []
  Array.from(fileFields).sort((a, b) => a.localeCompare(b, 'ru')).forEach(field => {
    columns.push({ key: extraColumnKey('file', field), source: 'file', field, label: extraColumnLabel('file', field) })
  })
  Array.from(ymsFields).sort((a, b) => a.localeCompare(b, 'ru')).forEach(field => {
    columns.push({ key: extraColumnKey('yms', field), source: 'yms', field, label: extraColumnLabel('yms', field) })
  })
  return columns
}

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) {
    const parts = value.map(formatCellValue).filter(part => part !== '—')
    return parts.length ? parts.join(', ') : '—'
  }
  if (isPlainRecord(value)) return JSON.stringify(value)
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет'
  return String(value)
}

const valueFromExtraColumn = (row: RunRow, column: ExtraColumn): string => {
  const sourceData = column.source === 'file' ? row.file_data : row.yms_data
  if (Array.isArray(sourceData)) {
    return formatCellValue(sourceData.map(item => isPlainRecord(item) ? item[column.field] : undefined))
  }
  if (isPlainRecord(sourceData)) return formatCellValue(sourceData[column.field])
  return '—'
}

const DataComparisons: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const token = useMemo(() => localStorage.getItem('token'), [])
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [runs, setRuns] = useState<ComparisonRun[]>([])
  const [selectedRun, setSelectedRun] = useState<ComparisonRun | null>(null)
  const [profileId, setProfileId] = useState('')
  const [dateFrom, setDateFrom] = useState(todayYmd())
  const [dateTo, setDateTo] = useState(todayYmd())
  const [fileStartRow, setFileStartRow] = useState('2')
  const [fileEndRow, setFileEndRow] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedExtraColumns, setSelectedExtraColumns] = useState<string[]>([])

  const loadProfiles = async () => {
    const { data } = await axios.get<Profile[]>(`${API_BASE}/api/data-comparisons/profiles`, { headers })
    const activeProfiles = data.filter(profile => profile.is_active)
    setProfiles(activeProfiles)
    if (!profileId && activeProfiles.length > 0) setProfileId(String(activeProfiles[0].id))
  }

  const loadRuns = async () => {
    const { data } = await axios.get<ComparisonRun[]>(`${API_BASE}/api/data-comparisons/runs`, { headers })
    setRuns(data)
  }

  const loadInitial = async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([loadProfiles(), loadRuns()])
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка загрузки модуля сверок')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitRun = async (e: React.FormEvent) => {
    e.preventDefault()
    const startRow = Number(fileStartRow)
    const endRow = fileEndRow ? Number(fileEndRow) : null
    if (!profileId || !dateFrom || !dateTo || !file) {
      setError('Выберите профиль сверки, даты с/по и файл')
      return
    }
    if (!Number.isInteger(startRow) || startRow < 1 || (endRow !== null && (!Number.isInteger(endRow) || endRow < startRow))) {
      setError('Проверьте строки начала и окончания: окончание не может быть меньше начала')
      return
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const formData = new FormData()
      formData.append('profile_id', profileId)
      formData.append('date_from', dateFrom)
      formData.append('date_to', dateTo)
      formData.append('file_start_row', String(startRow))
      if (endRow !== null) formData.append('file_end_row', String(endRow))
      formData.append('file', file)
      const { data } = await axios.post<ComparisonRun>(`${API_BASE}/api/data-comparisons/runs`, formData, { headers })
      setSelectedRun(data)
      setSelectedExtraColumns([])
      setSuccess('Сверка завершена и сохранена в истории')
      await loadRuns()
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка запуска сверки')
    } finally {
      setLoading(false)
    }
  }

  const openRun = async (runId: number) => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.get<ComparisonRun>(`${API_BASE}/api/data-comparisons/runs/${runId}`, { headers })
      setSelectedRun(data)
      setStatusFilter('')
      setSelectedExtraColumns([])
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка открытия сверки')
    } finally {
      setLoading(false)
    }
  }

  const visibleRows = (selectedRun?.rows || []).filter(row => !statusFilter || row.status === statusFilter)
  const statuses = Array.from(new Set((selectedRun?.rows || []).map(row => row.status)))
  const availableExtraColumns = useMemo(
    () => buildAvailableExtraColumns(selectedRun?.rows || []),
    [selectedRun]
  )
  const activeExtraColumns = availableExtraColumns.filter(column => selectedExtraColumns.includes(column.key))
  const toggleExtraColumn = (columnKey: string) => {
    setSelectedExtraColumns(current => current.includes(columnKey)
      ? current.filter(key => key !== columnKey)
      : [...current, columnKey]
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        {onBack && <button className="secondary" onClick={onBack}>← Назад</button>}
        <div>
          <h1>Сверка данных</h1>
          <p className="muted">Выберите профиль сверки, период, строки файла и Excel-файл. Профили настраиваются в отдельном разделе «Профили сверки».</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <section className="card">
        <h2>Новая сверка</h2>
        <form onSubmit={submitRun} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 2fr auto', gap: 12, alignItems: 'end' }}>
          <label>
            Профиль сверки
            <select value={profileId} onChange={e => setProfileId(e.target.value)}>
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          </label>
          <label>
            Дата с
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </label>
          <label>
            Дата по
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </label>
          <label>
            Строка начала
            <input type="number" min="1" value={fileStartRow} onChange={e => setFileStartRow(e.target.value)} placeholder="2" />
          </label>
          <label>
            Строка окончания
            <input type="number" min="1" value={fileEndRow} onChange={e => setFileEndRow(e.target.value)} placeholder="пусто = до конца" />
          </label>
          <label>
            Файл Excel
            <input type="file" accept=".xlsx" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
          <button disabled={loading}>{loading ? '...' : 'Запустить'}</button>
        </form>
      </section>

      {selectedRun && (
        <section className="card">
          <h2>Результат сверки #{selectedRun.id}</h2>
          <p className="muted">
            {selectedRun.profile_name} · {selectedRun.date_from} — {selectedRun.date_to} · файл {selectedRun.source_file_name}. Доп. проверка: {selectedRun.extended_date_from} — {selectedRun.extended_date_to}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
            {summaryOrder.map(key => (
              <div key={key} className="stat-card">
                <div className="muted">{summaryLabels[key]}</div>
                <strong>{selectedRun.summary?.[key] ?? 0}</strong>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
            <label>
              Фильтр результата
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">Все статусы</option>
                {statuses.map(status => <option key={status} value={status}>{statusLabels[status] || status}</option>)}
              </select>
            </label>

            {availableExtraColumns.length > 0 && (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Дополнительные столбцы</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {availableExtraColumns.map(column => (
                    <label key={column.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #d0d5dd', borderRadius: 8, padding: '6px 10px' }}>
                      <input
                        type="checkbox"
                        checked={selectedExtraColumns.includes(column.key)}
                        onChange={() => toggleExtraColumn(column.key)}
                      />
                      {column.label}
                    </label>
                  ))}
                </div>
                <p className="muted" style={{ marginTop: 6 }}>Можно включить данные из сохранённой строки Excel и из найденной записи YMS прямо при просмотре отчёта.</p>
              </div>
            )}
          </div>

          <div className="table-wrapper" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Статус</th>
                  <th>Номер ТЛ</th>
                  <th>Строка файла</th>
                  <th>ID бронирования</th>
                  {activeExtraColumns.map(column => <th key={column.key}>{column.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => (
                  <tr key={row.id}>
                    <td>{statusLabels[row.status] || row.status}</td>
                    <td>{row.tl_number_normalized}</td>
                    <td>{row.file_row_number || '—'}</td>
                    <td>{row.booking_id || '—'}</td>
                    {activeExtraColumns.map(column => <td key={column.key}>{valueFromExtraColumn(row, column)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <h2>История сверок</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Дата запуска</th>
                <th>Профиль</th>
                <th>Период</th>
                <th>Файл</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {runs.map(run => (
                <tr key={run.id}>
                  <td>{run.created_at?.slice(0, 16).replace('T', ' ')}</td>
                  <td>{run.profile_name}</td>
                  <td>{run.date_from} — {run.date_to}</td>
                  <td>{run.source_file_name}</td>
                  <td>{run.status}</td>
                  <td><button className="secondary" onClick={() => openRun(run.id)}>Открыть</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default DataComparisons
