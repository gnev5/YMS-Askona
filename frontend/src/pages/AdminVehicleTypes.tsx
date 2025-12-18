import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface VehicleType {
  id?: number
  name: string
  duration_minutes: number
}

const emptyVT: VehicleType = { name: '', duration_minutes: 60 }

const AdminVehicleTypes: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [items, setItems] = useState<VehicleType[]>([])
  const [form, setForm] = useState<VehicleType>({ ...emptyVT })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const token = useMemo(() => localStorage.getItem('token'), [])
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await axios.get<VehicleType[]>(`${API_BASE}/api/vehicle-types/`)
      setItems(data)
    } catch (e: any) {
      setError('Ошибка загрузки типов ТС')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const resetForm = () => { setForm({ ...emptyVT }); setEditingId(null) }

  const create = async () => {
    setError(null); setSuccess(null)
    try {
      await axios.post(`${API_BASE}/api/vehicle-types/`, form, { headers })
      setSuccess('Тип ТС создан')
      resetForm()
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка создания')
    }
  }

  const startEdit = (it: VehicleType) => {
    setEditingId(it.id!)
    setForm({ ...it })
  }

  const update = async () => {
    if (!editingId) return
    setError(null); setSuccess(null)
    try {
      await axios.put(`${API_BASE}/api/vehicle-types/${editingId}`, form, { headers })
      setSuccess('Тип ТС обновлён')
      resetForm()
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка обновления')
    }
  }

  const remove = async (id: number) => {
    if (!confirm('Удалить тип ТС?')) return
    setError(null); setSuccess(null)
    try {
      await axios.delete(`${API_BASE}/api/vehicle-types/${id}`, { headers })
      setSuccess('Тип ТС удалён')
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка удаления')
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={onBack}>Назад</button>
      </div>

      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ color: '#16a34a', marginBottom: 8 }}>{success}</div>}

      <h3>Новый тип ТС / Редактирование</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 200px', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input placeholder="Наименование" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input type="number" min={30} step={30} placeholder="Длительность, мин" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
        {editingId ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={update}>Сохранить</button>
            <button onClick={resetForm}>Отмена</button>
          </div>
        ) : (
          <button onClick={create}>Создать</button>
        )}
      </div>

      <h3>Типы ТС</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Наименование</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Длительность, мин</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{it.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{it.duration_minutes}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <button onClick={() => startEdit(it)}>Изменить</button>
                  <button onClick={() => remove(it.id!)} style={{ marginLeft: 8 }}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminVehicleTypes
