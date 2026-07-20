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
  fields: string[]
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

const myBookingExtraColumns: ExtraColumn[] = [
  { key: 'booking_date', fields: ['booking_date'], label: 'Дата' },
  { key: 'booking_time', fields: ['start_time', 'end_time'], label: 'Время' },
  { key: 'dock_name', fields: ['dock_name'], label: 'Док' },
  { key: 'object_name', fields: ['object_name'], label: 'Объект' },
  { key: 'vehicle_type_name', fields: ['vehicle_type_name'], label: 'Тип ТС' },
  { key: 'supplier_name', fields: ['supplier_name'], label: 'Поставщик' },
  { key: 'zone_name', fields: ['zone_name'], label: 'Зона' },
  { key: 'transport_type_name', fields: ['transport_type_name'], label: 'Тип перевозки' },
  { key: 'cubes', fields: ['cubes'], label: 'Кубы' },
  { key: 'status', fields: ['status'], label: 'Статус YMS' },
  { key: 'user_full_name', fields: ['user_full_name', 'user_email', 'user_login'], label: 'Пользователь' },
]

const ymsRecordsFromRow = (row: RunRow): Record<string, unknown>[] => {
  if (Array.isArray(row.yms_data)) return row.yms_data.filter(isPlainRecord)
  if (isPlainRecord(row.yms_data)) return [row.yms_data]
  return []
}

const buildAvailableExtraColumns = (rows: RunRow[]): ExtraColumn[] => (
  myBookingExtraColumns.filter(column => rows.some(row => (
    ymsRecordsFromRow(row).some(record => column.fields.some(field => record[field] !== null && record[field] !== undefined && record[field] !== ''))
  )))
)

const buildAvailableFileColumns = (rows: RunRow[]): ExtraColumn[] => {
  const seen = new Set<string>()
  const columns: ExtraColumn[] = []
  rows.forEach(row => {
    if (!isPlainRecord(row.file_data)) return
    Object.keys(row.file_data).forEach(field => {
      const value = row.file_data?.[field]
      if (seen.has(field) || value === null || value === undefined || value === '') return
      seen.add(field)
      columns.push({ key: field, fields: [field], label: field })
    })
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

const valueFromRecord = (record: Record<string, unknown>, column: ExtraColumn): string => {
  if (column.key === 'booking_time') {
    const start = formatCellValue(record.start_time).slice(0, 5)
    const end = formatCellValue(record.end_time).slice(0, 5)
    if (start === '—' && end === '—') return '—'
    return `${start}${end !== '—' ? ` - ${end}` : ''}`
  }
  if (column.key === 'status') return statusLabels[String(record.status || '')] || formatCellValue(record.status)
  const value = column.fields.map(field => record[field]).find(fieldValue => fieldValue !== null && fieldValue !== undefined && fieldValue !== '')
  return formatCellValue(value)
}

const valueFromExtraColumn = (row: RunRow, column: ExtraColumn): string => {
  const records = ymsRecordsFromRow(row)
  if (records.length === 0) return '—'
  return formatCellValue(records.map(record => valueFromRecord(record, column)))
}

const valueFromFileColumn = (row: RunRow, column: ExtraColumn): string => {
  if (!isPlainRecord(row.file_data)) return '—'
  return formatCellValue(row.file_data[column.key])
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
  const [selectedYmsColumns, setSelectedYmsColumns] = useState<string[]>([])
  const [selectedFileColumns, setSelectedFileColumns] = useState<string[]>([])
  const [ymsColumnsDropdownOpen, setYmsColumnsDropdownOpen] = useState(false)
  const [fileColumnsDropdownOpen, setFileColumnsDropdownOpen] = useState(false)

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
      setSelectedYmsColumns([])
      setSelectedFileColumns([])
      setYmsColumnsDropdownOpen(false)
      setFileColumnsDropdownOpen(false)
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
      setSelectedYmsColumns([])
      setSelectedFileColumns([])
      setYmsColumnsDropdownOpen(false)
      setFileColumnsDropdownOpen(false)
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка открытия сверки')
    } finally {
      setLoading(false)
    }
  }

  const visibleRows = (selectedRun?.rows || []).filter(row => !statusFilter || row.status === statusFilter)
  const statuses = Array.from(new Set((selectedRun?.rows || []).map(row => row.status)))
  const availableYmsColumns = useMemo(
    () => buildAvailableExtraColumns(selectedRun?.rows || []),
    [selectedRun]
  )
  const availableFileColumns = useMemo(
    () => buildAvailableFileColumns(selectedRun?.rows || []),
    [selectedRun]
  )
  const activeYmsColumns = availableYmsColumns.filter(column => selectedYmsColumns.includes(column.key))
  const activeFileColumns = availableFileColumns.filter(column => selectedFileColumns.includes(column.key))
  const toggleYmsColumn = (columnKey: string) => {
    setSelectedYmsColumns(current => current.includes(columnKey)
      ? current.filter(key => key !== columnKey)
      : [...current, columnKey]
    )
  }
  const toggleFileColumn = (columnKey: string) => {
    setSelectedFileColumns(current => current.includes(columnKey)
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

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {availableYmsColumns.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setYmsColumnsDropdownOpen(open => !open)}
                  >
                    Столбцы YMS{selectedYmsColumns.length > 0 ? ` (${selectedYmsColumns.length})` : ''}
                  </button>
                  {ymsColumnsDropdownOpen && (
                    <div style={{ position: 'absolute', zIndex: 5, marginTop: 6, background: '#fff', border: '1px solid #d0d5dd', borderRadius: 8, padding: 10, boxShadow: '0 12px 24px rgba(15, 23, 42, 0.12)', minWidth: 240, maxHeight: 320, overflowY: 'auto' }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Столбцы YMS</div>
                      {availableYmsColumns.map(column => (
                        <label key={column.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                          <input
                            type="checkbox"
                            checked={selectedYmsColumns.includes(column.key)}
                            onChange={() => toggleYmsColumn(column.key)}
                          />
                          {column.label}
                        </label>
                      ))}
                      <p className="muted" style={{ marginTop: 8 }}>Доступны только поля, которые используются в таблице «Мои бронирования».</p>
                    </div>
                  )}
                </div>
              )}

              {availableFileColumns.length > 0 && (
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setFileColumnsDropdownOpen(open => !open)}
                  >
                    Столбцы из файла{selectedFileColumns.length > 0 ? ` (${selectedFileColumns.length})` : ''}
                  </button>
                  {fileColumnsDropdownOpen && (
                    <div style={{ position: 'absolute', zIndex: 5, marginTop: 6, background: '#fff', border: '1px solid #d0d5dd', borderRadius: 8, padding: 10, boxShadow: '0 12px 24px rgba(15, 23, 42, 0.12)', minWidth: 240, maxHeight: 320, overflowY: 'auto' }}>
                      <div style={{ fontWeight: 600, marginBottom: 8 }}>Столбцы из файла</div>
                      {availableFileColumns.map(column => (
                        <label key={column.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                          <input
                            type="checkbox"
                            checked={selectedFileColumns.includes(column.key)}
                            onChange={() => toggleFileColumn(column.key)}
                          />
                          {column.label}
                        </label>
                      ))}
                      <p className="muted" style={{ marginTop: 8 }}>Показываются сохранённые поля из Excel-снимка выбранного профиля.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="table-wrapper" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Статус</th>
                  <th>Номер ТЛ</th>
                  <th>Строка файла</th>
                  <th>ID бронирования</th>
                  {activeYmsColumns.map(column => <th key={`yms-${column.key}`}>{column.label}</th>)}
                  {activeFileColumns.map(column => <th key={`file-${column.key}`}>{column.label} (файл)</th>)}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(row => (
                  <tr key={row.id}>
                    <td>{statusLabels[row.status] || row.status}</td>
                    <td>{row.tl_number_normalized}</td>
                    <td>{row.file_row_number || '—'}</td>
                    <td>{row.booking_id || '—'}</td>
                    {activeYmsColumns.map(column => <td key={`yms-${column.key}`}>{valueFromExtraColumn(row, column)}</td>)}
                    {activeFileColumns.map(column => <td key={`file-${column.key}`}>{valueFromFileColumn(row, column)}</td>)}
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
