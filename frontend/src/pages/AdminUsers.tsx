import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface UserItem {
  id: number
  email: string
  full_name: string
  role: string
  is_active: boolean
}

interface Supplier {
  id: number
  name: string
  comment?: string
  zone_id: number
  zone?: {
    id: number
    name: string
  }
}

interface UserSupplier {
  id: number
  user_id: number
  supplier_id: number
}

const AdminUsers: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const token = useMemo(() => localStorage.getItem('token'), [])
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const [users, setUsers] = useState<UserItem[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [userSuppliers, setUserSuppliers] = useState<{[userId: number]: Supplier[]}>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'carrier' })
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [showSupplierModal, setShowSupplierModal] = useState(false)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [usersResponse, suppliersResponse] = await Promise.all([
        axios.get<UserItem[]>(`${API_BASE}/auth/users`, { headers }),
        axios.get<Supplier[]>(`${API_BASE}/api/suppliers/`, { headers })
      ])
      setUsers(usersResponse.data)
      setSuppliers(suppliersResponse.data)
      
      // Load user-supplier relationships for non-admin users
      const userSuppliersData: {[userId: number]: Supplier[]} = {}
      for (const user of usersResponse.data) {
        if (user.role !== 'admin') {
          try {
            const { data } = await axios.get<Supplier[]>(`${API_BASE}/api/suppliers/user/${user.id}`, { headers })
            userSuppliersData[user.id] = data
          } catch (e) {
            userSuppliersData[user.id] = []
          }
        }
      }
      setUserSuppliers(userSuppliersData)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка загрузки данных')
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const createUser = async () => {
    setError(null)
    try {
      await axios.post(`${API_BASE}/auth/users`, form, { headers })
      setForm({ email: '', password: '', full_name: '', role: 'carrier' })
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка создания пользователя')
    }
  }

  const updateUser = async (u: UserItem, changes: Partial<UserItem> & { password?: string }) => {
    setError(null)
    try {
      await axios.put(`${API_BASE}/auth/users/${u.id}`, changes, { headers })
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка обновления пользователя')
    }
  }

  const deleteUser = async (u: UserItem) => {
    if (!confirm(`Удалить пользователя ${u.email}?`)) return
    setError(null)
    try {
      await axios.delete(`${API_BASE}/auth/users/${u.id}`, { headers })
      load()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка удаления пользователя')
    }
  }

  const addSupplierToUser = async (userId: number, supplierId: number) => {
    setError(null)
    try {
      await axios.post(`${API_BASE}/api/suppliers/user/${userId}/supplier/${supplierId}`, {}, { headers })
      // Refresh user suppliers
      const { data } = await axios.get<Supplier[]>(`${API_BASE}/api/suppliers/user/${userId}`, { headers })
      setUserSuppliers(prev => ({ ...prev, [userId]: data }))
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка добавления поставщика')
    }
  }

  const removeSupplierFromUser = async (userId: number, supplierId: number) => {
    setError(null)
    try {
      await axios.delete(`${API_BASE}/api/suppliers/user/${userId}/supplier/${supplierId}`, { headers })
      // Refresh user suppliers
      const { data } = await axios.get<Supplier[]>(`${API_BASE}/api/suppliers/user/${userId}`, { headers })
      setUserSuppliers(prev => ({ ...prev, [userId]: data }))
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Ошибка удаления поставщика')
    }
  }

  const openSupplierModal = (userId: number) => {
    setSelectedUserId(userId)
    setShowSupplierModal(true)
  }

  const closeSupplierModal = () => {
    setSelectedUserId(null)
    setShowSupplierModal(false)
  }

  const getAvailableSuppliers = (userId: number) => {
    const userSuppliersList = userSuppliers[userId] || []
    const assignedSupplierIds = userSuppliersList.map(s => s.id)
    return suppliers.filter(s => !assignedSupplierIds.includes(s.id))
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={onBack}>Назад</button>
      </div>
      {error && <div className="error" style={{ marginBottom: 8 }}>{error}</div>}
      <h3>Пользователи</h3>


      <div className="card" style={{ marginBottom: 16, padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Пароль" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          <input placeholder="ФИО" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            <option value="carrier">Пользователь</option>
            <option value="admin">Администратор</option>
          </select>
          <button onClick={createUser}>Создать</button>
        </div>
      </div>

      {loading ? 'Загрузка...' : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Email</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>ФИО</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Роль</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Активен</th>
                <th style={{ textAlign: 'left', padding: 8, borderBottom: '1px solid #e5e7eb' }}>Поставщики</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>{u.email}</td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <input value={u.full_name} onChange={e => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, full_name: e.target.value } : x))} />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <select value={u.role} onChange={e => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: e.target.value } : x))}>
                      <option value="carrier">Пользователь</option>
                      <option value="admin">Администратор</option>
                    </select>
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <input type="checkbox" checked={u.is_active} onChange={e => setUsers(prev => prev.map(x => x.id === u.id ? { ...x, is_active: e.target.checked } : x))} />
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    {u.role === 'admin' ? (
                      <span style={{ color: '#059669', fontSize: '12px' }}>✓ Доступ ко всем поставщикам</span>
                    ) : (
                      <div>
                        <div style={{ fontSize: '12px', marginBottom: 4 }}>
                          {userSuppliers[u.id]?.length || 0} поставщиков
                        </div>
                        <button 
                          onClick={() => openSupplierModal(u.id)}
                          style={{ 
                            fontSize: '12px', 
                            padding: '4px 8px',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          Управление
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: 8, borderBottom: '1px solid #f3f4f6' }}>
                    <button onClick={() => updateUser(u, { full_name: u.full_name, role: u.role, is_active: u.is_active })}>Сохранить</button>
                    <button onClick={() => deleteUser(u)} style={{ marginLeft: 8, backgroundColor: '#ef4444', color: 'white' }}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Supplier Management Modal */}
      {showSupplierModal && selectedUserId && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: 24,
            borderRadius: 8,
            width: '90%',
            maxWidth: 600,
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3>Управление поставщиками пользователя</h3>
              <button 
                onClick={closeSupplierModal}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '24px', 
                  cursor: 'pointer' 
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <strong>Пользователь:</strong> {users.find(u => u.id === selectedUserId)?.full_name} ({users.find(u => u.id === selectedUserId)?.email})
            </div>

            {/* Current Suppliers */}
            <div style={{ marginBottom: 24 }}>
              <h4>Текущие поставщики:</h4>
              {userSuppliers[selectedUserId]?.length ? (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4 }}>
                  {userSuppliers[selectedUserId].map(supplier => (
                    <div key={supplier.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      borderBottom: '1px solid #f3f4f6'
                    }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{supplier.name}</div>
                        {supplier.comment && (
                          <div style={{ fontSize: '12px', color: '#666' }}>{supplier.comment}</div>
                        )}
                        {supplier.zone && (
                          <div style={{ fontSize: '12px', color: '#059669' }}>Зона: {supplier.zone.name}</div>
                        )}
                      </div>
                      <button
                        onClick={() => removeSupplierFromUser(selectedUserId, supplier.id)}
                        style={{
                          backgroundColor: '#ef4444',
                          color: 'white',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#666', fontSize: '14px' }}>Поставщики не назначены</div>
              )}
            </div>

            {/* Available Suppliers */}
            <div>
              <h4>Доступные поставщики:</h4>
              {getAvailableSuppliers(selectedUserId).length ? (
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
                  {getAvailableSuppliers(selectedUserId).map(supplier => (
                    <div key={supplier.id} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      borderBottom: '1px solid #f3f4f6'
                    }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{supplier.name}</div>
                        {supplier.comment && (
                          <div style={{ fontSize: '12px', color: '#666' }}>{supplier.comment}</div>
                        )}
                        {supplier.zone && (
                          <div style={{ fontSize: '12px', color: '#059669' }}>Зона: {supplier.zone.name}</div>
                        )}
                      </div>
                      <button
                        onClick={() => addSupplierToUser(selectedUserId, supplier.id)}
                        style={{
                          backgroundColor: '#059669',
                          color: 'white',
                          border: 'none',
                          padding: '4px 8px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Добавить
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#666', fontSize: '14px' }}>Все поставщики уже назначены</div>
              )}
            </div>

            <div style={{ marginTop: 20, textAlign: 'right' }}>
              <button 
                onClick={closeSupplierModal}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminUsers


