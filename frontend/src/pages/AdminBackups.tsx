import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const AdminBackups: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const [backups, setBackups] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const token = useMemo(() => localStorage.getItem('token'), []);
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const loadBackups = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await axios.get<string[]>(`${API_BASE}/api/backups/`, { headers });
            setBackups(data);
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Ошибка загрузки списка бэкапов');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBackups();
    }, []);

    const handleCreateBackup = async () => {
        if (!confirm('Создать новый бэкап? Это может занять некоторое время.')) return;
        setError(null);
        try {
            await axios.post(`${API_BASE}/api/backups/create`, {}, { headers });
            alert('Создание бэкапа запущено в фоновом режиме. Список обновится через несколько секунд.');
            setTimeout(loadBackups, 5000); // Refresh list after a delay
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Ошибка создания бэкапа');
        }
    };

    const handleDeleteBackup = async (filename: string) => {
        if (!confirm(`Вы уверены, что хотите удалить бэкап ${filename}?`)) return;
        setError(null);
        try {
            await axios.delete(`${API_BASE}/api/backups/${filename}`, { headers });
            loadBackups();
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Ошибка удаления бэкапа');
        }
    };

    const handleRestoreBackup = async (filename: string) => {
        if (!confirm(`ВНИМАНИЕ! Вы уверены, что хотите восстановить базу данных из файла ${filename}? Все текущие данные будут заменены!`)) return;
        setError(null);
        try {
            await axios.post(`${API_BASE}/api/backups/restore/${filename}`, {}, { headers });
            alert('Восстановление запущено. Это может занять некоторое время. Приложение может быть недоступно.');
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Ошибка восстановления');
        }
    };

    const handleDownloadBackup = (filename: string) => {
        window.open(`${API_BASE}/api/backups/download/${filename}`, '_blank');
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError("Файл не выбран");
            return;
        }
        setUploading(true);
        setError(null);
        const formData = new FormData();
        formData.append("file", selectedFile);

        try {
            await axios.post(`${API_BASE}/api/backups/upload`, formData, {
                headers: {
                    ...headers,
                    'Content-Type': 'multipart/form-data',
                },
            });
            setSelectedFile(null);
            loadBackups();
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Ошибка загрузки файла');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                <button onClick={onBack}>Назад</button>
                <h3>Управление бэкапами</h3>
            </div>
            {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}

            <div className="card" style={{ marginBottom: 16, padding: 12 }}>
                <h4>Действия</h4>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button onClick={handleCreateBackup}>Создать новый бэкап</button>
                    <div style={{ border: '1px solid #ccc', padding: '4px 8px', borderRadius: 4 }}>
                        <input type="file" onChange={handleFileChange} />
                        <button onClick={handleUpload} disabled={!selectedFile || uploading}>
                            {uploading ? 'Загрузка...' : 'Загрузить на сервер'}
                        </button>
                    </div>
                </div>
            </div>

            <h4>Список доступных бэкапов</h4>
            {loading ? 'Загрузка...' : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Имя файла</th>
                                <th style={{ textAlign: 'right', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {backups.length > 0 ? backups.map(backup => (
                                <tr key={backup}>
                                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{backup}</td>
                                    <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>
                                        <button onClick={() => handleDownloadBackup(backup)} style={{ marginRight: 8 }}>Скачать</button>
                                        <button onClick={() => handleRestoreBackup(backup)} style={{ marginRight: 8 }}>Восстановить</button>
                                        <button onClick={() => handleDeleteBackup(backup)} style={{ backgroundColor: '#ef4444', color: 'white' }}>Удалить</button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={2} style={{ padding: 8, textAlign: 'center', color: '#666' }}>
                                        Бэкапы не найдены.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default AdminBackups;
