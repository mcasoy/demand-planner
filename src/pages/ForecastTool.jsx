import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db, appId } from '../firebase/config';
import { getMonthDetails, formatCurrency, cleanNumber } from '../utils/helpers';
import { useForecastCalculations } from '../hooks/useForecastCalculations';

import GoogleSheetsManagerForecast from '../components/GoogleSheetsManagerForecast';
import FilterControlsForecast from '../components/FilterControlsForecast';
import { IconSearch, IconTrash2, IconShieldQuestion } from '../assets/Icons';

const ForecastTool = () => {
    const [skus, setSkus] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'objetivo_mensual_gmv', direction: 'descending' });
    const [dataVersion, setDataVersion] = useState(0);
    const [filters, setFilters] = useState({ category: [], brand: [], owner: [], oosOnly: false });
    const [groupBy, setGroupBy] = useState('sku');
    const [expandedGroups, setExpandedGroups] = useState({});

    const monthDetails = useMemo(getMonthDetails, []);

    useEffect(() => {
        setIsLoading(true);
        const skusCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'skus');
        const unsubscribe = onSnapshot(skusCollectionRef, snapshot => {
            const skusData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSkus(skusData);
            setIsLoading(false);
        }, err => {
            setError("No se pudieron cargar los datos de Firestore.");
            console.error(err);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [dataVersion]);

    const augmentedSkus = useForecastCalculations(skus, monthDetails);

    const filterOptions = useMemo(() => {
        const categories = new Set();
        const brands = new Set();
        const owners = new Set();
        skus.forEach(sku => {
            if (sku.category) categories.add(sku.category);
            if (sku.brand) brands.add(sku.brand);
            if (sku.owner) owners.add(sku.owner);
        });
        return { 
            categories: [...categories].sort(), 
            brands: [...brands].sort(), 
            owners: [...owners].sort()
        };
    }, [skus]);

    const filteredAndSortedSkus = useMemo(() => {
        const filtered = (augmentedSkus || []).filter(Boolean).filter(sku => {
            const categoryMatch = filters.category.length === 0 || filters.category.includes(sku.category);
            const brandMatch = filters.brand.length === 0 || filters.brand.includes(sku.brand);
            const buyerMatch = filters.owner.length === 0 || filters.owner.includes(sku.owner);
            const oosMatch = !filters.oosOnly || (sku.projections || []).some(p => p.count < p.daysInMonth);
            const searchMatch = (sku.id?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || (sku.sku_name?.toLowerCase() || '').includes(searchTerm.toLowerCase());
            return categoryMatch && brandMatch && buyerMatch && oosMatch && searchMatch;
        });

        filtered.sort((a, b) => {
            const valA = a[sortConfig.key] ?? -Infinity;
            const valB = b[sortConfig.key] ?? -Infinity;
            if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        return filtered;
    }, [augmentedSkus, searchTerm, sortConfig, filters]);

    const displayData = useMemo(() => {
        if (groupBy === 'sku') {
            return filteredAndSortedSkus.map(sku => ({ ...sku, isGroup: false }));
        }

        const grouped = filteredAndSortedSkus.reduce((acc, sku) => {
            const groupName = sku[groupBy] || `Sin ${groupBy}`;
            if (!acc[groupName]) {
                acc[groupName] = { items: [], stock_actual: 0, objetivo_mensual_gmv: 0 };
            }
            acc[groupName].items.push(sku);
            acc[groupName].stock_actual += cleanNumber(sku.stock_actual);
            acc[groupName].objetivo_mensual_gmv += cleanNumber(sku.objetivo_mensual_gmv);
            return acc;
        }, {});

        return Object.entries(grouped).map(([groupName, data]) => ({
            isGroup: true,
            id: groupName,
            groupName,
            ...data
        })).sort((a,b) => b.objetivo_mensual_gmv - a.objetivo_mensual_gmv);

    }, [groupBy, filteredAndSortedSkus]);
    
    const toggleGroup = useCallback((groupName) => {
        setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
    }, []);

    const requestSort = (key) => {
        setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending' }));
    };

    const handleDeleteAll = async () => {
        if (!confirmDelete) {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 3500);
            return;
        }
        setIsProcessing(true);
        try {
            const skusCollectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'skus');
            const querySnapshot = await getDocs(skusCollectionRef);
            const batch = writeBatch(db);
            querySnapshot.docs.forEach(docSnapshot => batch.delete(doc(skusCollectionRef, docSnapshot.id)));
            await batch.commit();
            setDataVersion(v => v + 1);
        } catch (e) { 
            setError("No se pudieron eliminar los datos."); 
            console.error(e);
        } finally { 
            setIsProcessing(false); 
            setConfirmDelete(false); 
        }
    };

    return (
        <div className="bg-slate-100 min-h-screen">
            <div className="container mx-auto p-4 md:p-8">
                <header className="mb-6">
                    <Link to="/" className="text-indigo-600 hover:underline mb-4">&larr; Volver al Índice</Link>
                    <h1 className="text-4xl font-bold text-slate-900">Forecast Tool</h1>
                    <p className="text-slate-600 mt-2">Conecta tu Google Sheet para visualizar proyecciones.</p>
                </header>
                {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded" role="alert"><p>{error}</p></div>}
                
                <GoogleSheetsManagerForecast db={db} setError={setError} setIsProcessing={setIsProcessing} isProcessing={isProcessing} forceRefresh={() => setDataVersion(v => v + 1)} />
                
                <div className="bg-white p-6 rounded-xl shadow-lg my-6">
                    <FilterControlsForecast filters={filters} setFilters={setFilters} options={filterOptions} />
                    <div className="mt-6 border-t pt-4">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Agrupar por</label>
                        <div className="flex gap-2 rounded-lg bg-slate-100 p-1">
                            <button onClick={() => setGroupBy('sku')} className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${groupBy === 'sku' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>SKU</button>
                            <button onClick={() => setGroupBy('brand')} className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${groupBy === 'brand' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>Marca</button>
                            <button onClick={() => setGroupBy('category')} className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${groupBy === 'category' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>Categoría</button>
                            <button onClick={() => setGroupBy('owner')} className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${groupBy === 'owner' ? 'bg-white shadow text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}>Owner</button>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg my-6">
                     <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                        <div className="relative w-full md:w-1/3">
                            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input type="text" placeholder="Buscar por SKU o nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <button onClick={handleDeleteAll} disabled={isProcessing || skus.length === 0} className={`w-full md:w-auto flex items-center justify-center gap-2 font-semibold px-4 py-2 rounded-lg shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${confirmDelete ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
                            {confirmDelete ? <IconShieldQuestion size={20} /> : <IconTrash2 size={20} />}
                            {confirmDelete ? "Confirmar Eliminación" : "Eliminar Todo"}
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto bg-white rounded-xl shadow-lg">
                    <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                            {groupBy === 'sku' ? (
                                <tr>
                                    <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-200" onClick={() => requestSort('id')}>SKU</th>
                                    <th scope="col" className="px-4 py-3">Nombre</th>
                                    <th scope="col" className="px-4 py-3">Marca</th>
                                    <th scope="col" className="px-4 py-3">Owner</th>
                                    <th scope="col" className="px-4 py-3">Categoría</th>
                                    <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-200" onClick={() => requestSort('objetivo_mensual_gmv')}>Obj. GMV</th>
                                    <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-200" onClick={() => requestSort('stock_actual')}>Stock Actual</th>
                                    <th scope="col" className="px-4 py-3 cursor-pointer hover:bg-slate-200" onClick={() => requestSort('dias_stock_hoy')}>Días Stock Hoy</th>
                                    {monthDetails.map((detail, i) => (<th key={i} scope="col" className="px-4 py-3">{`Días Stock ${detail.monthName}`}</th>))}
                                </tr>
                            ) : (
                                <tr>
                                    <th className="px-4 py-3">{ {brand: 'Marca', category: 'Categoría', owner: 'Owner'}[groupBy] }</th>
                                    <th className="px-4 py-3 text-right">Obj. GMV Total</th>
                                    <th className="px-4 py-3 text-right">Stock Actual Total</th>
                                    <th className="px-4 py-3 text-right"># SKUs</th>
                                </tr>
                            )}
                        </thead>
                        <tbody>
                            {displayData.map(item => (
                                item.isGroup ? (
                                    <React.Fragment key={item.id}>
                                        <tr className="bg-slate-100 border-b hover:bg-slate-200 cursor-pointer" onClick={() => toggleGroup(item.groupName)}>
                                            <td className="px-4 py-3 font-bold text-slate-800 flex items-center gap-2">
                                                <span className={`transition-transform duration-200 ${expandedGroups[item.groupName] ? 'rotate-90' : ''}`}>▶</span>
                                                {item.groupName}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold">{formatCurrency(item.objetivo_mensual_gmv)}</td>
                                            <td className="px-4 py-3 text-right font-bold">{item.stock_actual.toLocaleString('es-AR')}</td>
                                            <td className="px-4 py-3 text-right font-bold">{item.items.length}</td>
                                        </tr>
                                        {expandedGroups[item.groupName] && item.items.map(sku => (
                                            <tr key={sku.id} className="bg-white border-b hover:bg-slate-50 text-xs">
                                                <td className="pl-12 pr-4 py-2 text-slate-600">{sku.sku_name} ({sku.id})</td>
                                                <td className="px-4 py-2 text-right">{formatCurrency(sku.objetivo_mensual_gmv)}</td>
                                                <td className="px-4 py-2 text-right">{sku.stock_actual.toLocaleString('es-AR')}</td>
                                                <td className="px-4 py-2 text-right">{isFinite(sku.dias_stock_hoy) ? sku.dias_stock_hoy.toFixed(0) : '∞'} días</td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ) : (
                                    <tr key={item.id} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900">{item.id}</td>
                                        <td className="px-4 py-3">{item.sku_name}</td>
                                        <td className="px-4 py-3">{item.brand}</td>
                                        <td className="px-4 py-3">{item.owner}</td>
                                        <td className="px-4 py-3">{item.category}</td>
                                        <td className="px-4 py-3">{formatCurrency(item.objetivo_mensual_gmv)}</td>
                                        <td className="px-4 py-3 font-semibold">{item.stock_actual}</td>
                                        <td className="px-4 py-3 font-bold">
                                            <span className={`px-2 py-1 rounded-full text-xs ${item.dias_stock_hoy < 15 ? 'text-red-600 bg-red-100' : item.dias_stock_hoy < 30 ? 'text-amber-600 bg-amber-100' : 'text-green-600 bg-green-100'}`}>
                                                {isFinite(item.dias_stock_hoy) ? item.dias_stock_hoy.toFixed(0) : '∞'}
                                            </span>
                                        </td>
                                        {(item.projections || []).map((proj, i) => { 
                                            const percentageInStock = proj.daysInMonth > 0 ? (proj.count / proj.daysInMonth) * 100 : 100;
                                            const riskColor = percentageInStock < 50 ? 'text-red-500' : percentageInStock < 85 ? 'text-amber-600' : 'text-green-600';
                                            return <td key={i} className={`px-4 py-3 font-bold ${riskColor}`}>{`${proj.count}/${proj.daysInMonth}`}</td>
                                        })}
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

export default ForecastTool;