import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getYear, getMonth, parse, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import DatePicker from 'react-datepicker';
import { CSVLink } from 'react-csv';
import 'react-datepicker/dist/react-datepicker.css';

import { cleanNumber, formatCurrency } from '../utils/helpers';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import {
    IconArrowUpDown,
    IconTrendingUp,
    IconTarget,
    IconPackage,
    IconActivity,
    IconDownload
} from '../assets/Icons';

// --- Componentes Auxiliares ---
const renderChange = (change, unit = '%') => {
    if (!isFinite(change) || isNaN(change)) return null;
    const isPositive = change >= 0;
    const colorClass = isPositive ? 'text-green-600' : 'text-red-600';
    const sign = isPositive ? '▲ ' : '▼ ';
    const formattedChange = unit === 'pts' ? Math.abs(change).toFixed(1) : Math.abs(change).toFixed(0);
    return <span className={`text-sm font-semibold ${colorClass}`}>{sign}{formattedChange}{unit}</span>;
};

const SummaryKpiCard = ({ icon, title, value, change, unit = '%' }) => (
    <div className="bg-white p-6 rounded-xl shadow-lg flex items-start gap-4">
        <div className="bg-slate-100 p-3 rounded-lg">{icon}</div>
        <div>
            <p className="text-sm text-slate-500 font-medium">{title}</p>
            <p className="text-3xl font-bold text-slate-800">{value}</p>
            {isFinite(change) && <div className="mt-1">{renderChange(change, unit)}</div>}
        </div>
    </div>
);

