import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { Calendar, dateFnsLocalizer, SlotInfo, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import BookingModal from '../components/BookingModal'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const locales = { ru }
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
})

interface YmsObject {
  id: number
  name: string
  object_type: string
}

interface Supplier {
  id: number
  name: string
  transport_types?: TransportType[]
}

interface TransportType {
  id: number
  name: string
}

interface SlotBookingInfo {
  id: number
  supplier_name?: string
  transport_sheet?: string | null
  cubes?: number | null
}

interface Dock {
  id: number
  name: string
  object_id: number
  dock_type: 'entrance' | 'exit' | 'universal' | string
}

interface TimeSlot {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
  capacity: number
  occupancy: number
  status: 'free' | 'partial' | 'full' | string
  dock_id?: number
  bookings?: SlotBookingInfo[]
}

interface EventItem {
  id: string
  title: string
  start: Date
  end: Date
  resource: TimeSlot | 'quota'
  availableDocks?: number[]
  resourceId?: number
  resourceIds?: number[]
  tooltip?: string
  isQuota?: boolean
  quotaTotal?: number | null
  quotaRemaining?: number
  isStart?: boolean
}

interface QuotaAvailability {
  date: string
  total_volume: number | null
  remaining_volume: number
}

const BookingIn: React.FC = () => {
  const [objects, setObjects] = useState<YmsObject[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [transportTypes, setTransportTypes] = useState<TransportType[]>([])
  const [docks, setDocks] = useState<Dock[]>([])
  const [selectedObject, setSelectedObject] = useState<number | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null)
  const [selectedTransportType, setSelectedTransportType] = useState<number | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [quotaByDate, setQuotaByDate] = useState<Record<string, { remaining: number; total: number | null }>>({})
  const initialWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState<View>('week')
  const [range, setRange] = useState<{ start: Date; end: Date }>({ start: initialWeekStart, end: addDays(initialWeekStart, 6) })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date; slotId: number; availableDocks?: number[] } | null>(null)
  const filteredDocks = selectedObject ? docks.filter(d => d.object_id === selectedObject && (d.dock_type === 'entrance' || d.dock_type === 'universal')) : []
  const availableTransportTypes = selectedSupplier
    ? suppliers.find(s => s.id === selectedSupplier)?.transport_types || transportTypes
    : transportTypes

  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; errors: { row_number: number; message: string }[] } | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const token = localStorage.getItem('token')
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const formatBookingTooltip = (bookings?: SlotBookingInfo[]) => {
    if (!bookings || bookings.length === 0) return undefined
    const lines = bookings.map((b, idx) => {
      const transportSheet = b.transport_sheet || 'не указан'
      const supplier = b.supplier_name || 'не указан'
      const volume = b.cubes ?? 'не указан'
      return `${idx + 1}. ТЛ: ${transportSheet} • Поставщик: ${supplier} • Объем: ${volume}`
    })
    return lines.join('\n')
  }

  const formatVolume = (value: number | null | undefined) => {
    if (value === null || value === undefined) return ''
    return Number.isInteger(value) ? `${value}` : value.toFixed(1)
  }

  useEffect(() => {
    const fetchObjects = async () => {
      const { data } = await axios.get<YmsObject[]>(`${API_BASE}/api/objects`)
      setObjects(data.filter(o => o.object_type === 'warehouse'))
    }

    const fetchSuppliers = async () => {
      const { data } = await axios.get<Supplier[]>(`${API_BASE}/api/suppliers`)
      setSuppliers(data)
    }

    const fetchTransportTypes = async () => {
      const { data } = await axios.get<TransportType[]>(`${API_BASE}/api/transport-types/`)
      setTransportTypes(data)
    }

    const fetchDocks = async () => {
      const { data } = await axios.get<Dock[]>(`${API_BASE}/api/docks/`)
      setDocks(data)
    }

    fetchObjects()
    fetchSuppliers()
    fetchTransportTypes()
    fetchDocks()

    const savedObject = localStorage.getItem('selectedObject')
    const savedSupplier = localStorage.getItem('selectedSupplier')
    const savedTransportType = localStorage.getItem('selectedTransportType_In')
    if (savedObject) setSelectedObject(Number(savedObject))
    if (savedSupplier) setSelectedSupplier(Number(savedSupplier))
    if (savedTransportType) setSelectedTransportType(Number(savedTransportType))
  }, [])

  useEffect(() => {
    if (selectedObject) localStorage.setItem('selectedObject', String(selectedObject))
    if (selectedSupplier) localStorage.setItem('selectedSupplier', String(selectedSupplier))
    if (selectedTransportType) localStorage.setItem('selectedTransportType_In', String(selectedTransportType))
    if (selectedObject && selectedSupplier && selectedTransportType) handleSearch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedObject, selectedSupplier, selectedTransportType])

  useEffect(() => {
    const allowedTypes = selectedSupplier
      ? suppliers.find(s => s.id === selectedSupplier)?.transport_types || transportTypes
      : transportTypes

    if (selectedTransportType) {
      const exists = allowedTypes.some(t => t.id === selectedTransportType)
      if (!exists) {
        setSelectedTransportType(null)
      }
    }
    if (!selectedTransportType && allowedTypes.length === 1) {
      setSelectedTransportType(allowedTypes[0].id)
    }
  }, [selectedSupplier, selectedTransportType, suppliers, transportTypes])

  
  const handleSearch = async (rangeOverride?: { start: Date; end: Date }, viewOverride?: View) => {
    if (!selectedObject || !selectedSupplier || !selectedTransportType) {
      setQuotaByDate({})
      return
    }

    const currentRange = rangeOverride || range
    const viewMode = viewOverride || currentView
    const from = format(currentRange.start, 'yyyy-MM-dd')
    const to = format(currentRange.end, 'yyyy-MM-dd')

    try {
      const [slotsRes, quotaRes] = await Promise.all([
        axios.get<TimeSlot[]>(`${API_BASE}/api/time-slots?from_date=${from}&to_date=${to}&object_id=${selectedObject}&supplier_id=${selectedSupplier}&transport_type_id=${selectedTransportType}&booking_type=in`),
        axios.get<QuotaAvailability[]>(`${API_BASE}/api/volume-quotas/availability`, {
          params: {
            from_date: from,
            to_date: to,
            object_id: selectedObject,
            transport_type_id: selectedTransportType,
            direction: 'in',
          },
        }).catch(() => ({ data: [] as QuotaAvailability[] })),
      ])

      const quotaMap: Record<string, { remaining: number; total: number | null }> = {}
      quotaRes.data.forEach(q => {
        quotaMap[q.date] = { remaining: q.total_volume !== null ? q.remaining_volume : 0, total: q.total_volume }
      })
      setQuotaByDate(quotaMap)

      const data = slotsRes.data
      const evts: EventItem[] = []

      for (let d = new Date(currentRange.start); d <= currentRange.end; d = new Date(d.getTime() + 86400000)) {
        const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
        const daySlots = data.filter(s => s.day_of_week === dow)

        if (viewMode === 'day') {
          daySlots.forEach(slot => {
            const [sh, sm] = slot.start_time.split(':').map(Number)
            const [eh, em] = slot.end_time.split(':').map(Number)
            const start = new Date(d)
            start.setHours(sh, sm, 0, 0)
            const end = new Date(d)
            end.setHours(eh, em, 0, 0)

            const title = `${slot.occupancy}/${slot.capacity}`
            const tooltip = formatBookingTooltip(slot.bookings)

            const isStart = (slot.bookings || []).some(b => (b as any).is_start)
            const displayTitle = isStart ? `▶ ${title}` : title

            evts.push({
              id: `slot-${slot.id}-${d.toDateString()}`,
              title: displayTitle,
              start,
              end,
              resource: slot,
              availableDocks: slot.dock_id ? [slot.dock_id] : [],
              resourceId: slot.dock_id,
              tooltip,
              isStart,
            })
          })
        } else {
          const slotGroups = new Map<string, TimeSlot[]>()
          daySlots.forEach(slot => {
            const timeKey = `${slot.start_time}-${slot.end_time}`
            if (!slotGroups.has(timeKey)) slotGroups.set(timeKey, [])
            slotGroups.get(timeKey)!.push(slot)
          })

          slotGroups.forEach((slots, timeKey) => {
            if (!slots.length) return
            const [sh, sm] = slots[0].start_time.split(':').map(Number)
            const [eh, em] = slots[0].end_time.split(':').map(Number)
            const start = new Date(d)
            start.setHours(sh, sm, 0, 0)
            const end = new Date(d)
            end.setHours(eh, em, 0, 0)

            const totalCapacity = slots.reduce((sum, slot) => sum + slot.capacity, 0)
            const totalOccupancy = slots.reduce((sum, slot) => sum + slot.occupancy, 0)
            let status: 'free' | 'partial' | 'full' = 'free'
            if (totalOccupancy === 0) status = 'free'
            else if (totalOccupancy < totalCapacity) status = 'partial'
            else status = 'full'

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
            const availableDocks = slots.filter(s => s.occupancy < s.capacity).map(s => s.dock_id).filter((id): id is number => typeof id === 'number')
            const isStart = slots.some(s => (s.bookings || []).some(b => (b as any).is_start))
            const displayTitle = isStart ? `▶ ${title}` : title

            evts.push({ id: `combined-${timeKey}-${d.toDateString()}`, title: displayTitle, start, end, resource: combinedResource, availableDocks, isStart })
          })
        }
      }

      Object.entries(quotaMap).forEach(([dateStr, q]) => {
        if (q.total === null) return
        const resourceIds = viewMode === 'day' ? filteredDocks.map(d => d.id) : undefined
        const start = new Date(`${dateStr}T00:00:00`)
        const end = new Date(start)
        end.setDate(end.getDate() + 1)
        evts.push({
          id: `quota-${dateStr}`,
          title: `${formatVolume(q.remaining)}/${formatVolume(q.total)}`,
          start,
          end,
          allDay: true as any,
          resource: 'quota',
          isQuota: true,
          quotaTotal: q.total,
          quotaRemaining: q.remaining,
          resourceIds: resourceIds && resourceIds.length ? resourceIds : undefined,
        })
      })

      setEvents(evts)
    } catch (e: any) {
      setError(e?.response?.data?.detail || '?? ??????? ????????? ?????')
      setQuotaByDate({})
    }
  }

  const onSelectSlot = (slotInfo: SlotInfo) => {
    const match = events.find(e =>
      e.start.getTime() === slotInfo.start.getTime() &&
      e.end.getTime() === slotInfo.end.getTime() &&
      (!slotInfo.resourceId || e.resourceId === slotInfo.resourceId)
    )
    if (match) openModalForEvent(match)
  }

  const openModalForEvent = (evt: EventItem) => {
    if (evt.isQuota) return
    if (String((evt as any).resource?.status || '').toLowerCase() === 'full') return
    setSelectedSlot({ start: evt.start, end: evt.end, slotId: evt.resource.id, availableDocks: evt.availableDocks })
    setIsModalOpen(true)
  }

  const handleBookingSuccess = () => {
    if (selectedObject && selectedSupplier) handleSearch()
  }

  const handleDownloadTemplate = async () => {
    setError(null)
    setTemplateLoading(true)
    try {
      const { data } = await axios.get(`${API_BASE}/api/bookings/import/template?direction=in`, {
        headers,
        responseType: 'blob',
      })
      const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'booking_import_in.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Не удалось скачать шаблон')
    } finally {
      setTemplateLoading(false)
    }
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setImportResult(null)
    if (!importFile) {
      setError('Выберите файл для импорта')
      return
    }
    setImportLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const { data } = await axios.post(`${API_BASE}/api/bookings/import?direction=in`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(data)
      handleSearch()
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Не удалось выполнить импорт')
    } finally {
      setImportLoading(false)
    }
  }

  const goToDate = (date: Date) => setCurrentDate(date)

  const onRangeChange = (r: any) => {
    if (Array.isArray(r) && r.length) {
      setRange({ start: r[0], end: r[r.length - 1] })
      if (selectedObject && selectedSupplier) handleSearch({ start: r[0], end: r[r.length - 1] }, currentView)
    } else if (r?.start && r?.end) {
      setRange({ start: r.start, end: r.end })
      if (selectedObject && selectedSupplier) handleSearch({ start: r.start, end: r.end }, currentView)
    }
  }

  const onViewChange = (v: View) => {
    setCurrentView(v)
    if (selectedObject && selectedSupplier && selectedTransportType) handleSearch(range, v)
  }

  const dayPropGetter = (date: Date) => {
    const today = new Date()
    const recommendedDate = addDays(today, 7)
    if (date.getDate() === recommendedDate.getDate() && date.getMonth() === recommendedDate.getMonth() && date.getFullYear() === recommendedDate.getFullYear()) {
      return { className: 'recommended-day' }
    }
    return {}
  }

  
  const eventPropGetter = (event: EventItem) => {
    if (event.isQuota) {
      const total = event.quotaTotal || 0
      const remaining = event.quotaRemaining || 0
      let bg = '#e0f2fe'
      let border = '#0ea5e9'
      if (remaining < 0) {
        bg = '#fee2e2'
        border = '#ef4444'
      } else if (total > 0 && remaining / total < 0.1) {
        bg = '#fff7ed'
        border = '#f97316'
      }
      return {
        style: {
          backgroundColor: bg,
          border: `1px solid ${border}`,
          color: '#0f172a',
          fontWeight: 700,
          fontSize: 12,
          padding: '2px 6px',
          pointerEvents: 'none'
        },
        title: event.title,
      }
    }

    const status = String((event as any).resource?.status || '').toLowerCase()
    let bg = '#e6ffed'
    let border = '#22c55e'
    let cursor = 'pointer'
    let title = event.tooltip || '???????+????????'
    let boxShadow: string | undefined

    if (status === 'partial') {
      bg = '#fff7e6'
      border = '#f59e0b'
      if (!event.tooltip) title = '?????????? ??????????'
    } else if (status === 'full') {
      bg = '#ffe6e6'
      border = '#ef4444'
      cursor = 'not-allowed'
      if (!event.tooltip) title = '????????????????'
    }

    if (event.isStart) {
      if (!String(title).startsWith('▶')) {
        title = `▶ ${title}`
      }
    }

    return {
      style: { backgroundColor: bg, borderLeft: `${event.isStart ? 6 : 4}px solid ${border}`, cursor, color: '#1e3a8a' },
      title,
    }
  }


  return (
    <div>
      <h1>Вход (поставщики)</h1>
      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      <form onSubmit={handleImport} style={{ marginBottom: 12, padding: 12, border: '1px dashed #d1d5db', borderRadius: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn-secondary" onClick={handleDownloadTemplate} disabled={templateLoading}>
            {templateLoading ? 'Скачиваем...' : 'Скачать шаблон'}
          </button>
          <input type="file" accept=".xlsx,.xlsm" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
          <button type="submit" disabled={importLoading}>{importLoading ? 'Импорт...' : 'Загрузить Excel'}</button>
        </div>
        {importResult && (
          <div style={{ marginTop: 8, fontSize: 14 }}>
            <div>Добавлено: {importResult.created}</div>
            {importResult.errors.length > 0 && (
              <div style={{ marginTop: 4 }}>
                Ошибки:
                <ul style={{ margin: 4, paddingLeft: 16 }}>
                  {importResult.errors.map(err => (
                    <li key={err.row_number}>Строка {err.row_number}: {err.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </form>

      <div className="form-grid">
        <div className="field">
          <label>Объект</label>
          <select value={selectedObject || ''} onChange={(e) => setSelectedObject(Number(e.target.value))}>
            <option value="" disabled>Выберите объект</option>
            {objects.map(obj => (
              <option key={obj.id} value={obj.id}>{obj.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Поставщик</label>
          <select value={selectedSupplier || ''} onChange={(e) => setSelectedSupplier(Number(e.target.value))}>
            <option value="" disabled>Выберите поставщика</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Тип перевозки</label>
          <select value={selectedTransportType || ''} onChange={(e) => setSelectedTransportType(Number(e.target.value))}>
            <option value="" disabled>Выберите тип перевозки</option>
            {availableTransportTypes.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="inline-actions" style={{ marginTop: 12 }}>
        <button className="btn-secondary" onClick={() => goToDate(new Date())}>Сегодня</button>
        <button className="btn-secondary" onClick={() => goToDate(addDays(new Date(), 1))}>Завтра</button>
        <button className="btn-secondary" onClick={() => goToDate(addDays(new Date(), 7))}>Через неделю</button>
      </div>

      <div className="calendar-shell" style={{ marginTop: 12 }}>
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 'calc(100vh - 340px)' }}
          selectable
          step={30}
          timeslots={1}
          views={['week', 'day']}
          defaultView={'week' as any}
          defaultDate={initialWeekStart}
          date={currentDate}
          view={currentView}
          onNavigate={(newDate) => setCurrentDate(newDate)}
          onSelectSlot={onSelectSlot}
          onSelectEvent={openModalForEvent as any}
          onRangeChange={onRangeChange as any}
          onView={onViewChange as any}
          resources={currentView === 'day' ? filteredDocks : undefined}
          resourceIdAccessor="id"
          resourceTitleAccessor="name"
          tooltipAccessor="tooltip"
          dayPropGetter={dayPropGetter}
          eventPropGetter={eventPropGetter}
          
          culture="ru"
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
        selectedObject={selectedObject}
        prefillSupplierId={selectedSupplier}
        prefillTransportTypeId={selectedTransportType}
      />
    </div>
  )
}

export default BookingIn
