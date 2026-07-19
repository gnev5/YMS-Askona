import React, { useEffect, useMemo, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

type Profile = {
  id: number
  name: string
  object_id: number
  object_name?: string | null
  direction: 'in' | 'out'
  tl_column_name: string
  tl_column_letter?: string | null
  status_filters: string[]
  file_settings?: {
    snapshot_columns?: string
    [key: string]: any
  }
  is_active: boolean
}

type YmsObject = {
  id: number
  name: string
  object_type?: string
}

type ProfileForm = {
  id?: number
  name: string
  objectId: string
  direction: 'in' | 'out'
  tlColumnLetter: string
  snapshotColumns: string
  statusFiltersText: string
  isActive: boolean
}

const emptyForm = (): ProfileForm => ({
  name: '',
  objectId: '',
  direction: 'in',
  tlColumnLetter: 'G',
  snapshotColumns: '',
  statusFiltersText: 'confirmed',
  isActive: true,
})

const DataComparisonProfiles: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const token = useMemo(() => localStorage.getItem('token'), [])
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [objects, setObjects] = useState<YmsObject[]>([])
  const [form, setForm] = useState<ProfileForm>(emptyForm())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadProfiles = async () => {
    const { data } = await axios.get<Profile[]>(`${API_BASE}/api/data-comparisons/profiles`, { headers })
    setProfiles(data)
  }

  const loadObjects = async () => {
    const { data } = await axios.get<YmsObject[]>(`${API_BASE}/api/objects`, { headers })
    setObjects(data)
    setForm(current => current.objectId || data.length === 0 ? current : { ...current, objectId: String(data[0].id) })
  }

  const loadInitial = async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([loadProfiles(), loadObjects()])
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка загрузки профилей сверки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetForm = () => {
    const next = emptyForm()
    if (objects.length > 0) next.objectId = String(objects[0].id)
    setForm(next)
    setError(null)
    setSuccess(null)
  }

  const editProfile = (profile: Profile) => {
    setForm({
      id: profile.id,
      name: profile.name,
      objectId: String(profile.object_id),
      direction: profile.direction,
      tlColumnLetter: profile.tl_column_letter || 'G',
      snapshotColumns: profile.file_settings?.snapshot_columns || '',
      statusFiltersText: (profile.status_filters || ['confirmed']).join(', '),
      isActive: profile.is_active,
    })
    setError(null)
    setSuccess(null)
  }

  const copyProfile = (profile: Profile) => {
    setForm({
      name: `${profile.name} — копия`,
      objectId: String(profile.object_id),
      direction: profile.direction,
      tlColumnLetter: profile.tl_column_letter || 'G',
      snapshotColumns: profile.file_settings?.snapshot_columns || '',
      statusFiltersText: (profile.status_filters || ['confirmed']).join(', '),
      isActive: true,
    })
    setError(null)
    setSuccess(null)
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.objectId || !form.tlColumnLetter.trim()) {
      setError('Заполните название профиля, объект и столбец с номером ТЛ')
      return
    }
    const statusFilters = form.statusFiltersText
      .split(',')
      .map(status => status.trim())
      .filter(Boolean)
    const payload = {
      name: form.name.trim(),
      object_id: Number(form.objectId),
      direction: form.direction,
      tl_column_name: 'Номер ТЛ',
      tl_column_letter: form.tlColumnLetter.trim().toUpperCase(),
      status_filters: statusFilters.length > 0 ? statusFilters : ['confirmed'],
      yms_filters: {},
      file_settings: form.snapshotColumns.trim() ? { snapshot_columns: form.snapshotColumns.trim().toUpperCase() } : {},
      comparison_settings: {},
      is_active: form.isActive,
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      if (form.id) {
        await axios.put(`${API_BASE}/api/data-comparisons/profiles/${form.id}`, payload, { headers })
        setSuccess('Профиль сверки сохранён')
      } else {
        await axios.post(`${API_BASE}/api/data-comparisons/profiles`, payload, { headers })
        setSuccess('Профиль сверки создан')
      }
      await loadProfiles()
      resetForm()
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка сохранения профиля сверки')
    } finally {
      setLoading(false)
    }
  }

  const toggleActive = async (profile: Profile) => {
    const payload = {
      name: profile.name,
      object_id: profile.object_id,
      direction: profile.direction,
      tl_column_name: profile.tl_column_name || 'Номер ТЛ',
      tl_column_letter: profile.tl_column_letter || 'G',
      status_filters: profile.status_filters || ['confirmed'],
      yms_filters: {},
      file_settings: profile.file_settings || {},
      comparison_settings: {},
      is_active: !profile.is_active,
    }
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      await axios.put(`${API_BASE}/api/data-comparisons/profiles/${profile.id}`, payload, { headers })
      setSuccess(profile.is_active ? 'Профиль отключён' : 'Профиль включён')
      await loadProfiles()
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Ошибка изменения активности профиля')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        {onBack && <button className="secondary" onClick={onBack}>← Назад</button>}
        <div>
          <h1>Профили сверки</h1>
          <p className="muted">Здесь настраиваются постоянные правила сверки: объект, направление, столбец ТЛ, колонки Excel для снимка и фильтры YMS. Даты и диапазон строк задаются при запуске сверки.</p>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <section className="card">
        <h2>{form.id ? 'Редактировать профиль' : 'Создать профиль'}</h2>
        <form onSubmit={saveProfile} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1.5fr 2fr 1fr auto auto', gap: 12, alignItems: 'end' }}>
          <label>
            Название профиля
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="РЦ Краснодар — Вход" />
          </label>
          <label>
            Объект / РЦ
            <select value={form.objectId} onChange={e => setForm({ ...form, objectId: e.target.value })}>
              {objects.map(object => (
                <option key={object.id} value={object.id}>{object.name}</option>
              ))}
            </select>
          </label>
          <label>
            Направление
            <select value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value as 'in' | 'out' })}>
              <option value="in">Вход</option>
              <option value="out">Выход</option>
            </select>
          </label>
          <label>
            Столбец с номером ТЛ
            <input value={form.tlColumnLetter} onChange={e => setForm({ ...form, tlColumnLetter: e.target.value.toUpperCase() })} placeholder="G" maxLength={3} />
          </label>
          <label>
            Колонки Excel для снимка
            <input value={form.snapshotColumns} onChange={e => setForm({ ...form, snapshotColumns: e.target.value.toUpperCase() })} placeholder="A:C,E" />
          </label>
          <label>
            Статусы YMS через запятую
            <input value={form.statusFiltersText} onChange={e => setForm({ ...form, statusFiltersText: e.target.value })} placeholder="confirmed" />
          </label>
          <label>
            Активен
            <select value={form.isActive ? 'yes' : 'no'} onChange={e => setForm({ ...form, isActive: e.target.value === 'yes' })}>
              <option value="yes">Да</option>
              <option value="no">Нет</option>
            </select>
          </label>
          <button disabled={loading}>{loading ? '...' : form.id ? 'Сохранить' : 'Создать'}</button>
          <button type="button" className="secondary" onClick={resetForm}>Очистить</button>
        </form>
      </section>

      <section className="card">
        <h2>Список профилей</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Название</th>
                <th>Объект / РЦ</th>
                <th>Направление</th>
                <th>Столбец ТЛ</th>
                <th>Снимок Excel</th>
                <th>Статусы YMS</th>
                <th>Активен</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map(profile => (
                <tr key={profile.id}>
                  <td>{profile.name}</td>
                  <td>{profile.object_name || profile.object_id}</td>
                  <td>{profile.direction === 'in' ? 'Вход' : 'Выход'}</td>
                  <td>{profile.tl_column_letter || '—'}</td>
                  <td>{profile.file_settings?.snapshot_columns || 'Все колонки'}</td>
                  <td>{(profile.status_filters || []).join(', ')}</td>
                  <td>{profile.is_active ? 'Да' : 'Нет'}</td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="secondary" onClick={() => editProfile(profile)}>Редактировать</button>
                    <button className="secondary" onClick={() => copyProfile(profile)}>Копировать</button>
                    <button className="secondary" onClick={() => toggleActive(profile)}>{profile.is_active ? 'Отключить' : 'Включить'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default DataComparisonProfiles
