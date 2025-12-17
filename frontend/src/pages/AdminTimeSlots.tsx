import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface TimeSlot {
  id: number
  dock_id: number
  slot_date: string
  start_time: string
  end_time: string
  capacity: number
  occupancy: number
  status: 'free' | 'partial' | 'full'
  is_available: boolean
  created_at: string
  updated_at: string
}

interface Dock {
  id: number
  name: string
}

interface TimeSlotForm {
  dock_id: number
  slot_date: string
  start_time: string
  end_time: string
  capacity: number
  is_available: boolean
}

const AdminTimeSlots: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [docks, setDocks] = useState<Dock[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedSlots, setSelectedSlots] = useState<number[]>([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<TimeSlotForm>({
    dock_id: 0,
    slot_date: '',
    start_time: '',
    end_time: '',
    capacity: 1,
    is_available: true
  })
  
  // Фильтры
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    dock_id: '',
    is_available: ''
  })

  const token = useMemo(() => localStorage.getItem('token'), [])
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const loadDocks = async () => {
    try {
      const { data } = await axios.get<Dock[]>(`${API_BASE}/api/docks/`)
      setDocks(data)
      if (data.length > 0 && formData.dock_id === 0) {
        setFormData(prev => ({ ...prev, dock_id: data[0].id }))
      }
    } catch (e: any) {
      setError('Ошибка загрузки доков')
    }
  }

  const loadTimeSlots = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.start_date) params.append('start_date', filters.start_date)
      if (filters.end_date) params.append('end_date', filters.end_date)
      if (filters.dock_id) params.append('dock_id', filters.dock_id)
      if (filters.is_available !== '') params.append('is_available', filters.is_available)

      const { data } = await axios.get<TimeSlot[]>(`${API_BASE}/api/time-slots/journal?${params.toString()}`, { headers })
      setTimeSlots(data)
    } catch (e: any) {
      setError('Ошибка загрузки интервалов')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocks()
  }, [])

  useEffect(() => {
    loadTimeSlots()
  }, [filters])

  const handleSelectSlot = (slotId: number) => {
    setSelectedSlots(prev => 
      prev.includes(slotId) 
        ? prev.filter(id => id !== slotId)
        : [...prev, slotId]
    )
  }

  const handleSelectAll = () => {
    if (selectedSlots.length === timeSlots.length) {
      setSelectedSlots([])
    } else {
      setSelectedSlots(timeSlots.map(slot => slot.id))
    }
  }

  const handleBulkDelete = async () => {
    if (selectedSlots.length === 0) {
      setError('Выберите интервалы для удаления')
      return
    }

    if (!confirm(`Удалить ${selectedSlots.length} выбранных интервалов?`)) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      await axios.post(`${API_BASE}/api/time-slots/bulk-delete`, selectedSlots, { headers })
      setSuccess(`Удалено ${selectedSlots.length} интервалов`)
      setSelectedSlots([])
      loadTimeSlots()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка удаления интервалов')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSlot = async () => {
    setLoading(true)
    setError(null)
    try {
      const slotData = {
        ...formData,
        slot_date: formData.slot_date,
        start_time: formData.start_time,
        end_time: formData.end_time
      }
      
      await axios.post(`${API_BASE}/api/time-slots/`, slotData, { headers })
      setSuccess('Интервал создан успешно')
      setShowForm(false)
      setFormData({
        dock_id: docks[0]?.id || 0,
        slot_date: '',
        start_time: '',
        end_time: '',
        capacity: 1,
        is_available: true
      })
      loadTimeSlots()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка создания интервала')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSlot = async (slotId: number) => {
    if (!confirm('Удалить этот интервал?')) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      await axios.delete(`${API_BASE}/api/time-slots/${slotId}`, { headers })
      setSuccess('Интервал удален')
      loadTimeSlots()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка удаления интервала')
    } finally {
      setLoading(false)
    }
  }

  const toggleSlotAvailability = async (slotId: number, isAvailable: boolean) => {
    setLoading(true)
    setError(null)
    try {
      await axios.put(`${API_BASE}/api/time-slots/${slotId}/availability`, { is_available: isAvailable }, { headers })
      setSuccess(`Доступность интервала изменена`)
      loadTimeSlots()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка изменения доступности')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'free': return '#16a34a'
      case 'partial': return '#f59e0b'
      case 'full': return '#dc2626'
      default: return '#6b7280'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'free': return 'Свободен'
      case 'partial': return 'Частично занят'
      case 'full': return 'Занят'
      default: return 'Неизвестно'
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={onBack}>Назад</button>
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Скрыть форму' : 'Добавить интервал'}
        </button>
        {selectedSlots.length > 0 && (
          <button 
            onClick={handleBulkDelete}
            disabled={loading}
            style={{ backgroundColor: '#dc2626', color: 'white' }}
          >
            Удалить выбранные ({selectedSlots.length})
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ 
          border: '1px solid #e5e7eb', 
          borderRadius: 8, 
          padding: 16, 
          marginBottom: 16,
          backgroundColor: '#f9fafb'
        }}>
          <h3 style={{ margin: '0 0 16px 0' }}>Добавить новый интервал</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label>Док:</label>
              <select 
                value={formData.dock_id} 
                onChange={e => setFormData(prev => ({ ...prev, dock_id: Number(e.target.value) }))}
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              >
                {docks.map(dock => (
                  <option key={dock.id} value={dock.id}>{dock.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Дата:</label>
              <input 
                type="date" 
                value={formData.slot_date} 
                onChange={e => setFormData(prev => ({ ...prev, slot_date: e.target.value }))}
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
            </div>
            <div>
              <label>Время начала:</label>
              <input 
                type="time" 
                value={formData.start_time} 
                onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
            </div>
            <div>
              <label>Время окончания:</label>
              <input 
                type="time" 
                value={formData.end_time} 
                onChange={e => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
            </div>
            <div>
              <label>Емкость:</label>
              <input 
                type="number" 
                min="1" 
                value={formData.capacity} 
                onChange={e => setFormData(prev => ({ ...prev, capacity: Number(e.target.value) }))}
                style={{ width: '100%', padding: 8, marginTop: 4 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
              <input 
                type="checkbox" 
                checked={formData.is_available} 
                onChange={e => setFormData(prev => ({ ...prev, is_available: e.target.checked }))}
              />
              <label>Доступен</label>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <button onClick={handleCreateSlot} disabled={loading}>
              Создать интервал
            </button>
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div style={{ 
        border: '1px solid #e5e7eb', 
        borderRadius: 8, 
        padding: 16, 
        marginBottom: 16,
        backgroundColor: '#f9fafb'
      }}>
        <h3 style={{ margin: '0 0 12px 0' }}>Фильтры</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <label>Дата с:</label>
            <input 
              type="date" 
              value={filters.start_date} 
              onChange={e => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            />
          </div>
          <div>
            <label>Дата по:</label>
            <input 
              type="date" 
              value={filters.end_date} 
              onChange={e => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            />
          </div>
          <div>
            <label>Док:</label>
            <select 
              value={filters.dock_id} 
              onChange={e => setFilters(prev => ({ ...prev, dock_id: e.target.value }))}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            >
              <option value="">Все доки</option>
              {docks.map(dock => (
                <option key={dock.id} value={dock.id.toString()}>{dock.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Доступность:</label>
            <select 
              value={filters.is_available} 
              onChange={e => setFilters(prev => ({ ...prev, is_available: e.target.value }))}
              style={{ width: '100%', padding: 8, marginTop: 4 }}
            >
              <option value="">Все</option>
              <option value="true">Доступные</option>
              <option value="false">Недоступные</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ color: '#16a34a', marginBottom: 8 }}>{success}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3>Журнал интервалов ({timeSlots.length})</h3>
        {timeSlots.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input 
              type="checkbox" 
              checked={selectedSlots.length === timeSlots.length && timeSlots.length > 0}
              onChange={handleSelectAll}
            />
            <span>Выбрать все</span>
          </div>
        )}
      </div>

      {loading && <div>Загрузка...</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6' }}>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}></th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Док</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Дата</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Время</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Емкость</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Занятость</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Статус</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Доступность</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {timeSlots.map(slot => {
              const dock = docks.find(d => d.id === slot.dock_id)
              return (
                <tr key={slot.id} style={{ backgroundColor: selectedSlots.includes(slot.id) ? '#fef3c7' : 'white' }}>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedSlots.includes(slot.id)}
                      onChange={() => handleSelectSlot(slot.id)}
                    />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    {dock?.name || `Док #${slot.dock_id}`}
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    {new Date(slot.slot_date).toLocaleDateString('ru-RU')}
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    {slot.start_time} - {slot.end_time}
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    {slot.capacity}
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    {slot.occupancy}/{slot.capacity}
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: getStatusColor(slot.status) }}>
                      {getStatusText(slot.status)}
                    </span>
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <button 
                      onClick={() => toggleSlotAvailability(slot.id, !slot.is_available)}
                      disabled={loading}
                      style={{ 
                        backgroundColor: slot.is_available ? '#16a34a' : '#dc2626',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                    >
                      {slot.is_available ? 'Доступен' : 'Недоступен'}
                    </button>
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <button 
                      onClick={() => handleDeleteSlot(slot.id)}
                      disabled={loading}
                      style={{ 
                        backgroundColor: '#dc2626',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {timeSlots.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
          Интервалы не найдены
        </div>
      )}
    </div>
  )
}

export default AdminTimeSlots
