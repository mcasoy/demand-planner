// src/hooks/useForecastCalculations.js (Versión Final Ultra-Robusta)

import { useMemo } from 'react';
import { cleanNumber } from '../utils/helpers';
import { parseISO, isAfter, startOfToday, isValid } from 'date-fns'; // Importamos 'isValid'

export const useForecastCalculations = (skus, monthDetails) => {
    return useMemo(() => {
        if (!skus || skus.length === 0) return [];

        const today = startOfToday();

        return skus.map(sku => {
            try {
                const stock = sku.stock_actual || 0;
                const forecasts = Array.isArray(sku.forecasts) ? sku.forecasts : [];
                const forecastM0 = forecasts.length > 0 ? cleanNumber(forecasts[0]) : 0;
                
                let dias_stock_hoy = Infinity;
                if (forecastM0 > 0 && monthDetails[0] && monthDetails[0].daysInMonth > 0) {
                    const dailySale = forecastM0 / monthDetails[0].daysInMonth;
                    if (dailySale > 0) dias_stock_hoy = stock / dailySale;
                }

                const purchaseOrders = Array.isArray(sku.purchase_orders) ? sku.purchase_orders : [];
                const transitsByDay = purchaseOrders.reduce((acc, po) => {
                    // 1. Nos aseguramos que la fecha sea un string válido antes de procesar
                    if (po && typeof po.date_of_arrival === 'string' && po.date_of_arrival) {
                        const etaDate = parseISO(po.date_of_arrival);
                        
                        // 2. Comprobamos que la fecha parseada sea válida Y futura
                        if (isValid(etaDate) && isAfter(etaDate, today)) {
                            const key = `${etaDate.getUTCFullYear()}-${etaDate.getUTCMonth()}-${etaDate.getUTCDate()}`;
                            acc[key] = (acc[key] || 0) + cleanNumber(po.quantity);
                        }
                    }
                    return acc;
                }, {});

                let stockForNextMonth = stock;
                const projections = [];
                const currentDayOfMonth = new Date().getDate();

                for (let i = 0; i < 5; i++) {
                    const { daysInMonth, monthIndex, year } = monthDetails[i];
                    const monthlyForecast = forecasts.length > i ? (cleanNumber(forecasts[i]) || 0) : 0;
                    const dailySale = monthlyForecast > 0 ? monthlyForecast / daysInMonth : 0;
                    
                    let daysInStockCount = 0;
                    let stockForCurrentMonthSim = stockForNextMonth;
                    const startDay = (i === 0) ? currentDayOfMonth : 1;
                    
                    if (dailySale > 0) {
                        for (let day = startDay; day <= daysInMonth; day++) {
                            const transitKey = `${year}-${monthIndex}-${day}`;
                            if (transitsByDay[transitKey]) {
                                stockForCurrentMonthSim += transitsByDay[transitKey];
                            }
                            if (stockForCurrentMonthSim >= dailySale) daysInStockCount++;
                            stockForCurrentMonthSim -= dailySale;
                            if (stockForCurrentMonthSim < 0) stockForCurrentMonthSim = 0;
                        }
                    } else {
                        daysInStockCount = (daysInMonth - startDay + 1);
                    }
                    
                    const totalDaysInPeriod = daysInMonth - startDay + 1;
                    projections.push({ count: daysInStockCount, daysInMonth: totalDaysInPeriod });
                    stockForNextMonth = stockForCurrentMonthSim;
                }
                
                return { ...sku, dias_stock_hoy, projections };
            } catch (e) {
                console.error("Error procesando el SKU:", sku, e);
                return null;
            }
        });
    }, [skus, monthDetails]);
};