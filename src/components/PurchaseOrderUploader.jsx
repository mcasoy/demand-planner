// src/components/PurchaseOrderUploader.jsx
import React, { useCallback } from 'react';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db, appId } from '../firebase/config';
import { IconClipboardList, IconRefreshCw } from '../assets/Icons';
import { purchaseOrdersDataJSON } from '../data/datosManuales.js';

const PurchaseOrderUploader = ({ setError, setIsProcessing, isProcessing }) => {

    const handlePoLoad = useCallback(async () => {
        if (!db) {
            setError("La base de datos no está lista.");
            return;
        }
        setIsProcessing(true);
        setError(null);

        try {
            const poData = purchaseOrdersDataJSON;
            const batch = writeBatch(db);
            const collectionRef = collection(db, 'artifacts', appId, 'public', 'data', 'purchase_orders');

            console.log(`Fusionando ${poData.length} órdenes de compra...`);

            // --- NUEVA LÓGICA DE FUSIÓN (MERGE) ---
            // En lugar de borrar, vamos a "setear con merge".
            // Esto actualiza los datos del archivo local pero MANTIENE los campos
            // que ya existen en Firestore y no están en el archivo local (como el campo "status").
            poData.forEach((po) => {
                // Usaremos el SKU como ID único para cada PO.
                // Esto asume que no tienes múltiples órdenes para el mismo SKU en el archivo.
                if (po.sku) {
                    const docRef = doc(collectionRef, String(po.sku));
                    batch.set(docRef, po, { merge: true }); // La magia está en { merge: true }
                }
            });

            await batch.commit();
            alert('¡Órdenes de Compra actualizadas con éxito!');

        } catch (e) {
            console.error("Error en la carga manual de POs:", e);
            setError("Hubo un error al actualizar las órdenes: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    }, [setError, setIsProcessing]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg mb-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <IconClipboardList size={20}/> Carga de Órdenes de Compra
                    </h3>
                    <p className="text-sm text-slate-600">Actualiza las POs desde el archivo local sin borrar tu progreso.</p>
                </div>
                <button
                    onClick={handlePoLoad}
                    disabled={isProcessing}
                    className="flex items-center gap-2 bg-sky-600 text-white font-semibold px-4 py-2 rounded-lg shadow-md hover:bg-sky-700 transition-all disabled:bg-sky-300 disabled:cursor-wait"
                >
                    <IconRefreshCw size={16} className={isProcessing ? "animate-spin" : ""}/>
                    {isProcessing ? "Actualizando..." : "Actualizar Órdenes"}
                </button>
            </div>
        </div>
    );
};

export default PurchaseOrderUploader;