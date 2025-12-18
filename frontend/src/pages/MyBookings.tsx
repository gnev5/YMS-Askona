import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useAuth } from '../state/AuthContext'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface Booking {
  id: number
  booking_date: string
  start_time: string
  end_time: string
  vehicle_plate: string
  driver_name?: string
  driver_full_name?: string
  driver_phone: string
  vehicle_type_name: string
  dock_name: string
  status: string
  slots_count: number
  created_at: string
  supplier_name?: string
  zone_name?: string
  transport_type_name?: string
  cubes?: number
  transport_sheet?: string
  user_email?: string
  user_full_name?: string
}

const MyBookings: React.FC<{ onBack: () => void; onBookingCancelled?: () => void; }> = ({ onBack, onBookingCancelled }) => {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    supplier: '',
    zone: '',
    transport_type: '',
    vehicle_plate: '',
    driver_name: '',
    user_email: ''
  })

  const token = useMemo(() => localStorage.getItem('token'), [])
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const loadBookings = async () => {
    setLoading(true); setError(null)
    try {
      // Для администраторов загружаем все записи, для обычных пользователей - только свои
      const endpoint = user?.role === 'admin' ? '/api/bookings/all' : '/api/bookings/my'
      const { data } = await axios.get<Booking[]>(`${API_BASE}${endpoint}`, { headers })
      setBookings(data)
      setFilteredBookings(data)
    } catch (e: any) {
      const msg = e.response?.data?.detail || e.message || 'Ошибка загрузки записей'
      setError(msg)
    } finally { setLoading(false) }
  }

  const applyFilters = () => {
    let filtered = bookings

    if (filters.supplier) {
      filtered = filtered.filter(b => 
        b.supplier_name?.toLowerCase().includes(filters.supplier.toLowerCase())
      )
    }

    if (filters.zone) {
      filtered = filtered.filter(b => 
        b.zone_name?.toLowerCase().includes(filters.zone.toLowerCase())
      )
    }

    if (filters.transport_type) {
      filtered = filtered.filter(b => 
        b.transport_type_name?.toLowerCase().includes(filters.transport_type.toLowerCase())
      )
    }

    if (filters.vehicle_plate) {
      filtered = filtered.filter(b => 
        b.vehicle_plate.toLowerCase().includes(filters.vehicle_plate.toLowerCase())
      )
    }

    if (filters.driver_name) {
      filtered = filtered.filter(b => {
        const driverName = (b.driver_full_name || b.driver_name || '').toLowerCase()
        return driverName.includes(filters.driver_name.toLowerCase())
      })
    }

    if (filters.user_email && user?.role === 'admin') {
      filtered = filtered.filter(b => 
        (b.user_email || '').toLowerCase().includes(filters.user_email.toLowerCase()) ||
        (b.user_full_name || '').toLowerCase().includes(filters.user_email.toLowerCase())
      )
    }

    setFilteredBookings(filtered)
  }

  useEffect(() => { loadBookings() }, [])
  useEffect(() => { applyFilters() }, [filters, bookings])

  const cancelBooking = async (bookingId: number) => {
    if (!window.confirm('Отменить запись?')) return
    setError(null); setSuccess(null)
    try {
      await axios.put(`${API_BASE}/api/bookings/${bookingId}/cancel`, {}, { headers })
      setSuccess('Запись отменена')
      loadBookings()
      if (onBookingCancelled) {
        onBookingCancelled()
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка отмены')
    }
  }

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd.MM.yyyy', { locale: ru })
  }

  const formatTime = (timeStr: string) => {
    return timeStr.slice(0, 5)
  }

  const renderDriver = (b: Booking) => b.driver_full_name || b.driver_name || ''

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={onBack}>Назад</button>
      </div>

      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ color: '#16a34a', marginBottom: 8 }}>{success}</div>}

      <h3>{user?.role === 'admin' ? 'Все записи' : 'Мои записи'} ({filteredBookings.length})</h3>
      
      {/* Фильтры */}
      <div style={{ 
        border: '1px solid #e5e7eb', 
        borderRadius: 8, 
        padding: 16, 
        marginBottom: 16,
        backgroundColor: '#f9fafb'
      }}>
        <h4 style={{ margin: '0 0 12px 0' }}>Фильтры</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Поставщик:</label>
            <input
              type="text"
              value={filters.supplier}
              onChange={e => setFilters(prev => ({ ...prev, supplier: e.target.value }))}
              placeholder="Поиск по поставщику"
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Зона:</label>
            <input
              type="text"
              value={filters.zone}
              onChange={e => setFilters(prev => ({ ...prev, zone: e.target.value }))}
              placeholder="Поиск по зоне"
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Тип перевозки:</label>
            <input
              type="text"
              value={filters.transport_type}
              onChange={e => setFilters(prev => ({ ...prev, transport_type: e.target.value }))}
              placeholder="Поиск по типу перевозки"
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Номер ТС:</label>
            <input
              type="text"
              value={filters.vehicle_plate}
              onChange={e => setFilters(prev => ({ ...prev, vehicle_plate: e.target.value }))}
              placeholder="Поиск по номеру ТС"
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Водитель:</label>
            <input
              type="text"
              value={filters.driver_name}
              onChange={e => setFilters(prev => ({ ...prev, driver_name: e.target.value }))}
              placeholder="Поиск по водителю"
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          {user?.role === 'admin' && (
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Пользователь:</label>
              <input
                type="text"
                value={filters.user_email}
                onChange={e => setFilters(prev => ({ ...prev, user_email: e.target.value }))}
                placeholder="Поиск по пользователю"
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <button 
            onClick={() => setFilters({ supplier: '', zone: '', transport_type: '', vehicle_plate: '', driver_name: '', user_email: '' })}
            style={{ 
              backgroundColor: '#6b7280', 
              color: 'white', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Очистить фильтры
          </button>
        </div>
      </div>
      
      {loading ? (
        <div>Загрузка...</div>
      ) : filteredBookings.length === 0 ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: 32 }}>
          {bookings.length === 0 ? 
            (user?.role === 'admin' ? 'В системе пока нет записей' : 'У вас пока нет записей') : 
            'Записи не найдены по заданным фильтрам'
          }
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Дата</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Время</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Док</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Тип ТС</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Номер ТС</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Водитель</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Телефон</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Поставщик</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Зона</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Тип перевозки</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Кубы</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Транспортный лист</th>
                {user?.role === 'admin' && (
                  <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Пользователь</th>
                )}
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map(b => (
                <tr key={b.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{formatDate(b.booking_date)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{formatTime(b.start_time)} - {formatTime(b.end_time)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{b.dock_name}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{b.vehicle_type_name}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{b.vehicle_plate}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{renderDriver(b)}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{b.driver_phone}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{b.supplier_name || '-'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{b.zone_name || '-'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{b.transport_type_name || '-'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{b.cubes || '-'}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{b.transport_sheet || '-'}</td>
                  {user?.role === 'admin' && (
                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontSize: '12px' }}>
                        <div style={{ fontWeight: 'bold' }}>{b.user_full_name || '-'}</div>
                        <div style={{ color: '#6b7280' }}>{b.user_email || '-'}</div>
                      </div>
                    </td>
                  )}
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <button onClick={() => cancelBooking(b.id)} style={{ backgroundColor: '#ef4444', color: 'white' }}>Отменить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default MyBookings
