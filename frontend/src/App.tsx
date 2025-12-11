import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Calendar, dateFnsLocalizer, SlotInfo, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { useAuth } from './state/AuthContext'
import BookingModal from './components/BookingModal'
import AdminSchedule from './pages/AdminSchedule'
import AdminDocks from './pages/AdminDocks'
import AdminVehicleTypes from './pages/AdminVehicleTypes'
import AdminZones from './pages/AdminZones'
import AdminSuppliers from './pages/AdminSuppliers'
import AdminTransportTypes from './pages/AdminTransportTypes'
import AdminTimeSlots from './pages/AdminTimeSlots'
import MyBookings from './pages/MyBookings'
import AdminUsers from './pages/AdminUsers'
import Analytics from './pages/Analytics'

const locales = { 'ru': ru }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
})

// Use full backend URL instead of proxy
const API_BASE = 'http://localhost:8000'

interface TimeSlot {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
  capacity: number
  occupancy: number
  status: 'free' | 'partial' | 'full' | string
}

interface EventItem {
  id: string
  title: string
  start: Date
  end: Date
  resource: TimeSlot
  availableDocks?: number[] // ID доступных доков для этого времени
}

const Login: React.FC = () => {
  const { login } = useAuth()
  const [email, setEmail] = useState('admin@yms.local')
  const [password, setPassword] = useState('Admin1234!')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000))
      await Promise.race([
        login(email, password),
        timeout,
      ])
    } catch (err: any) {
      const msg = err?.response?.data?.detail || (err?.message === 'timeout' ? 'Таймаут запроса' : 'Ошибка логина')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="center">
      <form className="card" onSubmit={onSubmit}>
        <h2>Вход</h2>
        <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input placeholder="Пароль" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <div className="error">{error}</div>}
        <button disabled={loading}>{loading ? '...' : 'Войти'}</button>
      </form>
    </div>
  )
}

const CalendarView: React.FC<{ onGoAdmin: (page: 'schedule' | 'docks' | 'vehicle-types' | 'zones' | 'suppliers' | 'transport-types') => void, onGoMyBookings: () => void, onGoUsers: () => void, onGoAnalytics: () => void }> = ({ onGoAdmin, onGoMyBookings, onGoUsers, onGoAnalytics }) => {
  const { token, user, logout } = useAuth()
  const [events, setEvents] = useState<EventItem[]>([])
  const initialWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState<View>('week')
  const [range, setRange] = useState<{ start: Date, end: Date }>({ start: initialWeekStart, end: addDays(initialWeekStart, 6) })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date; slotId: number; availableDocks?: number[] } | null>(null)

  const loadEvents = async () => {
    const from = format(range.start, 'yyyy-MM-dd')
    const to = format(range.end, 'yyyy-MM-dd')
    const { data } = await axios.get<TimeSlot[]>(`${API_BASE}/api/time-slots?from_date=${from}&to_date=${to}`)
    const evts: EventItem[] = []
    
    for (let d = new Date(range.start); d <= range.end; d = new Date(d.getTime() + 86400000)) {
      const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
      const daySlots = data.filter(s => s.day_of_week === dow)
      
      // Группируем слоты по времени (start_time + end_time)
      const slotGroups = new Map<string, TimeSlot[]>()
      
      daySlots.forEach(slot => {
        const timeKey = `${slot.start_time}-${slot.end_time}`
        if (!slotGroups.has(timeKey)) {
          slotGroups.set(timeKey, [])
        }
        slotGroups.get(timeKey)!.push(slot)
      })
      
      // Создаем объединенные события для каждой группы времени
      slotGroups.forEach((slots, timeKey) => {
        if (slots.length === 0) return
        
        const [sh, sm] = slots[0].start_time.split(":").map(Number)
        const [eh, em] = slots[0].end_time.split(":").map(Number)
        const start = new Date(d)
        start.setHours(sh, sm, 0, 0)
        const end = new Date(d)
        end.setHours(eh, em, 0, 0)
        
        // Суммируем емкость и занятость всех доков для этого времени
        const totalCapacity = slots.reduce((sum, slot) => sum + slot.capacity, 0)
        const totalOccupancy = slots.reduce((sum, slot) => sum + slot.occupancy, 0)
        
        // Определяем общий статус
        let status = 'free'
        if (totalOccupancy === 0) {
          status = 'free'
        } else if (totalOccupancy < totalCapacity) {
          status = 'partial'
        } else {
          status = 'full'
        }
        
        const title = `${totalOccupancy}/${totalCapacity}`
        
        // Создаем объединенный ресурс с общей информацией
        const combinedResource: TimeSlot = {
          id: slots[0].id, // Используем ID первого слота как основной
          day_of_week: slots[0].day_of_week,
          start_time: slots[0].start_time,
          end_time: slots[0].end_time,
          capacity: totalCapacity,
          occupancy: totalOccupancy,
          status: status as 'free' | 'partial' | 'full'
        }
        
        // Собираем ID всех доков с доступными слотами
        const availableDocks = slots
          .filter(slot => slot.occupancy < slot.capacity) // Только доки с свободными местами
          .map(slot => slot.dock_id)
        
        evts.push({ 
          id: `combined-${timeKey}-${d.toDateString()}`, 
          title, 
          start, 
          end, 
          resource: combinedResource,
          availableDocks
        })
      })
    }
    setEvents(evts)
  }

  useEffect(() => {
    loadEvents()
  }, [range.start, range.end])

  const eventPropGetter = (event: EventItem) => {
    const status = String(event.resource.status || '').toLowerCase()
    let bg = '#e6ffed'
    let border = '#22c55e'
    
    if (status === 'partial') {
      bg = '#fff7e6'
      border = '#f59e0b'
    } else if (status === 'full') {
      bg = '#ffe6e6'
      border = '#ef4444'
    }
    
    return { 
      style: { 
        backgroundColor: bg, 
        borderLeft: `4px solid ${border}`, 
        cursor: status !== 'full' ? 'pointer' : 'default', 
        color: '#1e3a8a' 
      } 
    }
  }

  const onRangeChange = (r: any) => {
    if (Array.isArray(r)) {
      const start = r[0]
      const end = r[r.length - 1]
      setRange({ start, end })
    } else if ('start' in r && 'end' in r) {
      setRange({ start: r.start, end: r.end })
    }
  }

  const onViewChange = (newView: View) => {
    setCurrentView(newView)
    if (newView === 'day') {
      setRange({ start: currentDate, end: currentDate })
    } else if (newView === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      setRange({ start: weekStart, end: addDays(weekStart, 6) })
    }
  }

  const openModalForEvent = (evt: EventItem) => {
    if (!token) return
    if (String(evt.resource.status).toLowerCase() === 'full') return
    setSelectedSlot({ 
      start: evt.start, 
      end: evt.end, 
      slotId: evt.resource.id,
      availableDocks: evt.availableDocks
    })
    setIsModalOpen(true)
  }

  const onSelectSlot = (slotInfo: SlotInfo) => {
    if (!token) return
    const match = events.find(e => e.start.getTime() === slotInfo.start.getTime() && e.end.getTime() === slotInfo.end.getTime())
    if (match) {
      openModalForEvent(match)
    }
  }

  const handleBookingSuccess = () => {
    loadEvents()
  }

  return (
    <div>
      <div className="topbar" style={{ gap: 8 }}>
        <div>Пользователь: {user?.email} ({user?.role})</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onGoMyBookings}>Мои записи</button>
          {user?.role?.toLowerCase?.().includes('admin') && (
            <>
              <button onClick={() => onGoAdmin('schedule')}>Расписание</button>
              <button onClick={() => onGoAdmin('docks')}>Доки</button>
              <button onClick={() => onGoAdmin('vehicle-types')}>Типы ТС</button>
              <button onClick={() => onGoAdmin('zones')}>Зоны</button>
              <button onClick={() => onGoAdmin('suppliers')}>Поставщики</button>
              <button onClick={() => onGoAdmin('transport-types')}>Типы перевозки</button>
              <button onClick={onGoUsers}>Пользователи</button>
              <button onClick={onGoAnalytics}>Аналитика</button>
            </>
          )}
          {token ? <button onClick={logout}>Выйти</button> : null}
        </div>
      </div>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 'calc(100vh - 60px)', padding: 16 }}
        selectable
        step={30}
        timeslots={1}
        views={['week','day']}
        defaultView={'week' as any}
        defaultDate={initialWeekStart}
        date={currentDate}
        view={currentView}
        onSelectEvent={openModalForEvent as any}
        onSelectSlot={onSelectSlot}
        onRangeChange={onRangeChange as any}
        onView={onViewChange as any}
        onNavigate={(newDate) => setCurrentDate(newDate)}
        eventPropGetter={eventPropGetter as any}
        popup
        culture="ru"
        formats={{
          timeGutterFormat: 'HH:mm',
          eventTimeRangeFormat: ({ start, end }: any) => 
            `${start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
          agendaTimeFormat: 'HH:mm',
          agendaTimeRangeFormat: ({ start, end }: any) => 
            `${start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
          dayFormat: (date: Date) => {
            const dayName = date.toLocaleDateString('ru-RU', { weekday: 'long' })
            const day = date.getDate()
            const month = date.toLocaleDateString('ru-RU', { month: 'long' })
            return `${dayName}, ${day} ${month}`
          },
          dayHeaderFormat: (date: Date) => {
            const dayName = date.toLocaleDateString('ru-RU', { weekday: 'long' })
            const day = date.getDate()
            const month = date.toLocaleDateString('ru-RU', { month: 'long' })
            return `${dayName}, ${day} ${month}`
          },
          dayRangeFormat: ({ start, end }: any) => 
            `${start.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' })} - ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'numeric' })}`,
          monthHeaderFormat: 'MMMM YYYY',
          weekdayFormat: 'dddd'
        }}
      />
      
      <BookingModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedSlot(null)
        }}
        selectedSlot={selectedSlot}
        onBookingSuccess={handleBookingSuccess}
      />
    </div>
  )
}

const App: React.FC = () => {
  const { token, user } = useAuth()
  const [page, setPage] = useState<'calendar' | 'admin-schedule' | 'admin-docks' | 'admin-vehicle-types' | 'admin-zones' | 'admin-suppliers' | 'admin-transport-types' | 'admin-time-slots' | 'my-bookings' | 'admin-users' | 'analytics'>('calendar')

  if (!token) return <Login />

  if (page === 'admin-schedule') return <AdminSchedule onBack={() => setPage('calendar')} onOpenTimeSlots={() => setPage('admin-time-slots')} />
  if (page === 'admin-docks') return <AdminDocks onBack={() => setPage('calendar')} />
  if (page === 'admin-vehicle-types') return <AdminVehicleTypes onBack={() => setPage('calendar')} />
  if (page === 'admin-zones') return <AdminZones onBack={() => setPage('calendar')} />
  if (page === 'admin-suppliers') return <AdminSuppliers onBack={() => setPage('calendar')} />
  if (page === 'admin-transport-types') return <AdminTransportTypes onBack={() => setPage('calendar')} />
  if (page === 'admin-time-slots') return <AdminTimeSlots onBack={() => setPage('admin-schedule')} />
  if (page === 'my-bookings') return <MyBookings onBack={() => setPage('calendar')} />
  if (page === 'admin-users') return <AdminUsers onBack={() => setPage('calendar')} />
  if (page === 'analytics') return <Analytics onBack={() => setPage('calendar')} />

  return <CalendarView 
    onGoAdmin={(p) => {
      switch(p) {
        case 'schedule': return setPage('admin-schedule')
        case 'docks': return setPage('admin-docks')
        case 'vehicle-types': return setPage('admin-vehicle-types')
        case 'zones': return setPage('admin-zones')
        case 'suppliers': return setPage('admin-suppliers')
        case 'transport-types': return setPage('admin-transport-types')
        default: return setPage('admin-schedule')
      }
    }} 
    onGoMyBookings={() => setPage('my-bookings')}
    onGoUsers={() => setPage('admin-users')}
    onGoAnalytics={() => setPage('analytics')}
  />
}

export default App
