import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useAuth } from '../state/AuthContext'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

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
  user_login?: string
  user_email?: string
  user_full_name?: string
  is_owner?: boolean
  can_modify?: boolean
  object_id?: number
  object_name?: string
}

type Filters = {
  supplier: string
  zone: string
  transport_type: string
  vehicle_plate: string
  driver_name: string
  transport_sheet: string
  user_email: string
  objects: number[]
  date_from: string
  date_to: string
}

const toYmd = (date: Date) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

const defaultFilters = (): Filters => {
  const today = new Date()
  const inThreeDays = new Date(today)
  inThreeDays.setDate(today.getDate() + 3)

  return {
    supplier: '',
    zone: '',
    transport_type: '',
    vehicle_plate: '',
    driver_name: '',
    transport_sheet: '',
    user_email: '',
    objects: [],
    date_from: toYmd(today),
    date_to: toYmd(inThreeDays),
  }
}

const MyBookings: React.FC<{ onBack?: () => void; onBookingCancelled?: () => void }> = ({ onBack, onBookingCancelled }) => {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [savingTransportSheet, setSavingTransportSheet] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>(defaultFilters())
  const [editTransportSheet, setEditTransportSheet] = useState<{ open: boolean; bookingId: number | null; value: string }>({ open: false, bookingId: null, value: '' })

  const token = useMemo(() => localStorage.getItem('token'), [])
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const objectOptions = useMemo(() => {
    const map = new Map<number, string>()
    bookings.forEach(b => {
      if (b.object_id && b.object_name) {
        map.set(b.object_id, b.object_name)
      }
    })
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [bookings])

  const normalizeBookingDate = (dateStr: string) => dateStr?.split('T')[0] || dateStr

  const loadBookings = async () => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = user?.role === 'admin' ? '/api/bookings/all' : '/api/bookings/my'
      const { data } = await axios.get<Booking[]>(`${API_BASE}${endpoint}`, { headers })
      setBookings(data)
      setFilteredBookings(data)
    } catch (e: any) {
      const msg = e.response?.data?.detail || e.message || 'Ошибка загрузки бронирований'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = () => {
    let filtered = bookings

    if (filters.supplier) {
      filtered = filtered.filter(b => b.supplier_name?.toLowerCase().includes(filters.supplier.toLowerCase()))
    }

    if (filters.zone) {
      filtered = filtered.filter(b => b.zone_name?.toLowerCase().includes(filters.zone.toLowerCase()))
    }

    if (filters.transport_type) {
      filtered = filtered.filter(b => b.transport_type_name?.toLowerCase().includes(filters.transport_type.toLowerCase()))
    }

    if (filters.vehicle_plate) {
      filtered = filtered.filter(b => b.vehicle_plate.toLowerCase().includes(filters.vehicle_plate.toLowerCase()))
    }

    if (filters.driver_name) {
      filtered = filtered.filter(b => {
        const driverName = (b.driver_full_name || b.driver_name || '').toLowerCase()
        return driverName.includes(filters.driver_name.toLowerCase())
      })
    }

    if (filters.transport_sheet) {
      filtered = filtered.filter(b => (b.transport_sheet || '').toLowerCase().includes(filters.transport_sheet.toLowerCase()))
    }

    if (filters.objects.length > 0) {
      filtered = filtered.filter(b => b.object_id && filters.objects.includes(b.object_id))
    }

    if (filters.date_from) {
      filtered = filtered.filter(b => normalizeBookingDate(b.booking_date) >= filters.date_from)
    }

    if (filters.date_to) {
      filtered = filtered.filter(b => normalizeBookingDate(b.booking_date) <= filters.date_to)
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

  const openTransportSheetModal = (booking: Booking) => {
    setEditTransportSheet({ open: true, bookingId: booking.id, value: booking.transport_sheet || '' })
    setError(null)
    setSuccess(null)
  }

  const closeTransportSheetModal = () => {
    setEditTransportSheet({ open: false, bookingId: null, value: '' })
  }

  const saveTransportSheet = async () => {
    if (!editTransportSheet.bookingId) return
    setError(null); setSuccess(null); setSavingTransportSheet(true)
    try {
      await axios.put(
        `${API_BASE}/api/bookings/${editTransportSheet.bookingId}/transport-sheet`,
        { transport_sheet: editTransportSheet.value || null },
        { headers }
      )
      await loadBookings()
      setSuccess('Транспортный лист обновлен')
      closeTransportSheetModal()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Не удалось обновить транспортный лист')
    } finally {
      setSavingTransportSheet(false)
    }
  }

  const cancelBooking = async (bookingId: number) => {
    if (!window.confirm('Отменить бронирование?')) return
    setError(null); setSuccess(null)
    try {
      await axios.put(`${API_BASE}/api/bookings/${bookingId}/cancel`, {}, { headers })
      setSuccess('Бронь отменена')
      loadBookings()
      if (onBookingCancelled) onBookingCancelled()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Не удалось отменить')
    }
  }

  const formatDate = (dateStr: string) => format(new Date(dateStr), 'dd.MM.yyyy', { locale: ru })
  const formatTime = (timeStr: string) => timeStr.slice(0, 5)
  const renderDriver = (b: Booking) => b.driver_full_name || b.driver_name || ''

  return (
    <div style={{ padding: 16 }}>
      {onBack && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={onBack}>Назад</button>
        </div>
      )}

      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ color: '#16a34a', marginBottom: 8 }}>{success}</div>}

      <h3>{user?.role === 'admin' ? 'Все бронирования' : 'Мои бронирования'} ({filteredBookings.length})</h3>
      
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
              placeholder="Введите название поставщика"
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Зона:</label>
            <input
              type="text"
              value={filters.zone}
              onChange={e => setFilters(prev => ({ ...prev, zone: e.target.value }))}
              placeholder="Введите зону"
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Тип перевозки:</label>
            <input
              type="text"
              value={filters.transport_type}
              onChange={e => setFilters(prev => ({ ...prev, transport_type: e.target.value }))}
              placeholder="Введите тип перевозки"
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Номер авто:</label>
            <input
              type="text"
              value={filters.vehicle_plate}
              onChange={e => setFilters(prev => ({ ...prev, vehicle_plate: e.target.value }))}
              placeholder="Введите номер авто"
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Водитель:</label>
            <input
              type="text"
              value={filters.driver_name}
              onChange={e => setFilters(prev => ({ ...prev, driver_name: e.target.value }))}
              placeholder="Введите ФИО водителя"
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Транспортный лист:</label>
            <input
              type="text"
              value={filters.transport_sheet}
              onChange={e => setFilters(prev => ({ ...prev, transport_sheet: e.target.value }))}
              placeholder="Введите номер ТЛ"
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Объект:</label>
            <select
              multiple
              value={filters.objects.map(String)}
              onChange={e => {
                const selectedIds = Array.from(e.target.selectedOptions).map(opt => Number(opt.value))
                setFilters(prev => ({ ...prev, objects: selectedIds }))
              }}
              style={{ width: '100%', padding: 8, fontSize: '14px', minHeight: 96 }}
            >
              {objectOptions.length === 0 && <option disabled>Нет объектов</option>}
              {objectOptions.map(obj => (
                <option key={obj.id} value={obj.id}>{obj.name}</option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>Можно выбрать несколько объектов</div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Дата бронирования с:</label>
            <input
              type="date"
              value={filters.date_from}
              onChange={e => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Дата бронирования по:</label>
            <input
              type="date"
              value={filters.date_to}
              onChange={e => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
              style={{ width: '100%', padding: 8, fontSize: '14px' }}
            />
          </div>
          {user?.role === 'admin' && (
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Пользователь/почта:</label>
              <input
                type="text"
                value={filters.user_email}
                onChange={e => setFilters(prev => ({ ...prev, user_email: e.target.value }))}
                placeholder="Введите почту или ФИО пользователя"
                style={{ width: '100%', padding: 8, fontSize: '14px' }}
              />
            </div>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <button 
            onClick={() => setFilters(defaultFilters())}
            style={{ 
              backgroundColor: '#6b7280', 
              color: 'white', 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: 4,
              cursor: 'pointer'
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      </div>
      
      {loading ? (
        <div>Загрузка...</div>
      ) : filteredBookings.length === 0 ? (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: 32 }}>
          {bookings.length === 0
            ? (user?.role === 'admin' ? 'Пока нет бронирований' : 'У вас пока нет бронирований')
            : 'Не найдено по фильтрам'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Дата</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Время</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Док</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Объект</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Номер авто</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Водитель</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Телефон</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Тип ТС</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Поставщик</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Зона</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Тип перевозки</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Кубы</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Транспортный лист</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Статус</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Пользователь</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 8 }}>{formatDate(b.booking_date)}</td>
                  <td style={{ padding: 8 }}>{formatTime(b.start_time)} - {formatTime(b.end_time)}</td>
                  <td style={{ padding: 8 }}>{b.dock_name}</td>
                  <td style={{ padding: 8 }}>{b.object_name || '-'}</td>
                  <td style={{ padding: 8 }}>{b.vehicle_plate}</td>
                  <td style={{ padding: 8 }}>{renderDriver(b)}</td>
                  <td style={{ padding: 8 }}>{b.driver_phone}</td>
                  <td style={{ padding: 8 }}>{b.vehicle_type_name}</td>
                  <td style={{ padding: 8 }}>{b.supplier_name || '-'}</td>
                  <td style={{ padding: 8 }}>{b.zone_name || '-'}</td>
                  <td style={{ padding: 8 }}>{b.transport_type_name || '-'}</td>
                  <td style={{ padding: 8 }}>{b.cubes || '-'}</td>
                  <td style={{ padding: 8 }}>{b.transport_sheet || '-'}</td>
                  <td style={{ padding: 8 }}>{b.status}</td>
                  <td style={{ padding: 8 }}>{b.user_full_name || b.user_email || b.user_login || '-'}</td>
                  <td style={{ padding: 8 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {b.can_modify && (
                        <>
                          <button 
                            onClick={() => openTransportSheetModal(b)}
                            style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: 4 }}
                          >
                            Изменить лист
                          </button>
                          {b.status === 'confirmed' && (
                            <button 
                              onClick={() => cancelBooking(b.id)}
                              style={{ padding: '4px 8px', fontSize: '12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: 4 }}
                            >
                              Отменить
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editTransportSheet.open && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}
          onClick={closeTransportSheetModal}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 8,
              width: 'min(420px, 90vw)',
              boxShadow: '0 10px 25px rgba(0,0,0,0.12)'
            }}
          >
            <h4 style={{ marginTop: 0, marginBottom: 12 }}>Изменить транспортный лист</h4>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6 }}>Номер/значение</label>
              <input
                type="text"
                value={editTransportSheet.value}
                onChange={e => setEditTransportSheet(prev => ({ ...prev, value: e.target.value }))}
                maxLength={20}
                style={{ width: '100%', padding: 10, fontSize: 14 }}
                placeholder="Введите номер транспортного листа"
              />
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Не более 20 символов</div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={closeTransportSheetModal}
                style={{ padding: '8px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer' }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={saveTransportSheet}
                disabled={savingTransportSheet}
                style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer' }}
              >
                {savingTransportSheet ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyBookings
