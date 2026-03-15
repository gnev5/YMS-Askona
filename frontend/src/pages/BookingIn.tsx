import React, { useEffect, useMemo, useRef, useState } from 'react'
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
  capacity_in?: number | null
  capacity_out?: number | null
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
  user_full_name?: string | null
  user_email?: string | null
  is_start?: boolean
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
  bookings?: SlotBookingInfo[]
}

interface QuotaAvailability {
  date: string
  total_volume: number | null
  remaining_volume: number
}

const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  '\u0430': 'a',
  '\u0431': 'b',
  '\u0432': 'v',
  '\u0433': 'g',
  '\u0434': 'd',
  '\u0435': 'e',
  '\u0451': 'yo',
  '\u0436': 'zh',
  '\u0437': 'z',
  '\u0438': 'i',
  '\u0439': 'y',
  '\u043a': 'k',
  '\u043b': 'l',
  '\u043c': 'm',
  '\u043d': 'n',
  '\u043e': 'o',
  '\u043f': 'p',
  '\u0440': 'r',
  '\u0441': 's',
  '\u0442': 't',
  '\u0443': 'u',
  '\u0444': 'f',
  '\u0445': 'kh',
  '\u0446': 'ts',
  '\u0447': 'ch',
  '\u0448': 'sh',
  '\u0449': 'sch',
  '\u044a': '',
  '\u044b': 'y',
  '\u044c': '',
  '\u044d': 'e',
  '\u044e': 'yu',
  '\u044f': 'ya',
}

const normalizeSearchValue = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

const transliterateRuToLatin = (value: string) =>
  value
    .split('')
    .map((char) => CYRILLIC_TO_LATIN_MAP[char] ?? char)
    .join('')

const supplierNameCollator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true })

