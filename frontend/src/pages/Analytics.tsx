import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { addDays, format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Bar, Pie } from '../components/ChartComponents';

// Chart.js загружается через CDN в index.html
declare global {
  interface Window {
    Chart: any;
  }
}

// Регистрация компонентов Chart.js (если Chart.js доступен)
if (typeof window !== 'undefined' && window.Chart) {
  window.Chart.register(
    window.Chart.CategoryScale,
    window.Chart.LinearScale,
    window.Chart.BarElement,
    window.Chart.Title,
    window.Chart.Tooltip,
    window.Chart.Legend,
    window.Chart.ArcElement
  );
}

// Используем полный URL бэкенда
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
};

const normalizeSearchValue = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const transliterateRuToLatin = (value: string) =>
  value
    .split('')
    .map((char) => CYRILLIC_TO_LATIN_MAP[char] ?? char)
    .join('');

const supplierNameCollator = new Intl.Collator('ru', { sensitivity: 'base', numeric: true });

const serializeParams = (params: Record<string, unknown>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, String(item)));
      return;
    }
    searchParams.append(key, String(value));
  });
  return searchParams.toString();
};

interface AnalyticsProps {
  onBack: () => void;
}

interface BookingsByDay {
  date: string;
  count: number;
  cubes: number;
}

interface BookingsByZone {
  zone_name: string;
  booking_count: number;
  cubes_sum: number;
}

interface TransportType {
  id: number;
  name: string;
  enum_value: string;
}

interface Supplier {
  id: number;
  name: string;
  comment?: string;
  zone_id?: number;
}

interface ObjectItem {
  id: number;
  name: string;
}

