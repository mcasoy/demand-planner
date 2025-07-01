import React from 'react';
import { Link } from 'react-router-dom';

const PlaceholderTool = ({ title }) => (
    <div className="p-8">
        <Link to="/" className="text-indigo-600 hover:underline mb-8">&larr; Volver al Índice</Link>
        <h1 className="text-4xl font-bold text-slate-900 mt-4">{title}</h1>
        <p className="text-slate-600 mt-4">Esta herramienta está en construcción. ¡Vuelve pronto!</p>
    </div>
);

export default PlaceholderTool;