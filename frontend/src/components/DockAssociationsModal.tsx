import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface Zone {
    id: number;
    name: string;
}

interface TransportType {
    id: number;
    name: string;
}

interface Dock {
    id: number;
    name: string;
    available_zones: Zone[];
    available_transport_types: TransportType[];
}

interface DockAssociationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    dock: Dock | null;
    onSave: () => void;
}

const DockAssociationsModal: React.FC<DockAssociationsModalProps> = ({ isOpen, onClose, dock, onSave }) => {
    const [zones, setZones] = useState<Zone[]>([]);
    const [transportTypes, setTransportTypes] = useState<TransportType[]>([]);
    const [selectedZoneIds, setSelectedZoneIds] = useState<number[]>([]);
    const [selectedTransportTypeIds, setSelectedTransportTypeIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    useEffect(() => {
        if (isOpen) {
            fetchZones();
            fetchTransportTypes();
            if (dock) {
                setSelectedZoneIds(dock.available_zones.map(z => z.id));
                setSelectedTransportTypeIds(dock.available_transport_types.map(t => t.id));
            }
        }
    }, [isOpen, dock]);

    const fetchZones = async () => {
        try {
            const { data } = await axios.get<Zone[]>(`${API_BASE}/api/zones/`, { headers });
            setZones(data);
        } catch (e) {
            setError('Ошибка загрузки зон');
        }
    };

    const fetchTransportTypes = async () => {
        try {
            const { data } = await axios.get<TransportType[]>(`${API_BASE}/api/transport-types/`, { headers });
            setTransportTypes(data);
        } catch (e) {
            setError('Ошибка загрузки типов транспорта');
        }
    };

    const handleSave = async () => {
        if (!dock) return;
        setLoading(true);
        setError(null);
        try {
            const payload = {
                ...dock,
                available_zone_ids: selectedZoneIds,
                available_transport_type_ids: selectedTransportTypeIds,
            };
            await axios.put(`${API_BASE}/api/docks/${dock.id}`, payload, { headers });
            onSave();
            onClose();
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Ошибка сохранения');
        } finally {
            setLoading(false);
        }
    };
    
    const handleZoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedIds = Array.from(e.target.selectedOptions, option => Number(option.value));
        setSelectedZoneIds(selectedIds);
    };

    const handleTransportTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedIds = Array.from(e.target.selectedOptions, option => Number(option.value));
        setSelectedTransportTypeIds(selectedIds);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Управление ассоциациями дока: {dock?.name}</h3>
                    <button className="close-btn" type="button" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    {error && <div className="error">{error}</div>}
                    <div className="form-grid">
                        <div className="field">
                            <label>Доступные зоны</label>
                            <select multiple value={selectedZoneIds.map(String)} onChange={handleZoneChange}>
                                {zones.map(zone => (
                                    <option key={zone.id} value={zone.id}>{zone.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="field">
                            <label>Доступные типы перевозок</label>
                            <select multiple value={selectedTransportTypeIds.map(String)} onChange={handleTransportTypeChange}>
                                {transportTypes.map(tt => (
                                    <option key={tt.id} value={tt.id}>{tt.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="form-footer">
                    <button className="btn-ghost" type="button" onClick={onClose}>Отмена</button>
                    <button type="button" onClick={handleSave} disabled={loading}>
                        {loading ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DockAssociationsModal;