const BookingIn: React.FC = () => {
  const [objects, setObjects] = useState<YmsObject[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [transportTypes, setTransportTypes] = useState<TransportType[]>([])
  const [docks, setDocks] = useState<Dock[]>([])
  const [selectedObject, setSelectedObject] = useState<number | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState(false)
  const [selectedTransportType, setSelectedTransportType] = useState<number | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [quotaByDate, setQuotaByDate] = useState<Record<string, { remaining: number; total: number | null }>>({})
  const initialWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState<View>('week')
  const viewRef = useRef<View>('week')
  const supplierFieldRef = useRef<HTMLDivElement | null>(null)
  const [range, setRange] = useState<{ start: Date; end: Date }>({ start: initialWeekStart, end: addDays(initialWeekStart, 6) })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date; slotId: number; availableDocks?: number[] } | null>(null)
  const [startInfo, setStartInfo] = useState<{ open: boolean; bookings: SlotBookingInfo[] }>({ open: false, bookings: [] })
  const filteredDocks = selectedObject ? docks.filter(d => d.object_id === selectedObject && (d.dock_type === 'entrance' || d.dock_type === 'universal')) : []
  const availableTransportTypes = selectedSupplier
    ? suppliers.find(s => s.id === selectedSupplier)?.transport_types || transportTypes
    : transportTypes
  const filteredSuppliers = useMemo(() => {
    const sortedSuppliers = [...suppliers].sort((a, b) =>
      supplierNameCollator.compare(a.name || '', b.name || ''),
    )
    const query = normalizeSearchValue(supplierSearch)
    if (!query) return sortedSuppliers

    const transliteratedQuery = transliterateRuToLatin(query)
    return sortedSuppliers.filter((supplier) => {
      const normalizedName = normalizeSearchValue(supplier.name || '')
      const transliteratedName = transliterateRuToLatin(normalizedName)
      return (
        normalizedName.includes(query) ||
        normalizedName.includes(transliteratedQuery) ||
        transliteratedName.includes(query) ||
        transliteratedName.includes(transliteratedQuery)
      )
    })
  }, [supplierSearch, suppliers])

  const handleSupplierSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier.id)
    setSupplierSearch(supplier.name)
    setSupplierDropdownOpen(false)
  }

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
      const { data } = await axios.get<Supplier[]>(`${API_BASE}/api/suppliers/my`, { headers })
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
    if (!selectedSupplier) return
    const selected = suppliers.find((s) => s.id === selectedSupplier)
    if (selected) setSupplierSearch(selected.name)
  }, [selectedSupplier, suppliers])

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!supplierFieldRef.current) return
      if (!supplierFieldRef.current.contains(event.target as Node)) {
        setSupplierDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocumentMouseDown)
    return () => document.removeEventListener('mousedown', onDocumentMouseDown)
  }, [])

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

  useEffect(() => {
    if (objects.length && selectedObject && selectedSupplier && selectedTransportType) {
      handleSearch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects])

  
  const handleSearch = async (rangeOverride?: { start: Date; end: Date }, viewOverride?: View) => {
    if (!selectedObject || !selectedSupplier || !selectedTransportType) {
      setQuotaByDate({})
      return
    }

    const currentRange = rangeOverride || range
    const viewMode = viewOverride || viewRef.current
    const from = format(currentRange.start, 'yyyy-MM-dd')
    const to = format(currentRange.end, 'yyyy-MM-dd')
    const selectedObjectData = objects.find(o => o.id === selectedObject)
    const objectCapacityRaw = selectedObjectData?.capacity_in
    const objectCapacity = typeof objectCapacityRaw === 'number' && objectCapacityRaw > 0 ? objectCapacityRaw : null

    try {
      const [slotsRes, objectScopeSlotsRes, quotaRes] = await Promise.all([
        axios.get<TimeSlot[]>(`${API_BASE}/api/time-slots?from_date=${from}&to_date=${to}&object_id=${selectedObject}&supplier_id=${selectedSupplier}&transport_type_id=${selectedTransportType}&booking_type=in`),
        axios.get<TimeSlot[]>(`${API_BASE}/api/time-slots?from_date=${from}&to_date=${to}&object_id=${selectedObject}&booking_type=in`).catch(() => ({ data: [] as TimeSlot[] })),
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
      const objectScopeData = objectScopeSlotsRes.data.length ? objectScopeSlotsRes.data : data
      const evts: EventItem[] = []

      for (let d = new Date(currentRange.start); d <= currentRange.end; d = new Date(d.getTime() + 86400000)) {
        const dow = d.getDay() === 0 ? 6 : d.getDay() - 1
        const daySlots = data.filter(s => s.day_of_week === dow)
        const objectDaySlots = objectScopeData.filter(s => s.day_of_week === dow)
        const objectOccupancyByTime = new Map<string, number>()

        objectDaySlots.forEach(slot => {
          const timeKey = `${slot.start_time}-${slot.end_time}`
          objectOccupancyByTime.set(timeKey, (objectOccupancyByTime.get(timeKey) || 0) + slot.occupancy)
        })

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
            const timeKey = `${slot.start_time}-${slot.end_time}`
            const objectOccupancy = objectOccupancyByTime.get(timeKey) || 0
            const objectRemaining = objectCapacity !== null ? objectCapacity - objectOccupancy : null
            const objectCapacityInfo = objectCapacity !== null ? `${objectRemaining}/${objectCapacity}` : ''
            const isObjectCapacityFull = objectRemaining !== null && objectRemaining <= 0

            const isStart = (slot.bookings || []).some(b => (b as any).is_start)
            const displayTitle = objectCapacityInfo ? `${title} | ${objectCapacityInfo}` : title
            const resourceForEvent: TimeSlot = isObjectCapacityFull ? { ...slot, status: 'full' } : slot
            const availableDocks = isObjectCapacityFull ? [] : slot.dock_id ? [slot.dock_id] : []

            evts.push({
              id: `slot-${slot.id}-${d.toDateString()}`,
              title: displayTitle,
              start,
              end,
              resource: resourceForEvent,
              availableDocks,
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
            const combinedBookings = slots.flatMap(s => s.bookings || [])
            const objectOccupancy = objectOccupancyByTime.get(timeKey) || 0
            const objectRemaining = objectCapacity !== null ? objectCapacity - objectOccupancy : null
            const isObjectCapacityFull = objectRemaining !== null && objectRemaining <= 0
            let status: 'free' | 'partial' | 'full' = 'free'
            if (totalOccupancy === 0) status = 'free'
            else if (totalOccupancy < totalCapacity) status = 'partial'
            else status = 'full'
            if (isObjectCapacityFull) status = 'full'

            const title = `${totalOccupancy}/${totalCapacity}`
            const objectCapacityInfo = objectCapacity !== null ? `${objectRemaining}/${objectCapacity}` : ''
            const combinedResource: TimeSlot = {
              id: slots[0].id,
              day_of_week: slots[0].day_of_week,
              start_time: slots[0].start_time,
              end_time: slots[0].end_time,
              capacity: totalCapacity,
              occupancy: totalOccupancy,
              status,
              bookings: combinedBookings,
            }
            const availableDocks = isObjectCapacityFull
              ? []
              : slots.filter(s => s.occupancy < s.capacity).map(s => s.dock_id).filter((id): id is number => typeof id === 'number')
            const isStart = combinedBookings.some(b => (b as any).is_start)
            const displayTitle = objectCapacityInfo ? `${title} | ${objectCapacityInfo}` : title

            evts.push({ id: `combined-${timeKey}-${d.toDateString()}`, title: displayTitle, start, end, resource: combinedResource, availableDocks, isStart, bookings: combinedBookings })
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
          title: `Квота: ${formatVolume(q.total)} Остаток: ${formatVolume(q.remaining)}`,
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
      setError(e?.response?.data?.detail || 'Не удалось загрузить слоты')
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

  const extractStartBookings = (evt: EventItem) => {
    const bookings = ((evt.resource as any)?.bookings || evt.bookings || []) as SlotBookingInfo[]
    const starts = bookings.filter(b => b && b.is_start)
    const unique: SlotBookingInfo[] = []
    const seen = new Set<number>()
    starts.forEach(b => {
      if (!seen.has(b.id)) {
        seen.add(b.id)
        unique.push(b)
      }
    })
    return unique
  }

  const openModalForEvent = (evt: EventItem) => {
    if (evt.isQuota) return
    if (String((evt as any).resource?.status || '').toLowerCase() === 'full') return
    setSelectedSlot({ start: evt.start, end: evt.end, slotId: evt.resource.id, availableDocks: evt.availableDocks })
    setIsModalOpen(true)
  }

  const EventCell: React.FC<{ event: EventItem }> = ({ event }) => {
    const starts = event.isStart ? extractStartBookings(event) : []
    const showStartInfo = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (starts.length > 0) setStartInfo({ open: true, bookings: starts })
    }
    const titleText = String(event.title || '')
    const triangle = event.isStart ? '▸' : null
    const rest = titleText
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {triangle && (
          <span
            onClick={showStartInfo}
            style={{ cursor: 'pointer', color: '#1e3a8a', fontWeight: 800, fontSize: 18, lineHeight: '18px' }}
            title="Начало бронирования"
          >
            {triangle}
          </span>
        )}
        <span>{rest}</span>
      </div>
    )
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

  const onRangeChange = (r: any) => {
    if (Array.isArray(r) && r.length) {
      setRange({ start: r[0], end: r[r.length - 1] })
      if (selectedObject && selectedSupplier) handleSearch({ start: r[0], end: r[r.length - 1] }, viewRef.current)
    } else if (r?.start && r?.end) {
      setRange({ start: r.start, end: r.end })
      if (selectedObject && selectedSupplier) handleSearch({ start: r.start, end: r.end }, viewRef.current)
    }
  }

  const onViewChange = (v: View) => {
    viewRef.current = v
    setCurrentView(v)
    if (selectedObject && selectedSupplier && selectedTransportType) handleSearch(range, v)
  }

  const handleSupplierInputChange = (value: string) => {
    setSupplierSearch(value)
    setSupplierDropdownOpen(true)

    const normalizedValue = normalizeSearchValue(value)
    if (!normalizedValue) {
      setSelectedSupplier(null)
      return
    }

    const selected = suppliers.find((s) => s.id === selectedSupplier)
    if (selected && normalizeSearchValue(selected.name) === normalizedValue) return

    const exact = suppliers.find((s) => normalizeSearchValue(s.name) === normalizedValue)
    setSelectedSupplier(exact ? exact.id : null)
  }

  const handleSupplierInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (filteredSuppliers.length > 0) handleSupplierSelect(filteredSuppliers[0])
      return
    }
    if (event.key === 'Escape') {
      setSupplierDropdownOpen(false)
      return
    }
    if (event.key === 'ArrowDown') {
      setSupplierDropdownOpen(true)
    }
  }

  const handleClearSupplier = () => {
    setSupplierSearch('')
    setSelectedSupplier(null)
    setSupplierDropdownOpen(true)
    localStorage.removeItem('selectedSupplier')
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
    const hasStart = !!event.isStart
    let bg = '#bbf7d0'     // brighter green for free slots
    let border = '#16a34a' // deeper green border
    let cursor = 'pointer'
    let title = event.tooltip || 'Доступно'
    let boxShadow: string | undefined

    if (status === 'partial') {
      bg = '#fff7e6'
      border = '#f59e0b'
      if (!event.tooltip) title = 'Частично занято'
    } else if (status === 'full') {
      bg = '#ffe6e6'
      border = '#ef4444'
      cursor = 'not-allowed'
      if (!event.tooltip) title = 'Нет свободных слотов'
    }

    if (hasStart) {
      cursor = 'pointer'
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
        <div className="field" ref={supplierFieldRef} style={{ position: 'relative' }}>
          <label>Поставщик</label>
          <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={supplierSearch}
            onFocus={() => setSupplierDropdownOpen(true)}
            onChange={(e) => handleSupplierInputChange(e.target.value)}
            onKeyDown={handleSupplierInputKeyDown}
            placeholder="Начните вводить поставщика"
            autoComplete="off"
            style={{ paddingRight: supplierSearch ? 34 : undefined }}
          />
          {supplierSearch && (
            <button
              type="button"
              aria-label="Очистить поставщика"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleClearSupplier}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: 'none',
                background: '#e5e7eb',
                color: '#374151',
                padding: 0,
                fontSize: 14,
                lineHeight: '18px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'none',
              }}
              title="Очистить"
            >
              &times;
            </button>
          )}
          </div>
          {supplierDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                maxHeight: 220,
                overflowY: 'auto',
                border: '1px solid var(--border)',
                borderRadius: 10,
                backgroundColor: '#fff',
                boxShadow: '0 10px 25px rgba(15, 23, 42, 0.12)',
                zIndex: 20,
              }}
            >
              {filteredSuppliers.length === 0 ? (
                <div style={{ padding: 10, color: '#6b7280', fontSize: 14 }}>
                  Нет совпадений
                </div>
              ) : (
                filteredSuppliers.map((s) => (
                  <div
                    key={s.id}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      handleSupplierSelect(s)
                    }}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: s.id === selectedSupplier ? '#eef2ff' : '#fff',
                    }}
                  >
                    {s.name}
                  </div>
                ))
              )}
            </div>
          )}
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
          components={{ event: EventCell as any }}
          
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

      {startInfo.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
          }}
          onClick={() => setStartInfo({ open: false, bookings: [] })}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: 10,
              padding: 18,
              width: 'min(460px, 90vw)',
              boxShadow: '0 12px 30px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ margin: 0 }}>Начавшиеся бронирования</h4>
              <button
                onClick={() => setStartInfo({ open: false, bookings: [] })}
                style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: 'pointer' }}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            {startInfo.bookings.length === 0 ? (
              <div style={{ color: '#6b7280' }}>Нет данных</div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {startInfo.bookings.map(b => (
                  <div key={b.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>ТЛ: {b.transport_sheet || '—'}</div>
                    <div style={{ color: '#4b5563', fontSize: 14 }}>
                      <div>Поставщик: {b.supplier_name || '—'}</div>
                      <div>Создал: {b.user_full_name || b.user_email || '—'}</div>
                      <div>Кубы: {b.cubes ?? '—'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BookingIn



