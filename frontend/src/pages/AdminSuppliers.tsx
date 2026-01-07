import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

interface Zone {
  id: number
  name: string
}

interface VehicleType {
  id: number
  name: string
}

interface TransportType {
  id: number
  name: string
}

interface Supplier {
  id: number
  name: string
  comment?: string
  zone_id: number
  zone?: Zone
  vehicle_types?: VehicleType[]
  transport_types?: TransportType[]
}

const AdminSuppliers: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [transportTypes, setTransportTypes] = useState<TransportType[]>([])
  const [loading, setLoading] = useState(false)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<{ created: number; errors: { row_number: number; message: string }[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    comment: '',
    zone_id: 0,
    vehicle_type_ids: [] as number[],
    transport_type_ids: [] as number[],
  })

  const token = localStorage.getItem('token')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const loadSuppliers = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.get<Supplier[]>(`${API_BASE}/api/suppliers/`, { headers })
      setSuppliers(data)
    } catch (e: any) {
      setError('Не удалось загрузить поставщиков')
    } finally {
      setLoading(false)
    }
  }

  const loadZones = async () => {
    try {
      const { data } = await axios.get<Zone[]>(`${API_BASE}/api/zones/`, { headers })
      setZones(data)
      if (data.length > 0 && formData.zone_id === 0) {
        setFormData(prev => ({ ...prev, zone_id: data[0].id }))
      }
    } catch (e) {
      console.error('Failed to load zones', e)
    }
  }

  const loadVehicleTypes = async () => {
    try {
      const { data } = await axios.get<VehicleType[]>(`${API_BASE}/api/vehicle-types`, { headers })
      setVehicleTypes(data)
    } catch (e) {
      console.error('Failed to load vehicle types', e)
    }
  }

  const loadTransportTypes = async () => {
    try {
      const { data } = await axios.get<TransportType[]>(`${API_BASE}/api/transport-types`, { headers })
      setTransportTypes(data)
    } catch (e) {
      console.error('Failed to load transport types', e)
    }
  }

  useEffect(() => {
    loadSuppliers()
    loadZones()
    loadVehicleTypes()

    loadTransportTypes()



  }, [])

  const handleDownloadTemplate = async () => {
    setError(null)
    setSuccess(null)
    setTemplateLoading(true)
    try {
      const { data } = await axios.get(`${API_BASE}/api/suppliers/import/template`, {
        headers,
        responseType: 'blob',
      })
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'supplier_import_template.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Не удалось скачать шаблон')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Введите название поставщика')
      return
    }
    if (!formData.zone_id) {
      setError('Выберите зону')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (editingSupplier) {
        await axios.put(`${API_BASE}/api/suppliers/${editingSupplier.id}`, formData, { headers })
        setSuccess('Поставщик обновлён')
      } else {
        await axios.post(`${API_BASE}/api/suppliers/`, formData, { headers })
        setSuccess('Поставщик создан')
      }

      handleCancel()
      loadSuppliers()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Не удалось сохранить поставщика')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setImportResult(null)
    if (!importFile) {
      setError('Выберите файл для импорта')
      return
    }
    setImportLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const { data } = await axios.post(`${API_BASE}/api/suppliers/import`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(data)
      setSuccess(`Импорт завершён: добавлено ${data.created}, ошибок ${data.errors.length}`)
      loadSuppliers()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Не удалось выполнить импорт')
    } finally {
      setImportLoading(false)
    }
  }

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.name,
      comment: supplier.comment || '',
      zone_id: supplier.zone_id,
      vehicle_type_ids: (supplier.vehicle_types || []).map(v => v.id),
      transport_type_ids: (supplier.transport_types || []).map(t => t.id),
    })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить поставщика?')) return

    setLoading(true)
    setError(null)
    try {
      await axios.delete(`${API_BASE}/api/suppliers/${id}`, { headers })
      setSuccess('Поставщик удалён')
      loadSuppliers()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Не удалось удалить поставщика')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditingSupplier(null)
    setFormData({ name: '', comment: '', zone_id: 0, vehicle_type_ids: [], transport_type_ids: [] })
  }

  const toggleSelection = (field: 'vehicle_type_ids' | 'transport_type_ids', id: number) => {
    setFormData(prev => {
      const currentIds = prev[field]
      const exists = currentIds.includes(id)
      return {
        ...prev,

        [field]: exists ? currentIds.filter(x => x !== id) : [...currentIds, id],
        vehicle_type_ids: exists ? prev.vehicle_type_ids.filter(x => x !== id) : [...prev.vehicle_type_ids, id],

      }
    })
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={onBack}>← Назад</button>
        <h2>Управление поставщиками</h2>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={handleDownloadTemplate} disabled={templateLoading}>
            {templateLoading ? 'Скачиваем...' : 'Скачать шаблон импорта'}
          </button>
        </div>
      </div>

      {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="success" style={{ marginBottom: 16 }}>{success}</div>}

      <form onSubmit={handleImport} style={{ marginBottom: 16, padding: 12, border: '1px dashed #d1d5db', borderRadius: 8 }}>
        <h3>Импорт поставщиков из Excel</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, marginBottom: 8 }}>
          <input
            type="file"
            accept=".xlsx,.xlsm"
            onChange={e => setImportFile(e.target.files?.[0] || null)}
          />
          <button type="submit" disabled={importLoading}>
            {importLoading ? 'Импорт...' : 'Загрузить файл'}
          </button>
        </div>
        {importResult && (
          <div style={{ marginTop: 8, fontSize: 14 }}>
            <div>Добавлено: {importResult.created}</div>
            {importResult.errors.length > 0 && (
              <div style={{ marginTop: 4 }}>
                Ошибки:
                <ul style={{ margin: 4, paddingLeft: 16 }}>
                  {importResult.errors.map(err => (
                    <li key={err.row_number}>
                      Строка {err.row_number}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </form>

      <form onSubmit={handleSubmit} style={{ marginBottom: 24, padding: 16, border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h3>{editingSupplier ? 'Редактировать поставщика' : 'Добавить поставщика'}</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Название поставщика:</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Введите название поставщика"
            style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }}
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Комментарий:</label>
          <textarea
            value={formData.comment}
            onChange={e => setFormData({ ...formData, comment: e.target.value })}
            placeholder="Опишите детали (опционально)"
            rows={3}
            style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Зона:</label>
          <select
            value={formData.zone_id}
            onChange={e => setFormData({ ...formData, zone_id: Number(e.target.value) })}
            style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }}
            required
          >
            <option value={0}>Выберите зону</option>
            {zones.map(zone => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Типы ТС (если нужно):</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
            {vehicleTypes.map(vt => (
              <label key={vt.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={formData.vehicle_type_ids.includes(vt.id)}
                  onChange={() => toggleSelection('vehicle_type_ids', vt.id)}
                />
                <span>{vt.name}</span>
              </label>
            ))}
            {vehicleTypes.length === 0 && <div style={{ color: '#6b7280' }}>Нет типов ТС</div>}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Типы перевозки (можно несколько):</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
            {transportTypes.map(tt => (
              <label key={tt.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={formData.transport_type_ids.includes(tt.id)}
                  onChange={() => toggleSelection('transport_type_ids', tt.id)}
                />
                <span>{tt.name}</span>
              </label>
            ))}
            {transportTypes.length === 0 && <div style={{ color: '#6b7280' }}>Нет типов перевозки</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading}>
            {loading ? 'Сохранение...' : editingSupplier ? 'Обновить' : 'Создать'}
          </button>
          {editingSupplier && (
            <button type="button" onClick={handleCancel}>
              Отмена
            </button>
          )}
        </div>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>ID</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Название</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Комментарий</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Зона</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Типы ТС</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Типы перевозки</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map(supplier => (
              <tr key={supplier.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{supplier.id}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{supplier.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{supplier.comment || '-'}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  {supplier.zone?.name || '—'}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  {(supplier.vehicle_types || []).map(v => v.name).join(', ') || '—'}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  {(supplier.transport_types || []).map(t => t.name).join(', ') || '—'}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <button
                    onClick={() => handleEdit(supplier)}
                    style={{ marginRight: 8, padding: '4px 8px', fontSize: '12px' }}
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => handleDelete(supplier.id)}
                    style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#dc2626', color: 'white' }}
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminSuppliers
