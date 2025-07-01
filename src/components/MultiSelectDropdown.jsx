import React, { useState, useEffect, useRef } from 'react';
import { IconArrowUpDown } from '../assets/Icons';

const MultiSelectDropdown = ({ options, selected, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [ref]);

    const handleSelection = (option) => {
        const newSelected = selected.includes(option) ? selected.filter(item => item !== option) : [...selected, option];
        onChange(newSelected);
    };

    return (
        <div className="relative" ref={ref}>
            <button onClick={() => setIsOpen(!isOpen)} className="w-full bg-white border border-gray-300 rounded-md shadow-sm pl-3 pr-10 py-2 text-left cursor-default focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm">
                <span className="block truncate">{selected.length > 0 ? selected.join(', ') : placeholder}</span>
                <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none"><IconArrowUpDown size={16} className="text-gray-400" /></span>
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {options.map(option => (
                        <div key={option} onClick={() => handleSelection(option)} className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50">
                            <span className={`font-normal block truncate ${selected.includes(option) ? 'font-semibold' : ''}`}>{option}</span>
                            {selected.includes(option) && <span className="text-indigo-600 absolute inset-y-0 right-0 flex items-center pr-4">✓</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MultiSelectDropdown;