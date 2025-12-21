// Test comment
import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

type DockStatus = 'active' | 'inactive' | 'maintenance'

interface Object {
    id: number
    name: string
}

interface Zone {
    id: number
    name: string
}

interface TransportType {
    id: number
    name: string
}

interface Dock {
  id?: number
  name: string
  status: DockStatus
  length_meters?: number | null
  width_meters?: number | null
  max_load_kg?: number | null
  object_id: number
  object: Object
  dock_type: 'universal' | 'entrance' | 'exit'
  available_zones: Zone[]
  available_transport_types: TransportType[]
}

const emptyDock: Dock = { name: '', status: 'active', length_meters: null, width_meters: null, max_load_kg: null, object_id: 0, object: {id: 0, name: ''}, dock_type: 'universal', available_zones: [], available_transport_types: [] }

const AdminDocks: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [items, setItems] = useState<Dock[]>([])
  const [objects, setObjects] = useState<Object[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [transportTypes, setTransportTypes] = useState<TransportType[]>([])
  const [form, setForm] = useState<Dock>({ ...emptyDock })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const token = useMemo(() => localStorage.getItem('token'), [])
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await axios.get<Dock[]>(`${API_BASE}/api/docks/`)
      setItems(data)
    } catch (e: any) {
      setError('Ошибка загрузки доков')
    } finally { setLoading(false) }
  }

  const loadObjects = async () => {
    try {
      const { data } = await axios.get<Object[]>(`${API_BASE}/api/objects/`)
      setObjects(data)
    } catch (e: any) {
      setError('Ошибка загрузки объектов')
    }
  }

  useEffect(() => { load(); loadObjects() }, [])

  const resetForm = () => { setForm({ ...emptyDock }); setEditingId(null) }

  const create = async () => {
    setError(null); setSuccess(null)
    try {
      await axios.post(`${API_BASE}/api/docks/`, form, { headers })
      setSuccess('Док создан')
      resetForm()
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка создания')
    }
  }

  const startEdit = (d: Dock) => {
    setEditingId(d.id!)
    setForm({ ...d })
  }

  const update = async () => {
    if (!editingId) return
    setError(null); setSuccess(null)
    try {
        const payload = {
            ...form,
            available_zone_ids: form.available_zones.map(z => z.id),
            available_transport_type_ids: form.available_transport_types.map(t => t.id),
        }
      await axios.put(`${API_BASE}/api/docks/${editingId}`, payload, { headers })
      setSuccess('Док обновлён')
      resetForm()
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка обновления')
    }
  }

  const remove = async (id: number) => {
    if (!confirm('Удалить док?')) return
    setError(null); setSuccess(null)
    try {
      await axios.delete(`${API_BASE}/api/docks/${id}`, { headers })
      setSuccess('Док удалён')
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка удаления')
    }
  }

  const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedIds = Array.from(e.target.selectedOptions, option => Number(option.value));
    const selectedZones = zones.filter(z => selectedIds.includes(z.id));
    setForm({ ...form, available_zones: selectedZones });
  };

  const handleTransportTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedIds = Array.from(e.target.selectedOptions, option => Number(option.value));
    const selectedTransportTypes = transportTypes.filter(t => selectedIds.includes(t.id));
    setForm({ ...form, available_transport_types: selectedTransportTypes });
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={onBack}>Назад</button>
      </div>

      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ color: '#16a34a', marginBottom: 8 }}>{success}</div>}

      <h3>Новый док / Редактирование</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 160px', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input placeholder="Название" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <select value={form.object_id} onChange={e => setForm({ ...form, object_id: Number(e.target.value) })}>
            <option value={0}>Выберите объект</option>
            {objects.map(obj => (
                <option key={obj.id} value={obj.id}>{obj.name}</option>
            ))}
        </select>
        <select value={form.dock_type} onChange={e => setForm({ ...form, dock_type: e.target.value as 'universal' | 'entrance' | 'exit' })}>
          <option value="universal">Универсальный</option>
          <option value="entrance">Вход</option>
          <option value="exit">Выход</option>
        </select>
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as DockStatus })}>
          <option value="active">Активен</option>
          <option value="inactive">Неактивен</option>
          <option value="maintenance">На обслуживании</option>
        </select>
        {editingId ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={update}>Сохранить</button>
            <button onClick={resetForm}>Отмена</button>
          </div>
        ) : (
          <button onClick={create}>Создать</button>
        )}
      </div>

      <h3>Доки</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Название</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Объект</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Тип</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Статус</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Доступные зоны</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Доступные типы перевозок</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Длина, м</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Ширина, м</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Макс. нагрузка, кг</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map(d => (
              <tr key={d.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.object?.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.dock_type}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.status}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.available_zones.map(z => z.name).join(', ')}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.available_transport_types.map(t => t.name).join(', ')}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.length_meters ?? ''}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.width_meters ?? ''}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.max_load_kg ?? ''}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <button onClick={() => startEdit(d)}>Изменить</button>
                  <button onClick={() => remove(d.id!)} style={{ marginLeft: 8 }}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminDocks