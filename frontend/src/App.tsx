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

type Page =
  | 'calendar'
  | 'admin-schedule'
  | 'admin-docks'
  | 'admin-vehicle-types'
  | 'admin-zones'
  | 'admin-suppliers'
  | 'admin-transport-types'
  | 'admin-time-slots'
  | 'my-bookings'
  | 'admin-users'
  | 'analytics'

const NAV_ITEMS: { id: Page; label: string; icon: string; admin?: boolean }[] = [
  { id: 'calendar', label: 'Календарь', icon: '📅' },
  { id: 'my-bookings', label: 'Мои бронирования', icon: '🧾' },
  { id: 'analytics', label: 'Аналитика', icon: '📊', admin: true },
  { id: 'admin-schedule', label: 'График работы', icon: '🗓', admin: true },
  { id: 'admin-docks', label: 'Доки', icon: '🚪', admin: true },
  { id: 'admin-vehicle-types', label: 'Типы ТС', icon: '🚛', admin: true },
  { id: 'admin-zones', label: 'Зоны', icon: '🧭', admin: true },
  { id: 'admin-suppliers', label: 'Поставщики', icon: '🏭', admin: true },
  { id: 'admin-transport-types', label: 'Типы перевозки', icon: '📦', admin: true },
  { id: 'admin-time-slots', label: 'Тайм-слоты', icon: '⏱', admin: true },
  { id: 'admin-users', label: 'Пользователи', icon: '👥', admin: true },
]

const locales = { ru }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
})

// Use full backend URL instead of proxy
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface TimeSlot {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
  capacity: number
  occupancy: number
  status: 'free' | 'partial' | 'full' | string
  dock_id?: number
}

interface EventItem {
  id: string
  title: string
  start: Date
  end: Date
  resource: TimeSlot
  availableDocks?: number[]
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

      console.error(err);
      const msg = err?.response?.data?.detail || (err?.message === 'timeout' ? 'Таймаут запроса' : 'Ошибка логина')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-hero">
      <div className="login-card">
        <div className="login-logo">Y</div>
        <div>
          <h2 className="login-title">Вход в YMS Askona</h2>
          <p className="login-subtitle">Планирование ворот, слотов и поставщиков</p>
        </div>
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Пароль" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          {error && <div className="error">{error}</div>}
          <button disabled={loading}>{loading ? '...' : 'Войти'}</button>
        </form>
      </div>
    </div>
  )
}

