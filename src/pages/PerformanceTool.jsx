import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getYear, getMonth, parse, subMonths } from 'date-fns';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

import { salesDataJSON } from '../data/datosManuales.js';
import { skusDataJSON } from '../data/datosManuales.js';
import { cleanNumber, formatCurrency } from '../utils/helpers';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import { IconArrowUpDown } from '../assets/Icons';

const renderChange = (change, unit = '%') => {
    if (!isFinite(change) || isNaN(change)) return null;
    
    const isPositive = change >= 0;
    const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
    const sign = isPositive ? '+' : '';
    const formattedChange = unit === 'pts' ? change.toFixed(1) : change.toFixed(0);

    return (
        <span className={`ml-2 text-xs font-mono ${colorClass}`}>
            ({sign}{formattedChange}{unit})
        </span>
    );
};

const PerformanceTool = () => {
    const [sales] = useState(salesDataJSON || []);
    const [skuInfo] = useState(skusDataJSON || []);
    const [primaryStartDate, setPrimaryStartDate] = useState(new Date(2025, 3, 1));
    const [primaryEndDate, setPrimaryEndDate] = useState(new Date(2025, 5, 30));
    const [secondaryStartDate, setSecondaryStartDate] = useState(new Date(2025, 0, 1));
    const [secondaryEndDate, setSecondaryEndDate] = useState(new Date(2025, 2, 31));
    const [selectedChannels, setSelectedChannels] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: 'periodRevenue', direction: 'descending' });
    const [groupBy, setGroupBy] = useState('sku');
    const [expandedGroups, setExpandedGroups] = useState({});

    const channelOptions = useMemo(() => {
        if (!sales) return [];
        return [...new Set(sales.map(s => s.channel))].sort();
    }, [sales]);

    const salesBySkuMonth = useMemo(() => {
        if (!sales) return {};
        return sales.reduce((acc, sale) => {
            const sku = sale.SKU;
            const yearmonth = sale.yearmonth;
            const channel = sale.channel;

            if (!acc[sku]) acc[sku] = {};
            if (!acc[sku][yearmonth]) acc[sku][yearmonth] = {};
            if (!acc[sku][yearmonth][channel]) {
                acc[sku][yearmonth][channel] = { revenue: 0, units: 0, marginValue: 0 };
            }

            const revenue = cleanNumber(sale.net_sales);
            acc[sku][yearmonth][channel].revenue += revenue;
            acc[sku][yearmonth][channel].units += cleanNumber(sale.items_sold);
            acc[sku][yearmonth][channel].marginValue += (cleanNumber(sale.grossmargin) * revenue);
            
            return acc;
        }, {});
    }, [sales]);

    const processedSkus = useMemo(() => {
        const calculateMetricsForPeriod = (start, end) => {
            const metrics = {};
            for (const sku in salesBySkuMonth) {
                for (const ym in salesBySkuMonth[sku]) {
                    const saleDate = parse(String(ym), 'yyyyMM', new Date());
                    if (saleDate >= start && saleDate <= end) {
                        for (const channel in salesBySkuMonth[sku][ym]) {
                            if (selectedChannels.length === 0 || selectedChannels.includes(channel)) {
                                if (!metrics[sku]) metrics[sku] = { revenue: 0, units: 0, marginValue: 0 };
                                const data = salesBySkuMonth[sku][ym][channel];
                                metrics[sku].revenue += data.revenue;
                                metrics[sku].units += data.units;
                                metrics[sku].marginValue += data.marginValue;
                            }
                        }
                    }
                }
            }
            return metrics;
        };

        const primaryMetrics = calculateMetricsForPeriod(primaryStartDate, primaryEndDate);
        const secondaryMetrics = calculateMetricsForPeriod(secondaryStartDate, secondaryEndDate);

        const lastMonthDate = subMonths(new Date(), 1);
        const lastYearMonth = getYear(lastMonthDate) * 100 + (getMonth(lastMonthDate) + 1);
        const skuInfoMap = new Map(skuInfo.map(s => [s.sku, s]));
        const allSkus = [...new Set(Object.keys(primaryMetrics).concat(Object.keys(secondaryMetrics)))];
        
        const result = allSkus.map(sku => {
            const pMetrics = primaryMetrics[sku] || { revenue: 0, units: 0, marginValue: 0 };
            const sMetrics = secondaryMetrics[sku] || { revenue: 0, units: 0, marginValue: 0 };
            const info = skuInfoMap.get(sku) || {};
            
            const stockActual = cleanNumber(info.stock_actual);
            let salesLastMonth = 0;
            if (salesBySkuMonth[sku] && salesBySkuMonth[sku][lastYearMonth]) {
                for (const channel in salesBySkuMonth[sku][lastYearMonth]) {
                    salesLastMonth += salesBySkuMonth[sku][lastYearMonth][channel].units;
                }
            }
            
            const daysInLastMonth = 30.4;
            const dailySalesLastMonth = salesLastMonth / daysInLastMonth;
            const daysOfInventory = dailySalesLastMonth > 0 ? (stockActual / dailySalesLastMonth) : Infinity;

            const periodRevenue = pMetrics.revenue;
            const periodUnits = pMetrics.units;
            const periodAvgPrice = periodUnits > 0 ? periodRevenue / periodUnits : 0;
            const periodMargin = periodRevenue > 0 ? (pMetrics.marginValue / periodRevenue) * 100 : 0;
            const sAvgPrice = sMetrics.units > 0 ? sMetrics.revenue / sMetrics.units : 0;
            const sMargin = sMetrics.revenue > 0 ? (sMetrics.marginValue / sMetrics.revenue) * 100 : 0;
            const revenuePctChange = sMetrics.revenue > 0 ? ((periodRevenue - sMetrics.revenue) / sMetrics.revenue) * 100 : Infinity;
            const unitsPctChange = sMetrics.units > 0 ? ((periodUnits - sMetrics.units) / sMetrics.units) * 100 : Infinity;
            const avgPricePctChange = sAvgPrice > 0 ? ((periodAvgPrice - sAvgPrice) / sAvgPrice) * 100 : Infinity;
            const marginPtsChange = periodMargin - sMargin;

            return {
                sku,
                sku_name: info.sku_name || 'N/A',
                brand: info.brand || 'N/A',
                category: info.category || 'N/A',
                stock_actual: stockActual,
                daysOfInventory: isFinite(daysOfInventory) ? Math.round(daysOfInventory) : '∞',
                periodRevenue, periodUnits, periodAvgPrice, periodMargin,
                revenuePctChange, unitsPctChange, avgPricePctChange, marginPtsChange,
            };
        });
        
        result.sort((a, b) => {
            const valA = a[sortConfig.key] ?? -Infinity;
            const valB = b[sortConfig.key] ?? -Infinity;
            if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });

        return result;

    }, [salesBySkuMonth, skuInfo, primaryStartDate, primaryEndDate, secondaryStartDate, secondaryEndDate, selectedChannels, sortConfig]);

    const displayData = useMemo(() => {
        if (groupBy === 'sku') {
            return processedSkus.map(sku => ({ ...sku, isGroup: false }));
        }

        const grouped = processedSkus.reduce((acc, sku) => {
            const groupName = sku[groupBy] || `Sin ${groupBy}`;
            if (!acc[groupName]) {
                acc[groupName] = {
                    items: [], periodRevenue: 0, periodUnits: 0,
                    revenuePctChangeArr: [], unitsPctChangeArr: []
                };
            }
            acc[groupName].items.push(sku);
            acc[groupName].periodRevenue += sku.periodRevenue;
            acc[groupName].periodUnits += sku.periodUnits;
            if (isFinite(sku.revenuePctChange)) acc[groupName].revenuePctChangeArr.push(sku.revenuePctChange);
            if (isFinite(sku.unitsPctChange)) acc[groupName].unitsPctChangeArr.push(sku.unitsPctChange);
            return acc;
        }, {});

        return Object.entries(grouped).map(([groupName, data]) => {
            const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : Infinity;
            return {
                isGroup: true,
                id: groupName,
                groupName,
                items: data.items,
                periodRevenue: data.periodRevenue,
                periodUnits: data.periodUnits,
                avgRevenuePctChange: avg(data.revenuePctChangeArr),
                avgUnitsPctChange: avg(data.unitsPctChangeArr),
            };
        }).sort((a,b) => b.periodRevenue - a.periodRevenue);

    }, [groupBy, processedSkus]);

    const requestSort = (key) => {
        let direction = 'descending';
        if (sortConfig.key === key && sortConfig.direction === 'descending') {
            direction = 'ascending';
        }
        setSortConfig({ key, direction });
    };
    
    const toggleGroup = useCallback((groupName) => {
        setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
    }, []);

    const renderSortableHeader = (key, label, aclassName = '') => (
        <th className={`px-4 py-3 cursor-pointer hover:bg-slate-200 transition-colors ${aclassName}`} onClick={() => requestSort(key)}>
            <div className={`flex items-center gap-1 ${aclassName.includes('text-right') ? 'justify-end' : 'flex-start'}`}>
                <span>{label}</span>
                <IconArrowUpDown size={14} className={sortConfig.key === key ? 'text-slate-900' : 'text-slate-300'} />
            </div>
        </th>
    );

    return (
        <div className="bg-slate-100 min-h-screen font-sans">
            <div className="container mx-auto p-4 md:p-8">
                <header className="mb-6">
                    <Link to="/" className="text-indigo-600 hover:underline mb-4">&larr; Volver al Índice</Link>
                    <h1 className="text-4xl font-bold text-slate-900 mt-4">Herramienta de Performance</h1>
                    <p className="text-slate-600 mt-2">Analiza el rendimiento de tus SKUs, marcas y categorías.</p>
                </header>

                <div className="mb-6 p-6 bg-white rounded-xl shadow-lg">
                    <h3 className="font-bold text-lg mb-4">Filtros y Vistas</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Período Primario</label>
                            <div className="flex items-center gap-2">
                                <DatePicker selected={primaryStartDate} onChange={date => setPrimaryStartDate(date)} selectsStart startDate={primaryStartDate} endDate={primaryEndDate} dateFormat="MMM yyyy" showMonthYearPicker className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                                <span className="text-gray-500">-</span>
                                <DatePicker selected={primaryEndDate} onChange={date => setPrimaryEndDate(date)} selectsEnd startDate={primaryStartDate} endDate={primaryEndDate} minDate={primaryStartDate} dateFormat="MMM yyyy" showMonthYearPicker className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Período Secundario (para comparar)</label>
                            <div className="flex items-center gap-2">
                                <DatePicker selected={secondaryStartDate} onChange={date => setSecondaryStartDate(date)} selectsStart startDate={secondaryStartDate} endDate={secondaryEndDate} dateFormat="MMM yyyy" showMonthYearPicker className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                                <span className="text-gray-500">-</span>
                                <DatePicker selected={secondaryEndDate} onChange={date => setSecondaryEndDate(date)} selectsEnd startDate={secondaryStartDate} endDate={secondaryEndDate} minDate={secondaryStartDate} dateFormat="MMM yyyy" showMonthYearPicker className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                            </div>
                        </div>
                        <div>
                             <label className="block text-sm font-medium text-slate-700 mb-1">Canales</label>
                             <MultiSelectDropdown options={channelOptions} selected={selectedChannels} onChange={setSelectedChannels} placeholder="Todos los Canales"/>
                        </div>
                    </div>
                    <div className="mt-6 border-t pt-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Agrupar por</label>
                        <div className="flex gap-2 rounded-lg bg-slate-100 p-1">
                            <button onClick={() => setGroupBy('sku')} className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${groupBy === 'sku' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>SKU</button>
                            <button onClick={() => setGroupBy('brand')} className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${groupBy === 'brand' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>Marca</button>
                            <button onClick={() => setGroupBy('category')} className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${groupBy === 'category' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>Categoría</button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto bg-white rounded-xl shadow-lg">
                    <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                            {groupBy === 'sku' ? (
                                <tr>
                                    {renderSortableHeader('sku', 'SKU', '')}
                                    <th className="px-4 py-3 font-semibold">Nombre</th>
                                    {renderSortableHeader('stock_actual', 'Stock Actual', 'text-right')}
                                    {renderSortableHeader('daysOfInventory', 'Días Inventario', 'text-right')}
                                    {renderSortableHeader('periodRevenue', 'Ventas ($)', 'text-right')}
                                    {renderSortableHeader('periodUnits', 'Ventas (u)', 'text-right')}
                                    {renderSortableHeader('periodAvgPrice', 'Precio Prom.', 'text-right')}
                                    {renderSortableHeader('periodMargin', 'Margen (%)', 'text-right')}
                                </tr>
                            ) : (
                                <tr>
                                    <th className="px-4 py-3 w-1/2">{groupBy === 'brand' ? 'Marca' : 'Categoría'}</th>
                                    <th className="px-4 py-3 text-right">Ventas ($)</th>
                                    <th className="px-4 py-3 text-right">Ventas (u)</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {displayData.map(item => (
                                item.isGroup ? (
                                    <React.Fragment key={item.groupName}>
                                        <tr className="bg-slate-100 border-b hover:bg-slate-200 cursor-pointer" onClick={() => toggleGroup(item.groupName)}>
                                            <td className="px-4 py-3 font-bold text-slate-800 flex items-center gap-2">
                                                <span className={`transition-transform duration-200 ${expandedGroups[item.groupName] ? 'rotate-90' : ''}`}>▶</span>
                                                {item.groupName}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.periodRevenue)}{renderChange(item.avgRevenuePctChange)}</td>
                                            <td className="px-4 py-3 text-right font-bold">{item.periodUnits.toLocaleString('es-AR')}{renderChange(item.avgUnitsPctChange)}</td>
                                        </tr>
                                        {expandedGroups[item.groupName] && item.items.map(sku => (
                                            <tr key={sku.sku} className="bg-white border-b hover:bg-slate-50">
                                                <td className="pl-12 pr-4 py-2 text-slate-600 col-span-2">{sku.sku_name} ({sku.sku})</td>
                                                <td className="px-4 py-2 text-right">{formatCurrency(sku.periodRevenue)}{renderChange(sku.revenuePctChange)}</td>
                                                <td className="px-4 py-2 text-right">{sku.periodUnits.toLocaleString('es-AR')}{renderChange(sku.unitsPctChange)}</td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ) : (
                                    <tr key={item.sku} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">{item.sku}</td>
                                        <td className="px-4 py-3">{item.sku_name}</td>
                                        <td className="px-4 py-3 text-right font-semibold">{item.stock_actual.toLocaleString('es-AR')}</td>
                                        <td className="px-4 py-3 text-right font-bold">{item.daysOfInventory}</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(item.periodRevenue)}{renderChange(item.revenuePctChange, '%')}</td>
                                        <td className="px-4 py-3 text-right">{item.periodUnits.toLocaleString('es-AR')}{renderChange(item.unitsPctChange, '%')}</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(item.periodAvgPrice)}{renderChange(item.avgPricePctChange, '%')}</td>
                                        <td className="px-4 py-3 text-right">{item.periodMargin.toFixed(1)}%{renderChange(item.marginPtsChange, 'pts')}</td>
                                    </tr>
                                )
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PerformanceTool;