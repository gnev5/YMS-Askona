// Test comment
import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import DockAssociationsModal from '../components/DockAssociationsModal'
import DockTransportTypeAssociationsModal from '../components/DockTransportTypeAssociationsModal'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

type DockStatus = 'active' | 'inactive' | 'maintenance'

interface Object {
    id: number
    name: string
}

interface Zone {
    id: number
    name: string
}

interface TransportType {
    id: number
    name: string
}

export interface Dock {
  id?: number
  name: string
  status: DockStatus
  length_meters?: number | null
  width_meters?: number | null
  max_load_kg?: number | null
  object_id: number
  object: Object
  dock_type: 'universal' | 'entrance' | 'exit'
  available_zones: Zone[]
  available_transport_types: TransportType[]
}

const emptyDock: Dock = { name: '', status: 'active', length_meters: null, width_meters: null, max_load_kg: null, object_id: 0, object: {id: 0, name: ''}, dock_type: 'universal', available_zones: [], available_transport_types: [] }

const dockTypeTranslation = {
  universal: 'Универсальный',
  entrance: 'Вход',
  exit: 'Выход',
};

const AdminDocks: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [items, setItems] = useState<Dock[]>([])
  const [objects, setObjects] = useState<Object[]>([])
  const [form, setForm] = useState<Dock>({ ...emptyDock })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // State for the new modal
  const [isZoneModalOpen, setZoneModalOpen] = useState(false)
  const [isTransportTypeModalOpen, setTransportTypeModalOpen] = useState(false)
  const [selectedDock, setSelectedDock] = useState<Dock | null>(null)


  const token = useMemo(() => localStorage.getItem('token'), [])
  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await axios.get<Dock[]>(`${API_BASE}/api/docks/`)
      setItems(data)
    } catch (e: any) {
      setError('Ошибка загрузки доков')
    } finally { setLoading(false) }
  }

  const loadObjects = async () => {
    try {
      const { data } = await axios.get<Object[]>(`${API_BASE}/api/objects/`)
      setObjects(data)
    } catch (e: any) {
      setError('Ошибка загрузки объектов')
    }
  }

  useEffect(() => { load(); loadObjects() }, [])

  const resetForm = () => { setForm({ ...emptyDock }); setEditingId(null) }

  const create = async () => {
    setError(null); setSuccess(null)
    try {
      // NOTE: available_zone_ids are now managed separately
      const payload = { ...form, available_zone_ids: [], available_transport_type_ids: [] };
      await axios.post(`${API_BASE}/api/docks/`, payload, { headers })
      setSuccess('Док создан')
      resetForm()
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка создания')
    }
  }

  const startEdit = (d: Dock) => {
    setEditingId(d.id!)
    // We don't need to load zones into the main form anymore
    setForm({ ...d, available_zones: [], available_transport_types: [] })
  }

  const update = async () => {
    if (!editingId) return
    setError(null); setSuccess(null)
    try {
      // available_zone_ids are no longer part of the main update payload
      const payload = { ...form, available_zone_ids: undefined, available_transport_type_ids: undefined };
      await axios.put(`${API_BASE}/api/docks/${editingId}`, payload, { headers })
      setSuccess('Док обновлён')
      resetForm()
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка обновления')
    }
  }

  const remove = async (id: number) => {
    if (!confirm('Удалить док?')) return
    setError(null); setSuccess(null)
    try {
      await axios.delete(`${API_BASE}/api/docks/${id}`, { headers })
      setSuccess('Док удалён')
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка удаления')
    }
  }

  // --- Handlers for the new modal ---
  const openZoneModal = (dock: Dock) => {
    setSelectedDock(dock);
    setZoneModalOpen(true);
  };

  const closeZoneModal = () => {
    setSelectedDock(null);
    setZoneModalOpen(false);
  };

  const handleSaveZones = async (dockId: number, zoneIds: number[]) => {
    setError(null); setSuccess(null);
    try {
      await axios.put(`${API_BASE}/api/docks/${dockId}/zones`, { zone_ids: zoneIds }, { headers });
      setSuccess('Привязки зон успешно обновлены');
      closeZoneModal();
      load(); // Reload data to show changes
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка обновления зон');
    }
  };

  // --- Handlers for the Transport Type modal ---
  const openTransportTypeModal = (dock: Dock) => {
    setSelectedDock(dock);
    setTransportTypeModalOpen(true);
  };

  const closeTransportTypeModal = () => {
    setSelectedDock(null);
    setTransportTypeModalOpen(false);
  };

  const handleSaveTransportTypes = async (dockId: number, transportTypeIds: number[]) => {
    setError(null); setSuccess(null);
    try {
      await axios.put(`${API_BASE}/api/docks/${dockId}/transport-types`, { transport_type_ids: transportTypeIds }, { headers });
      setSuccess('Привязки типов перевозок успешно обновлены');
      closeTransportTypeModal();
      load(); // Reload data to show changes
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка обновления типов перевозок');
    }
  };


  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={onBack}>Назад</button>
      </div>

      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      {success && <div style={{ color: '#16a34a', marginBottom: 8 }}>{success}</div>}

      <h3>Новый док / Редактирование</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 160px', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input placeholder="Название" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <select value={form.object_id} onChange={e => setForm({ ...form, object_id: Number(e.target.value) })}>
            <option value={0}>Выберите объект</option>
            {objects.map(obj => (
                <option key={obj.id} value={obj.id}>{obj.name}</option>
            ))}
        </select>
        <select value={form.dock_type} onChange={e => setForm({ ...form, dock_type: e.target.value as 'universal' | 'entrance' | 'exit' })}>
          <option value="universal">Универсальный</option>
          <option value="entrance">Вход</option>
          <option value="exit">Выход</option>
        </select>
        <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as DockStatus })}>
          <option value="active">Активен</option>
          <option value="inactive">Неактивен</option>
          <option value="maintenance">На обслуживании</option>
        </select>
        {editingId ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={update}>Сохранить</button>
            <button onClick={resetForm}>Отмена</button>
          </div>
        ) : (
          <button onClick={create}>Создать</button>
        )}
      </div>

      <h3>Доки</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Название</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Объект</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Тип</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Статус</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Доступные зоны</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Доступные типы перевозок</th>
              <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map(d => (
              <tr key={d.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.object?.name}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{dockTypeTranslation[d.dock_type]}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{d.status}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  {d.available_zones.map(z => z.name).join(', ')}
                  {d.available_zones.length > 0 && <span style={{ marginLeft: '8px' }}></span>}
                  <button onClick={() => openZoneModal(d)} style={{ marginLeft: '8px', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Управление</button>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  {d.available_transport_types.map(t => t.name).join(', ')}
                  <button onClick={() => openTransportTypeModal(d)} style={{ marginLeft: '8px', padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Управление</button>
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                  <button onClick={() => startEdit(d)}>Изменить</button>
                  <button onClick={() => remove(d.id!)} style={{ marginLeft: 8 }}>Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DockAssociationsModal
        isOpen={isZoneModalOpen}
        onClose={closeZoneModal}
        onSave={handleSaveZones}
        dock={selectedDock}
      />
      <DockTransportTypeAssociationsModal
        isOpen={isTransportTypeModalOpen}
        onClose={closeTransportTypeModal}
        onSave={handleSaveTransportTypes}
        dock={selectedDock}
      />
    </div>
  )
}

export default AdminDocks