const CalendarView: React.FC<{ goToPage: (p: Page) => void }> = ({ goToPage }) => {
  const { token, user } = useAuth()
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
      
      const slotGroups = new Map<string, TimeSlot[]>()
      
      daySlots.forEach(slot => {
        const timeKey = `${slot.start_time}-${slot.end_time}`
        if (!slotGroups.has(timeKey)) {
          slotGroups.set(timeKey, [])
        }
        slotGroups.get(timeKey)!.push(slot)
      })
      
      slotGroups.forEach((slots, timeKey) => {
        if (slots.length === 0) return
        
        const [sh, sm] = slots[0].start_time.split(':').map(Number)
        const [eh, em] = slots[0].end_time.split(':').map(Number)
        const start = new Date(d)
        start.setHours(sh, sm, 0, 0)
        const end = new Date(d)
        end.setHours(eh, em, 0, 0)
        
        const totalCapacity = slots.reduce((sum, slot) => sum + slot.capacity, 0)
        const totalOccupancy = slots.reduce((sum, slot) => sum + slot.occupancy, 0)
        
        let status: 'free' | 'partial' | 'full' = 'free'
        if (totalOccupancy === 0) {
          status = 'free'
        } else if (totalOccupancy < totalCapacity) {
          status = 'partial'
        } else {
          status = 'full'
        }
        
        const title = `${totalOccupancy}/${totalCapacity}`
        
        const combinedResource: TimeSlot = {
          id: slots[0].id,
          day_of_week: slots[0].day_of_week,
          start_time: slots[0].start_time,
          end_time: slots[0].end_time,
          capacity: totalCapacity,
          occupancy: totalOccupancy,
          status,
        }
        
        const availableDocks = slots
          .filter(slot => slot.occupancy < slot.capacity)
          .map(slot => slot.dock_id)
          .filter((id): id is number => typeof id === 'number')
        
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const stats = useMemo(() => {
    const totalSlots = events.length
    const freeSlots = events.filter(e => e.resource.status === 'free').length
    const partialSlots = events.filter(e => e.resource.status === 'partial').length
    const fullSlots = events.filter(e => e.resource.status === 'full').length
    const totalCapacity = events.reduce((sum, e) => sum + (e.resource.capacity || 0), 0)
    const totalOccupancy = events.reduce((sum, e) => sum + (e.resource.occupancy || 0), 0)
    const utilization = totalCapacity ? Math.round((totalOccupancy / totalCapacity) * 100) : 0
    return { totalSlots, freeSlots, partialSlots, fullSlots, totalCapacity, totalOccupancy, utilization }
  }, [events])

  const rangeLabel = `${format(range.start, 'dd.MM.yyyy')} — ${format(range.end, 'dd.MM.yyyy')}`

  return (
    <div className="surface">
      <div className="section-header" style={{ marginBottom: 12 }}>
        <div>
          <div className="section-title">
            <span>Расписание слотов</span>
            <span className="pill">{rangeLabel}</span>
          </div>
          <div className="subtitle">Неделя приемки/отгрузки. Статус, заполненность и слоты.</div>
        </div>
        <div className="inline-actions">
          <button className="btn-secondary" onClick={() => goToPage('my-bookings')}>Мои бронирования</button>
          {user?.role?.toLowerCase?.().includes('admin') && (
            <>
              <button className="btn-secondary" onClick={() => goToPage('admin-schedule')}>График</button>
              <button className="btn-secondary" onClick={() => goToPage('admin-suppliers')}>Поставщики</button>
              <button className="btn-secondary" onClick={() => goToPage('analytics')}>Аналитика</button>
            </>
          )}
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Всего слотов</div>
          <div className="value">{stats.totalSlots}</div>
          <div className="meta">Окна на выбранный диапазон</div>
        </div>
        <div className="stat-card">
          <div className="label">Свободно</div>
          <div className="value">{stats.freeSlots}</div>
          <div className="meta">Частично занято: {stats.partialSlots}</div>
        </div>
        <div className="stat-card">
          <div className="label">Занятость</div>
          <div className="value">{stats.totalOccupancy}/{stats.totalCapacity}</div>
          <div className="meta">Utilization: {stats.utilization}%</div>
        </div>
        <div className="stat-card">
          <div className="label">Закрыто слотов</div>
          <div className="value">{stats.fullSlots}</div>
          <div className="meta">Недоступно для брони</div>
        </div>
      </div>

      <div className="calendar-shell" style={{ marginTop: 12 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 'calc(100vh - 280px)' }}
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
      </div>
      
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

const AppShell: React.FC<{ page: Page; onNavigate: (p: Page) => void; children: React.ReactNode }> = ({ page, onNavigate, children }) => {
  const { user, logout } = useAuth()
  const isAdmin = user?.role?.toLowerCase?.().includes('admin')
  const navItems = NAV_ITEMS.filter(item => !item.admin || isAdmin)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-badge">YMS</div>
          <div>
            <div>Askona Yard</div>
            <div style={{ fontSize: 12, color: '#cbd5e1' }}>Слоты, доки, поставки</div>
          </div>
        </div>
        <nav>
          {navItems.map(item => (
            <div
              key={item.id}
              className={`nav-item ${page === item.id ? 'active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.admin && <span className="nav-pill">Admin</span>}
            </div>
          ))}
        </nav>
      </aside>

      <div className="main-area">
        <header className="app-header">
          <div>
            <div className="title">YMS Askona</div>
            <div className="subtitle">Планирование ворот и поставщиков</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="user-chip">
              <div style={{ width: 36, height: 36, borderRadius: 12, background: '#eef2ff', display: 'grid', placeItems: 'center', fontWeight: 700, color: '#1e3a8a' }}>
                {user?.email?.[0]?.toUpperCase?.() || 'U'}
              </div>
              <div>
                <div style={{ fontWeight: 700 }}>{user?.email || 'Пользователь'}</div>
                <div className="role">{user?.role || 'Роль не указана'}</div>
              </div>
            </div>
            <button className="btn-ghost" onClick={logout}>Выйти</button>
          </div>
        </header>

        <div className="page-body">
          {children}
        </div>
      </div>
    </div>
  )
}

const App: React.FC = () => {
  const { token } = useAuth()
  const [page, setPage] = useState<Page>('calendar')
  const [calendarKey, setCalendarKey] = useState(0)

  if (!token) return <Login />

  const refreshCalendar = () => setCalendarKey(prev => prev + 1)

  const renderPage = () => {
    switch (page) {
      case 'admin-schedule':
        return <AdminSchedule onBack={() => setPage('calendar')} onOpenTimeSlots={() => setPage('admin-time-slots')} />
      case 'admin-docks':
        return <AdminDocks onBack={() => setPage('calendar')} />
      case 'admin-vehicle-types':
        return <AdminVehicleTypes onBack={() => setPage('calendar')} />
      case 'admin-zones':
        return <AdminZones onBack={() => setPage('calendar')} />
      case 'admin-suppliers':
        return <AdminSuppliers onBack={() => setPage('calendar')} />
      case 'admin-transport-types':
        return <AdminTransportTypes onBack={() => setPage('calendar')} />
      case 'admin-time-slots':
        return <AdminTimeSlots onBack={() => setPage('admin-schedule')} />
      case 'my-bookings':
        return <MyBookings onBack={() => setPage('calendar')} onBookingCancelled={refreshCalendar} />
      case 'admin-users':
        return <AdminUsers onBack={() => setPage('calendar')} />
      case 'analytics':
        return <Analytics onBack={() => setPage('calendar')} />
      default:
        return <CalendarView goToPage={setPage} key={calendarKey} />
    }
  }

  return (
    <AppShell page={page} onNavigate={setPage}>
      {renderPage()}
    </AppShell>
  )
}

export default App
