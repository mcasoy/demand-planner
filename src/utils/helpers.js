import { getMonth, getYear, getDaysInMonth, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

export const getMonthDetails = () => {
    const now = new Date();
    return Array.from({ length: 5 }, (_, i) => {
        const d = addMonths(now, i);
        const monthName = es.localize.month(getMonth(d), { width: 'abbreviated' }).toUpperCase().replace('.', '');
        const daysInMonth = getDaysInMonth(d);
        return { 
            monthName, 
            daysInMonth, 
            monthIndex: getMonth(d), 
            year: getYear(d) 
        };
    });
};

export const cleanNumber = (num) => {
    if (typeof num === 'string') {
        return parseFloat(num.replace(/,/g, '')) || 0;
    }
    return num || 0;
};

export const formatCurrency = (num) => {
    return `$ ${cleanNumber(num).toLocaleString('es-AR', {
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2
    })}`;
};