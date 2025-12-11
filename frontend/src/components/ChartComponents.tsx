import React, { useRef, useEffect } from 'react';

interface ChartProps {
  type: 'bar' | 'pie';
  data: any;
  options?: any;
}

// Компонент для создания графиков с использованием глобального объекта Chart.js
export const ChartComponent: React.FC<ChartProps> = ({ type, data, options = {} }) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<any>(null);

  useEffect(() => {
    if (!chartRef.current || typeof window === 'undefined' || !window.Chart) {
      return;
    }

    // Уничтожаем предыдущий экземпляр графика, если он существует
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Создаем новый экземпляр графика
    const ctx = chartRef.current.getContext('2d');
    if (ctx) {
      chartInstance.current = new window.Chart(ctx, {
        type,
        data,
        options
      });
    }

    // Уничтожаем график при размонтировании компонента
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [type, data, options]);

  return <canvas ref={chartRef} />;
};

// Компонент Bar для удобства использования
export const Bar: React.FC<Omit<ChartProps, 'type'>> = ({ data, options }) => {
  return <ChartComponent type="bar" data={data} options={options} />;
};

// Компонент Pie для удобства использования
export const Pie: React.FC<Omit<ChartProps, 'type'>> = ({ data, options }) => {
  return <ChartComponent type="pie" data={data} options={options} />;
};