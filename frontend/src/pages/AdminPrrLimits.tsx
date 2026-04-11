import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const DURATION_VALIDATION_MESSAGE = 'Длительность должна быть > 0 и кратна 30 минутам'

const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  '\u0430': 'a',
  '\u0431': 'b',
  '\u0432': 'v',
  '\u0433': 'g',
  '\u0434': 'd',
  '\u0435': 'e',
  '\u0451': 'yo',
  '\u0436': 'zh',
  '\u0437': 'z',
  '\u0438': 'i',
  '\u0439': 'y',
  '\u043a': 'k',
  '\u043b': 'l',
  '\u043c': 'm',
  '\u043d': 'n',
  '\u043e': 'o',
  '\u043f': 'p',
  '\u0440': 'r',
  '\u0441': 's',
  '\u0442': 't',
  '\u0443': 'u',
  '\u0444': 'f',
  '\u0445': 'kh',
  '\u0446': 'ts',
  '\u0447': 'ch',
  '\u0448': 'sh',
  '\u0449': 'sch',
  '\u044a': '',
  '\u044b': 'y',
  '\u044c': '',
  '\u044d': 'e',
  '\u044e': 'yu',
  '\u044f': 'ya',
}

const normalizeSearchValue = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const transliterateRuToLatin = (value: string) =>
  value
    .split('')
    .map((char) => CYRILLIC_TO_LATIN_MAP[char] ?? char)
    .join('')

const supplierNameCollator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true })

interface PrrLimit {
  id?: number
  object_id: number
  supplier_id?: number | null
  transport_type_id?: number | null
  vehicle_type_id?: number | null
  duration_minutes: number
}

interface YmsObject {
  id: number
  name: string
}

interface Supplier {
  id: number
  name: string
}

interface TransportType {
  id: number
  name: string
}

interface VehicleType {
  id: number
  name: string
}

interface PrrLimitImportError {
  row_number: number
  message: string
}

interface PrrLimitConflict {
  row_number: number
  object_name: string
  supplier_name?: string | null
  transport_type?: string | null
  vehicle_type?: string | null
  existing_duration?: number | null
  new_duration: number
  source: string
}

interface PrrLimitImportResult {
  created: number
  updated: number
  errors: PrrLimitImportError[]
  conflicts: PrrLimitConflict[]
}

type ConflictChoice = 'keep_existing' | 'replace_with_new'

const emptyPrrLimit: PrrLimit = {
  object_id: 0,
  supplier_id: null,
  transport_type_id: null,
  vehicle_type_id: null,
  duration_minutes: 0,
}

