import fs from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import neatCsv from 'neat-csv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generarDatos() {
    try {
        console.log('Iniciando la lectura de todos los archivos CSV...');

        const skusPath = path.join(__dirname, 'csv_data', 'skus.csv');
        const forecastsPath = path.join(__dirname, 'csv_data', 'forecasts.csv');
        const transitsPath = path.join(__dirname, 'csv_data', 'transits.csv');
        const ordersPath = path.join(__dirname, 'csv_data', 'orders.csv');
        const salesPath = path.join(__dirname, 'csv_data', 'sales.csv');

        const [skusRaw, forecastsRaw, transitsRaw, ordersRaw, salesRaw] = await Promise.all([
            fs.readFile(skusPath, 'utf8'),
            fs.readFile(forecastsPath, 'utf8'),
            fs.readFile(transitsPath, 'utf8'),
            fs.readFile(ordersPath, 'utf8'),
            fs.readFile(salesPath, 'utf8')
        ]);

        const skusList = await neatCsv(skusRaw);
        const forecastsList = await neatCsv(forecastsRaw);
        const transitsList = await neatCsv(transitsRaw);
        const purchaseOrdersList = await neatCsv(ordersRaw);
        const salesList = await neatCsv(salesRaw);
        
        console.log('Archivos leídos. Combinando, priorizando y añadiendo owner...');

        const skusMap = new Map();
        skusList.forEach(sku => {
            skusMap.set(sku.sku, { ...sku, forecasts: [], purchase_orders: [] });
        });

        salesList.forEach(sale => {
            const sku = sale.SKU;
            if (skusMap.has(sku)) {
                const skuData = skusMap.get(sku);
                skuData.sku_name = sale.sku_name;
                skuData.brand = sale.brand;
                skuData.category = sale.category;
            }
        });
        
        const ownerMap = new Map();
        purchaseOrdersList.forEach(order => {
            if (order.sku && order.owner) {
                ownerMap.set(order.sku, order.owner);
            }
        });

        skusMap.forEach((skuData, sku) => {
            if (ownerMap.has(sku)) {
                skuData.owner = ownerMap.get(sku);
            }
        });

        forecastsList.forEach(forecast => {
            if (skusMap.has(forecast.sku)) {
                const skuData = skusMap.get(forecast.sku);
                skuData.forecasts = [
                    forecast.venta_estimada_m0,
                    forecast.venta_estimada_m1,
                    forecast.venta_estimada_m2,
                    forecast.venta_estimada_m3,
                    forecast.venta_estimada_m4,
                ];
            }
        });
        transitsList.forEach(transit => {
             if (skusMap.has(transit.sku)) {
                skusMap.get(transit.sku).purchase_orders.push({
                    quantity: transit.quantity,
                    date_of_arrival: transit.date_of_arrival
                });
            }
        });

        const skusDataJSON = Array.from(skusMap.values());
        const purchaseOrdersDataJSON = purchaseOrdersList;
        const salesDataJSON = salesList;

        const fileContent = `
// Este archivo fue generado automáticamente por generarDatos.js

export const skusDataJSON = ${JSON.stringify(skusDataJSON, null, 2)};

export const purchaseOrdersDataJSON = ${JSON.stringify(purchaseOrdersDataJSON, null, 2)};

export const salesDataJSON = ${JSON.stringify(salesDataJSON, null, 2)};
        `;

        const outputPath = path.join(__dirname, 'src', 'data', 'datosManuales.js');
        await fs.writeFile(outputPath, fileContent, 'utf8');

        console.log(`✅ ¡Archivo datosManuales.js generado con éxito!`);

    } catch (error) {
        console.error("❌ Error al generar el archivo de datos:", error);
    }
}

generarDatos();