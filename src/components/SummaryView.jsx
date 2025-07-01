// src/components/SummaryView.jsx
import React, { useMemo } from 'react';
import BarChart from './BarChart';
import { cleanNumber } from '../utils/helpers';

const SummaryView = ({ processedData }) => {

    const chartData = useMemo(() => {
        const allItems = processedData.flatMap(supplier => supplier.items);

        // Función genérica para agrupar y calcular totales
        const calculateProgress = (items, groupBy) => {
            const progressData = items.reduce((acc, item) => {
                const key = item[groupBy] || `Sin ${groupBy}`;
                const amount = cleanNumber(item.cantidad_a_comprar) * cleanNumber(item.precio_unitario);

                if (!acc[key]) {
                    acc[key] = { total: 0, done: 0 };
                }
                
                acc[key].total += amount;

                if (item.status === 'DONE') {
                    acc[key].done += amount;
                }
                
                return acc;
            }, {});

            // Convertimos el objeto en un array para el gráfico, calculando el %
            return Object.entries(progressData)
                .map(([label, { total, done }]) => ({
                    label,
                    value: total > 0 ? (done / total) * 100 : 0,
                }))
                .sort((a, b) => b.value - a.value);
        };
        
        return {
            byBuyer: calculateProgress(allItems, 'owner'),
            byCategory: calculateProgress(allItems, 'category'),
        };

    }, [processedData]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Le pasamos el nuevo "mode" al BarChart */}
            <BarChart title="Progreso de Gestión por Comprador" data={chartData.byBuyer} mode="percentage" />
            <BarChart title="Progreso de Gestión por Categoría" data={chartData.byCategory} mode="percentage" />
        </div>
    );
};

export default SummaryView;