// src/components/SupplierCard.jsx (Versión Final y Completa)
import React, { useMemo } from 'react';
import { formatCurrency, cleanNumber } from '../utils/helpers';
import { IconAlertTriangle } from '../assets/Icons';

const POItemRow = ({ item, onToggleStatus }) => {
    const totalAmount = cleanNumber(item.cantidad_a_comprar) * cleanNumber(item.precio_unitario);
    
    return (
        <div className={`grid grid-cols-10 gap-4 p-2 border-t text-xs ${item.status === 'DONE' ? 'bg-green-50 text-gray-400 line-through' : 'hover:bg-slate-50'}`}>
            <span className="col-span-1">{item.sku}</span>
            <span className="col-span-2">{item.sku_name}</span>
            <span className="text-right font-medium text-blue-600">{item.stock_actual}</span>
            <span className="text-right font-medium text-purple-600">{item.totalInTransit}</span>
            <span className="font-medium text-purple-600">{item.nextArrival}</span>
            <span className="text-right">{item.cantidad_a_comprar}</span>
            <span className="text-right">{formatCurrency(item.precio_unitario)}</span>
            <span className="text-right font-bold">{formatCurrency(totalAmount)}</span>
            <div className="flex justify-center">
                <input 
                    type="checkbox" 
                    className="cursor-pointer h-4 w-4"
                    checked={item.status === 'DONE'}
                    onChange={() => onToggleStatus(item.id, item.status)}
                />
            </div>
        </div>
    );
};

const SupplierCard = ({ supplier, onToggleStatus, isOpen, onToggle }) => {

    // --- LÓGICA COMPLETA PARA LA BARRA DE PROGRESO ---
    const progressPercentage = useMemo(() => {
        if (!supplier.items || supplier.items.length === 0) return 0;
        
        const totalAmount = supplier.items.reduce((sum, item) => sum + (cleanNumber(item.cantidad_a_comprar) * cleanNumber(item.precio_unitario)), 0);
        if (totalAmount === 0) return 100; // Si no hay monto, se considera completo
        
        const doneAmount = supplier.items
            .filter(item => item.status === 'DONE')
            .reduce((sum, item) => sum + (cleanNumber(item.cantidad_a_comprar) * cleanNumber(item.precio_unitario)), 0);
            
        return (doneAmount / totalAmount) * 100;
    }, [supplier.items]);

    // --- LÓGICA COMPLETA PARA ORDENAR LOS ITEMS POR MONTO TOTAL ---
    const sortedItems = useMemo(() => {
        return [...supplier.items].sort((a, b) => {
            const totalA = cleanNumber(a.cantidad_a_comprar) * cleanNumber(a.precio_unitario);
            const totalB = cleanNumber(b.cantidad_a_comprar) * cleanNumber(b.precio_unitario);
            return totalB - totalA; // Orden descendente
        });
    }, [supplier.items]);

    return (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 bg-slate-50 border-b cursor-pointer hover:bg-slate-100 transition-colors" onClick={onToggle}>
                 <div className="flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-lg text-slate-800">{supplier.name}</h3>
                        <p className="text-sm text-slate-500">Comprador: {supplier.owner || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-slate-900 text-lg">{formatCurrency(supplier.totalAmount)}</p>
                        <div className="flex items-center gap-2 justify-end text-sm text-amber-600">
                            {supplier.riskScore > 0 && <IconAlertTriangle size={16} />}
                            <span>{supplier.riskScore} item(s) con bajo stock</span>
                        </div>
                    </div>
                </div>
                <div className="mt-3">
                    <div className="flex justify-between mb-1">
                        <span className="text-xs font-semibold text-teal-700">Progreso de Gestión</span>
                        <span className="text-xs font-semibold text-teal-700">{progressPercentage.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className="bg-teal-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div>
                    </div>
                </div>
            </div>

            {isOpen && (
                <div className="p-4">
                    <div className="grid grid-cols-10 gap-4 p-2 font-bold text-xs text-slate-600 border-b">
                        <span className="col-span-1">SKU</span>
                        <span className="col-span-2">Nombre</span>
                        <span className="text-right">Stock Actual</span>
                        <span className="text-right">Cant. Tránsito</span>
                        <span>Próx. Arribo</span>
                        <span className="text-right">Cantidad</span>
                        <span className="text-right">Precio Unit.</span>
                        <span className="text-right">Monto Total</span>
                        <span className="text-center">Hecho</span>
                    </div>
                    {sortedItems.map(item => (
                        <POItemRow key={item.id || item.sku} item={item} onToggleStatus={onToggleStatus} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default SupplierCard;