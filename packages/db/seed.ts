import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/schema';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';

config({ path: '../../.env.local' });

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

async function seed() {
  console.log('🌱 Reseteando base de datos...');
  
// 1. Limpiar todas las tablas (orden inverso por dependencias)
   await db.execute(sql`TRUNCATE TABLE order_items CASCADE`);
   await db.execute(sql`TRUNCATE TABLE orders CASCADE`);
   await db.execute(sql`TRUNCATE TABLE product_variants CASCADE`);
   await db.execute(sql`TRUNCATE TABLE product_images CASCADE`);
   await db.execute(sql`TRUNCATE TABLE products CASCADE`);
   await db.execute(sql`TRUNCATE TABLE categories CASCADE`);
   await db.execute(sql`TRUNCATE TABLE customers CASCADE`);
   await db.execute(sql`TRUNCATE TABLE admin_users CASCADE`);
   await db.execute(sql`TRUNCATE TABLE tenants CASCADE`);
  
  console.log('✅ Tablas limpiadas');

// 2. Crear tenant por defecto
   const [tenant] = await db.insert(schema.dbTenants).values({
     slug: 'tienda1',
     name: 'Tienda Demo',
     plan: 'starter',
     status: 'active',
     settings: {},
   }).returning();
   console.log(`✅ Tenant creado: ${tenant.slug} (ID: ${tenant.id})`);

   // 3. Crear administrador (para admin y superadmin)
   const hashedPassword = await bcrypt.hash('123456', 10);

   // Admin normal (del tenant)
   await db.insert(schema.dbAdminUsers).values({
     email: 'admin@tienda1.com',
     password: hashedPassword,
     role: 'admin',
     tenantId: tenant.id,
   });

   // Superadmin (sin tenant asociado)
   await db.insert(schema.dbAdminUsers).values({
     email: 'super@admin.com',
     password: hashedPassword,
     role: 'superadmin',
     tenantId: null,
   });

   console.log('✅ Admin y Superadmin creados (contraseña: 123456)');

   // 4. Crear categorías
   const [catRemeras] = await db.insert(schema.dbCategories).values({
     tenantId: tenant.id,
     name: 'Remeras',
     slug: 'remeras',
   }).returning();

   const [catPantalones] = await db.insert(schema.dbCategories).values({
     tenantId: tenant.id,
     name: 'Pantalones',
     slug: 'pantalones',
   }).returning();

   const [catAccesorios] = await db.insert(schema.dbCategories).values({
     tenantId: tenant.id,
     name: 'Accesorios',
     slug: 'accesorios',
   }).returning();

   console.log('✅ Categorías creadas: Remeras, Pantalones, Accesorios');

   // 5. Crear productos de demostración
   const [product1] = await db.insert(schema.dbProducts).values({
     tenantId: tenant.id,
     categoryId: catRemeras.id,
     name: 'Remera Básica',
     slug: 'remera-basica',
     description: 'Remera básica de algodón, disponible en varios talles y colores.',
     status: 'active',
     metadata: {},
   }).returning();

   const [product2] = await db.insert(schema.dbProducts).values({
     tenantId: tenant.id,
     categoryId: catPantalones.id,
     name: 'Pantalón Jeans',
     slug: 'pantalon-jeans',
     description: 'Pantalón jeans clásico, disponible en varios talles y colores.',
     status: 'active',
     metadata: {},
   }).returning();

   const [product3] = await db.insert(schema.dbProducts).values({
     tenantId: tenant.id,
     categoryId: catAccesorios.id,
     name: 'Gorra',
     slug: 'gorra',
     description: 'Gorra unisex, ideal para uso diario.',
     status: 'active',
     metadata: {},
   }).returning();

   console.log('✅ Productos creados: Remera Básica, Pantalón Jeans, Gorra');

   // 6. Crear variantes con combinaciones de opciones
   // Remera Básica: Talle (S, M, L) x Color (Rojo, Azul) = 6 variantes
   const remeraVariants = [
     { sku: 'REM-S-ROJ', talle: 'S', color: 'Rojo', price: 3500, stock: 20 },
     { sku: 'REM-S-AZU', talle: 'S', color: 'Azul', price: 3500, stock: 15 },
     { sku: 'REM-M-ROJ', talle: 'M', color: 'Rojo', price: 3500, stock: 25 },
     { sku: 'REM-M-AZU', talle: 'M', color: 'Azul', price: 3500, stock: 3 }, // Stock bajo para alerta
     { sku: 'REM-L-ROJ', talle: 'L', color: 'Rojo', price: 3600, stock: 18 },
     { sku: 'REM-L-AZU', talle: 'L', color: 'Azul', price: 3600, stock: 22 },
   ];

   for (const v of remeraVariants) {
     await db.insert(schema.dbProductVariants).values({
       tenantId: tenant.id,
       productId: product1.id,
       sku: v.sku,
       price: v.price,
       stock: v.stock,
       options: { Talle: v.talle, Color: v.color },
     });
   }

   // Pantalón Jeans: Talle (38, 40, 42) x Color (Azul, Negro) = 6 variantes
   const jeansVariants = [
     { sku: 'JEAN-38-AZU', talle: '38', color: 'Azul', price: 8900, stock: 10 },
     { sku: 'JEAN-38-NEG', talle: '38', color: 'Negro', price: 8900, stock: 8 },
     { sku: 'JEAN-40-AZU', talle: '40', color: 'Azul', price: 8900, stock: 12 },
     { sku: 'JEAN-40-NEG', talle: '40', color: 'Negro', price: 8900, stock: 15 },
     { sku: 'JEAN-42-AZU', talle: '42', color: 'Azul', price: 9000, stock: 7 },
     { sku: 'JEAN-42-NEG', talle: '42', color: 'Negro', price: 9000, stock: 9 },
   ];

   for (const v of jeansVariants) {
     await db.insert(schema.dbProductVariants).values({
       tenantId: tenant.id,
       productId: product2.id,
       sku: v.sku,
       price: v.price,
       stock: v.stock,
       options: { Talle: v.talle, Color: v.color },
     });
   }

   // Gorra: Variante única
   await db.insert(schema.dbProductVariants).values({
     tenantId: tenant.id,
     productId: product3.id,
     sku: 'GOR-UNI-NEG',
     price: 2500,
     stock: 30,
     options: { Talle: 'Único', Color: 'Negra' },
   });

   console.log('✅ Variantes creadas para todos los productos');

   // 7. Crear imágenes de productos (múltiples por producto)
   // Imágenes para Remera Básica
   await db.insert(schema.dbProductImages).values([
     {
       productId: product1.id,
       tenantId: tenant.id,
       url: 'https://picsum.photos/seed/remera1/800/600',
       alt: 'Remera Básica Roja frente',
       position: 0,
     },
     {
       productId: product1.id,
       tenantId: tenant.id,
       url: 'https://picsum.photos/seed/remera2/800/600',
       alt: 'Remera Básica Azul frente',
       position: 1,
     },
     {
       productId: product1.id,
       tenantId: tenant.id,
       url: 'https://picsum.photos/seed/remera3/800/600',
       alt: 'Remera Básica detalle',
       position: 2,
     },
   ]);

   // Imágenes para Pantalón Jeans
   await db.insert(schema.dbProductImages).values([
     {
       productId: product2.id,
       tenantId: tenant.id,
       url: 'https://picsum.photos/seed/jeans1/800/600',
       alt: 'Pantalón Jeans frente',
       position: 0,
     },
     {
       productId: product2.id,
       tenantId: tenant.id,
       url: 'https://picsum.photos/seed/jeans2/800/600',
       alt: 'Pantalón Jeans perfil',
       position: 1,
     },
   ]);

   console.log('✅ Imágenes de productos creadas');

   // 8. Crear cliente de prueba
   await db.insert(schema.dbCustomers).values({
     tenantId: tenant.id,
     email: 'cliente@ejemplo.com',
     password: hashedPassword,
     name: 'Cliente Test',
     phone: '099123456',
   });

   const [customer] = await db.select().from(schema.dbCustomers).where(sql`email = 'cliente@ejemplo.com'`);

   console.log('✅ Cliente de prueba creado');

   // 9. Obtener algunas variantes para las órdenes
   const [varianteRemeraM] = await db.select().from(schema.dbProductVariants).where(sql`sku = 'REM-M-ROJ'`);
   const [varianteJeans40] = await db.select().from(schema.dbProductVariants).where(sql`sku = 'JEAN-40-AZU'`);
   const [varianteGorra] = await db.select().from(schema.dbProductVariants).where(sql`sku = 'GOR-UNI-NEG'`);
   const [varianteRemeraL] = await db.select().from(schema.dbProductVariants).where(sql`sku = 'REM-L-AZU'`);

   // 10. Crear órdenes de ejemplo
   // Orden 1: Confirmada (pago aprobado)
   const order1Total = (varianteRemeraM.price * 2) + (varianteJeans40.price * 1);
   const [order1] = await db.insert(schema.dbOrders).values({
     tenantId: tenant.id,
     customerId: customer.id,
     customerEmail: customer.email,
     status: 'confirmed',
     total: order1Total,
     currency: 'UYU',
     shippingDetails: { address: 'Calle Test 123', city: 'Montevideo' },
     metadata: { paymentId: 'mp_test_001', paymentStatus: 'approved' },
   }).returning();

   await db.insert(schema.dbOrderItems).values([
     {
       orderId: order1.id,
       productVariantId: varianteRemeraM.id,
       quantity: 2,
       unitPrice: varianteRemeraM.price,
     },
     {
       orderId: order1.id,
       productVariantId: varianteJeans40.id,
       quantity: 1,
       unitPrice: varianteJeans40.price,
     },
   ]);

   // Orden 2: Pendiente de pago
   const order2Total = (varianteGorra.price * 1) + (varianteRemeraL.price * 1);
   const [order2] = await db.insert(schema.dbOrders).values({
     tenantId: tenant.id,
     customerId: customer.id,
     customerEmail: customer.email,
     status: 'pending_payment',
     total: order2Total,
     currency: 'UYU',
     shippingDetails: { address: 'Calle Test 123', city: 'Montevideo' },
     metadata: { paymentId: 'mp_test_002', paymentStatus: 'pending' },
   }).returning();

   await db.insert(schema.dbOrderItems).values([
     {
       orderId: order2.id,
       productVariantId: varianteGorra.id,
       quantity: 1,
       unitPrice: varianteGorra.price,
     },
     {
       orderId: order2.id,
       productVariantId: varianteRemeraL.id,
       quantity: 1,
       unitPrice: varianteRemeraL.price,
     },
   ]);

   console.log('✅ Órdenes de ejemplo creadas (1 confirmada, 1 pendiente)');

   // 11. Verificar que todo está bien
   const tenantsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.dbTenants);
   const productsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.dbProducts);
   const variantsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.dbProductVariants);
   const ordersCount = await db.select({ count: sql<number>`count(*)` }).from(schema.dbOrders);
   const imagesCount = await db.select({ count: sql<number>`count(*)` }).from(schema.dbProductImages);
   const categoriesCount = await db.select({ count: sql<number>`count(*)` }).from(schema.dbCategories);

   console.log(`📊 Resumen: ${tenantsCount[0].count} tenant(s), ${categoriesCount[0].count} categoría(s), ${productsCount[0].count} producto(s), ${variantsCount[0].count} variante(s), ${imagesCount[0].count} imagen(es), ${ordersCount[0].count} orden(es)`);

   console.log('🎉 Seed completado con éxito');
   process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Error en seed:', error);
  process.exit(1);
});