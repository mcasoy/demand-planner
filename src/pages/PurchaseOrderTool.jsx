// src/pages/PurchaseOrderTool.jsx (Versión con Lógica de Datos Corregida)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, appId } from '../firebase/config';
import { getMonthDetails, cleanNumber } from '../utils/helpers';
import { format, parseISO, isValid } from 'date-fns';

// Componentes
import SupplierCard from '../components/SupplierCard';
import MultiSelectDropdown from '../components/MultiSelectDropdown';
import PurchaseOrderUploader from '../components/PurchaseOrderUploader';
import SummaryCard from '../components/SummaryCard';
import SummaryView from '../components/SummaryView';
import { IconFilter } from '../assets/Icons';

const PurchaseOrderTool = () => {
    // --- ESTADOS (sin cambios) ---
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [forecastData, setForecastData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [filters, setFilters] = useState({ proveedor: [], owner: [] });
    const [sortBy, setSortBy] = useState('totalAmount');
    const [openSuppliers, setOpenSuppliers] = useState({});
    const [view, setView] = useState('orders');

    const monthDetails = useMemo(getMonthDetails, []);

    // --- EFECTO DE CARGA DE DATOS (sin cambios) ---
    useEffect(() => {
        setIsLoading(true);
        const collectionsToFetch = [
            { 
                name: 'purchase_orders', 
                setter: (data) => setPurchaseOrders(data.filter(po => po.cantidad_a_comprar && Number(po.cantidad_a_comprar) > 0)) 
            },
            { 
                name: 'skus', 
                setter: setForecastData 
            }
        ];

        const unsubscribers = collectionsToFetch.map(c => {
            const ref = collection(db, 'artifacts', appId, 'public', 'data', c.name);
            return onSnapshot(ref, snapshot => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                c.setter(data);
                setIsLoading(false);
            }, err => {
                setError(`No se pudieron cargar los datos de ${c.name}.`);
                console.error(err);
                setIsLoading(false);
            });
        });
        
        return () => unsubscribers.forEach(unsub => unsub());
    }, []);

    // --- CAMBIO PRINCIPAL AQUÍ ---
    // Lógica de procesamiento de datos corregida
    const processedData = useMemo(() => {
        if (forecastData.length === 0) return [];

        const forecastMap = new Map(forecastData.map(f => [f.id, f]));
        
        const suppliers = purchaseOrders.reduce((acc, po) => {
            const supplierName = po.proveedor || 'Sin Proveedor';
            if (!acc[supplierName]) {
                acc[supplierName] = { name: supplierName, owner: po.owner, items: [], totalAmount: 0, totalItems: 0, riskScore: 0 };
            }

            const sku = String(po.sku).trim();
            const poQuantity = cleanNumber(po.cantidad_a_comprar);
            
            const existingItem = acc[supplierName].items.find(item => item.sku === sku);

            if (existingItem) {
                existingItem.cantidad_a_comprar += poQuantity;
            } else {
                const skuData = forecastMap.get(sku);

                // LÓGICA CORREGIDA: Calculamos Tránsito y Arribo desde la fuente correcta (skuData)
                const totalInTransit = skuData?.purchase_orders?.reduce((sum, transit_item) => sum + cleanNumber(transit_item.quantity), 0) ?? 0;
                
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const nextArrival = skuData?.purchase_orders
                    ?.map(transit_item => parseISO(transit_item.date_of_arrival))
                    .filter(date => isValid(date) && date >= today)
                    .sort((a, b) => a - b)[0];

                const newItem = {
                    ...po,
                    cantidad_a_comprar: poQuantity,
                    sku_name: skuData?.sku_name ?? 'N/A',
                    category: skuData?.category ?? 'N/A',
                    stock_actual: skuData?.stock_actual ?? 0,
                    totalInTransit: totalInTransit,
                    nextArrival: nextArrival ? format(nextArrival, 'dd/MM/yyyy') : 'N/A',
                };
                acc[supplierName].items.push(newItem);
            }

            return acc;
        }, {});

        // El resto de la lógica no cambia
        return Object.values(suppliers).map(s => {
            s.totalAmount = s.items.reduce((sum, item) => sum + (cleanNumber(item.cantidad_a_comprar) * cleanNumber(item.precio_unitario)), 0);
            s.totalItems = s.items.reduce((sum, item) => sum + cleanNumber(item.cantidad_a_comprar), 0);
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();
            
            s.riskScore = s.items.reduce((risk, item) => {
                 const forecast = forecastMap.get(item.sku);
                 if (!forecast || !forecast.forecasts) return risk;
                 
                 const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                 const dailySaleM0 = (forecast.forecasts[0] || 0) / daysInCurrentMonth;
                 const dias_stock_hoy = dailySaleM0 > 0 ? (forecast.stock_actual || 0) / dailySaleM0 : Infinity;

                 if (dias_stock_hoy < 30) return risk + 1;
                 return risk;
            }, 0);
            return s;
        });
    }, [purchaseOrders, forecastData, monthDetails]);
    // --- FIN DEL CAMBIO PRINCIPAL ---

    // El resto del archivo no tiene cambios
    const filterOptions = useMemo(() => {
        const suppliers = new Set(purchaseOrders.map(po => po.proveedor).filter(Boolean));
        const owners = new Set(purchaseOrders.map(po => po.owner).filter(Boolean));
        return { suppliers: [...suppliers].sort(), owners: [...owners].sort() };
    }, [purchaseOrders]);

    const filteredAndSortedSuppliers = useMemo(() => {
        return processedData.filter(s => {
            const supplierMatch = filters.proveedor.length === 0 || filters.proveedor.includes(s.name);
            const ownerMatch = filters.owner.length === 0 || filters.owner.includes(s.owner);
            return supplierMatch && ownerMatch;
        }).sort((a,b) => {
            if (sortBy === 'riskScore') return b.riskScore - a.riskScore;
            if (sortBy === 'totalItems') return b.totalItems - a.totalItems;
            return b.totalAmount - a.totalAmount;
        });
    }, [processedData, filters, sortBy]);

    const handleToggleSupplier = useCallback((supplierName) => {
        setOpenSuppliers(prev => ({
            ...prev,
            [supplierName]: !(prev[supplierName] ?? true)
        }));
    }, []);

    const toggleAllSuppliers = useCallback((isOpen) => {
        const newState = {};
        filteredAndSortedSuppliers.forEach(s => {
            newState[s.name] = isOpen;
        });
        setOpenSuppliers(newState);
    }, [filteredAndSortedSuppliers]);
    
    const handleToggleStatus = useCallback(async (poId, currentStatus) => {
        if (!db || !poId) return;
        const newStatus = currentStatus === 'DONE' ? 'PENDING' : 'DONE';
        const poDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'purchase_orders', poId);
        try {
            await updateDoc(poDocRef, { status: newStatus });
        } catch(e) {
            setError("Error al actualizar el estado.");
            console.error(e);
        }
    }, []);

    return (
        <div className="bg-slate-100 min-h-screen font-sans">
            <div className="container mx-auto p-4 md:p-8">
                <header className="mb-6">
                    <Link to="/" className="text-indigo-600 hover:underline mb-4">&larr; Volver al Índice</Link>
                    <h1 className="text-4xl font-bold text-slate-900 mt-4">Priorización de Órdenes de Compra</h1>
                    <p className="text-slate-600 mt-2">Gestiona y prioriza tus órdenes de compra pendientes.</p>
                </header>

                <PurchaseOrderUploader setError={setError} setIsProcessing={setIsProcessing} isProcessing={isProcessing} />
                
                {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded" role="alert"><p>{error}</p></div>}
                
                <SummaryCard suppliers={filteredAndSortedSuppliers} />

                <div className="my-6 p-6 bg-white rounded-xl shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                         <div className="flex items-center gap-4">
                             <span className={`font-semibold transition-colors ${view === 'orders' ? 'text-indigo-600' : 'text-slate-400'}`}>Vista de Órdenes</span>
                             <label className="inline-flex relative items-center cursor-pointer">
                                 <input type="checkbox" checked={view === 'summary'} onChange={() => setView(v => v === 'orders' ? 'summary' : 'orders')} className="sr-only peer" />
                                 <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-indigo-300 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                             </label>
                             <span className={`font-semibold transition-colors ${view === 'summary' ? 'text-indigo-600' : 'text-slate-400'}`}>Vista de Resumen</span>
                        </div>
                        {view === 'orders' && (
                            <div className="flex gap-2">
                                 <button onClick={() => toggleAllSuppliers(true)} className="text-xs font-semibold text-indigo-600 hover:underline">Expandir Todo</button>
                                 <button onClick={() => toggleAllSuppliers(false)} className="text-xs font-semibold text-indigo-600 hover:underline">Contraer Todo</button>
                            </div>
                        )}
                    </div>
                    {view === 'orders' && (
                        <div className="border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <MultiSelectDropdown options={filterOptions.suppliers} selected={filters.proveedor} onChange={(val) => setFilters(f => ({...f, proveedor: val}))} placeholder="Proveedor" />
                            <MultiSelectDropdown options={filterOptions.owners} selected={filters.owner} onChange={(val) => setFilters(f => ({...f, owner: val}))} placeholder="Comprador" />
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Priorizar por:</label>
                                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left">
                                    <option value="totalAmount">Monto Total</option>
                                    <option value="totalItems">Cantidad Items</option>
                                    <option value="riskScore">Riesgo OOS</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
                
                {isLoading ? <p className="text-center py-8">Cargando datos...</p> : (
                    view === 'orders' ? (
                        <div className="space-y-6">
                            {filteredAndSortedSuppliers.length > 0 ? 
                                filteredAndSortedSuppliers.map(supplier => (
                                    <SupplierCard 
                                        key={supplier.name} 
                                        supplier={supplier} 
                                        onToggleStatus={handleToggleStatus}
                                        isOpen={openSuppliers[supplier.name] ?? true}
                                        onToggle={() => handleToggleSupplier(supplier.name)}
                                    />
                                )) :
                                <p className="text-center text-slate-500 py-16 bg-white rounded-lg shadow-lg">No hay órdenes para mostrar con los filtros actuales.</p>
                            }
                        </div>
                    ) : (
                        <SummaryView processedData={processedData} />
                    )
                )}
            </div>
        </div>
    );
};

export default PurchaseOrderTool;