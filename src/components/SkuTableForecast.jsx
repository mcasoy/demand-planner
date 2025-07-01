import React from 'react';
import { formatCurrency } from '../utils/helpers';
import { IconArrowUpDown } from '../assets/Icons';

// Componente para una sola fila, se usa solo aquí así que lo mantenemos en el mismo archivo.
const SkuTableRowForecast = ({ sku, monthDetails }) => {
    const initialDaysOfStock = sku.dias_stock_hoy;
    const projections = sku.projections || [];
    
    return (
        <tr className="bg-white border-b hover:bg-slate-50">
            <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{sku.id}</td>
            <td className="px-4 py-3">{sku.sku_name}</td>
            <td className="px-4 py-3">{sku.brand}</td>
            <td className="px-4 py-3">{sku.buyer}</td>
            <td className="px-4 py-3">{sku.category}</td>
            <td className="px-4 py-3">{formatCurrency(sku.objetivo_mensual_gmv)}</td>
            <td className="px-4 py-3 font-semibold">{sku.stock_actual}</td>
            <td className="px-4 py-3 font-bold">
                <span className={`px-2 py-1 rounded-full text-xs ${
                    initialDaysOfStock < 15 ? 'text-red-600 bg-red-100' : 
                    initialDaysOfStock < 30 ? 'text-amber-600 bg-amber-100' : 
                    'text-green-600 bg-green-100'
                }`}>
                    {isFinite(initialDaysOfStock) ? initialDaysOfStock.toFixed(0) : '∞'}
                </span>
            </td>
            {projections.map((proj, i) => {
                const { count, daysInMonth } = proj;
                const percentageInStock = daysInMonth > 0 ? (count / daysInMonth) * 100 : 100;
                const riskColor = percentageInStock < 50 ? 'text-red-500' : percentageInStock < 85 ? 'text-amber-600' : 'text-green-600';
                return (
                    <td key={i} className={`px-4 py-3 font-bold ${riskColor}`}>
                        {`${count}/${daysInMonth}`}
                    </td>
                );
            })}
        </tr>
    );
};

// Headers de la tabla definidos como una constante
const tableHeadersForecast = (monthDetails) => [
    { key: 'id', label: 'SKU' },
    { key: 'sku_name', label: 'Nombre' },
    { key: 'brand', label: 'Marca' },
    { key: 'buyer', label: 'Comprador' },
    { key: 'category', label: 'Categoría' },
    { key: 'objetivo_mensual_gmv', label: 'Obj. GMV' },
    { key: 'stock_actual', label: 'Stock Actual' },
    { key: 'dias_stock_hoy', label: 'Días Stock Hoy' },
    ...monthDetails.map((detail, i) => ({ key: `proj_${i}`, label: `Días en Stock ${detail.monthName}` }))
];


const SkuTableForecast = ({ skus, sortConfig, requestSort, monthDetails }) => (
    <div className="overflow-x-auto bg-white rounded-xl shadow-lg">
        <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                <tr>
                    {tableHeadersForecast(monthDetails).map(header => (
                        <th 
                            key={header.key} 
                            scope="col" 
                            className="px-4 py-3 cursor-pointer hover:bg-slate-200 whitespace-nowrap" 
                            onClick={() => requestSort(header.key)}
                        >
                            <div className="flex items-center gap-1">
                                <IconArrowUpDown size={14} className={sortConfig.key === header.key ? '' : 'opacity-20'}/> 
                                {header.label}
                            </div>
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {skus.map(sku => <SkuTableRowForecast key={sku.id} sku={sku} monthDetails={monthDetails} />)}
            </tbody>
        </table>
    </div>
);

export default SkuTableForecast;