// --- Componente Principal ---
const PerformanceTool = () => {
    // Estados para los datos que vienen de Firebase
    const [sales, setSales] = useState([]);
    const [productCatalog, setProductCatalog] = useState(new Map());
    const [stockData, setStockData] = useState(new Map());

    // Estados de UI
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [exportData, setExportData] = useState([]);
    
    // Estados de filtros y tabla
    const [primaryStartDate, setPrimaryStartDate] = useState(startOfMonth(new Date()));
    const [primaryEndDate, setPrimaryEndDate] = useState(endOfMonth(new Date()));
    const [secondaryStartDate, setSecondaryStartDate] = useState(startOfMonth(subMonths(new Date(), 1)));
    const [secondaryEndDate, setSecondaryEndDate] = useState(endOfMonth(subMonths(new Date(), 1)));
    
    const [selectedChannels, setSelectedChannels] = useState([]);
    const [selectedBrands, setSelectedBrands] = useState([]);
    const [selectedCategories, setSelectedCategories] = useState([]);
    
    const [sortConfig, setSortConfig] = useState({ key: 'periodRevenue', direction: 'descending' });
    const [groupBy, setGroupBy] = useState('sku');
    const [expandedGroups, setExpandedGroups] = useState({});

    // --- CARGA DE DATOS DESDE FIREBASE ---
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                console.log("Paso 1: Iniciando carga de colecciones...");
                const [productsSnapshot, salesSnapshot, stockSnapshot] = await Promise.all([
                    getDocs(collection(db, 'products')),
                    getDocs(collection(db, 'sales')),
                    getDocs(collection(db, 'stock'))
                ]);
                console.log(`Paso 2: Datos recibidos. Productos: ${productsSnapshot.size}, Ventas: ${salesSnapshot.size}, Stock: ${stockSnapshot.size}`);

                const catalogMap = new Map();
                productsSnapshot.docs.forEach(doc => {
                    // La llave es el product_id
                    catalogMap.set(doc.id, doc.data());
                });
                setProductCatalog(catalogMap);

                const stockMap = new Map();
                stockSnapshot.docs.forEach(doc => {
                    // La llave es el ID del documento (que es el SKU/default_code)
                    stockMap.set(doc.id, doc.data().stock_total_disponible || 0);
                });
                setStockData(stockMap);

                const salesData = salesSnapshot.docs.map(doc => doc.data());
                setSales(salesData);
                console.log("Paso 3: Datos cargados en el estado de React.");

            } catch (err) {
                console.error("Error al cargar datos desde Firebase:", err);
                setError("No se pudieron cargar los datos. Revisa la consola y las reglas de seguridad.");
            }
            setIsLoading(false);
        };
        fetchData();
    }, []);

    // --- LÓGICA DE UNIÓN Y CÁLCULOS ---
    const processedData = useMemo(() => {
        if (isLoading || sales.length === 0 || productCatalog.size === 0) return null;
        
        const joinedData = sales
            .filter(sale => sale.state === 'sale' && !sale.is_combo_sale) // Filtramos por estado y excluimos combos por ahora
            .map(sale => {
                const productInfo = productCatalog.get(sale.product_id);
                if (!productInfo) return null; // Si no encontramos el producto en el catálogo, descartamos la venta

                const stockInfo = stockData.get(productInfo.default_code);
                
                return {
                    sku: productInfo.default_code,
                    sku_name: productInfo.name,
                    brand: productInfo.brand,
                    category: productInfo.category,
                    net_sales: sale.net_sales,
                    items_sold: sale.product_qty_sold,
                    grossmargin: sale.gross_margin,
                    yearmonth: sale.yearmonth,
                    channel: sale.sales_channel,
                    stock_actual: stockInfo || 0
                };
            }).filter(Boolean);

        const salesBySkuMonth = joinedData.reduce((acc, sale) => {
            const sku = sale.sku;
            const yearmonth = sale.yearmonth;
            const channel = sale.channel;
            if (!acc[sku] || !yearmonth || !channel) return acc;

            if (!acc[sku][yearmonth]) acc[sku][yearmonth] = {};
            if (!acc[sku][yearmonth][channel]) acc[sku][yearmonth][channel] = { revenue: 0, units: 0, marginValue: 0 };
            
            const revenue = cleanNumber(sale.net_sales);
            const units = cleanNumber(sale.items_sold);
            const margin = cleanNumber(sale.grossmargin);

            acc[sku][yearmonth][channel].revenue += revenue;
            acc[sku][yearmonth][channel].units += units;
            acc[sku][yearmonth][channel].marginValue += margin; // El margen ya viene en valor
            
            return acc;
        }, {});
        
        const calculateMetricsForPeriod = (start, end) => {
            const metrics = {};
            for (const sku in salesBySkuMonth) {
                const info = productCatalog.get(sku); // Aquí la llave debería ser el ID del producto, no el SKU.
                // Corrección: Debemos tener un mapa de SKU a producto para esto
                let productInfo = {};
                for (const p of productCatalog.values()) {
                    if (p.default_code === sku) {
                        productInfo = p;
                        break;
                    }
                }

                if ((selectedBrands.length > 0 && !selectedBrands.includes(productInfo?.brand)) || (selectedCategories.length > 0 && !selectedCategories.includes(productInfo?.category))) continue;

                for (const ym in salesBySkuMonth[sku]) {
                    const saleDate = parse(String(ym), 'yyyyMM', new Date());
                    if (saleDate >= start && saleDate <= end) {
                        for (const channel in salesBySkuMonth[sku][ym]) {
                            if (selectedChannels.length === 0 || selectedChannels.includes(channel)) {
                                if (!metrics[sku]) metrics[sku] = { revenue: 0, units: 0, marginValue: 0, stock: stockData.get(sku) || 0 };
                                const data = salesBySkuMonth[sku][ym][channel];
                                metrics[sku].revenue += data.revenue;
                                metrics[sku].units += data.units;
                                metrics[sku].marginValue += data.marginValue;
                            }
                        }
                    }
                }
            }
            for(const sku in metrics) {
                const m = metrics[sku];
                const stock = cleanNumber(m.stock);
                const totalInventoryInPeriod = m.units + stock;
                m.sellThrough = totalInventoryInPeriod > 0 ? (m.units / totalInventoryInPeriod) * 100 : 0;
                // Asumiendo que el costo está en el catálogo de productos
                const productInfo = productCatalog.get(allSkus.find(id => productCatalog.get(id)?.default_code === sku));
                const unitCost = productInfo?.cost || 0;
                const avgInventoryValue = ((stock + totalInventoryInPeriod) / 2) * unitCost;
                m.turnover = avgInventoryValue > 0 ? m.revenue / avgInventoryValue : 0;
            }
            return metrics;
        };
        
        const primaryMetrics = calculateMetricsForPeriod(primaryStartDate, primaryEndDate);
        const secondaryMetrics = calculateMetricsForPeriod(secondaryStartDate, secondaryEndDate);
        const allSkus = [...new Set(Object.keys(primaryMetrics).concat(Object.keys(secondaryMetrics)))];
        
        const skusResult = allSkus.map(sku => {
            const pMetrics = primaryMetrics[sku] || { revenue: 0, units: 0, marginValue: 0, sellThrough: 0, turnover: 0 };
            const sMetrics = secondaryMetrics[sku] || { revenue: 0, units: 0, marginValue: 0, sellThrough: 0, turnover: 0 };
            let info = {};
            for (const p of productCatalog.values()) {
                if (p.default_code === sku) {
                    info = p;
                    break;
                }
            }
            const stock = stockData.get(sku) || 0;
            const periodRevenue = pMetrics.revenue;
            const periodUnits = pMetrics.units;
            const periodMargin = periodRevenue > 0 ? (pMetrics.marginValue / periodRevenue) * 100 : 0;
            const sMargin = sMetrics.revenue > 0 ? (sMetrics.marginValue / sMetrics.revenue) * 100 : 0;
            return {
                sku, 
                sku_name: info.name || 'N/A', 
                brand: info.brand || 'N/A', 
                category: info.category || 'N/A',
                stock_actual: cleanNumber(stock), 
                periodRevenue, 
                periodUnits, 
                periodMargin,
                periodSellThrough: pMetrics.sellThrough, 
                periodTurnover: pMetrics.turnover,
                revenuePctChange: sMetrics.revenue > 0 ? ((periodRevenue - sMetrics.revenue) / sMetrics.revenue) * 100 : Infinity,
                unitsPctChange: sMetrics.units > 0 ? ((periodUnits - sMetrics.units) / sMetrics.units) * 100 : Infinity,
                marginPtsChange: periodMargin - sMargin,
            };
        });

        const calculateGlobalKpis = (metricsObject) => {
            const metricsArray = Object.values(metricsObject);
            if(metricsArray.length === 0) return { totalRevenue: 0, totalUnits: 0, avgMargin: 0, avgSellThrough: 0 };
            const totalRevenue = metricsArray.reduce((sum, m) => sum + m.revenue, 0);
            const totalUnits = metricsArray.reduce((sum, m) => sum + m.units, 0);
            const totalMarginValue = metricsArray.reduce((sum, m) => sum + m.marginValue, 0);
            const weightedSellThrough = metricsArray.reduce((sum, m) => sum + (m.sellThrough * (m.units + cleanNumber(m.stock))), 0);
            const totalInventory = metricsArray.reduce((sum, m) => sum + (m.units + cleanNumber(m.stock)), 0);
            const avgMargin = totalRevenue > 0 ? (totalMarginValue / totalRevenue) * 100 : 0;
            const avgSellThrough = totalInventory > 0 ? weightedSellThrough / totalInventory : 0;
            return { totalRevenue, totalUnits, avgMargin, avgSellThrough };
        }

        const primaryKpis = calculateGlobalKpis(primaryMetrics);
        const secondaryKpis = calculateGlobalKpis(secondaryMetrics);

        const kpiSummary = {
            totalRevenue: { value: primaryKpis.totalRevenue, change: secondaryKpis.totalRevenue > 0 ? ((primaryKpis.totalRevenue - secondaryKpis.totalRevenue) / secondaryKpis.totalRevenue) * 100 : Infinity },
            avgMargin: { value: primaryKpis.avgMargin, change: primaryKpis.avgMargin - secondaryKpis.avgMargin },
            totalUnits: { value: primaryKpis.totalUnits, change: secondaryKpis.totalUnits > 0 ? ((primaryKpis.totalUnits - secondaryKpis.totalUnits) / secondaryKpis.totalUnits) * 100 : Infinity },
            avgSellThrough: { value: primaryKpis.avgSellThrough, change: primaryKpis.avgSellThrough - secondaryKpis.avgSellThrough }
        };
        return { skus: skusResult, kpis: kpiSummary };
    }, [isLoading, transactions, productCatalog, stockData, primaryStartDate, primaryEndDate, secondaryStartDate, secondaryEndDate, selectedChannels, selectedBrands, selectedCategories]);
    
    const dynamicFilterOptions = useMemo(() => {
        if (!productCatalog) return { channels: [], brands: [], categories: [] };
        const catalogArray = Array.from(productCatalog.values());
        const getUniqueOptions = (key, items) => [...new Set(items.map(s => s[key]).filter(Boolean))].sort();
        
        const categoryFilteredSkus = selectedCategories.length > 0 ? catalogArray.filter(s => selectedCategories.includes(s.category)) : catalogArray;
        const brandOptions = getUniqueOptions('brand', categoryFilteredSkus);

        const brandFilteredSkus = selectedBrands.length > 0 ? catalogArray.filter(s => selectedBrands.includes(s.brand)) : catalogArray;
        const categoryOptions = getUniqueOptions('category', brandFilteredSkus);

        const channelOptions = [...new Set(sales.map(s => s.sales_channel))].sort();

        return { channels: channelOptions, brands: brandOptions, categories: categoryOptions };
    }, [productCatalog, sales, selectedBrands, selectedCategories]);
    
    const displayData = useMemo(() => {
        if (!processedData || !processedData.skus) return [];
        let dataToDisplay;
        if (groupBy === 'sku') {
            dataToDisplay = processedData.skus.map(item => ({ ...item, isGroup: false, id: item.sku }));
        } else {
            const grouped = processedData.skus.reduce((acc, sku) => {
                const groupName = sku[groupBy] || `Sin ${groupBy}`;
                if (!acc[groupName]) {
                    acc[groupName] = { items: [], periodRevenue: 0, periodUnits: 0, periodMarginValue: 0, stock_actual: 0, revenuePctChangeArr: [], unitsPctChangeArr: [] };
                }
                const group = acc[groupName];
                group.items.push(sku);
                group.periodRevenue += sku.periodRevenue;
                group.periodUnits += sku.periodUnits;
                group.periodMarginValue += (sku.periodRevenue * (sku.periodMargin / 100));
                group.stock_actual += sku.stock_actual;
                if (isFinite(sku.revenuePctChange)) group.revenuePctChangeArr.push(sku.revenuePctChange);
                if (isFinite(sku.unitsPctChange)) group.unitsPctChangeArr.push(sku.unitsPctChange);
                return acc;
            }, {});
            dataToDisplay = Object.entries(grouped).map(([groupName, data]) => {
                const periodMargin = data.periodRevenue > 0 ? (data.periodMarginValue / data.periodRevenue) * 100 : 0;
                const totalInventoryInPeriod = data.periodUnits + data.stock_actual;
                const periodSellThrough = totalInventoryInPeriod > 0 ? (data.periodUnits / totalInventoryInPeriod) * 100 : 0;
                const avgInventoryValue = ((data.stock_actual + totalInventoryInPeriod) / 2) * (data.periodUnits > 0 ? data.periodRevenue / data.periodUnits : 0);
                const periodTurnover = avgInventoryValue > 0 ? data.periodRevenue / avgInventoryValue : 0;
                const avg = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : Infinity;
                const sortedItems = [...data.items].sort((a, b) => {
                    const valA = a[sortConfig.key] ?? -Infinity;
                    const valB = b[sortConfig.key] ?? -Infinity;
                    if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
                    return 0;
                });
                return {
                    isGroup: true, id: groupName, groupName, items: sortedItems, periodRevenue: data.periodRevenue, periodUnits: data.periodUnits,
                    periodMargin, periodSellThrough, periodTurnover, stock_actual: data.stock_actual,
                    revenuePctChange: avg(data.revenuePctChangeArr), unitsPctChange: avg(data.unitsPctChangeArr),
                };
            });
        }
        const sortedData = [...dataToDisplay].sort((a, b) => {
            const sortKey = (a.isGroup && sortConfig.key === 'sku_name') ? 'groupName' : sortConfig.key;
            const valA = a[sortKey] ?? -Infinity;
            const valB = b[sortKey] ?? -Infinity;
            if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        return sortedData;
    }, [groupBy, processedData, sortConfig]);
    
    useEffect(() => {
        if(!processedData || !processedData.skus) { setExportData([]); return; }
        const flatData = [];
        displayData.forEach(item => {
            if(item.isGroup) {
                flatData.push({'Grupo': item.groupName, 'Ventas ($)': item.periodRevenue, 'Unidades': item.periodUnits, 'Margen (%)': item.periodMargin, 'Sell-Through (%)': item.periodSellThrough, 'Rotacion': item.periodTurnover, 'Stock Actual': item.stock_actual});
                item.items.forEach(sku => {
                    flatData.push({'Grupo': `${item.groupName} > ${sku.sku_name} (${sku.sku})`, 'Ventas ($)': sku.periodRevenue, 'Unidades': sku.periodUnits, 'Margen (%)': sku.periodMargin, 'Sell-Through (%)': sku.periodSellThrough, 'Rotacion': sku.periodTurnover, 'Stock Actual': sku.stock_actual});
                });
            } else {
                flatData.push({'Grupo': `${item.sku_name} (${item.sku})`, 'Ventas ($)': item.periodRevenue, 'Unidades': item.periodUnits, 'Margen (%)': item.periodMargin, 'Sell-Through (%)': item.periodSellThrough, 'Rotacion': item.periodTurnover, 'Stock Actual': item.stock_actual});
            }
        });
        setExportData(flatData);
    }, [displayData]);

    const requestSort = (key) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'descending' ? 'ascending' : 'descending' }));
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
                <header className="mb-8">
                    <Link to="/" className="text-indigo-600 hover:underline mb-4">&larr; Volver al Índice</Link>
                    <h1 className="text-4xl font-bold text-slate-900 mt-4">Dashboard de Performance</h1>
                    <p className="text-slate-600 mt-2">Analiza el rendimiento de tus SKUs, marcas y categorías.</p>
                </header>

                {isLoading ? (
                    <div className="text-center py-10"><p className="font-semibold text-indigo-600">Cargando datos desde Firebase...</p></div>
                ) : error ? (
                    <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded" role="alert"><p>{error}</p></div>
                ) : (
                    <>
                        <div className="mb-8 p-6 bg-white rounded-xl shadow-lg">
                            <h3 className="font-bold text-lg mb-4">Filtros y Vistas</h3>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start border-b pb-6 mb-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Período Primario</label>
                                    <div className="flex items-center gap-2">
                                        <DatePicker selected={primaryStartDate} onChange={date => setPrimaryStartDate(date)} selectsStart startDate={primaryStartDate} endDate={primaryEndDate} dateFormat="MMM yy" showMonthYearPicker className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                                        <span className="text-gray-500">-</span>
                                        <DatePicker selected={primaryEndDate} onChange={date => setPrimaryEndDate(date)} selectsEnd startDate={primaryStartDate} endDate={primaryEndDate} minDate={primaryStartDate} dateFormat="MMM yy" showMonthYearPicker className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Período Secundario (para comparar)</label>
                                    <div className="flex items-center gap-2">
                                        <DatePicker selected={secondaryStartDate} onChange={date => setSecondaryStartDate(date)} selectsStart startDate={secondaryStartDate} endDate={secondaryEndDate} dateFormat="MMM yy" showMonthYearPicker className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                                        <span className="text-gray-500">-</span>
                                        <DatePicker selected={secondaryEndDate} onChange={date => setSecondaryEndDate(date)} selectsEnd startDate={secondaryStartDate} endDate={secondaryEndDate} minDate={secondaryStartDate} dateFormat="MMM yy" showMonthYearPicker className="w-full p-2 border border-gray-300 rounded-md shadow-sm"/>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div>
                                     <label className="block text-sm font-medium text-slate-700 mb-1">Canales</label>
                                     <MultiSelectDropdown options={dynamicFilterOptions.channels} selected={selectedChannels} onChange={setSelectedChannels} placeholder="Todos los Canales"/>
                                </div>
                                <div>
                                     <label className="block text-sm font-medium text-slate-700 mb-1">Marcas</label>
                                     <MultiSelectDropdown options={dynamicFilterOptions.brands} selected={selectedBrands} onChange={setSelectedBrands} placeholder="Todas las Marcas"/>
                                </div>
                                <div>
                                     <label className="block text-sm font-medium text-slate-700 mb-1">Categorías</label>
                                     <MultiSelectDropdown options={dynamicFilterOptions.categories} selected={selectedCategories} onChange={setSelectedCategories} placeholder="Todas las Categorías"/>
                                </div>
                                <div>
                                     <label className="block text-sm font-medium text-slate-700 mb-1">Compradores</label>
                                     <MultiSelectDropdown options={[]} selected={[]} onChange={() => {}} placeholder="N/A"/>
                                </div>
                            </div>
                        </div>

                        {processedData && processedData.skus.length > 0 ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                    <SummaryKpiCard icon={<IconTrendingUp size={24} className="text-teal-600"/>} title="Ventas Totales" value={formatCurrency(processedData.kpis.totalRevenue.value)} change={processedData.kpis.totalRevenue.change} unit="%"/>
                                    <SummaryKpiCard icon={<IconTarget size={24} className="text-sky-600"/>} title="Margen Bruto Promedio" value={`${processedData.kpis.avgMargin.value.toFixed(1)}%`} change={processedData.kpis.avgMargin.change} unit="pts"/>
                                    <SummaryKpiCard icon={<IconPackage size={24} className="text-indigo-600"/>} title="Unidades Vendidas" value={processedData.kpis.totalUnits.value.toLocaleString('es-AR')} change={processedData.kpis.totalUnits.change} unit="%"/>
                                    <SummaryKpiCard icon={<IconActivity size={24} className="text-violet-600"/>} title="Sell-Through Ponderado" value={`${processedData.kpis.avgSellThrough.value.toFixed(0)}%`} change={processedData.kpis.avgSellThrough.change} unit="pts"/>
                                </div>
                                
                                <div className="bg-white rounded-xl shadow-lg">
                                    <div className="p-4 border-b flex justify-between items-center">
                                        <div>
                                            <label className="text-sm font-medium text-slate-700 mr-4">Agrupar por:</label>
                                            <div className="inline-flex gap-2 rounded-lg bg-slate-100 p-1">
                                                <button onClick={() => setGroupBy('sku')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${groupBy === 'sku' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>SKU</button>
                                                <button onClick={() => setGroupBy('brand')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${groupBy === 'brand' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>Marca</button>
                                                <button onClick={() => setGroupBy('category')} className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${groupBy === 'category' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>Categoría</button>
                                            </div>
                                        </div>
                                        <CSVLink 
                                            data={exportData} 
                                            filename={`performance_report_${new Date().toISOString().slice(0,10)}.csv`}
                                            className="flex items-center gap-2 bg-teal-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:bg-teal-700 transition-all"
                                            target="_blank"
                                        >
                                            <IconDownload size={16}/>
                                            Descargar CSV
                                        </CSVLink>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left text-slate-600">
                                            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                                <tr>
                                                    {renderSortableHeader(groupBy === 'sku' ? 'sku_name' : 'groupName', groupBy === 'sku' ? 'SKU' : (groupBy.charAt(0).toUpperCase() + groupBy.slice(1)), 'whitespace-nowrap')}
                                                    {renderSortableHeader('periodRevenue', 'Ventas ($)', 'text-right')}
                                                    {renderSortableHeader('periodUnits', 'Unidades', 'text-right')}
                                                    {renderSortableHeader('periodMargin', 'Margen (%)', 'text-right')}
                                                    {renderSortableHeader('periodSellThrough', 'Sell-Through (%)', 'text-right')}
                                                    {renderSortableHeader('periodTurnover', 'Rotación', 'text-right')}
                                                    {renderSortableHeader('stock_actual', 'Stock Actual', 'text-right')}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {displayData.map(item => (
                                                    item.isGroup ? (
                                                        <React.Fragment key={item.id}>
                                                            <tr className="bg-slate-50 border-b hover:bg-slate-100 cursor-pointer" onClick={() => toggleGroup(item.id)}>
                                                                <td className="px-4 py-3 font-bold text-slate-800 flex items-center gap-2">
                                                                    <span className={`transition-transform duration-200 ${expandedGroups[item.id] ? 'rotate-90' : ''}`}>▶</span>
                                                                    {item.groupName}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.periodRevenue)}{renderChange(item.revenuePctChange)}</td>
                                                                <td className="px-4 py-3 text-right font-semibold">{item.periodUnits.toLocaleString('es-AR')}{renderChange(item.unitsPctChange)}</td>
                                                                <td className="px-4 py-3 text-right font-semibold">{item.periodMargin.toFixed(1)}%</td>
                                                                <td className="px-4 py-3 text-right font-semibold">{item.periodSellThrough.toFixed(1)}%</td>
                                                                <td className="px-4 py-3 text-right font-semibold">{item.periodTurnover.toFixed(2)}</td>
                                                                <td className="px-4 py-3 text-right font-semibold">{item.stock_actual.toLocaleString('es-AR')}</td>
                                                            </tr>
                                                            {expandedGroups[item.id] && item.items.map(sku => (
                                                                <tr key={sku.sku} className="bg-white border-b hover:bg-slate-50 text-xs">
                                                                    <td className="pl-12 pr-4 py-2 text-slate-600">{sku.sku_name} ({sku.sku})</td>
                                                                    <td className="px-4 py-2 text-right">{formatCurrency(sku.periodRevenue)}</td>
                                                                    <td className="px-4 py-2 text-right">{sku.periodUnits.toLocaleString('es-AR')}</td>
                                                                    <td className="px-4 py-2 text-right">{sku.periodMargin.toFixed(1)}%</td>
                                                                    <td className="px-4 py-2 text-right">{sku.periodSellThrough.toFixed(1)}%</td>
                                                                    <td className="px-4 py-2 text-right">{sku.periodTurnover.toFixed(2)}</td>
                                                                    <td className="px-4 py-2 text-right">{sku.stock_actual.toLocaleString('es-AR')}</td>
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                    ) : (
                                                        <tr key={item.sku} className="bg-white border-b hover:bg-slate-50">
                                                            <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                                                                <div className="font-bold">{item.sku_name}</div>
                                                                <div className="text-xs text-slate-500">{item.sku}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-right">{formatCurrency(item.periodRevenue)}{renderChange(item.revenuePctChange)}</td>
                                                            <td className="px-4 py-3 text-right">{item.periodUnits.toLocaleString('es-AR')}{renderChange(item.unitsPctChange)}</td>
                                                            <td className="px-4 py-3 text-right">{item.periodMargin.toFixed(1)}%{renderChange(item.marginPtsChange, 'pts')}</td>
                                                            <td className="px-4 py-3 text-right font-semibold">{item.periodSellThrough.toFixed(1)}%</td>
                                                            <td className="px-4 py-3 text-right font-semibold">{item.periodTurnover.toFixed(2)}</td>
                                                            <td className="px-4 py-3 text-right">{item.stock_actual.toLocaleString('es-AR')}</td>
                                                        </tr>
                                                    )
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        ) : (
                           <div className="text-center py-10 bg-white rounded-xl shadow-lg">
                                <h3 className="text-lg font-semibold text-slate-800">No se encontraron datos</h3>
                                <p className="text-slate-500 mt-2">La carga inicial fue exitosa, pero no se pudieron unir los datos. Verifica que los 'default_code' de las transacciones coincidan con los del catálogo.</p>
                           </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default PerformanceTool;