const Analytics: React.FC<AnalyticsProps> = ({ onBack }) => {
  const [startDate, setStartDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    format(addDays(new Date(), 5), 'yyyy-MM-dd')
  );
  const [bookingsByDay, setBookingsByDay] = useState<BookingsByDay[]>([]);
  const [bookingsByZone, setBookingsByZone] = useState<BookingsByZone[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Новые состояния для фильтров
  const [objects, setObjects] = useState<ObjectItem[]>([]);
  const [transportTypes, setTransportTypes] = useState<TransportType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedTransportTypeId, setSelectedTransportTypeId] = useState<string>('');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<number[]>([]);
  const [supplierSearch, setSupplierSearch] = useState<string>('');
  const [supplierDropdownOpen, setSupplierDropdownOpen] = useState<boolean>(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string>('');
  const [selectedDockType, setSelectedDockType] = useState<string>('');
  const supplierFieldRef = useRef<HTMLDivElement | null>(null);

  // Загрузка справочников при монтировании компонента
  useEffect(() => {
    loadObjects();
    loadTransportTypes();
    loadSuppliers();
  }, []);

  // Загрузка данных при изменении периода или фильтров
  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedTransportTypeId, selectedSupplierIds, selectedObjectId, selectedDockType]);

  const loadObjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      const response = await axios.get(
        `${API_BASE}/api/objects/`,
        { headers }
      );
      setObjects(response.data);
    } catch (err: any) {
      console.error('Ошибка загрузки объектов:', err);
    }
  };

  // Загрузка типов перевозки
  const loadTransportTypes = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      const response = await axios.get(
        `${API_BASE}/api/transport-types/`,
        { headers }
      );
      setTransportTypes(response.data);
    } catch (err: any) {
      console.error('Ошибка загрузки типов перевозки:', err);
    }
  };

  // Загрузка поставщиков
  const loadSuppliers = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      const response = await axios.get(
        `${API_BASE}/api/suppliers/`,
        { headers }
      );
      setSuppliers(response.data);
    } catch (err: any) {
      console.error('Ошибка загрузки поставщиков:', err);
    }
  };

  const sortedSuppliers = useMemo(
    () => [...suppliers].sort((a, b) => supplierNameCollator.compare(a.name || '', b.name || '')),
    [suppliers],
  );

  const selectedSuppliers = useMemo(
    () => sortedSuppliers.filter((supplier) => selectedSupplierIds.includes(supplier.id)),
    [selectedSupplierIds, sortedSuppliers],
  );

  const filteredSuppliers = useMemo(() => {
    const query = normalizeSearchValue(supplierSearch);
    const availableSuppliers = sortedSuppliers.filter((supplier) => !selectedSupplierIds.includes(supplier.id));
    if (!query) return availableSuppliers;

    const transliteratedQuery = transliterateRuToLatin(query);
    return availableSuppliers.filter((supplier) => {
      const normalizedName = normalizeSearchValue(supplier.name || '');
      const transliteratedName = transliterateRuToLatin(normalizedName);
      return (
        normalizedName.includes(query) ||
        normalizedName.includes(transliteratedQuery) ||
        transliteratedName.includes(query) ||
        transliteratedName.includes(transliteratedQuery)
      );
    });
  }, [selectedSupplierIds, sortedSuppliers, supplierSearch]);

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!supplierFieldRef.current) return;
      if (!supplierFieldRef.current.contains(event.target as Node)) {
        setSupplierDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocumentMouseDown);
    return () => document.removeEventListener('mousedown', onDocumentMouseDown);
  }, []);

  const handleSupplierSelect = (supplier: Supplier) => {
    setSelectedSupplierIds((prev) => {
      if (prev.includes(supplier.id)) return prev;
      return [...prev, supplier.id];
    });
    setSupplierSearch('');
    setSupplierDropdownOpen(true);
  };

  const handleRemoveSupplier = (supplierId: number) => {
    setSelectedSupplierIds((prev) => prev.filter((id) => id !== supplierId));
  };

  const handleSupplierInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (filteredSuppliers.length > 0) handleSupplierSelect(filteredSuppliers[0]);
      return;
    }
    if (event.key === 'Escape') {
      setSupplierDropdownOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      setSupplierDropdownOpen(true);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Получаем токен из localStorage
      const token = localStorage.getItem('token');
      
      // Настраиваем заголовки с токеном авторизации
      const headers = {
        Authorization: `Bearer ${token}`
      };
      
      // Формируем параметры запроса с учетом фильтров
      let params: any = {
        start_date: startDate,
        end_date: endDate
      };
      
      if (selectedTransportTypeId) {
        params.transport_type_id = selectedTransportTypeId;
      }
      
      if (selectedSupplierIds.length > 0) {
        params.supplier_ids = selectedSupplierIds;
      }
      if (selectedObjectId) {
        params.object_id = selectedObjectId;
      }
      if (selectedDockType) {
        params.dock_type = selectedDockType;
      }
      
      // Загрузка данных по дням
      const bookingsByDayResponse = await axios.get(
        `${API_BASE}/api/analytics/bookings-by-day`,
        { headers, params, paramsSerializer: serializeParams }
      );
      setBookingsByDay(bookingsByDayResponse.data);

      // Загрузка данных по зонам
      const bookingsByZoneResponse = await axios.get(
        `${API_BASE}/api/analytics/bookings-by-zone`,
        { headers, params, paramsSerializer: serializeParams }
      );
      setBookingsByZone(bookingsByZoneResponse.data);
    } catch (err: any) {
      console.error('Error fetching analytics data:', err);
      setError(err?.response?.data?.detail || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  // Подготовка данных для графика по дням (количество записей)
  const bookingsCountChartData = {
    labels: bookingsByDay.map((item) =>
      format(parseISO(item.date), 'dd MMM', { locale: ru })
    ),
    datasets: [
      {
        label: 'Количество записей',
        data: bookingsByDay.map((item) => item.count),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Подготовка данных для графика по дням (количество кубов)
  const cubesChartData = {
    labels: bookingsByDay.map((item) =>
      format(parseISO(item.date), 'dd MMM', { locale: ru })
    ),
    datasets: [
      {
        label: 'Количество кубов',
        data: bookingsByDay.map((item) => item.cubes),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  // Подготовка данных для диаграммы по зонам (количество записей)
  const bookingsByZoneChartData = {
    labels: bookingsByZone.map((item) => item.zone_name),
    datasets: [
      {
        label: 'Количество записей по зонам',
        data: bookingsByZone.map((item) => item.booking_count),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Подготовка данных для диаграммы по зонам (количество кубов)
  const cubesByZoneChartData = {
    labels: bookingsByZone.map((item) => item.zone_name),
    datasets: [
      {
        label: 'Количество кубов по зонам',
        data: bookingsByZone.map((item) => item.cubes_sum),
        backgroundColor: [
          'rgba(255, 159, 64, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 99, 132, 0.6)',
        ],
        borderColor: [
          'rgba(255, 159, 64, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 99, 132, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        font: {
          size: 16,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="container">
      <div className="topbar">
        <button onClick={onBack}>← Назад</button>
        <h1>Аналитика</h1>
      </div>

      <div className="filter-panel" style={{ marginBottom: '20px' }}>
        <div className="filter-row">
          <div className="filter-item">
            <label>Период: с </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <label> по </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        
        <div className="filter-row">
          <div className="filter-item">
            <label>Тип перевозки: </label>
            <select
              value={selectedTransportTypeId}
              onChange={(e) => setSelectedTransportTypeId(e.target.value)}
            >
              <option value="">Все типы</option>
              {transportTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
          
                    <div className="filter-item supplier-filter" ref={supplierFieldRef}>
            <label>Поставщик: </label>
            <div className="supplier-filter-control">
              <div className="supplier-input-row">
                <input
                  type="text"
                  value={supplierSearch}
                  onFocus={() => setSupplierDropdownOpen(true)}
                  onChange={(e) => {
                    setSupplierSearch(e.target.value);
                    setSupplierDropdownOpen(true);
                  }}
                  onKeyDown={handleSupplierInputKeyDown}
                  placeholder={selectedSupplierIds.length > 0 ? 'Добавить поставщика' : 'Начните вводить поставщика'}
                  autoComplete="off"
                />
                {selectedSupplierIds.length > 0 && (
                  <button
                    type="button"
                    className="supplier-clear-btn"
                    onClick={() => {
                      setSelectedSupplierIds([]);
                      setSupplierSearch('');
                      setSupplierDropdownOpen(false);
                    }}
                  >
                    Очистить
                  </button>
                )}
              </div>

              {supplierDropdownOpen && (
                <div className="supplier-dropdown">
                  {filteredSuppliers.length === 0 ? (
                    <div className="supplier-dropdown-empty">Нет совпадений</div>
                  ) : (
                    filteredSuppliers.map((supplier) => (
                      <div
                        key={supplier.id}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleSupplierSelect(supplier);
                        }}
                        className="supplier-dropdown-item"
                      >
                        {supplier.name}
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="supplier-hint">
                {selectedSupplierIds.length === 0
                  ? 'Выбраны все поставщики'
                  : `Выбрано: ${selectedSupplierIds.length}`}
              </div>

              {selectedSuppliers.length > 0 && (
                <div className="supplier-chips">
                  {selectedSuppliers.map((supplier) => (
                    <button
                      key={supplier.id}
                      type="button"
                      className="supplier-chip"
                      onClick={() => handleRemoveSupplier(supplier.id)}
                    >
                      {supplier.name} x
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-item">
            <label>Объект: </label>
            <select
              value={selectedObjectId}
              onChange={(e) => setSelectedObjectId(e.target.value)}
            >
              <option value="">Все</option>
              {objects.map((obj) => (
                <option key={obj.id} value={obj.id}>
                  {obj.name}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <label>Тип (вход/выход): </label>
            <select
              value={selectedDockType}
              onChange={(e) => setSelectedDockType(e.target.value)}
            >
              <option value="">Все</option>
              <option value="entrance">Вход</option>
              <option value="exit">Выход</option>
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="loading">Загрузка данных...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <div className="analytics-container">
          <div className="chart-row">
            <div className="chart-container">
            <h2>Количество записей по дням</h2>
            {typeof window !== 'undefined' && window.Chart ? (
              <Bar data={bookingsCountChartData} options={chartOptions} />
            ) : (
              <div>Загрузка графика...</div>
            )}
          </div>

          <div className="chart-container">
            <h2>Количество кубов по дням</h2>
            {typeof window !== 'undefined' && window.Chart ? (
              <Bar data={cubesChartData} options={chartOptions} />
            ) : (
              <div>Загрузка графика...</div>
            )}
          </div>
          </div>

          <div className="chart-row">
            <div className="chart-container">
            <h2>Количество записей по зонам</h2>
            {typeof window !== 'undefined' && window.Chart ? (
              <Pie data={bookingsByZoneChartData} />
            ) : (
              <div>Загрузка диаграммы...</div>
            )}
          </div>

          <div className="chart-container">
            <h2>Количество кубов по зонам</h2>
            {typeof window !== 'undefined' && window.Chart ? (
              <Pie data={cubesByZoneChartData} />
            ) : (
              <div>Загрузка диаграммы...</div>
            )}
          </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .container {
          padding: 20px;
        }
        .topbar {
          display: flex;
          align-items: center;
          margin-bottom: 20px;
        }
        .topbar h1 {
          margin-left: 20px;
        }
        .filter-panel {
          display: flex;
          flex-direction: column;
          gap: 15px;
          margin-bottom: 20px;
          padding: 15px;
          background-color: #f5f5f5;
          border-radius: 5px;
        }
        .filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
        }
        .filter-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .filter-item select {
          padding: 6px 10px;
          border-radius: 4px;
          border: 1px solid #ccc;
        }
        .filter-item input {
          padding: 6px 10px;
          border-radius: 4px;
          border: 1px solid #ccc;
        }
        .supplier-filter {
          align-items: flex-start;
        }
        .supplier-filter-control {
          min-width: 320px;
          position: relative;
        }
        .supplier-input-row {
          display: flex;
          gap: 8px;
        }
        .supplier-input-row input {
          width: 100%;
        }
        .supplier-clear-btn {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #fff;
          padding: 6px 10px;
          cursor: pointer;
        }
        .supplier-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          max-height: 220px;
          overflow-y: auto;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background-color: #fff;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12);
          z-index: 10;
        }
        .supplier-dropdown-item {
          padding: 10px 12px;
          cursor: pointer;
          border-bottom: 1px solid #f1f5f9;
        }
        .supplier-dropdown-item:hover {
          background: #f8fafc;
        }
        .supplier-dropdown-empty {
          padding: 10px;
          color: #6b7280;
          font-size: 14px;
        }
        .supplier-hint {
          margin-top: 8px;
          color: #64748b;
          font-size: 12px;
        }
        .supplier-chips {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .supplier-chip {
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1e3a8a;
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 13px;
          cursor: pointer;
        }
        .analytics-container {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }
        .chart-row {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        .chart-container {
          flex: 1;
          min-width: 45%;
          background-color: white;
          padding: 15px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        .loading {
          text-align: center;
          padding: 20px;
          font-size: 18px;
          color: #666;
        }
        .error {
          text-align: center;
          padding: 20px;
          font-size: 18px;
          color: #e53e3e;
          background-color: #fff5f5;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        h2 {
          margin-top: 0;
          margin-bottom: 15px;
          font-size: 18px;
          color: #333;
        }
      `}</style>
    </div>
  );
};

export default Analytics;

