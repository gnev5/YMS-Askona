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

  booking_type?: 'in' | 'out' | null
  is_after_noon_for_next_day_msk?: boolean
  is_post_factum_msk?: boolean
  is_created_today_for_today_msk?: boolean

}

interface PaginatedBookingsResponse {
  items: Booking[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

interface ObjectOption {
  id: number
  name: string
}

const DEFAULT_PAGE_SIZE = 50



type Filters = {

  supplier: string

  zone: string

  transport_type: string

  vehicle_plate: string

  driver_name: string

  transport_sheet: string

  booking_type: '' | 'in' | 'out'

  user_email: string

  objects: number[]

  date_from: string

  date_to: string

  only_owner: boolean

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

    booking_type: '',

    user_email: '',

    objects: [],

    date_from: toYmd(today),

    date_to: toYmd(inThreeDays),

    only_owner: false,

  }

}

const clearedFilters = (): Filters => ({
  supplier: '',
  zone: '',
  transport_type: '',
  vehicle_plate: '',
  driver_name: '',
  transport_sheet: '',
  booking_type: '',
  user_email: '',
  objects: [],
  date_from: '',
  date_to: '',
  only_owner: false,
})



const MyBookings: React.FC<{ onBack?: () => void; onBookingCancelled?: () => void }> = ({ onBack, onBookingCancelled }) => {

  const { user } = useAuth()

  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([])

  const [loading, setLoading] = useState(false)

  const [savingTransportSheet, setSavingTransportSheet] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(DEFAULT_PAGE_SIZE)
  const [totalBookings, setTotalBookings] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [objectOptions, setObjectOptions] = useState<ObjectOption[]>([])

  const [error, setError] = useState<string | null>(null)

  const [success, setSuccess] = useState<string | null>(null)

  const [filters, setFilters] = useState<Filters>(defaultFilters())

  const [editTransportSheet, setEditTransportSheet] = useState<{ open: boolean; bookingId: number | null; value: string }>({ open: false, bookingId: null, value: '' })



  const token = useMemo(() => localStorage.getItem('token'), [])

  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const updateFilters = (patch: Partial<Filters>) => {
    setCurrentPage(1)
    setFilters(prev => ({ ...prev, ...patch }))
  }

  const buildBookingQueryParams = (includePagination = true) => {
    const params = new URLSearchParams()

    if (includePagination) {
      params.append('page', currentPage.toString())
      params.append('page_size', pageSize.toString())
    }

    if (filters.supplier) params.append('supplier', filters.supplier)
    if (filters.zone) params.append('zone', filters.zone)
    if (filters.transport_type) params.append('transport_type', filters.transport_type)
    if (filters.vehicle_plate) params.append('vehicle_plate', filters.vehicle_plate)
    if (filters.driver_name) params.append('driver_name', filters.driver_name)
    if (filters.transport_sheet) params.append('transport_sheet', filters.transport_sheet)
    if (filters.booking_type) params.append('booking_type', filters.booking_type)
    if (filters.date_from) params.append('date_from', filters.date_from)
    if (filters.date_to) params.append('date_to', filters.date_to)
    if (filters.only_owner) params.append('only_owner', 'true')
    if (user?.role === 'admin' && filters.user_email) params.append('user_email', filters.user_email)
    filters.objects.forEach(id => params.append('object_id', id.toString()))

    return params
  }



  const loadBookings = async () => {

    setLoading(true)

    setError(null)

    try {

      const endpoint = user?.role === 'admin' ? '/api/bookings/all' : '/api/bookings/my'
      const params = buildBookingQueryParams()
      const query = params.toString()
      const url = query ? `${API_BASE}${endpoint}?${query}` : `${API_BASE}${endpoint}`
      const { data } = await axios.get<PaginatedBookingsResponse>(url, { headers })

      setFilteredBookings(data.items)
      setTotalBookings(data.total)
      setTotalPages(data.total_pages)
      if (data.page !== currentPage) {
        setCurrentPage(data.page)
      }

    } catch (e: any) {

      const msg = e.response?.data?.detail || e.message || 'Ошибка загрузки бронирований'

      setError(msg)

    } finally {

      setLoading(false)

    }

  }

  const loadObjects = async () => {
    try {
      const { data } = await axios.get<ObjectOption[]>(`${API_BASE}/api/objects/`, { headers })
      setObjectOptions([...data].sort((a, b) => a.name.localeCompare(b.name, 'ru')))
    } catch (_e: any) {
      // Не блокируем экран бронирований, если список объектов временно недоступен.
    }
  }



  useEffect(() => {
    loadObjects()
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadBookings()
    }, 250)

    return () => window.clearTimeout(timer)
  }, [filters, currentPage, pageSize, user?.role])



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

  const getFilenameFromDisposition = (contentDisposition?: string) => {
    if (!contentDisposition) return null
    const utfMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1])
    const simpleMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i)
    if (simpleMatch?.[1]) return simpleMatch[1]
    return null
  }

  const exportToExcel = async (variant: 'default' | 'start-end' = 'default') => {
    if (totalBookings === 0) {
      setError('Нет данных для выгрузки по текущим фильтрам')
      return
    }

    setExporting(true)
    setError(null)
    setSuccess(null)

    try {
      const params = buildBookingQueryParams(false)
      params.append('variant', variant)
      const endpoint = `${API_BASE}/api/bookings/export/xlsx?${params.toString()}`
      const response = await axios.post(
        endpoint,
        null,
        {
          headers,
          responseType: 'blob',
        }
      )

      const blob = new Blob(
        [response.data],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      )
      const filename = getFilenameFromDisposition(response.headers['content-disposition']) || (
        variant === 'start-end'
          ? `my_bookings_start_end_export_${Date.now()}.xlsx`
          : `my_bookings_export_${Date.now()}.xlsx`
      )
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      setSuccess('Выгрузка выполнена')
    } catch (e: any) {
      const detail = e?.response?.data?.detail || e?.message || 'Не удалось выгрузить файл'
      setError(typeof detail === 'string' ? detail : 'Не удалось выгрузить файл')
    } finally {
      setExporting(false)
    }
  }

  const pageStart = totalBookings === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = totalBookings === 0 ? 0 : Math.min(totalBookings, currentPage * pageSize)



  return (

    <div style={{ padding: 16 }}>

      {onBack && (

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>

          <button onClick={onBack}>Назад</button>

        </div>

      )}



      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}

      {success && <div style={{ color: '#16a34a', marginBottom: 8 }}>{success}</div>}



      <h3>{user?.role === 'admin' ? 'Все бронирования' : 'Мои бронирования'} ({totalBookings})</h3>

      

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

              onChange={e => updateFilters({ supplier: e.target.value })}

              placeholder="Введите название поставщика"

              style={{ width: '100%', padding: 8, fontSize: '14px' }}

            />

          </div>

          <div>

            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Направление:</label>

            <select

              value={filters.booking_type}

              onChange={e => updateFilters({ booking_type: e.target.value as '' | 'in' | 'out' })}

              style={{ width: '100%', padding: 8, fontSize: '14px' }}

            >

              <option value="">Все</option>

              <option value="in">Вход</option>

              <option value="out">Выход</option>

            </select>

          </div>

          <div>

            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Зона:</label>

            <input

              type="text"

              value={filters.zone}

              onChange={e => updateFilters({ zone: e.target.value })}

              placeholder="Введите зону"

              style={{ width: '100%', padding: 8, fontSize: '14px' }}

            />

          </div>

          <div>

            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Тип перевозки:</label>

            <input

              type="text"

              value={filters.transport_type}

              onChange={e => updateFilters({ transport_type: e.target.value })}

              placeholder="Введите тип перевозки"

              style={{ width: '100%', padding: 8, fontSize: '14px' }}

            />

          </div>

          <div>

            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Номер авто:</label>

            <input

              type="text"

              value={filters.vehicle_plate}

              onChange={e => updateFilters({ vehicle_plate: e.target.value })}

              placeholder="Введите номер авто"

              style={{ width: '100%', padding: 8, fontSize: '14px' }}

            />

          </div>

          <div>

            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Водитель:</label>

            <input

              type="text"

              value={filters.driver_name}

              onChange={e => updateFilters({ driver_name: e.target.value })}

              placeholder="Введите ФИО водителя"

              style={{ width: '100%', padding: 8, fontSize: '14px' }}

            />

          </div>

          <div>

            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Транспортный лист:</label>

            <input

              type="text"

              value={filters.transport_sheet}

              onChange={e => updateFilters({ transport_sheet: e.target.value })}

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

                updateFilters({ objects: selectedIds })

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

              onChange={e => updateFilters({ date_from: e.target.value })}

              style={{ width: '100%', padding: 8, fontSize: '14px' }}

            />

          </div>

          <div>

            <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Дата бронирования по:</label>

            <input

              type="date"

              value={filters.date_to}

              onChange={e => updateFilters({ date_to: e.target.value })}

              style={{ width: '100%', padding: 8, fontSize: '14px' }}

            />

          </div>

          {user?.role === 'admin' && (

            <div>

              <label style={{ display: 'block', marginBottom: 4, fontSize: '14px' }}>Пользователь/почта:</label>

              <input

                type="text"

                value={filters.user_email}

                onChange={e => updateFilters({ user_email: e.target.value })}

                placeholder="Введите почту или ФИО пользователя"

                style={{ width: '100%', padding: 8, fontSize: '14px' }}

              />

            </div>

          )}

        </div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filters.only_owner}
              onChange={e => updateFilters({ only_owner: e.target.checked })}
            />
            Только мои (я владелец)
          </label>

          <button 
            type="button"
            onClick={() => {
              setCurrentPage(1)
              setFilters(clearedFilters())
            }}

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

          <button
            type="button"
            onClick={() => exportToExcel()}
            disabled={exporting}
            style={{
              backgroundColor: '#059669',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.8 : 1
            }}
          >
            {exporting ? '\u0412\u044b\u0433\u0440\u0443\u0437\u043a\u0430...' : '\u041f\u043e\u043b\u043d\u0430\u044f \u0432\u044b\u0433\u0440\u0443\u0437\u043a\u0430 Excel'}
          </button>

          <button
            type="button"
            onClick={() => exportToExcel('start-end')}
            disabled={exporting}
            style={{
              backgroundColor: '#1d4ed8',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: exporting ? 'not-allowed' : 'pointer',
              opacity: exporting ? 0.8 : 1
            }}
          >
            {exporting ? '\u0412\u044b\u0433\u0440\u0443\u0437\u043a\u0430...' : '\u0412\u044b\u0433\u0440\u0443\u0437\u043a\u0430 \u043d\u0430\u0447\u0430\u043b\u043e/\u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u0435 Excel'}
          </button>

        </div>

      </div>

      

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ color: '#4b5563', fontSize: 14 }}>
          {totalBookings > 0 ? `Показано ${pageStart}-${pageEnd} из ${totalBookings}` : 'Нет записей'}
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={loading || currentPage <= 1}
            >
              Назад
            </button>
            <span style={{ fontSize: 14 }}>{`Страница ${currentPage} из ${totalPages}`}</span>
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={loading || currentPage >= totalPages}
            >
              Вперед
            </button>
          </div>
        )}
      </div>

      {loading ? (

        <div>Загрузка...</div>

      ) : filteredBookings.length === 0 ? (

        <div style={{ color: '#6b7280', textAlign: 'center', padding: 32 }}>

          {totalBookings === 0

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

                <tr
                  key={b.id}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    backgroundColor: b.is_post_factum_msk
                      ? '#fee2e2'
                      : b.is_created_today_for_today_msk
                        ? '#fed7aa'
                        : b.is_after_noon_for_next_day_msk
                          ? '#fef9c3'
                          : undefined,
                  }}
                >

                  <td style={{ padding: 8 }}>{formatDate(b.booking_date)}</td>

                  <td style={{ padding: 8 }}>{formatTime(b.start_time)} - {formatTime(b.end_time)}</td>

                  <td style={{ padding: 8 }}>{b.dock_name}</td>

                  <td style={{ padding: 8 }}>{b.object_name || '-'}</td>

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

