import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API_BASE = 'http://localhost:8000'

interface Zone {
  id: number
  name: string
}

const AdminZones: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [zones, setZones] = useState<Zone[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingZone, setEditingZone] = useState<Zone | null>(null)
  const [formData, setFormData] = useState({ name: '' })

  const token = localStorage.getItem('token')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const loadZones = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.get<Zone[]>(`${API_BASE}/api/zones/`)
      setZones(data)
    } catch (e: any) {
      setError('Ошибка загрузки зон')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadZones()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Название зоны обязательно')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (editingZone) {
        await axios.put(`${API_BASE}/api/zones/${editingZone.id}`, formData, { headers })
        setSuccess('Зона обновлена')
      } else {
        await axios.post(`${API_BASE}/api/zones/`, formData, { headers })
        setSuccess('Зона создана')
      }
      
      setFormData({ name: '' })
      setEditingZone(null)
      loadZones()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка сохранения зоны')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (zone: Zone) => {
    setEditingZone(zone)
    setFormData({ name: zone.name })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту зону?')) return

    setLoading(true)
    setError(null)
    try {
      await axios.delete(`${API_BASE}/api/zones/${id}`, { headers })
      setSuccess('Зона удалена')
      loadZones()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка удаления зоны')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditingZone(null)
    setFormData({ name: '' })
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={onBack}>← Назад</button>
        <h2>Управление зонами</h2>
      </div>

      {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="success" style={{ marginBottom: 16 }}>{success}</div>}

      <form onSubmit={handleSubmit} style={{ marginBottom: 24, padding: 16, border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h3>{editingZone ? 'Редактировать зону' : 'Добавить зону'}</h3>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Название зоны:</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ name: e.target.value })}
            placeholder="Введите название зоны"
            style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }}
            required
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading}>
            {loading ? 'Сохранение...' : (editingZone ? 'Обновить' : 'Создать')}
          </button>
          {editingZone && (
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
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {zones.map(zone => (
              <tr key={zone.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{zone.id}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{zone.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <button 
                    onClick={() => handleEdit(zone)}
                    style={{ marginRight: 8, padding: '4px 8px', fontSize: '12px' }}
                  >
                    Редактировать
                  </button>
                  <button 
                    onClick={() => handleDelete(zone.id)}
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

export default AdminZones
