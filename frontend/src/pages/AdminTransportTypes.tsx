import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface TransportType {
  id: number
  name: string
  enum_value: string
}

const AdminTransportTypes: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [transportTypes, setTransportTypes] = useState<TransportType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingType, setEditingType] = useState<TransportType | null>(null)
  const [formData, setFormData] = useState({ 
    name: '', 
    enum_value: '' 
  })

  const token = localStorage.getItem('token')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const loadTransportTypes = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await axios.get<TransportType[]>(`${API_BASE}/api/transport-types/`)
      setTransportTypes(data)
    } catch (e: any) {
      setError('Ошибка загрузки типов перевозки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTransportTypes()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Название типа перевозки обязательно')
      return
    }
    if (!formData.enum_value.trim()) {
      setError('Значение enum обязательно')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (editingType) {
        await axios.put(`${API_BASE}/api/transport-types/${editingType.id}`, formData, { headers })
        setSuccess('Тип перевозки обновлен')
      } else {
        await axios.post(`${API_BASE}/api/transport-types/`, formData, { headers })
        setSuccess('Тип перевозки создан')
      }
      
      setFormData({ name: '', enum_value: '' })
      setEditingType(null)
      loadTransportTypes()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка сохранения типа перевозки')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (transportType: TransportType) => {
    setEditingType(transportType)
    setFormData({ 
      name: transportType.name, 
      enum_value: transportType.enum_value 
    })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот тип перевозки?')) return

    setLoading(true)
    setError(null)
    try {
      await axios.delete(`${API_BASE}/api/transport-types/${id}`, { headers })
      setSuccess('Тип перевозки удален')
      loadTransportTypes()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка удаления типа перевозки')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setEditingType(null)
    setFormData({ name: '', enum_value: '' })
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <button onClick={onBack}>← Назад</button>
        <h2>Управление типами перевозки</h2>
      </div>

      {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}
      {success && <div className="success" style={{ marginBottom: 16 }}>{success}</div>}

      <form onSubmit={handleSubmit} style={{ marginBottom: 24, padding: 16, border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <h3>{editingType ? 'Редактировать тип перевозки' : 'Добавить тип перевозки'}</h3>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Название типа перевозки:</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Введите название типа перевозки"
            style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }}
            required
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4 }}>Значение enum:</label>
          <select
            value={formData.enum_value}
            onChange={e => setFormData({ ...formData, enum_value: e.target.value })}
            style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }}
            required
          >
            <option value="">Выберите значение</option>
            <option value="own_production">собственное производство</option>
            <option value="purchased">закупная</option>
            <option value="container">контейнер</option>
            <option value="return_goods">возврат</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" disabled={loading}>
            {loading ? 'Сохранение...' : (editingType ? 'Обновить' : 'Создать')}
          </button>
          {editingType && (
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
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Enum значение</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {transportTypes.map(transportType => (
              <tr key={transportType.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{transportType.id}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{transportType.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{transportType.enum_value}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <button 
                    onClick={() => handleEdit(transportType)}
                    style={{ marginRight: 8, padding: '4px 8px', fontSize: '12px' }}
                  >
                    Редактировать
                  </button>
                  <button 
                    onClick={() => handleDelete(transportType.id)}
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

export default AdminTransportTypes
