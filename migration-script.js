// ============================================
// SCRIPT DE MIGRACIÓN MYSQL → FIRESTORE (ES MODULES)
// migration-script.js
// ============================================

import admin from 'firebase-admin';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';

// ============================================
// CONFIGURACIÓN - EDITAR ESTAS LÍNEAS
// ============================================

// CAMBIAR por el nombre exacto de tu archivo JSON descargado de Firebase
const serviceAccount = JSON.parse(readFileSync('./demand-planner-78dde-firebase-adminsdk-fbsvc-9472a57c1f.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// CAMBIAR con tus datos de MySQL
const mysqlConfig = {
  host: 'wonderbrands1.cuwd36ifbz5t.us-east-1.rds.amazonaws.com',     // Tu host MySQL
  user: 'mati',    // Tu usuario MySQL
  password: 'DTv@#dvd2y8jNIfP', // Tu contraseña MySQL
  database: 'mati'       // Base de datos (mantener 'mati')
};

// ============================================
// FUNCIONES DE MIGRACIÓN
// ============================================

async function migrateProducts() {
  console.log('🚀 Iniciando migración de productos...');
  
  const connection = await mysql.createConnection(mysqlConfig);
  
  try {
    const [rows] = await connection.execute('SELECT * FROM firestore_products');
    console.log(`📦 Encontrados ${rows.length} productos para migrar`);
    
    const batchSize = 500;
    let migratedCount = 0;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = db.batch();
      const batchData = rows.slice(i, i + batchSize);
      
      batchData.forEach(product => {
        const cleanProduct = cleanProductData(product);
        const docRef = db.collection('products').doc(product.product_id);
        batch.set(docRef, cleanProduct);
      });
      
      await batch.commit();
      migratedCount += batchData.length;
      console.log(`✅ Migrados ${migratedCount}/${rows.length} productos`);
    }
    
    console.log('🎉 Migración de productos completada');
  } catch (error) {
    console.error('❌ Error migrando productos:', error);
  } finally {
    await connection.end();
  }
}

async function migrateSales() {
  console.log('🚀 Iniciando migración de ventas...');
  
  const connection = await mysql.createConnection(mysqlConfig);
  
  try {
    const [rows] = await connection.execute('SELECT * FROM firestore_sales ORDER BY sale_date DESC');
    console.log(`💰 Encontradas ${rows.length} ventas para migrar`);
    
    const batchSize = 500;
    let migratedCount = 0;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = db.batch();
      const batchData = rows.slice(i, i + batchSize);
      
      batchData.forEach(sale => {
        const cleanSale = cleanSaleData(sale);
        const docRef = db.collection('sales').doc(sale.original_sale_line_id);
        batch.set(docRef, cleanSale);
      });
      
      await batch.commit();
      migratedCount += batchData.length;
      console.log(`✅ Migradas ${migratedCount}/${rows.length} ventas`);
    }
    
    console.log('🎉 Migración de ventas completada');
  } catch (error) {
    console.error('❌ Error migrando ventas:', error);
  } finally {
    await connection.end();
  }
}

async function migrateStock() {
  console.log('🚀 Iniciando migración de stock...');
  
  const connection = await mysql.createConnection(mysqlConfig);
  
  try {
    const [rows] = await connection.execute('SELECT * FROM firestore_stock');
    console.log(`📊 Encontrados ${rows.length} registros de stock para migrar`);
    
    const batchSize = 500;
    let migratedCount = 0;
    
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = db.batch();
      const batchData = rows.slice(i, i + batchSize);
      
      batchData.forEach(stock => {
        const cleanStock = cleanStockData(stock);
        const docRef = db.collection('stock').doc(stock.product_id);
        batch.set(docRef, cleanStock);
      });
      
      await batch.commit();
      migratedCount += batchData.length;
      console.log(`✅ Migrados ${migratedCount}/${rows.length} registros de stock`);
    }
    
    console.log('🎉 Migración de stock completada');
  } catch (error) {
    console.error('❌ Error migrando stock:', error);
  } finally {
    await connection.end();
  }
}

// ============================================
// FUNCIONES DE LIMPIEZA DE DATOS
// ============================================

function cleanProductData(product) {
  return {
    product_id: product.product_id,
    type: product.type,
    default_code: product.default_code,
    name: product.name,
    cost: parseFloat(product.cost) || 0,
    brand: product.brand,
    brand_type: product.brand_type,
    status: product.status,
    image: product.image,
    category: product.category,
    is_combo: Boolean(product.is_combo),
    components: product.components ? JSON.parse(product.components) : null,
    supplier_id: product.supplier_id,
    responsible_buyer_name: product.responsible_buyer_name,
    current_stock: parseInt(product.current_stock) || 0,
    packing: {
      length: parseFloat(product.packing_length) || 0,
      width: parseFloat(product.packing_width) || 0,
      height: parseFloat(product.packing_height) || 0,
      weight: parseFloat(product.packing_weight) || 0,
      volumetric_weight: parseFloat(product.volumetric_weight) || 0
    },
    last_updated: admin.firestore.Timestamp.fromDate(new Date(product.last_updated))
  };
}

function cleanSaleData(sale) {
  const cleanedSale = {
    original_sale_line_id: sale.original_sale_line_id,
    product_id: sale.product_id,
    product_code: sale.product_code,
    product_name: sale.product_name,
    product_qty_sold: parseInt(sale.product_qty_sold) || 0,
    product_price_at_sale: parseFloat(sale.product_price_at_sale) || 0,
    sale_date: admin.firestore.Timestamp.fromDate(new Date(sale.sale_date)),
    sale_day: sale.sale_day,
    yearmonth: sale.yearmonth,
    year: sale.year,
    fulfillment_channel: sale.fulfillment_channel,
    sales_channel: sale.sales_channel,
    marketplace: sale.marketplace,
    product_brand: sale.product_brand,
    brand_type: sale.brand_type,
    product_category: sale.product_category,
    is_combo_sale: Boolean(sale.is_combo_sale),
    sale_fee: parseFloat(sale.sale_fee) || 0,
    shipping_fee: parseFloat(sale.shipping_fee) || 0,
    gross_margin: parseFloat(sale.gross_margin) || 0,
    contribution_margin: parseFloat(sale.contribution_margin) || 0,
    state: sale.state,
    cogs: parseFloat(sale.cogs) || 0,
    net_sales: parseFloat(sale.net_sales) || 0,
    return_amount: parseFloat(sale.return_amount) || 0,
    return_qty: parseInt(sale.return_qty) || 0,
    order_id: sale.order_id,
    order_type: sale.order_type
  };

  // Agregar campos específicos de combos
  if (sale.is_combo_sale) {
    cleanedSale.product_combo_id = sale.product_combo_id;
    cleanedSale.combo_sku = sale.combo_sku;
    cleanedSale.combo_components = sale.combo_components ? JSON.parse(sale.combo_components) : null;
  }

  return cleanedSale;
}

function cleanStockData(stock) {
  return {
    product_id: stock.product_id,
    stock_full_meli: parseInt(stock.stock_full_meli) || 0,
    stock_full_amazon: parseInt(stock.stock_full_amazon) || 0,
    stock_full_walmart: parseInt(stock.stock_full_walmart) || 0,
    stock_full_coppel: parseInt(stock.stock_full_coppel) || 0,
    stock_wms_fisico: parseInt(stock.stock_wms_fisico) || 0,
    stock_wms_bloqueado: parseInt(stock.stock_wms_bloqueado) || 0,
    stock_wms_reservado: parseInt(stock.stock_wms_reservado) || 0,
    stock_wms_disponible: parseInt(stock.stock_wms_disponible) || 0,
    stock_wms_restringido: parseInt(stock.stock_wms_restringido) || 0,
    stock_odoo_ag: parseInt(stock.stock_odoo_ag) || 0,
    stock_total_disponible: parseInt(stock.stock_total_disponible) || 0,
    stock_odoo_naes: parseInt(stock.stock_odoo_naes) || 0,
    stock_odoo_nauto: parseInt(stock.stock_odoo_nauto) || 0,
    unit_cost: parseFloat(stock.unit_cost) || 0,
    stock_valorizado: parseFloat(stock.stock_valorizado) || 0,
    last_updated: admin.firestore.Timestamp.fromDate(new Date(stock.last_updated))
  };
}

// ============================================
// FUNCIÓN PRINCIPAL
// ============================================

async function runMigration() {
  console.log('🎯 Iniciando migración completa MySQL → Firestore');
  console.log('=====================================');
  
  try {
    // Migrar en orden: productos → stock → ventas
    await migrateProducts();
    console.log('');
    
    await migrateStock();
    console.log('');
    
    await migrateSales();
    console.log('');
    
    console.log('🎉 ¡Migración completa exitosa!');
    console.log('=====================================');
    console.log('✅ Colecciones creadas en Firestore:');
    console.log('   📦 products');
    console.log('   📊 stock');
    console.log('   💰 sales');
    
  } catch (error) {
    console.error('❌ Error en la migración:', error);
  } finally {
    process.exit(0);
  }
}

// ============================================
// FUNCIONES DE UTILIDAD ADICIONALES
// ============================================

// Función para migrar solo una tabla específica
async function migrateSpecificCollection(collectionName) {
  switch(collectionName) {
    case 'products':
      await migrateProducts();
      break;
    case 'sales':
      await migrateSales();
      break;
    case 'stock':
      await migrateStock();
      break;
    default:
      console.log('❌ Colección no válida. Usa: products, sales, o stock');
  }
}

// Función para verificar la migración
async function verifyMigration() {
  try {
    const productsSnapshot = await db.collection('products').limit(1).get();
    const salesSnapshot = await db.collection('sales').limit(1).get();
    const stockSnapshot = await db.collection('stock').limit(1).get();
    
    console.log('🔍 Verificación de migración:');
    console.log(`   📦 Products: ${productsSnapshot.size > 0 ? '✅' : '❌'}`);
    console.log(`   💰 Sales: ${salesSnapshot.size > 0 ? '✅' : '❌'}`);
    console.log(`   📊 Stock: ${stockSnapshot.size > 0 ? '✅' : '❌'}`);
  } catch (error) {
    console.error('❌ Error verificando migración:', error);
  }
}

// ============================================
// EJECUTAR MIGRACIÓN
// ============================================

// Migración completa
runMigration();

// Para migrar solo una colección específica, comenta la línea anterior y descomenta:
// migrateSpecificCollection('products');

// Para verificar migración, comenta todo lo anterior y descomenta:
// verifyMigration();