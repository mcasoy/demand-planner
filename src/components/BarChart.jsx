// src/components/BarChart.jsx
import React from 'react';
import { formatCurrency } from '../utils/helpers';

// Añadimos una nueva prop: "mode", que puede ser 'absolute' o 'percentage'
const BarChart = ({ title, data, mode = 'absolute' }) => {
    if (!data || data.length === 0) {
        return (
            <div className="p-6 bg-white rounded-xl shadow-lg">
                <h3 className="font-bold text-xl mb-6 text-slate-800">{title}</h3>
                <p className="text-slate-500">No hay datos para mostrar.</p>
            </div>
        );
    }

    // El valor máximo solo es relevante para el modo absoluto
    const maxValue = mode === 'absolute' ? Math.max(...data.map(item => item.value)) : 100;

    return (
        <div className="p-6 bg-white rounded-xl shadow-lg">
            <h3 className="font-bold text-xl mb-6 text-slate-800">{title}</h3>
            <div className="space-y-4">
                {data.map(({ label, value }) => {
                    // El cálculo del porcentaje ahora depende del modo
                    const percentage = mode === 'absolute' 
                        ? (maxValue > 0 ? (value / maxValue) * 100 : 0)
                        : value; // En modo porcentaje, el valor YA es el porcentaje

                    return (
                        <div key={label}>
                            <div className="flex justify-between mb-1">
                                <span className="text-sm font-medium text-slate-700">{label}</span>
                                {/* El texto que se muestra también depende del modo */}
                                <span className="text-sm font-bold text-slate-600">
                                    {mode === 'absolute' ? formatCurrency(value) : `${value.toFixed(0)}%`}
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4">
                                <div 
                                    className="bg-teal-500 h-4 rounded-full text-center text-white text-xs font-bold transition-all duration-500 flex items-center justify-center" 
                                    style={{ width: `${percentage}%` }}
                                >
                                   {/* Opcional: mostrar el % dentro de la barra si hay espacio */}
                                   {percentage > 15 && `${percentage.toFixed(0)}%`}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BarChart;