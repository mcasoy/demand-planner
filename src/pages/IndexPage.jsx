import React from 'react';
import {
    IconLineChart, IconTarget, IconClipboardList, IconLogOut
} from '../assets/Icons';
import ToolCard from '../components/ToolCard';

const IndexPage = ({ onLogout }) => {
    return (
        <div className="bg-slate-100 min-h-screen">
            <div className="container mx-auto p-4 md:p-8">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900">COFFEE Tools</h1>
                        <p className="text-slate-600 mt-2">Tu centro de control de inventario.</p>
                    </div>
                    <button 
                        onClick={onLogout}
                        className="flex items-center gap-2 bg-red-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:bg-red-700 transition-all"
                    >
                        <IconLogOut size={16} />
                        Cerrar Sesión
                    </button>
                </header>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <ToolCard 
                        icon={<IconTarget size={32} className="text-teal-600" />}
                        title="Forecast Tool"
                        description="Proyecta tus días de stock y anticipa quiebres conectando tus datos de venta y stock."
                        to="/forecast"
                    />
                    <ToolCard 
                        icon={<IconClipboardList size={32} className="text-sky-600" />}
                        title="Priorización de Órdenes"
                        description="Gestiona y prioriza tus órdenes de compra pendientes para optimizar el flujo de inventario."
                        to="/purchase-orders"
                    />
                     <ToolCard 
                        icon={<IconLineChart size={32} className="text-violet-600" />}
                        title="Monitoreo de Performance"
                        description="Analiza el rendimiento de tus SKUs y la precisión de tus pronósticos."
                        to="/performance"
                    />
                </div>
            </div>
        </div>
    );
};

export default IndexPage;