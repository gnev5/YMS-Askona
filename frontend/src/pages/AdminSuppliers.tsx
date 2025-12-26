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

interface Supplier {
  id: number
  name: string
  comment?: string
  zone_id: number
  zone?: Zone
  vehicle_types?: VehicleType[]
}

const AdminSuppliers: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    comment: '',
    zone_id: 0,
    vehicle_type_ids: [] as number[],
  })

  const token = localStorage.getItem('token')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const loadSuppliers = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.get<Supplier[]>(`${API_BASE}/api/suppliers/`)
      setSuppliers(data)
    } catch (e: any) {
      setError('Не удалось загрузить поставщиков')
    } finally {
      setLoading(false)
    }
  }

  const loadZones = async () => {
    try {
      const { data } = await axios.get<Zone[]>(`${API_BASE}/api/zones/`)
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
      const { data } = await axios.get<VehicleType[]>(`${API_BASE}/api/vehicle-types`)
      setVehicleTypes(data)
    } catch (e) {
      console.error('Failed to load vehicle types', e)
    }
  }

  useEffect(() => {
    loadSuppliers()
    loadZones()
    loadVehicleTypes()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Название поставщика обязательно')
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
        setSuccess('Поставщик обновлен')
      } else {
        await axios.post(`${API_BASE}/api/suppliers/`, formData, { headers })
        setSuccess('Поставщик создан')
      }

      setFormData({ name: '', comment: '', zone_id: 0, vehicle_type_ids: [] })
      setEditingSupplier(null)
      loadSuppliers()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка сохранения поставщика')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setFormData({
      name: supplier.name,
      comment: supplier.comment || '',
      zone_id: supplier.zone_id,
      vehicle_type_ids: (supplier.vehicle_types || []).map(v => v.id),
    })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Удалить поставщика?')) return

    setLoading(true)
    setError(null)
    try {
      await axios.delete(`${API_BASE}/api/suppliers/${id}`, { headers })
      setSuccess('Поставщик удален')
      loadSuppliers()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка удаления поставщика')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditingSupplier(null)
    setFormData({ name: '', comment: '', zone_id: 0, vehicle_type_ids: [] })
  }

  const toggleVehicleType = (id: number) => {
    setFormData(prev => {
      const exists = prev.vehicle_type_ids.includes(id)
      return {
        ...prev,
        vehicle_type_ids: exists
          ? prev.vehicle_type_ids.filter(x => x !== id)
          : [...prev.vehicle_type_ids, id],
      }
    })
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={onBack}>← Назад</button>
        <h2>Управление поставщиками</h2>
      </div>

      {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="success" style={{ marginBottom: 16 }}>{success}</div>}

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
            placeholder="Описание или примечание"
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
          <label style={{ display: 'block', marginBottom: 4 }}>Типы ТС (можно несколько):</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 6 }}>
            {vehicleTypes.map(vt => (
              <label key={vt.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={formData.vehicle_type_ids.includes(vt.id)}
                  onChange={() => toggleVehicleType(vt.id)}
                />
                <span>{vt.name}</span>
              </label>
            ))}
            {vehicleTypes.length === 0 && <div style={{ color: '#6b7280' }}>Нет типов ТС</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading}>
            {loading ? 'Сохранение...' : editingSupplier ? 'Сохранить' : 'Создать'}
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