const AdminPrrLimits: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [items, setItems] = useState<PrrLimit[]>([])
  const [objects, setObjects] = useState<YmsObject[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [transportTypes, setTransportTypes] = useState<TransportType[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [form, setForm] = useState<PrrLimit>({ ...emptyPrrLimit })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<PrrLimitImportResult | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [conflictChoices, setConflictChoices] = useState<Record<string, ConflictChoice>>({})
  const [supplierFilterId, setSupplierFilterId] = useState<number | ''>('')
  const [supplierFilterSearch, setSupplierFilterSearch] = useState('')
  const [supplierFilterDropdownOpen, setSupplierFilterDropdownOpen] = useState(false)
  const supplierFilterFieldRef = useRef<HTMLDivElement | null>(null)

  const token = useMemo(() => localStorage.getItem('token'), [])
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const filteredSupplierFilterOptions = useMemo(() => {
    const sortedSuppliers = [...suppliers].sort((a, b) =>
      supplierNameCollator.compare(a.name || '', b.name || ''),
    )
    const query = normalizeSearchValue(supplierFilterSearch)
    if (!query) return sortedSuppliers

    const transliteratedQuery = transliterateRuToLatin(query)
    return sortedSuppliers.filter((supplier) => {
      const normalizedName = normalizeSearchValue(supplier.name || '')
      const transliteratedName = transliterateRuToLatin(normalizedName)
      return (
        normalizedName.includes(query) ||
        normalizedName.includes(transliteratedQuery) ||
        transliteratedName.includes(query) ||
        transliteratedName.includes(transliteratedQuery)
      )
    })
  }, [supplierFilterSearch, suppliers])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, number> = {}
      if (supplierFilterId !== '') {
        params.supplier_id = supplierFilterId
      }
      const { data } = await axios.get<PrrLimit[]>(`${API_BASE}/api/prr-limits/`, { headers, params })
      setItems(data)
    } catch (e: any) {
      setError('Не удалось загрузить лимиты')
    } finally {
      setLoading(false)
    }
  }

  const loadDropdowns = async () => {
    try {
      const [objectsRes, suppliersRes, transportTypesRes, vehicleTypesRes] = await Promise.all([
        axios.get<YmsObject[]>(`${API_BASE}/api/objects/`, { headers }),
        axios.get<Supplier[]>(`${API_BASE}/api/suppliers/`),
        axios.get<TransportType[]>(`${API_BASE}/api/transport-types/`),
        axios.get<VehicleType[]>(`${API_BASE}/api/vehicle-types/`, { headers }),
      ])
      setObjects(objectsRes.data)
      setSuppliers(suppliersRes.data)
      setTransportTypes(transportTypesRes.data)
      setVehicleTypes(vehicleTypesRes.data)
    } catch (e: any) {
      setError('Не удалось загрузить справочники')
    }
  }

  useEffect(() => {
    loadDropdowns()
  }, [])

  useEffect(() => {
    load()
  }, [supplierFilterId])

  useEffect(() => {
    if (supplierFilterId === '') {
      setSupplierFilterSearch('')
      return
    }
    const selected = suppliers.find((s) => s.id === supplierFilterId)
    if (selected) setSupplierFilterSearch(selected.name)
  }, [supplierFilterId, suppliers])

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!supplierFilterFieldRef.current) return
      if (!supplierFilterFieldRef.current.contains(event.target as Node)) {
        setSupplierFilterDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocumentMouseDown)
    return () => document.removeEventListener('mousedown', onDocumentMouseDown)
  }, [])

  const resetForm = () => {
    setForm({ ...emptyPrrLimit })
    setEditingId(null)
  }

  const validateDuration = (value: number) => {
    if (value <= 0 || value % 30 !== 0) {
      setError(DURATION_VALIDATION_MESSAGE)
      return false
    }
    return true
  }

  const handleSupplierFilterSelect = (supplier: Supplier) => {
    setSupplierFilterId(supplier.id)
    setSupplierFilterSearch(supplier.name)
    setSupplierFilterDropdownOpen(false)
  }

  const handleSupplierFilterInputChange = (value: string) => {
    setSupplierFilterSearch(value)
    setSupplierFilterDropdownOpen(true)

    const normalizedValue = normalizeSearchValue(value)
    if (!normalizedValue) {
      setSupplierFilterId('')
      return
    }

    const selected = typeof supplierFilterId === 'number'
      ? suppliers.find((s) => s.id === supplierFilterId)
      : null
    if (selected && normalizeSearchValue(selected.name) === normalizedValue) return

    const exact = suppliers.find((s) => normalizeSearchValue(s.name) === normalizedValue)
    setSupplierFilterId(exact ? exact.id : '')
  }

  const handleSupplierFilterInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (filteredSupplierFilterOptions.length > 0) {
        handleSupplierFilterSelect(filteredSupplierFilterOptions[0])
      }
      return
    }
    if (event.key === 'Escape') {
      setSupplierFilterDropdownOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      setSupplierFilterDropdownOpen(true)
    }
  }

  const handleClearSupplierFilter = () => {
    setSupplierFilterSearch('')
    setSupplierFilterId('')
    setSupplierFilterDropdownOpen(true)
  }

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)
    if (!validateDuration(form.duration_minutes)) return
    if (editingId) {
      update()
    } else {
      create()
    }
  }

  const create = async () => {
    setError(null)
    setSuccess(null)
    try {
      await axios.post(`${API_BASE}/api/prr-limits/`, form, { headers })
      setSuccess('Лимит создан')
      resetForm()
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Не удалось создать лимит')
    }
  }

  const startEdit = (item: PrrLimit) => {
    setEditingId(item.id!)
    setForm(item)
  }

  const update = async () => {
    if (!editingId) return
    setError(null)
    setSuccess(null)
    try {
      await axios.put(`${API_BASE}/api/prr-limits/${editingId}`, form, { headers })
      setSuccess('Лимит обновлён')
      resetForm()
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Не удалось обновить лимит')
    }
  }

  const remove = async (id: number) => {
    if (!confirm('Удалить лимит?')) return
    setError(null)
    setSuccess(null)
    try {
      await axios.delete(`${API_BASE}/api/prr-limits/${id}`, { headers })
      setSuccess('Лимит удалён')
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Не удалось удалить лимит')
    }
  }

  const handleDownloadTemplate = async () => {
    setTemplateLoading(true)
    setError(null)
    try {
      const { data } = await axios.get(`${API_BASE}/api/prr-limits/template`, {
        headers,
        responseType: 'blob',
      })
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'prr_limits_template.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setError('Не удалось скачать шаблон')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleExport = async () => {
    setExportLoading(true)
    setError(null)
    try {
      const { data } = await axios.get(`${API_BASE}/api/prr-limits/export`, {
        headers,
        responseType: 'blob',
      })
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'prr_limits_export.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setError('Не удалось сделать экспорт')
    } finally {
      setExportLoading(false)
    }
  }

  const conflictKey = (c: { object_name: string; supplier_name?: string | null; transport_type?: string | null; vehicle_type?: string | null }) =>
    `${c.object_name || ''}||${c.supplier_name || ''}||${c.transport_type || ''}||${c.vehicle_type || ''}`

  const handleImport = async () => {
    if (!importFile) {
      setError('Выберите файл для импорта')
      return
    }
    setImportLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const formData = new FormData()
      formData.append('file', importFile)

      const resolutionsPayload = Object.entries(conflictChoices).map(([key, action]) => {
        const [object_name, supplier_name, transport_type, vehicle_type] = key.split('||')
        return {
          object_name,
          supplier_name: supplier_name || null,
          transport_type: transport_type || null,
          vehicle_type: vehicle_type || null,
          action,
        }
      })
      if (resolutionsPayload.length > 0) {
        formData.append('resolutions', JSON.stringify(resolutionsPayload))
      }

      const { data } = await axios.post<PrrLimitImportResult>(`${API_BASE}/api/prr-limits/import`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(data)
      if (data.conflicts.length === 0) {
        setConflictChoices({})
        load()
        setSuccess(`Создано: ${data.created}, обновлено: ${data.updated}`)
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Не удалось выполнить импорт')
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={onBack}>Назад</button>
      </div>

      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ color: '#16a34a', marginBottom: 8 }}>{success}</div>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn-secondary" onClick={handleDownloadTemplate} disabled={templateLoading}>
          {templateLoading ? 'Скачиваем…' : 'Шаблон Excel'}
        </button>
        <button className="btn-secondary" onClick={handleExport} disabled={exportLoading}>
          {exportLoading ? 'Экспорт…' : 'Экспорт Excel'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="file" accept=".xlsx,.xlsm" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          <button onClick={handleImport} disabled={importLoading}>{importLoading ? 'Импорт…' : 'Импортировать'}</button>
        </div>
      </div>

      {importResult && (
        <div style={{ marginBottom: 12, padding: 12, border: '1px dashed #d1d5db', borderRadius: 8 }}>
          <div>Создано: {importResult.created} · Обновлено: {importResult.updated}</div>
          {importResult.errors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              Ошибки:
              <ul style={{ margin: 4, paddingLeft: 18 }}>
                {importResult.errors.map(err => (
                  <li key={err.row_number}>Строка {err.row_number}: {err.message}</li>
                ))}
              </ul>
            </div>
          )}
          {importResult.conflicts.length > 0 && (
            <div style={{ marginTop: 8 }}>
              Конфликты (выберите, что оставить):
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                {importResult.conflicts.map(conflict => {
                  const key = conflictKey(conflict)
                  const choice = conflictChoices[key]
                  return (
                    <div key={`${key}-${conflict.row_number}`} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: 8 }}>
                      <div>
                        Строка {conflict.row_number}: {conflict.object_name} / {conflict.supplier_name || '—'} / {conflict.transport_type || '—'} / {conflict.vehicle_type || '—'}
                      </div>
                      <div>Текущее значение: {conflict.existing_duration ?? 'нет'} мин · Новое: {conflict.new_duration} мин (источник: {conflict.source})</div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                        <label>
                          <input
                            type="radio"
                            name={key}
                            value="keep_existing"
                            checked={choice === 'keep_existing'}
                            onChange={() => setConflictChoices(prev => ({ ...prev, [key]: 'keep_existing' }))}
                          />{' '}
                          Оставить существующую
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={key}
                            value="replace_with_new"
                            checked={choice === 'replace_with_new'}
                            onChange={() => setConflictChoices(prev => ({ ...prev, [key]: 'replace_with_new' }))}
                          />{' '}
                          Заменить новой
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button onClick={handleImport} disabled={importLoading}>Применить решения</button>
              </div>
            </div>
          )}
        </div>
      )}

      <h3>{editingId ? 'Редактирование лимита' : 'Создать лимит'}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 160px', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <select value={form.object_id} onChange={e => setForm({ ...form, object_id: Number(e.target.value) })}>
          <option value={0}>Выберите объект</option>
          {objects.map(obj => <option key={obj.id} value={obj.id}>{obj.name}</option>)}
        </select>
        <select value={form.supplier_id || ''} onChange={e => setForm({ ...form, supplier_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">(без поставщика)</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={form.transport_type_id || ''} onChange={e => setForm({ ...form, transport_type_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">(без типа перевозки)</option>
          {transportTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select value={form.vehicle_type_id || ''} onChange={e => setForm({ ...form, vehicle_type_id: e.target.value ? Number(e.target.value) : null })}>
          <option value="">(без типа ТС)</option>
          {vehicleTypes.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
        <input
          type="number"
          min={0}
          step={30}
          placeholder="Длительность (мин, шаг 30)"
          value={form.duration_minutes}
          onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSubmit}>{editingId ? 'Сохранить' : 'Создать'}</button>
          {editingId && <button onClick={resetForm}>Отмена</button>}
        </div>
      </div>

      <h3>Текущие лимиты</h3>
      <div style={{ marginBottom: 12 }}>
        <div ref={supplierFilterFieldRef} style={{ position: 'relative', maxWidth: 420 }}>
          <label htmlFor="supplier-filter-input" style={{ display: 'block', marginBottom: 4 }}>Фильтр по поставщику:</label>
          <div style={{ position: 'relative' }}>
            <input
              id="supplier-filter-input"
              type="text"
              value={supplierFilterSearch}
              onFocus={() => setSupplierFilterDropdownOpen(true)}
              onChange={(e) => handleSupplierFilterInputChange(e.target.value)}
              onKeyDown={handleSupplierFilterInputKeyDown}
              placeholder="Начните вводить поставщика"
              autoComplete="off"
              style={{ width: '100%', paddingRight: supplierFilterSearch ? 34 : undefined }}
            />
            {supplierFilterSearch && (
              <button
                type="button"
                aria-label="Очистить фильтр по поставщику"
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleClearSupplierFilter}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  border: 'none',
                  background: '#e5e7eb',
                  color: '#374151',
                  padding: 0,
                  fontSize: 14,
                  lineHeight: '18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                title="Очистить"
              >
                &times;
              </button>
            )}
          </div>
          {supplierFilterDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                maxHeight: 220,
                overflowY: 'auto',
                border: '1px solid #d1d5db',
                borderRadius: 10,
                backgroundColor: '#fff',
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
                zIndex: 20,
              }}
            >
              <div
                onMouseDown={(event) => {
                  event.preventDefault()
                  setSupplierFilterId('')
                  setSupplierFilterSearch('')
                  setSupplierFilterDropdownOpen(false)
                }}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  backgroundColor: supplierFilterId === '' ? '#eef2ff' : '#fff',
                }}
              >
                Все поставщики
              </div>
              {filteredSupplierFilterOptions.length === 0 ? (
                <div style={{ padding: 10, color: '#6b7280', fontSize: 14 }}>
                  Нет совпадений
                </div>
              ) : (
                filteredSupplierFilterOptions.map((supplier) => (
                  <div
                    key={supplier.id}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      handleSupplierFilterSelect(supplier)
                    }}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: supplier.id === supplierFilterId ? '#eef2ff' : '#fff',
                    }}
                  >
                    {supplier.name}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Объект</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Поставщик</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Тип перевозки</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Тип ТС</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Длительность (мин)</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{objects.find(o => o.id === item.object_id)?.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{suppliers.find(s => s.id === item.supplier_id)?.name || '-'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{transportTypes.find(t => t.id === item.transport_type_id)?.name || '-'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{vehicleTypes.find(v => v.id === item.vehicle_type_id)?.name || '-'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{item.duration_minutes}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <button onClick={() => startEdit(item)}>Редактировать</button>
                  <button onClick={() => remove(item.id!)} style={{ marginLeft: 8 }}>Удалить</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={6} style={{ padding: 8, textAlign: 'center', color: '#6b7280' }}>Нет данных</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminPrrLimits

