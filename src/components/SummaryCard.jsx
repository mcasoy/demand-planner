// src/components/SummaryCard.jsx
import React, { useMemo } from 'react';
import { formatCurrency } from '../utils/helpers';

const SummaryCard = ({ suppliers }) => {
    // Usamos useMemo para que estos cálculos no se rehagan en cada render,
    // solo cuando la lista de proveedores filtrados cambie.
    const summary = useMemo(() => {
        if (!suppliers || suppliers.length === 0) {
            return { totalAmount: 0, totalItems: 0, supplierCount: 0 };
        }
        const supplierCount = suppliers.length;
        const totalAmount = suppliers.reduce((sum, s) => sum + s.totalAmount, 0);
        const totalItems = suppliers.reduce((sum, s) => sum + s.totalItems, 0);
        return { totalAmount, totalItems, supplierCount };
    }, [suppliers]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
            <div className="bg-white p-4 rounded-xl shadow-lg">
                <p className="text-sm text-slate-500">Monto Total Visible</p>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(summary.totalAmount)}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-lg">
                <p className="text-sm text-slate-500">Unidades Totales</p>
                <p className="text-2xl font-bold text-slate-800">{summary.totalItems.toLocaleString('es-AR')}</p>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-lg">
                <p className="text-sm text-slate-500">Proveedores Visibles</p>
                <p className="text-2xl font-bold text-slate-800">{summary.supplierCount}</p>
            </div>
        </div>
    );
};

export default SummaryCard;