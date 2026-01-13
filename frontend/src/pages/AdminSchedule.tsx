import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface WorkSchedule {
  id?: number
  day_of_week: number
  work_start: string | null
  work_end: string | null
  break_start: string | null
  break_end: string | null
  is_working_day: boolean
  capacity: number
  dock_id?: number
}

interface Dock {
  id: number
  name: string
}

const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

const emptyDay = (dow: number, dockId: number): WorkSchedule => ({
  day_of_week: dow,
  dock_id: dockId,
  work_start: null,
  work_end: null,
  break_start: null,
  break_end: null,
  is_working_day: dow < 5,
  capacity: dow < 5 ? 1 : 0,
})

const AdminSchedule: React.FC<{ onBack: () => void; onOpenTimeSlots: () => void }> = ({ onBack, onOpenTimeSlots }) => {
  const [docks, setDocks] = useState<Dock[]>([])
  const [selectedDockId, setSelectedDockId] = useState<number | null>(null)
  const [rows, setRows] = useState<WorkSchedule[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  const token = useMemo(() => localStorage.getItem('token'), [])

  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  // Функция для вычисления дат по умолчанию
  const getDefaultDates = () => {
    const today = new Date()
    const daysUntilMonday = (7 - today.getDay()) % 7
    const nextMonday = new Date(today)
    nextMonday.setDate(today.getDate() + (daysUntilMonday === 0 ? 7 : daysUntilMonday))
    
    const endDate = new Date(nextMonday)
    endDate.setDate(nextMonday.getDate() + 28) // +4 недели
    
    return {
      start: nextMonday.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0]
    }
  }

  const loadDocks = async () => {
    const { data } = await axios.get<Dock[]>(`${API_BASE}/api/docks/`)
    setDocks(data)
    if (data.length && selectedDockId == null) {
      setSelectedDockId(data[0].id)
    }
  }

  const load = async () => {
    if (selectedDockId == null) return
    setLoading(true); setError(null)
    try {
      const { data } = await axios.get<WorkSchedule[]>(`${API_BASE}/api/work-schedules`)
      const forDock = data.filter(d => d.dock_id === selectedDockId)
      const merged = Array.from({ length: 7 }, (_, i) => {
        const found = forDock.find(d => d.day_of_week === i)
        return found ? found : emptyDay(i, selectedDockId)
      })
      setRows(merged)
    } catch (e: any) {
      setError('Ошибка загрузки расписания')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { 
    loadDocks()
    // Инициализируем даты по умолчанию
    const defaultDates = getDefaultDates()
    setStartDate(defaultDates.start)
    setEndDate(defaultDates.end)
  }, [])
  useEffect(() => { load() }, [selectedDockId])

  const saveDay = async (row: WorkSchedule) => {
    if (selectedDockId == null) return
    setError(null); setSuccess(null)
    const payload = {
      day_of_week: row.day_of_week,
      work_start: row.is_working_day ? (row.work_start || null) : null,
      work_end: row.is_working_day ? (row.work_end || null) : null,
      break_start: row.is_working_day ? (row.break_start || null) : null,
      break_end: row.is_working_day ? (row.break_end || null) : null,
      is_working_day: row.is_working_day,
      capacity: row.is_working_day ? row.capacity : 0,
      dock_id: selectedDockId,
    }
    try {
      if (row.id) {
        await axios.put(`${API_BASE}/api/work-schedules/${row.id}`, payload, { headers })
      } else {
        const { data } = await axios.post(`${API_BASE}/api/work-schedules/`, payload, { headers })
        row.id = (data as any).id
      }
      setSuccess('Сохранено')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка сохранения')
    }
  }

  const saveAll = async () => {
    for (const r of rows) {
      await saveDay(r)
    }
    await load()
  }

  const generateSlots = async () => {
    setError(null); setSuccess(null)
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      if (selectedDockId != null) params.append('dock_id', String(selectedDockId))
      
      const url = `${API_BASE}/api/work-schedules/generate-time-slots?${params.toString()}`
      const response = await axios.post(url, {}, { headers })
      setSuccess(`Интервалы сгенерированы: ${response.data.slots_created} слотов`)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка генерации интервалов')
    }
  }

  const updateRow = (idx: number, patch: Partial<WorkSchedule>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={onBack}>Назад</button>
        <button onClick={onOpenTimeSlots} style={{ backgroundColor: '#3b82f6', color: 'white' }}>
          📅 Журнал интервалов
        </button>
        <select value={selectedDockId ?? ''} onChange={e => setSelectedDockId(Number(e.target.value))}>
          {docks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button onClick={saveAll} disabled={loading || selectedDockId == null}>Сохранить неделю</button>
        
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <label>Период генерации:</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            style={{ padding: 4 }}
          />
          <span>-</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            style={{ padding: 4 }}
          />
          <button onClick={generateSlots} disabled={loading || selectedDockId == null || !startDate || !endDate}>
            Сгенерировать интервалы
          </button>
        </div>
      </div>
      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ color: '#16a34a', marginBottom: 8 }}>{success}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>День</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Рабочий день</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Начало</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Окончание</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Перерыв с</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Перерыв до</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Емкость</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${r.day_of_week}-${selectedDockId}`}>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{dayNames[idx]}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <input type="checkbox" checked={r.is_working_day} onChange={e => updateRow(idx, { is_working_day: e.target.checked })} />
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <input type="time" value={r.work_start || ''} onChange={e => updateRow(idx, { work_start: e.target.value })} disabled={!r.is_working_day} />
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <input type="time" value={r.work_end || ''} onChange={e => updateRow(idx, { work_end: e.target.value })} disabled={!r.is_working_day} />
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <input type="time" value={r.break_start || ''} onChange={e => updateRow(idx, { break_start: e.target.value })} disabled={!r.is_working_day} />
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <input type="time" value={r.break_end || ''} onChange={e => updateRow(idx, { break_end: e.target.value })} disabled={!r.is_working_day} />
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <input type="number" min={0} value={r.capacity} onChange={e => updateRow(idx, { capacity: Number(e.target.value) })} disabled={!r.is_working_day} />
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <button onClick={() => saveDay(r)} disabled={loading || selectedDockId == null}>Сохранить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdminSchedule
