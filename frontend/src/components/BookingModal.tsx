import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { format } from 'date-fns'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
  vehicle_types?: VehicleType[]
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
  selectedObject: number | null
  prefillSupplierId?: number | null
  prefillTransportTypeId?: number | null
}

const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  selectedSlot,
  onBookingSuccess,
  selectedObject,
  prefillSupplierId,
  prefillTransportTypeId,
}) => {
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [transportTypes, setTransportTypes] = useState<TransportType[]>([])
  const [docks, setDocks] = useState<Dock[]>([])
  const [filteredSuppliers, setFilteredSuppliers] = useState<Supplier[]>([])
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [allowedVehicleTypes, setAllowedVehicleTypes] = useState<VehicleType[]>([])
  const [duration, setDuration] = useState<number | null>(null)
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
          supplier_id: prefillSupplierId ?? undefined,
          transport_type_id: prefillTransportTypeId ?? undefined,
          cubes: undefined,
          transport_sheet: ''
        })
        // supplier/transport values may be prefetched; adjust when data arrives
        setSelectedSupplier(null)
        setSupplierSearch('')
        setFilteredSuppliers([])
        setDuration(null)
      }
    }
  }, [isOpen, selectedSlot, prefillSupplierId, prefillTransportTypeId])

  useEffect(() => {
    if (!isOpen) return
    if (prefillSupplierId && suppliers.length > 0) {
      const supplier = suppliers.find(s => s.id === prefillSupplierId)
      if (supplier) {
        setSelectedSupplier(supplier)
        setSupplierSearch(supplier.name)
        setForm(prev => ({ ...prev, supplier_id: supplier.id }))
      }
    }
  }, [isOpen, prefillSupplierId, suppliers])

  useEffect(() => {
    if (!isOpen) return
    if (prefillTransportTypeId && transportTypes.length > 0) {
      setForm(prev => ({ ...prev, transport_type_id: prefillTransportTypeId }))
    }
  }, [isOpen, prefillTransportTypeId, transportTypes])

  useEffect(() => {
    const supplierTypes = selectedSupplier?.vehicle_types || []
    if (supplierTypes.length > 0) {
      setAllowedVehicleTypes(supplierTypes.map(v => ({ ...v })))
      const allowedIds = supplierTypes.map(v => v.id)
      if (!allowedIds.includes(form.vehicle_type_id)) {
        setForm(prev => ({ ...prev, vehicle_type_id: supplierTypes[0].id }))
      }
    } else {
      setAllowedVehicleTypes(vehicleTypes)
      if (form.vehicle_type_id === 0 && vehicleTypes.length > 0) {
        setForm(prev => ({ ...prev, vehicle_type_id: vehicleTypes[0].id }))
      }
    }
  }, [selectedSupplier, vehicleTypes, form.vehicle_type_id])

  useEffect(() => {
    const fetchDuration = async () => {
        if (selectedObject && form.vehicle_type_id) {
            try {
                const { data } = await axios.get(`${API_BASE}/api/prr-limits/duration/`, {
                    params: {
                        object_id: selectedObject,
                        supplier_id: form.supplier_id,
                        transport_type_id: form.transport_type_id,
                        vehicle_type_id: form.vehicle_type_id,
                    }
                });
                setDuration(data.duration_minutes);
            } catch (error) {
                setDuration(null);
            }
        }
    };
    fetchDuration();
  }, [selectedObject, form.vehicle_type_id, form.supplier_id, form.transport_type_id]);
  
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
      setError('Не удалось загрузить типы ТС')
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
      const bookingData = {
        ...form,
        zone_id: selectedSupplier?.zone_id,
        object_id: selectedObject,
      }
      
      await axios.post(`${API_BASE}/api/bookings/`, bookingData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      onBookingSuccess()
      onClose()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Не получилось сохранить бронь')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClickOutside}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Новое бронирование</h3>
          <button className="close-btn" type="button" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {selectedSlot && (
            <div>
              <div className="pill" style={{ marginBottom: 6 }}>
                {selectedSlot.start.toLocaleDateString('ru-RU')} · {selectedSlot.start.toTimeString().slice(0, 5)} – {selectedSlot.end.toTimeString().slice(0, 5)}
              </div>
              {selectedSlot.availableDocks && selectedSlot.availableDocks.length > 0 && (
                <div className="badge badge-success">
                  Доки: {selectedSlot.availableDocks.map(dockId => {
                    const dock = docks.find(d => d.id === dockId)
                    return dock ? dock.name : `Док #${dockId}`
                  }).join(', ')}
                </div>
              )}
            </div>
          )}

          {duration && (
            <div className="badge badge-info">
              Длительность: {duration} мин.
            </div>
          )}
          {error && <div className="error">{error}</div>}

          <form onSubmit={handleSubmit} className="form-grid">
            <div className="field">
              <label>Тип ТС</label>
              <select 
                value={form.vehicle_type_id} 
                onChange={e => setForm({ ...form, vehicle_type_id: Number(e.target.value) })}
              >
                <option value={0}>Выберите тип</option>
                {allowedVehicleTypes.map(vt => (
                  <option key={vt.id} value={vt.id}>{vt.name} ({vt.duration_minutes} мин)</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Госномер</label>
              <input
                type="text"
                value={form.vehicle_plate}
                onChange={e => setForm({ ...form, vehicle_plate: e.target.value })}
                placeholder="A123BC77"
              />
            </div>

            <div className="field">
              <label>Водитель</label>
              <input
                type="text"
                value={form.driver_full_name}
                onChange={e => setForm({ ...form, driver_full_name: e.target.value })}
                placeholder="ФИО полностью"
              />
            </div>

            <div className="field">
              <label>Телефон водителя</label>
              <input
                type="tel"
                value={form.driver_phone}
                onChange={e => setForm({ ...form, driver_phone: e.target.value })}
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <div className="field" style={{ position: 'relative' }}>
              <label>Поставщик</label>
              <input
                type="text"
                value={supplierSearch}
                onChange={e => handleSupplierSearchChange(e.target.value)}
                onFocus={() => setShowSupplierDropdown(true)}
                placeholder="Начните вводить название"
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
                  borderRadius: '0 0 8px 8px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 1000
                }}>
                  {filteredSuppliers.map(supplier => (
                    <div
                      key={supplier.id}
                      onClick={() => handleSupplierSelect(supplier)}
                      style={{
                        padding: '10px 12px',
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
                <div className="hint" style={{ marginTop: 4 }}>
                  Выбран: {selectedSupplier.name}
                  {selectedSupplier.zone_id && (
                    <span style={{ marginLeft: 6 }}>
                      (Зона: {zones.find(z => z.id === selectedSupplier.zone_id)?.name || '—'})
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="field">
              <label>Тип перевозки</label>
              <select 
                value={form.transport_type_id || ''} 
                onChange={e => setForm({ ...form, transport_type_id: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">Выберите тип</option>
                {transportTypes.map(transportType => (
                  <option key={transportType.id} value={transportType.id}>
                    {transportType.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Объем, м³</label>
              <input
                type="number"
                step="0.01"
                value={form.cubes || ''}
                onChange={e => setForm({ ...form, cubes: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="0.00"
              />
            </div>

            <div className="field">
              <label>Транспортный лист</label>
              <input
                type="text"
                value={form.transport_sheet || ''}
                onChange={e => setForm({ ...form, transport_sheet: e.target.value })}
                placeholder="Номер листа"
                maxLength={20}
              />
            </div>

            <div className="form-footer">
              <button className="btn-ghost" type="button" onClick={onClose}>
                Отмена
              </button>
              <button type="submit" disabled={loading}>
                {loading ? 'Сохраняем...' : 'Забронировать'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default BookingModal
