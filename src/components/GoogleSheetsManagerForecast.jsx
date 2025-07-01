// src/components/GoogleSheetsManagerForecast.jsx (Versión Final Simplificada)

import React, { useCallback } from 'react';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db, appId } from '../firebase/config';
import { IconSheet, IconRefreshCw } from '../assets/Icons';

// Ahora solo importamos la constante que realmente existe y necesitamos
import { skusDataJSON } from '../data/datosManuales.js';

const GoogleSheetsManagerForecast = ({ setError, setIsProcessing, isProcessing, forceRefresh }) => {
    
    const handleSheetLoad = useCallback(async () => {
        if (!db) {
            setError("La base de datos no está lista.");
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            // La lógica de unir datos ya no es necesaria aquí,
            // porque nuestro script 'generarDatos.cjs' ya lo hizo.
            const mergedData = skusDataJSON;
            
            console.log(`Cargando ${mergedData.length} SKUs pre-procesados a Firestore...`);

            const batch = writeBatch(db);
            const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'skus');

            mergedData.forEach(sku => {
                // Usamos el 'sku' como ID del documento para consistencia
                if (sku.sku) {
                    const skuDocRef = doc(collectionRef, String(sku.sku));
                    // Usamos { merge: true } para no sobreescribir datos de otras herramientas, como el status.
                    batch.set(skuDocRef, sku, { merge: true });
                }
            });

            await batch.commit();
            alert("¡Datos de SKUs, Pronósticos y Tránsitos cargados con éxito!");
            forceRefresh();

        } catch (e) {
            console.error("ERROR EN LA CARGA MANUAL DE DATOS DE FORECAST:", e);
            setError(e.message);
        } finally {
            setIsProcessing(false);
        }
    }, [forceRefresh, setError, setIsProcessing]);
    
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><IconSheet size={20}/> Carga de Datos de SKU</h3>
                    <p className="text-sm text-slate-600">Carga la info de SKUs, pronósticos y tránsitos a Firestore.</p>
                </div>
                <button 
                    onClick={handleSheetLoad} 
                    disabled={isProcessing} 
                    className="flex items-center gap-2 bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:bg-indigo-700 transition-all disabled:bg-indigo-300 disabled:cursor-wait"
                >
                    <IconRefreshCw size={16} className={isProcessing ? "animate-spin" : ""}/>
                    {isProcessing ? "Cargando..." : "Cargar Datos"}
                </button>
            </div>
        </div>
    );
};

export default GoogleSheetsManagerForecast;