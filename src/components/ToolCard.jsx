import React from 'react';
import { useNavigate } from 'react-router-dom';

const ToolCard = ({ icon, title, description, to, disabled = false }) => {
    const navigate = useNavigate();

    const handleClick = () => {
        if (!disabled && to) {
            navigate(to);
        }
    };

    return (
        <div 
            onClick={handleClick} 
            className={`bg-white rounded-xl shadow-md p-6 flex flex-col items-start transition-all duration-200 ease-in-out 
                ${disabled 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'cursor-pointer hover:translate-y-[-5px] hover:shadow-lg'}`
            }
        >
            <div className="bg-slate-100 p-3 rounded-lg mb-4">{icon}</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
            <p className="text-slate-600 text-sm">{description}</p>
        </div>
    );
};

export default ToolCard;