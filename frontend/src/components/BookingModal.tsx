import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { format } from 'date-fns'

const API_BASE = 'http://localhost:8000'

interface VehicleType {
  id: number
  name: string
  duration_minutes: number
}

interface Zone {
  id: number
  name: string
}

interface Supplier {
  id: number
  name: string
  comment?: string
  zone_id: number
}

interface TransportType {
  id: number
  name: string
  enum_value: string
}

interface Dock {
  id: number
  name: string
}

interface BookingForm {
  vehicle_plate: string
  driver_full_name: string
  driver_phone: string
  vehicle_type_id: number
  booking_date: string
  start_time: string
  supplier_id?: number
  transport_type_id?: number
  cubes?: number
  transport_sheet?: string
}

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  selectedSlot: { start: Date; end: Date; slotId: number; availableDocks?: number[] } | null
  onBookingSuccess: () => void
}

const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, selectedSlot, onBookingSuccess }) => {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [transportTypes, setTransportTypes] = useState<TransportType[]>([])
  const [docks, setDocks] = useState<Dock[]>([])
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [form, setForm] = useState<BookingForm>({
    vehicle_plate: '',
    driver_full_name: '',
    driver_phone: '',
    vehicle_type_id: 0,
    booking_date: '',
    start_time: '',
    supplier_id: undefined,
    transport_type_id: undefined,
    cubes: undefined,
    transport_sheet: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadVehicleTypes()
      loadZones()
      loadSuppliers()
      loadTransportTypes()
      loadDocks()
      if (selectedSlot) {
        setForm({
          vehicle_plate: '',
          driver_full_name: '',
          driver_phone: '',
          vehicle_type_id: 0,
          booking_date: format(selectedSlot.start, 'yyyy-MM-dd'),
          start_time: format(selectedSlot.start, 'HH:mm'),
          supplier_id: undefined,
          transport_type_id: undefined,
          cubes: undefined,
          transport_sheet: ''
        })
        setSelectedSupplier(null)
        setSupplierSearch('')
        setFilteredSuppliers([])
      }
    }
  }, [isOpen, selectedSlot])

  // Фильтрация поставщиков при изменении поиска
  useEffect(() => {
    if (supplierSearch.trim() === '') {
      setFilteredSuppliers([])
    } else {
      const filtered = suppliers.filter(supplier =>
        supplier.name.toLowerCase().includes(supplierSearch.toLowerCase())
      )
      setFilteredSuppliers(filtered)
    }
  }, [supplierSearch, suppliers])

  const loadVehicleTypes = async () => {
    try {
      const { data } = await axios.get<VehicleType[]>(`${API_BASE}/api/vehicle-types/`)
      setVehicleTypes(data)
      if (data.length > 0) {
        setForm(prev => ({ ...prev, vehicle_type_id: data[0].id }))
      }
    } catch (e: any) {
      setError('Ошибка загрузки типов ТС')
    }
  }

  const loadZones = async () => {
    try {
      const { data } = await axios.get<Zone[]>(`${API_BASE}/api/zones/`)
      setZones(data)
    } catch (e: any) {
      console.error('Ошибка загрузки зон:', e)
    }
  }

  const loadSuppliers = async () => {
    try {
      const token = localStorage.getItem('token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const { data } = await axios.get<Supplier[]>(`${API_BASE}/api/suppliers/my`, { headers })
      setSuppliers(data)
    } catch (e: any) {
      console.error('Ошибка загрузки поставщиков:', e)
    }
  }

  const loadTransportTypes = async () => {
    try {
      const { data } = await axios.get<TransportType[]>(`${API_BASE}/api/transport-types/`)
      setTransportTypes(data)
    } catch (e: any) {
      console.error('Ошибка загрузки типов перевозки:', e)
    }
  }

  const loadDocks = async () => {
    try {
      const { data } = await axios.get<Dock[]>(`${API_BASE}/api/docks/`)
      setDocks(data)
    } catch (e: any) {
      console.error('Ошибка загрузки доков:', e)
    }
  }

  const handleSupplierSelect = (supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setSupplierSearch(supplier.name)
    setForm(prev => ({ ...prev, supplier_id: supplier.id }))
    setShowSupplierDropdown(false)
  }

  const handleSupplierSearchChange = (value: string) => {
    setSupplierSearch(value)
    setShowSupplierDropdown(true)
    if (value === '') {
      setSelectedSupplier(null)
      setForm(prev => ({ ...prev, supplier_id: undefined }))
    }
  }

  const handleClickOutside = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setShowSupplierDropdown(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.vehicle_type_id) {
      setError('Выберите тип ТС')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem('token')
      
      // Подготавливаем данные для отправки, добавляя zone_id из выбранного поставщика
      const bookingData = {
        ...form,
        zone_id: selectedSupplier?.zone_id
      }
      
      await axios.post(`${API_BASE}/api/bookings/`, bookingData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      onBookingSuccess()
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка создания записи')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={handleClickOutside}
    >
      <div style={{
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 8,
        width: '100%',
        maxWidth: 400
      }}>
        <h3>Записаться на время</h3>
        
        {selectedSlot && (
          <div style={{ marginBottom: 16, color: '#666' }}>
            <p style={{ marginBottom: 8 }}>
              {selectedSlot.start.toLocaleDateString('ru-RU')} {selectedSlot.start.toTimeString().slice(0, 5)} - {selectedSlot.end.toTimeString().slice(0, 5)}
            </p>
            {selectedSlot.availableDocks && selectedSlot.availableDocks.length > 0 && (
              <p style={{ fontSize: '14px', color: '#059669', marginBottom: 0 }}>
                🏭 Доступные доки: {selectedSlot.availableDocks.map(dockId => {
                  const dock = docks.find(d => d.id === dockId)
                  return dock ? dock.name : `Док #${dockId}`
                }).join(', ')}
              </p>
            )}
          </div>
        )}

        {error && <div className="error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Тип ТС:</label>
            <select 
              value={form.vehicle_type_id} 
              onChange={e => setForm({ ...form, vehicle_type_id: Number(e.target.value) })}
              style={{ width: '100%', padding: 8 }}
            >
              <option value={0}>Выберите тип ТС</option>
              {vehicleTypes.map(vt => (
                <option key={vt.id} value={vt.id}>{vt.name} ({vt.duration_minutes} мин)</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Номер ТС:</label>
            <input
              type="text"
              value={form.vehicle_plate}
              onChange={e => setForm({ ...form, vehicle_plate: e.target.value })}
              placeholder="A123BC77"
              style={{ width: '100%', padding: 8 }}
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Водитель:</label>
            <input
              type="text"
              value={form.driver_full_name}
              onChange={e => setForm({ ...form, driver_full_name: e.target.value })}
              placeholder="Иванов Иван Иванович"
              style={{ width: '100%', padding: 8 }}
              required
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Телефон:</label>
            <input
              type="tel"
              value={form.driver_phone}
              onChange={e => setForm({ ...form, driver_phone: e.target.value })}
              placeholder="+7 (999) 123-45-67"
              style={{ width: '100%', padding: 8 }}
              required
            />
          </div>

          <div style={{ marginBottom: 16, position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Поставщик:</label>
            <input
              type="text"
              value={supplierSearch}
              onChange={e => handleSupplierSearchChange(e.target.value)}
              onFocus={() => setShowSupplierDropdown(true)}
              placeholder="Начните вводить название поставщика..."
              style={{ width: '100%', padding: 8 }}
            />
            {showSupplierDropdown && filteredSuppliers.length > 0 && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderTop: 'none',
                borderRadius: '0 0 4px 4px',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 1000
              }}>
                {filteredSuppliers.map(supplier => (
                  <div
                    key={supplier.id}
                    onClick={() => handleSupplierSelect(supplier)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    {supplier.name}
                  </div>
                ))}
              </div>
            )}
            {selectedSupplier && (
              <div style={{ marginTop: 4, fontSize: '12px', color: '#059669' }}>
                ✅ Выбран: {selectedSupplier.name}
                {selectedSupplier.zone_id && (
                  <span style={{ marginLeft: 8 }}>
                    (Зона: {zones.find(z => z.id === selectedSupplier.zone_id)?.name || 'Неизвестно'})
                  </span>
                )}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Тип перевозки:</label>
            <select 
              value={form.transport_type_id || ''} 
              onChange={e => setForm({ ...form, transport_type_id: e.target.value ? Number(e.target.value) : undefined })}
              style={{ width: '100%', padding: 8 }}
            >
              <option value="">Выберите тип перевозки</option>
              {transportTypes.map(transportType => (
                <option key={transportType.id} value={transportType.id}>
                  {transportType.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Кубы:</label>
            <input
              type="number"
              step="0.01"
              value={form.cubes || ''}
              onChange={e => setForm({ ...form, cubes: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="0.00"
              style={{ width: '100%', padding: 8 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 4 }}>Транспортный лист:</label>
            <input
              type="text"
              value={form.transport_sheet || ''}
              onChange={e => setForm({ ...form, transport_sheet: e.target.value })}
              placeholder="Номер транспортного листа"
              maxLength={20}
              style={{ width: '100%', padding: 8 }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              type="button" 
              onClick={onClose}
              style={{ flex: 1, padding: 8 }}
            >
              Отмена
            </button>
            <button 
              type="submit" 
              disabled={loading}
              style={{ flex: 1, padding: 8, backgroundColor: '#2563eb', color: 'white' }}
            >
              {loading ? 'Сохранение...' : 'Записаться'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default BookingModal
