
import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const DURATION_VALIDATION_MESSAGE = 'Длительность должна быть неотрицательной и кратной 30 минутам';

// Interfaces for the data
interface PrrLimit {
    id?: number;
    object_id: number;
    supplier_id?: number | null;
    transport_type_id?: number | null;
    vehicle_type_id?: number | null;
    duration_minutes: number;
}

interface Object {
    id: number;
    name: string;
}

interface Supplier {
    id: number;
    name: string;
}

interface TransportType {
    id: number;
    name: string;
}

interface VehicleType {
    id: number;
    name: string;
}

const emptyPrrLimit: PrrLimit = {
    object_id: 0,
    supplier_id: null,
    transport_type_id: null,
    vehicle_type_id: null,
    duration_minutes: 0,
};

const AdminPrrLimits: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [items, setItems] = useState<PrrLimit[]>([]);
    const [objects, setObjects] = useState<Object[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [transportTypes, setTransportTypes] = useState<TransportType[]>([]);
    const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
    const [form, setForm] = useState<PrrLimit>({ ...emptyPrrLimit });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const token = useMemo(() => localStorage.getItem('token'), []);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await axios.get<PrrLimit[]>(`${API_BASE}/api/prr-limits/`, { headers });
            setItems(data);
        } catch (e: any) {
            setError('Ошибка загрузки лимитов ПРР');
        } finally {
            setLoading(false);
        }
    };

    const loadDropdowns = async () => {
        try {
            const [objectsRes, suppliersRes, transportTypesRes, vehicleTypesRes] = await Promise.all([
                axios.get<Object[]>(`${API_BASE}/api/objects/`, { headers }),
                axios.get<Supplier[]>(`${API_BASE}/api/suppliers/`),
                axios.get<TransportType[]>(`${API_BASE}/api/transport-types/`),
                axios.get<VehicleType[]>(`${API_BASE}/api/vehicle-types/`, { headers }),
            ]);
            setObjects(objectsRes.data);
            setSuppliers(suppliersRes.data);
            setTransportTypes(transportTypesRes.data);
            setVehicleTypes(vehicleTypesRes.data);
        } catch (e: any) {
            setError('Ошибка загрузки справочников');
        }
    };

    useEffect(() => {
        load();
        loadDropdowns();
    }, []);

    const resetForm = () => {
        setForm({ ...emptyPrrLimit });
        setEditingId(null);
    };

    const validateDuration = (value: number) => {
        if (value < 0 || value % 30 !== 0) {
            setError(DURATION_VALIDATION_MESSAGE);
            return false;
        }
        return true;
    };

    const handleSubmit = async () => {
        setError(null);
        setSuccess(null);
        if (!validateDuration(form.duration_minutes)) {
            return;
        }
        if (editingId) {
            update();
        } else {
            create();
        }
    };

    const create = async () => {
        setError(null);
        setSuccess(null);
        try {
            await axios.post(`${API_BASE}/api/prr-limits/`, form, { headers });
            setSuccess('Лимит ПРР создан');
            resetForm();
            load();
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Ошибка создания');
        }
    };

    const startEdit = (item: PrrLimit) => {
        setEditingId(item.id!);
        setForm(item);
    };

    const update = async () => {
        if (!editingId) return;
        setError(null);
        setSuccess(null);
        try {
            await axios.put(`${API_BASE}/api/prr-limits/${editingId}`, form, { headers });
            setSuccess('Лимит ПРР обновлен');
            resetForm();
            load();
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Ошибка обновления');
        }
    };

    const remove = async (id: number) => {
        if (!confirm('Удалить лимит ПРР?')) return;
        setError(null);
        setSuccess(null);
        try {
            await axios.delete(`${API_BASE}/api/prr-limits/${id}`, { headers });
            setSuccess('Лимит ПРР удален');
            load();
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Ошибка удаления');
        }
    };

    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button onClick={onBack}>Назад</button>
            </div>

            {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
            {success && <div style={{ color: '#16a34a', marginBottom: 8 }}>{success}</div>}

            <h3>{editingId ? 'Редактирование лимита ПРР' : 'Новый лимит ПРР'}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 160px', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                <select value={form.object_id} onChange={e => setForm({ ...form, object_id: Number(e.target.value) })}>
                    <option value={0}>Выберите объект</option>
                    {objects.map(obj => <option key={obj.id} value={obj.id}>{obj.name}</option>)}
                </select>
                <select value={form.supplier_id || ''} onChange={e => setForm({ ...form, supplier_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">(Любой поставщик)</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select value={form.transport_type_id || ''} onChange={e => setForm({ ...form, transport_type_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">(Любой тип перевозки)</option>
                    {transportTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <select value={form.vehicle_type_id || ''} onChange={e => setForm({ ...form, vehicle_type_id: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">(Любой тип ТС)</option>
                    {vehicleTypes.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <input
                    type="number"
                    min={0}
                    step={30}
                    placeholder="Длительность (мин, кратно 30)"
                    value={form.duration_minutes}
                    onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleSubmit}>{editingId ? 'Сохранить' : 'Создать'}</button>
                    {editingId && <button onClick={resetForm}>Отмена</button>}
                </div>
            </div>

            <h3>Лимиты ПРР</h3>
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Объект</th>
                            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Поставщик</th>
                            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Тип перевозки</th>
                            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Тип ТС</th>
                            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Длительность (мин)</th>
                            <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => (
                            <tr key={item.id}>
                                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{objects.find(o => o.id === item.object_id)?.name}</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{suppliers.find(s => s.id === item.supplier_id)?.name || '-'}</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{transportTypes.find(t => t.id === item.transport_type_id)?.name || '-'}</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{vehicleTypes.find(v => v.id === item.vehicle_type_id)?.name || '-'}</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{item.duration_minutes}</td>
                                <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                                    <button onClick={() => startEdit(item)}>Изменить</button>
                                    <button onClick={() => remove(item.id!)} style={{ marginLeft: 8 }}>Удалить</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminPrrLimits;
