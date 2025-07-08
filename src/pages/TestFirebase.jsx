import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

const TestFirebase = () => {
    const [status, setStatus] = useState('Iniciando prueba...');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const testFetch = async () => {
            try {
                // Intentaremos leer solo 5 documentos de 'catalogo_operativo'
                const testQuery = query(collection(db, 'catalogo_operativo'), limit(5));
                
                setStatus("Enviando petición a Firestore para 'catalogo_operativo' (limitado a 5)...");
                console.log("Enviando petición a Firestore para 'catalogo_operativo' (limitado a 5)...");

                const querySnapshot = await getDocs(testQuery);

                setStatus(`¡Éxito! Se recibieron ${querySnapshot.docs.length} documentos.`);
                console.log(`¡Éxito! Se recibieron ${querySnapshot.docs.length} documentos.`);
                
                // Guardamos el primer documento como ejemplo para mostrarlo
                if (querySnapshot.docs.length > 0) {
                    setData(querySnapshot.docs[0].data());
                }

            } catch (err) {
                console.error("FALLO LA PRUEBA:", err);
                setError(err.message);
                setStatus("La prueba falló. Revisa la consola.");
            }
        };

        testFetch();
    }, []);

    return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
            <h1>Prueba de Conexión a Firebase</h1>
            <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
                <h2 style={{marginTop: 0}}>Estado:</h2>
                <p style={{ fontWeight: 'bold', color: error ? 'red' : 'green' }}>
                    {status}
                </p>

                {error && (
                    <div style={{ color: 'red' }}>
                        <h3>Error:</h3>
                        <pre>{error}</pre>
                    </div>
                )}

                {data && (
                    <div>
                        <h3>Primer Documento Recibido:</h3>
                        <pre style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TestFirebase;