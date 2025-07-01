import React from 'react';
import { IconFilter } from '../assets/Icons';
import MultiSelectDropdown from './MultiSelectDropdown';

const FilterControlsForecast = ({ filters, setFilters, options }) => {
    return (
       <div className="bg-white p-6 rounded-xl shadow-lg my-6">
           <h3 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2"><IconFilter size={20} /> Filtros</h3>
           <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <MultiSelectDropdown options={options.categories} selected={filters.category} onChange={(val) => setFilters(prev => ({...prev, category: val}))} placeholder="Categorías" />
               <MultiSelectDropdown options={options.brands} selected={filters.brand} onChange={(val) => setFilters(prev => ({...prev, brand: val}))} placeholder="Marcas" />
               <MultiSelectDropdown options={options.buyers} selected={filters.buyer} onChange={(val) => setFilters(prev => ({...prev, buyer: val}))} placeholder="Compradores" />
               <div className="flex items-center justify-center">
                   <label className="flex items-center gap-2 cursor-pointer">
                       <input 
                           type="checkbox" 
                           checked={filters.oosOnly} 
                           onChange={e => setFilters(prev => ({ ...prev, oosOnly: e.target.checked }))} 
                           className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                       />
                       <span className="text-sm font-medium text-slate-700">Solo con riesgo de OOS</span>
                   </label>
               </div>
           </div>
       </div>
   );
};

export default FilterControlsForecast;