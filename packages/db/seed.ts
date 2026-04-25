import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './src/schema';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

async function seed() {
  console.log('🌱 Reseteando base de datos...');
  
  // 1. Limpiar todas las tablas (orden inverso por dependencias)
  await db.execute(sql`TRUNCATE TABLE order_items CASCADE`);
  await db.execute(sql`TRUNCATE TABLE orders CASCADE`);
  await db.execute(sql`TRUNCATE TABLE product_variants CASCADE`);
  await db.execute(sql`TRUNCATE TABLE products CASCADE`);
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

  // 4. Crear productos de demostración
  const [product1] = await db.insert(schema.dbProducts).values({
    tenantId: tenant.id,
    name: 'Zapatos Deportivos',
    slug: 'zapatos-deportivos',
    description: 'Zapatos ideales para correr. Suela de goma y materiales transpirables.',
    status: 'active',
    metadata: {},
  }).returning();

  const [product2] = await db.insert(schema.dbProducts).values({
    tenantId: tenant.id,
    name: 'Camiseta Algodón',
    slug: 'camiseta-algodon',
    description: 'Camiseta 100% algodón, disponible en varios colores.',
    status: 'active',
    metadata: {},
  }).returning();

  // 5. Crear variantes (una por producto, por simplicidad)
  await db.insert(schema.dbProductVariants).values({
    tenantId: tenant.id,
    productId: product1.id,
    sku: 'zap-001',
    price: 12300, // $123.00
    stock: 50,
    options: { talle: '42', color: 'negro' },
  });

  await db.insert(schema.dbProductVariants).values({
    tenantId: tenant.id,
    productId: product2.id,
    sku: 'cam-001',
    price: 8900, // $89.00
    stock: 100,
    options: { talle: 'M', color: 'blanco' },
  });

  console.log('✅ Productos y variantes creados');

  // 6. (Opcional) Crear un cliente de prueba (comprador) para la tienda
  await db.insert(schema.dbCustomers).values({
    tenantId: tenant.id,
    email: 'cliente@ejemplo.com',
    password: hashedPassword,
    name: 'Cliente Test',
    phone: '099123456',
  });

  console.log('✅ Cliente de prueba creado');
  
  // 7. Verificar que todo está bien
  const tenantsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.dbTenants);
  const productsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.dbProducts);
  console.log(`📊 Resumen: ${tenantsCount[0].count} tenant(s), ${productsCount[0].count} producto(s)`);
  
  console.log('🎉 Seed completado con éxito');
  process.exit(0);
}

seed().catch((error) => {
  console.error('❌ Error en seed:', error);
  process.exit(1);
});