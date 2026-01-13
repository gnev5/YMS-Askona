import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

interface VolumeQuotaOverride {
  override_date: string
  volume: number
}

interface VolumeQuotaImportError {
  sheet: string
  row_number: number
  message: string
}

interface VolumeQuotaImportResult {
  created: number
  updated: number
  errors: VolumeQuotaImportError[]
}

interface VolumeQuota {
  id?: number
  object_id: number
  direction: 'in' | 'out'
  year: number
  month: number
  day_of_week: number
  volume: number
  allow_overbooking: boolean
  transport_type_ids: number[]
  overrides: VolumeQuotaOverride[]
}

interface YmsObject {
  id: number
  name: string
}

interface TransportType {
  id: number
  name: string
}

const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const emptyQuota: VolumeQuota = {
  object_id: 0,
  direction: 'in',
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  day_of_week: 0,
  volume: 0,
  allow_overbooking: true,
  transport_type_ids: [],
  overrides: [],
}

const AdminVolumeQuotas: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [items, setItems] = useState<VolumeQuota[]>([])
  const [objects, setObjects] = useState<YmsObject[]>([])
  const [transportTypes, setTransportTypes] = useState<TransportType[]>([])
  const [form, setForm] = useState<VolumeQuota>({ ...emptyQuota })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<VolumeQuotaImportResult | null>(null)
  const [file, setFile] = useState<File | null>(null)

  const token = useMemo(() => localStorage.getItem('token'), [])
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.get<VolumeQuota[]>(`${API_BASE}/api/volume-quotas/`, { headers })
      setItems(data || [])
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Не удалось загрузить квоты')
    } finally {
      setLoading(false)
    }
  }

  const loadDropdowns = async () => {
    try {
      const [objectsRes, transportTypesRes] = await Promise.all([
        axios.get<YmsObject[]>(`${API_BASE}/api/objects/`, { headers }),
        axios.get<TransportType[]>(`${API_BASE}/api/transport-types/`),
      ])
      setObjects(objectsRes.data)
      setTransportTypes(transportTypesRes.data)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Не удалось загрузить справочники')
    }
  }

  useEffect(() => {
    load()
    loadDropdowns()
  }, [])

  const resetForm = () => {
    setForm({ ...emptyQuota })
    setEditingId(null)
  }

  const handleDownloadTemplate = async () => {
    setError(null)
    setSuccess(null)
    try {
      const { data } = await axios.get(`${API_BASE}/api/volume-quotas/template`, {
        headers,
        responseType: 'blob',
      })
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'volume_quotas_template.xlsx'
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Не удалось скачать шаблон')
    }
  }

  const handleImport = async () => {
    if (!file) {
      setError('Выберите файл')
      return
    }
    setError(null)
    setSuccess(null)
    setImportResult(null)
    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const { data } = await axios.post<VolumeQuotaImportResult>(`${API_BASE}/api/volume-quotas/import`, formData, {
        headers,
      })
      setImportResult(data)
      setSuccess(`Импорт завершён: создано ${data.created}, обновлено ${data.updated}`)
      load()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Не удалось импортировать')
    } finally {
      setImporting(false)
    }
  }

  const handleTransportTypesChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions).map(o => Number(o.value))
    setForm(prev => ({ ...prev, transport_type_ids: selected }))
  }

  const updateOverride = (index: number, key: keyof VolumeQuotaOverride, value: string) => {
    const next = [...form.overrides]
    const updated = { ...next[index], [key]: key === 'volume' ? Number(value) : value }
    next[index] = updated
    setForm(prev => ({ ...prev, overrides: next }))
  }

  const addOverride = () => {
    setForm(prev => ({ ...prev, overrides: [...prev.overrides, { override_date: '', volume: 0 }] }))
  }

  const removeOverride = (index: number) => {
    setForm(prev => ({ ...prev, overrides: prev.overrides.filter((_, i) => i !== index) }))
  }

  const startEdit = (item: VolumeQuota) => {
    setEditingId(item.id!)
    setForm({
      ...item,
      overrides: (item.overrides || []).map(ov => ({ override_date: ov.override_date, volume: ov.volume })),
    })
  }

  const validate = () => {
    if (!form.object_id) {
      setError('Выберите объект')
      return false
    }
    if (!form.transport_type_ids.length) {
      setError('Укажите хотя бы один тип перевозки')
      return false
    }
    if (!form.volume || form.volume <= 0) {
      setError('Объем квоты должен быть больше 0')
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    setError(null)
    setSuccess(null)
    if (!validate()) return
    const payload = { ...form, overrides: form.overrides || [] }
    try {
      if (editingId) {
        await axios.put(`${API_BASE}/api/volume-quotas/${editingId}`, payload, { headers })
        setSuccess('Квота обновлена')
      } else {
        await axios.post(`${API_BASE}/api/volume-quotas/`, payload, { headers })
        setSuccess('Квота создана')
      }
      resetForm()
      load()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Не удалось сохранить квоту')
    }
  }

  const remove = async (id: number) => {
    if (!confirm('Удалить квоту?')) return
    setError(null)
    setSuccess(null)
    try {
      await axios.delete(`${API_BASE}/api/volume-quotas/${id}`, { headers })
      setSuccess('Квота удалена')
      load()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Не удалось удалить квоту')
    }
  }

  const formatDay = (d: number) => dayNames[d] || d

  const findObjectName = (id: number) => objects.find(o => o.id === id)?.name || `#${id}`
  const findTransportNames = (ids: number[]) => ids.map(id => transportTypes.find(t => t.id === id)?.name || `#${id}`).join(', ')

  return (
    <div>
      <div className="inline-actions" style={{ marginBottom: 12 }}>
        <button className="btn-secondary" onClick={onBack}>Назад</button>
        <h2 style={{ margin: 0 }}>Квоты по объему</h2>
      </div>

      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      {success && <div className="badge badge-success" style={{ marginBottom: 8 }}>{success}</div>}

      <div className="card" style={{ padding: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <button className="btn-secondary" type="button" onClick={handleDownloadTemplate}>Скачать шаблон</button>
          <input type="file" accept=".xlsx,.xlsm" onChange={e => setFile(e.target.files?.[0] || null)} />
          <button type="button" onClick={handleImport} disabled={importing}>{importing ? 'Импорт...' : 'Загрузить xlsx'}</button>
        </div>

        {importResult && importResult.errors?.length > 0 && (
          <div className="error" style={{ marginBottom: 12 }}>
            <div>РћС€РёР±РєРё РёРјРїРѕСЂС'Р°:</div>
            <ul style={{ margin: '6px 0 0 16px' }}>
              {importResult.errors.map((err, idx) => (
                <li key={idx}>{err.sheet} / С'СЂРѕРєР° {err.row_number}: {err.message}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div className="field">
            <label>Объект</label>
            <select value={form.object_id || ''} onChange={e => setForm(prev => ({ ...prev, object_id: Number(e.target.value) }))}>
              <option value="" disabled>Выберите объект</option>
              {objects.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Направление</label>
            <select value={form.direction} onChange={e => setForm(prev => ({ ...prev, direction: e.target.value as 'in' | 'out' }))}>
              <option value="in">Вход</option>
              <option value="out">Выход</option>
            </select>
          </div>
          <div className="field">
            <label>Год</label>
            <input type="number" value={form.year} onChange={e => setForm(prev => ({ ...prev, year: Number(e.target.value) }))} />
          </div>
          <div className="field">
            <label>Месяц</label>
            <input type="number" min={1} max={12} value={form.month} onChange={e => setForm(prev => ({ ...prev, month: Number(e.target.value) }))} />
          </div>
          <div className="field">
            <label>День недели</label>
            <select value={form.day_of_week} onChange={e => setForm(prev => ({ ...prev, day_of_week: Number(e.target.value) }))}>
              {dayNames.map((d, idx) => (
                <option key={idx} value={idx}>{d}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Объем на день</label>
            <input type="number" step="0.1" value={form.volume} onChange={e => setForm(prev => ({ ...prev, volume: Number(e.target.value) }))} />
          </div>
          <div className="field">
            <label>Типы перевозки</label>
            <select multiple value={form.transport_type_ids.map(String)} onChange={handleTransportTypesChange} size={Math.min(transportTypes.length, 6)}>
              {transportTypes.map(tt => (
                <option key={tt.id} value={tt.id}>{tt.name}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" id="allowOver" checked={form.allow_overbooking} onChange={e => setForm(prev => ({ ...prev, allow_overbooking: e.target.checked }))} />
            <label htmlFor="allowOver" style={{ margin: 0 }}>Разрешить перебронь</label>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>Переопределения по датам</strong>
            <button type="button" className="btn-secondary" onClick={addOverride}>Добавить дату</button>
          </div>
          {form.overrides.length === 0 && <div style={{ color: '#64748b', marginTop: 6 }}>Нет переопределений</div>}
          {form.overrides.map((ov, idx) => (
            <div key={idx} className="form-grid" style={{ gridTemplateColumns: '1fr 1fr auto', alignItems: 'center', marginTop: 6 }}>
              <input type="date" value={ov.override_date || ''} onChange={e => updateOverride(idx, 'override_date', e.target.value)} />
              <input type="number" step="0.1" value={ov.volume} onChange={e => updateOverride(idx, 'volume', e.target.value)} />
              <button type="button" className="btn-secondary" onClick={() => removeOverride(idx)}>Удалить</button>
            </div>
          ))}
        </div>

        <div className="form-footer" style={{ marginTop: 12 }}>
          <button className="btn-secondary" onClick={resetForm}>Очистить</button>
          <button onClick={handleSubmit}>{editingId ? 'Обновить' : 'Создать'}</button>
        </div>
      </div>

      <div className="card" style={{ padding: 12 }}>
        {loading ? (
          <div>Загрузка...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Объект</th>
                <th>Направление</th>
                <th>Период</th>
                <th>День</th>
                <th>Объем</th>
                <th>Перебронь</th>
                <th>Типы перевозки</th>
                <th>Даты исключений</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{findObjectName(item.object_id)}</td>
                  <td>{item.direction === 'in' ? 'Вход' : 'Выход'}</td>
                  <td>{item.month}.{item.year}</td>
                  <td>{formatDay(item.day_of_week)}</td>
                  <td>{item.volume}</td>
                  <td>{item.allow_overbooking ? 'Да' : 'Нет'}</td>
                  <td>{findTransportNames(item.transport_type_ids)}</td>
                  <td>
                    {(item.overrides || []).length
                      ? item.overrides.map(ov => `${ov.override_date}: ${ov.volume}`).join('; ')
                      : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-secondary" onClick={() => startEdit(item)}>Изменить</button>
                      <button className="btn-secondary" onClick={() => remove(item.id!)}>Удалить</button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: '#94a3b8' }}>Квоты не найдены</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default AdminVolumeQuotas
