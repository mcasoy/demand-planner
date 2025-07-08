import React, { useState, useRef, useEffect } from 'react';

// --- NUEVO ÍCONO (necesario para la "X" de cerrar) ---
// Asegúrate de tenerlo en tu archivo Icons.jsx o reemplázalo por otro
// export const IconX = (props) => <Icon {...props}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></Icon>;
import { IconChevronDown, IconX } from '../assets/Icons';

const MultiSelectDropdown = ({ options, selected, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Efecto para cerrar el dropdown si se hace clic fuera de él
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSelectAll = () => {
        onChange(options);
    };

    const handleDeselectAll = () => {
        onChange([]);
    };

    const handleOptionClick = (option) => {
        const newSelected = selected.includes(option)
            ? selected.filter(item => item !== option)
            : [...selected, option];
        onChange(newSelected);
    };
    
    // Texto que se muestra en el botón del dropdown
    const getButtonLabel = () => {
        if (selected.length === 0) return placeholder;
        if (selected.length === options.length) return `Todos (${options.length})`;
        if (selected.length === 1) return selected[0];
        return `${selected.length} seleccionados`;
    };

    return (
        <div className="relative w-full" ref={dropdownRef}>
            {/* El botón que abre/cierra el dropdown */}
            <button
                type="button"
                className="w-full flex justify-between items-center bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-2 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{getButtonLabel()}</span>
                <IconChevronDown size={20} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* El panel desplegable con las opciones */}
            {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-300 max-h-60 overflow-auto">
                    {/* Botones de seleccionar/deseleccionar todo */}
                    <div className="p-2 border-b flex justify-between gap-2">
                        <button onClick={handleSelectAll} className="text-xs w-full text-center text-indigo-600 font-semibold hover:bg-indigo-50 rounded-md py-1">
                            Seleccionar Todo
                        </button>
                        <button onClick={handleDeselectAll} className="text-xs w-full text-center text-red-600 font-semibold hover:bg-red-50 rounded-md py-1">
                            Deseleccionar Todo
                        </button>
                    </div>
                    {/* Lista de opciones con checkboxes */}
                    <ul className="py-1">
                        {options.map((option, index) => (
                            <li
                                key={index}
                                className="px-3 py-2 text-sm text-gray-900 cursor-pointer hover:bg-slate-100 flex items-center gap-3"
                                onClick={() => handleOptionClick(option)}
                            >
                                <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                    checked={selected.includes(option)}
                                    readOnly // El click se maneja en el <li> para mayor área de selección
                                />
                                <span>{option}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default MultiSelectDropdown;