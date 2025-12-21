import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

type ObjectType = 'warehouse' | 'production' | 'retail' | 'pickup_point' | 'other'

interface Object {
  id?: number
  name: string
  object_type: ObjectType
  address?: string | null
}

const emptyObject: Object = { name: '', object_type: 'warehouse', address: null }

const AdminObjects: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [items, setItems] = useState<Object[]>([])
  const [form, setForm] = useState<Object>({ ...emptyObject })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const token = useMemo(() => localStorage.getItem('token'), [])
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await axios.get<Object[]>(`${API_BASE}/api/objects/`)
      setItems(data)
    } catch (e: any) {
      setError('Ошибка загрузки объектов')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const resetForm = () => { setForm({ ...emptyObject }); setEditingId(null) }

  const create = async () => {
    setError(null); setSuccess(null)
    try {
      await axios.post(`${API_BASE}/api/objects/`, form, { headers })
      setSuccess('Объект создан')
      resetForm()
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка создания')
    }
  }

  const startEdit = (d: Object) => {
    setEditingId(d.id!)
    setForm({ ...d })
  }

  const update = async () => {
    if (!editingId) return
    setError(null); setSuccess(null)
    try {
      await axios.put(`${API_BASE}/api/objects/${editingId}`, form, { headers })
      setSuccess('Объект обновлён')
      resetForm()
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка обновления')
    }
  }

  const remove = async (id: number) => {
    if (!confirm('Удалить объект?')) return
    setError(null); setSuccess(null)
    try {
      await axios.delete(`${API_BASE}/api/objects/${id}`, { headers })
      setSuccess('Объект удалён')
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

      <h3>Новый объект / Редактирование</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input placeholder="Название" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <select value={form.object_type} onChange={e => setForm({ ...form, object_type: e.target.value as ObjectType })}>
          <option value="warehouse">Склад</option>
          <option value="production">Производство</option>
          <option value="retail">Торговая точка</option>
          <option value="pickup_point">ПВЗ</option>
          <option value="other">Прочее</option>
        </select>
        <input placeholder="Адрес" value={form.address ?? ''} onChange={e => setForm({ ...form, address: e.target.value })} />
        {editingId ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={update}>Сохранить</button>
            <button onClick={resetForm}>Отмена</button>
          </div>
        ) : (
          <button onClick={create}>Создать</button>
        )}
      </div>

      <h3>Объекты</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Название</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Тип</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Адрес</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map(d => (
              <tr key={d.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.object_type}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.address ?? ''}</td>
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

export default AdminObjects
