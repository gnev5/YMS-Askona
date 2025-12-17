import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
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

const Analytics: React.FC<AnalyticsProps> = ({ onBack }) => {
  const [startDate, setStartDate] = useState<string>(
    format(startOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    format(endOfMonth(new Date()), 'yyyy-MM-dd')
  );
  const [bookingsByDay, setBookingsByDay] = useState<BookingsByDay[]>([]);
  const [bookingsByZone, setBookingsByZone] = useState<BookingsByZone[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Новые состояния для фильтров
  const [transportTypes, setTransportTypes] = useState<TransportType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedTransportTypeId, setSelectedTransportTypeId] = useState<string>('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // Загрузка справочников при монтировании компонента
  useEffect(() => {
    loadTransportTypes();
    loadSuppliers();
  }, []);

  // Загрузка данных при изменении периода или фильтров
  useEffect(() => {
    fetchData();
  }, [startDate, endDate, selectedTransportTypeId, selectedSupplierId]);

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
      
      if (selectedSupplierId) {
        params.supplier_id = selectedSupplierId;
      }
      
      // Загрузка данных по дням
      const bookingsByDayResponse = await axios.get(
        `${API_BASE}/api/analytics/bookings-by-day`,
        { headers, params }
      );
      setBookingsByDay(bookingsByDayResponse.data);

      // Загрузка данных по зонам
      const bookingsByZoneResponse = await axios.get(
        `${API_BASE}/api/analytics/bookings-by-zone`,
        { headers, params }
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
          
          <div className="filter-item">
            <label>Поставщик: </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
            >
              <option value="">Все поставщики</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
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