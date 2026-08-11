import { config } from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './src/schema'
import bcrypt from 'bcryptjs'
import { sql } from 'drizzle-orm'

config({ path: '.env.local' })

const client = postgres(process.env.DATABASE_URL!)
const db = drizzle(client, { schema })

async function seed() {
  console.log('🌱 Reseteando base de datos...')

  // 1. Limpiar todas las tablas (orden inverso por dependencias)
  await db.execute(sql`TRUNCATE TABLE order_items CASCADE`)
  await db.execute(sql`TRUNCATE TABLE orders CASCADE`)
  await db.execute(sql`TRUNCATE TABLE product_variants CASCADE`)
  await db.execute(sql`TRUNCATE TABLE product_images CASCADE`)
  await db.execute(sql`TRUNCATE TABLE products CASCADE`)
  await db.execute(sql`TRUNCATE TABLE categories CASCADE`)
  await db.execute(sql`TRUNCATE TABLE customers CASCADE`)
  await db.execute(sql`TRUNCATE TABLE admin_users CASCADE`)
  await db.execute(sql`TRUNCATE TABLE tenants CASCADE`)

  console.log('✅ Tablas limpiadas')

  // 2. Crear tenant por defecto
  const [tenant] = await db
    .insert(schema.dbTenants)
    .values({
      slug: 'tienda1',
      name: 'Tienda Demo',
      plan: 'starter',
      status: 'active',
      customDomain: 'tienda1.local',
      settings: {
        logoUrl: 'https://picsum.photos/seed/tienda-logo/200/80',
        storeDescription:
          'Tu tienda online de confianza. Encontra los mejores productos con la mejor calidad.',
        contactEmail: 'contacto@tienda1.com',
        contactPhone: '+598 99 123 456',
        socialLinks: {
          instagram: 'https://instagram.com/tienda1',
          facebook: 'https://facebook.com/tienda1',
        },
      },
    })
    .returning()
  console.log(`✅ Tenant creado: ${tenant.slug} (ID: ${tenant.id})`)

  // 2b. Crear segundo tenant
  const [tenant2] = await db
    .insert(schema.dbTenants)
    .values({
      slug: 'tienda2',
      name: 'Tienda Premium',
      plan: 'business',
      status: 'active',
      customDomain: 'tienda2.local',
      settings: {
        logoUrl: 'https://picsum.photos/seed/premium-logo/200/80',
        storeDescription: 'Productos premium para quienes buscan lo mejor.',
        contactEmail: 'contacto@tienda2.com',
        contactPhone: '+598 99 654 321',
        socialLinks: {
          instagram: 'https://instagram.com/tienda2',
          facebook: 'https://facebook.com/tienda2',
        },
      },
    })
    .returning()
  console.log(`✅ Tenant creado: ${tenant2.slug} (ID: ${tenant2.id})`)

  // 3. Crear administrador (para admin y superadmin)
  const hashedPassword = await bcrypt.hash('123456', 10)

  // Admin normal (del tenant)
  await db.insert(schema.dbAdminUsers).values({
    email: 'admin@tienda1.com',
    password: hashedPassword,
    role: 'admin',
    tenantId: tenant.id,
  })

  // Admin de tenant 2
  await db.insert(schema.dbAdminUsers).values({
    email: 'admin@tienda2.com',
    password: hashedPassword,
    role: 'admin',
    tenantId: tenant2.id,
  })

  // Superadmin (sin tenant asociado)
  await db.insert(schema.dbAdminUsers).values({
    email: 'super@admin.com',
    password: hashedPassword,
    role: 'superadmin',
    tenantId: null,
  })

  console.log('✅ Admins y Superadmin creados (contraseña: 123456)')

  // 4. Crear categorías
  const [catRemeras] = await db
    .insert(schema.dbCategories)
    .values({
      tenantId: tenant.id,
      name: 'Remeras',
      slug: 'remeras',
    })
    .returning()

  const [catPantalones] = await db
    .insert(schema.dbCategories)
    .values({
      tenantId: tenant.id,
      name: 'Pantalones',
      slug: 'pantalones',
    })
    .returning()

  const [catAccesorios] = await db
    .insert(schema.dbCategories)
    .values({
      tenantId: tenant.id,
      name: 'Accesorios',
      slug: 'accesorios',
    })
    .returning()

  console.log('✅ Categorías creadas: Remeras, Pantalones, Accesorios')

  // 4b. Categorías para tenant 2
  const [cat2Remeras] = await db
    .insert(schema.dbCategories)
    .values({
      tenantId: tenant2.id,
      name: 'Remeras',
      slug: 'remeras',
    })
    .returning()

  const [cat2Pantalones] = await db
    .insert(schema.dbCategories)
    .values({
      tenantId: tenant2.id,
      name: 'Pantalones',
      slug: 'pantalones',
    })
    .returning()

  const [cat2Accesorios] = await db
    .insert(schema.dbCategories)
    .values({
      tenantId: tenant2.id,
      name: 'Accesorios',
      slug: 'accesorios',
    })
    .returning()

  console.log('✅ Categorías para tienda2: Remeras, Pantalones, Accesorios')

  // 5. Crear productos de demostración
  const [product1] = await db
    .insert(schema.dbProducts)
    .values({
      tenantId: tenant.id,
      categoryId: catRemeras.id,
      name: 'Remera Básica',
      slug: 'remera-basica',
      description:
        'Remera básica de algodón, disponible en varios talles y colores.',
      status: 'active',
      metadata: {},
    })
    .returning()

  const [product2] = await db
    .insert(schema.dbProducts)
    .values({
      tenantId: tenant.id,
      categoryId: catPantalones.id,
      name: 'Pantalón Jeans',
      slug: 'pantalon-jeans',
      description:
        'Pantalón jeans clásico, disponible en varios talles y colores.',
      status: 'active',
      metadata: {},
    })
    .returning()

  const [product3] = await db
    .insert(schema.dbProducts)
    .values({
      tenantId: tenant.id,
      categoryId: catAccesorios.id,
      name: 'Gorra',
      slug: 'gorra',
      description: 'Gorra unisex, ideal para uso diario.',
      status: 'active',
      metadata: {},
    })
    .returning()

  console.log('✅ Productos creados: Remera Básica, Pantalón Jeans, Gorra')

  // 5b. Productos para tenant 2 (distintos a tenant 1)
  const [product4] = await db
    .insert(schema.dbProducts)
    .values({
      tenantId: tenant2.id,
      categoryId: cat2Remeras.id,
      name: 'Campera Premium',
      slug: 'campera-premium',
      description:
        'Campera rompevientos con capucha desmontable, ideal para actividades al aire libre.',
      status: 'active',
      metadata: {},
    })
    .returning()

  const [product5] = await db
    .insert(schema.dbProducts)
    .values({
      tenantId: tenant2.id,
      categoryId: cat2Pantalones.id,
      name: 'Zapatillas Runner',
      slug: 'zapatillas-runner',
      description:
        'Zapatillas de running con amortiguación avanzada y suela antideslizante.',
      status: 'active',
      metadata: {},
    })
    .returning()

  const [product6] = await db
    .insert(schema.dbProducts)
    .values({
      tenantId: tenant2.id,
      categoryId: cat2Accesorios.id,
      name: 'Mochila Urbana',
      slug: 'mochila-urbana',
      description:
        'Mochila impermeable con compartimento para laptop de hasta 15 pulgadas.',
      status: 'active',
      metadata: {},
    })
    .returning()

  console.log(
    '✅ Productos para tienda2: Campera Premium, Zapatillas Runner, Mochila Urbana',
  )

  // 6. Crear variantes con combinaciones de opciones
  // Remera Básica: Talle (S, M, L) x Color (Rojo, Azul) = 6 variantes
  const remeraVariants = [
    { sku: 'REM-S-ROJ', talle: 'S', color: 'Rojo', price: 3500, stock: 20 },
    { sku: 'REM-S-AZU', talle: 'S', color: 'Azul', price: 3500, stock: 15 },
    { sku: 'REM-M-ROJ', talle: 'M', color: 'Rojo', price: 3500, stock: 25 },
    { sku: 'REM-M-AZU', talle: 'M', color: 'Azul', price: 3500, stock: 3 }, // Stock bajo para alerta
    { sku: 'REM-L-ROJ', talle: 'L', color: 'Rojo', price: 3600, stock: 18 },
    { sku: 'REM-L-AZU', talle: 'L', color: 'Azul', price: 3600, stock: 22 },
  ]

  for (const v of remeraVariants) {
    await db.insert(schema.dbProductVariants).values({
      tenantId: tenant.id,
      productId: product1.id,
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      options: { Talle: v.talle, Color: v.color },
    })
  }

  // Pantalón Jeans: Talle (38, 40, 42) x Color (Azul, Negro) = 6 variantes
  const jeansVariants = [
    { sku: 'JEAN-38-AZU', talle: '38', color: 'Azul', price: 8900, stock: 10 },
    { sku: 'JEAN-38-NEG', talle: '38', color: 'Negro', price: 8900, stock: 8 },
    { sku: 'JEAN-40-AZU', talle: '40', color: 'Azul', price: 8900, stock: 12 },
    { sku: 'JEAN-40-NEG', talle: '40', color: 'Negro', price: 8900, stock: 15 },
    { sku: 'JEAN-42-AZU', talle: '42', color: 'Azul', price: 9000, stock: 7 },
    { sku: 'JEAN-42-NEG', talle: '42', color: 'Negro', price: 9000, stock: 9 },
  ]

  for (const v of jeansVariants) {
    await db.insert(schema.dbProductVariants).values({
      tenantId: tenant.id,
      productId: product2.id,
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      options: { Talle: v.talle, Color: v.color },
    })
  }

  // Gorra: Variante única
  await db.insert(schema.dbProductVariants).values({
    tenantId: tenant.id,
    productId: product3.id,
    sku: 'GOR-UNI-NEG',
    price: 2500,
    stock: 30,
    options: { Talle: 'Único', Color: 'Negra' },
  })

  console.log('✅ Variantes creadas para todos los productos')

  // 6b. Variantes para tenant 2
  // Campera Premium: Talle (S, M, L) x Color (Negro, Verde) = 6 variantes
  const camperaVariants = [
    { sku: 'CAMP-S-NEG', talle: 'S', color: 'Negro', price: 15000, stock: 10 },
    { sku: 'CAMP-S-VER', talle: 'S', color: 'Verde', price: 15000, stock: 8 },
    { sku: 'CAMP-M-NEG', talle: 'M', color: 'Negro', price: 15000, stock: 15 },
    { sku: 'CAMP-M-VER', talle: 'M', color: 'Verde', price: 15000, stock: 12 },
    { sku: 'CAMP-L-NEG', talle: 'L', color: 'Negro', price: 16000, stock: 5 },
    { sku: 'CAMP-L-VER', talle: 'L', color: 'Verde', price: 16000, stock: 7 },
  ]

  for (const v of camperaVariants) {
    await db.insert(schema.dbProductVariants).values({
      tenantId: tenant2.id,
      productId: product4.id,
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      options: { Talle: v.talle, Color: v.color },
    })
  }

  // Zapatillas Runner: Talle (38, 40, 42, 44) x Color (Blanco, Negro) = 8 variantes
  const zapatillasVariants = [
    {
      sku: 'ZAPA-38-BLA',
      talle: '38',
      color: 'Blanco',
      price: 12000,
      stock: 20,
    },
    {
      sku: 'ZAPA-38-NEG',
      talle: '38',
      color: 'Negro',
      price: 12000,
      stock: 15,
    },
    {
      sku: 'ZAPA-40-BLA',
      talle: '40',
      color: 'Blanco',
      price: 12000,
      stock: 25,
    },
    {
      sku: 'ZAPA-40-NEG',
      talle: '40',
      color: 'Negro',
      price: 12000,
      stock: 18,
    },
    {
      sku: 'ZAPA-42-BLA',
      talle: '42',
      color: 'Blanco',
      price: 12500,
      stock: 12,
    },
    {
      sku: 'ZAPA-42-NEG',
      talle: '42',
      color: 'Negro',
      price: 12500,
      stock: 10,
    },
    {
      sku: 'ZAPA-44-BLA',
      talle: '44',
      color: 'Blanco',
      price: 12500,
      stock: 6,
    },
    { sku: 'ZAPA-44-NEG', talle: '44', color: 'Negro', price: 12500, stock: 4 },
  ]

  for (const v of zapatillasVariants) {
    await db.insert(schema.dbProductVariants).values({
      tenantId: tenant2.id,
      productId: product5.id,
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      options: { Talle: v.talle, Color: v.color },
    })
  }

  // Mochila Urbana: Variante única
  await db.insert(schema.dbProductVariants).values({
    tenantId: tenant2.id,
    productId: product6.id,
    sku: 'MOCH-UNI-GRI',
    price: 8500,
    stock: 25,
    options: { Capacidad: '25L', Color: 'Gris' },
  })

  console.log('✅ Variantes para tienda2 creadas (13 variantes)')

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
  ])

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
  ])

  console.log('✅ Imágenes de productos creadas')

  // 7b. Imágenes para tenant 2
  await db.insert(schema.dbProductImages).values([
    {
      productId: product4.id,
      tenantId: tenant2.id,
      url: 'https://picsum.photos/seed/campera1/800/600',
      alt: 'Campera Premium frente',
      position: 0,
    },
    {
      productId: product4.id,
      tenantId: tenant2.id,
      url: 'https://picsum.photos/seed/campera2/800/600',
      alt: 'Campera Premium costado',
      position: 1,
    },
    {
      productId: product5.id,
      tenantId: tenant2.id,
      url: 'https://picsum.photos/seed/zapatillas1/800/600',
      alt: 'Zapatillas Runner perfil',
      position: 0,
    },
    {
      productId: product5.id,
      tenantId: tenant2.id,
      url: 'https://picsum.photos/seed/zapatillas2/800/600',
      alt: 'Zapatillas Runner frontal',
      position: 1,
    },
    {
      productId: product6.id,
      tenantId: tenant2.id,
      url: 'https://picsum.photos/seed/mochila1/800/600',
      alt: 'Mochila Urbana vista frontal',
      position: 0,
    },
  ])

  console.log('✅ Imágenes para tienda2 creadas (5 imágenes)')

  // 8. Crear cliente de prueba
  await db.insert(schema.dbCustomers).values({
    tenantId: tenant.id,
    email: 'cliente@ejemplo.com',
    password: hashedPassword,
    name: 'Cliente Test',
    phone: '099123456',
  })

  const [customer] = await db
    .select()
    .from(schema.dbCustomers)
    .where(sql`email = 'cliente@ejemplo.com'`)

  console.log('✅ Cliente de prueba creado')

  // 8b. Cliente de tenant 2
  await db.insert(schema.dbCustomers).values({
    tenantId: tenant2.id,
    email: 'cliente2@ejemplo.com',
    password: hashedPassword,
    name: 'Cliente Premium',
    phone: '099654321',
  })

  const [customer2] = await db
    .select()
    .from(schema.dbCustomers)
    .where(sql`email = 'cliente2@ejemplo.com'`)

  console.log('✅ Cliente de tienda2 creado')

  // 9. Obtener algunas variantes para las órdenes
  const [varianteRemeraM] = await db
    .select()
    .from(schema.dbProductVariants)
    .where(sql`sku = 'REM-M-ROJ'`)
  const [varianteJeans40] = await db
    .select()
    .from(schema.dbProductVariants)
    .where(sql`sku = 'JEAN-40-AZU'`)
  const [varianteGorra] = await db
    .select()
    .from(schema.dbProductVariants)
    .where(sql`sku = 'GOR-UNI-NEG'`)
  const [varianteRemeraL] = await db
    .select()
    .from(schema.dbProductVariants)
    .where(sql`sku = 'REM-L-AZU'`)

  // 10. Crear órdenes de ejemplo
  // Orden 1: Confirmada (pago aprobado)
  const order1Total = varianteRemeraM.price * 2 + varianteJeans40.price * 1
  const [order1] = await db
    .insert(schema.dbOrders)
    .values({
      tenantId: tenant.id,
      customerId: customer.id,
      customerEmail: customer.email,
      status: 'confirmed',
      total: order1Total,
      currency: 'UYU',
      shippingDetails: { address: 'Calle Test 123', city: 'Montevideo' },
      metadata: { paymentId: 'mp_test_001', paymentStatus: 'approved' },
    })
    .returning()

  await db.insert(schema.dbOrderItems).values([
    {
      tenantId: tenant.id,
      orderId: order1.id,
      productVariantId: varianteRemeraM.id,
      quantity: 2,
      unitPrice: varianteRemeraM.price,
    },
    {
      tenantId: tenant.id,
      orderId: order1.id,
      productVariantId: varianteJeans40.id,
      quantity: 1,
      unitPrice: varianteJeans40.price,
    },
  ])

  // Orden 2: Pendiente de pago (sin paymentId para pruebas de webhook)
  const order2Total = varianteGorra.price * 1 + varianteRemeraL.price * 1
  const [order2] = await db
    .insert(schema.dbOrders)
    .values({
      tenantId: tenant.id,
      customerId: customer.id,
      customerEmail: customer.email,
      status: 'pending_payment',
      total: order2Total,
      currency: 'UYU',
      shippingDetails: {
        address: 'Calle Test 123',
        city: 'Montevideo',
        name: 'Cliente Prueba',
      },
      metadata: { paymentStatus: 'pending' },
    })
    .returning()

  await db.insert(schema.dbOrderItems).values([
    {
      tenantId: tenant.id,
      orderId: order2.id,
      productVariantId: varianteGorra.id,
      quantity: 1,
      unitPrice: varianteGorra.price,
    },
    {
      tenantId: tenant.id,
      orderId: order2.id,
      productVariantId: varianteRemeraL.id,
      quantity: 1,
      unitPrice: varianteRemeraL.price,
    },
  ])

  console.log('✅ Órdenes de ejemplo creadas (1 confirmada, 1 pendiente)')

  // 10b. Órdenes para tenant 2
  const [vCamperaM] = await db
    .select()
    .from(schema.dbProductVariants)
    .where(sql`sku = 'CAMP-M-NEG'`)
  const [vZapatillas40] = await db
    .select()
    .from(schema.dbProductVariants)
    .where(sql`sku = 'ZAPA-40-BLA'`)
  const [vMochila] = await db
    .select()
    .from(schema.dbProductVariants)
    .where(sql`sku = 'MOCH-UNI-GRI'`)
  const [vCamperaL] = await db
    .select()
    .from(schema.dbProductVariants)
    .where(sql`sku = 'CAMP-L-VER'`)

  // Orden 3: Confirmada (tenant 2)
  const order3Total = vCamperaM.price * 1 + vZapatillas40.price * 1
  const [order3] = await db
    .insert(schema.dbOrders)
    .values({
      tenantId: tenant2.id,
      customerId: customer2.id,
      customerEmail: customer2.email,
      status: 'confirmed',
      total: order3Total,
      currency: 'UYU',
      shippingDetails: { address: 'Av. Principal 456', city: 'Montevideo' },
      metadata: { paymentId: 'mp_test_003', paymentStatus: 'approved' },
    })
    .returning()

  await db.insert(schema.dbOrderItems).values([
    {
      tenantId: tenant2.id,
      orderId: order3.id,
      productVariantId: vCamperaM.id,
      quantity: 1,
      unitPrice: vCamperaM.price,
    },
    {
      tenantId: tenant2.id,
      orderId: order3.id,
      productVariantId: vZapatillas40.id,
      quantity: 1,
      unitPrice: vZapatillas40.price,
    },
  ])

  // Orden 4: Pendiente de pago (tenant 2)
  const order4Total = vMochila.price * 2 + vCamperaL.price * 1
  const [order4] = await db
    .insert(schema.dbOrders)
    .values({
      tenantId: tenant2.id,
      customerId: customer2.id,
      customerEmail: customer2.email,
      status: 'pending_payment',
      total: order4Total,
      currency: 'UYU',
      shippingDetails: {
        address: 'Av. Principal 456',
        city: 'Montevideo',
        name: 'Cliente Premium',
      },
      metadata: { paymentStatus: 'pending' },
    })
    .returning()

  await db.insert(schema.dbOrderItems).values([
    {
      tenantId: tenant2.id,
      orderId: order4.id,
      productVariantId: vMochila.id,
      quantity: 2,
      unitPrice: vMochila.price,
    },
    {
      tenantId: tenant2.id,
      orderId: order4.id,
      productVariantId: vCamperaL.id,
      quantity: 1,
      unitPrice: vCamperaL.price,
    },
  ])

  console.log('✅ Órdenes para tienda2 creadas (1 confirmada, 1 pendiente)')

  // 11. Verificar que todo está bien
  const tenantsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.dbTenants)
  const productsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.dbProducts)
  const variantsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.dbProductVariants)
  const ordersCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.dbOrders)
  const imagesCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.dbProductImages)
  const categoriesCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.dbCategories)

  console.log(
    `📊 Resumen: ${tenantsCount[0].count} tenant(s), ${categoriesCount[0].count} categoría(s), ${productsCount[0].count} producto(s), ${variantsCount[0].count} variante(s), ${imagesCount[0].count} imagen(es), ${ordersCount[0].count} orden(es)`,
  )

  // Métodos de envío para tienda1
  await db
    .insert(schema.dbShippingMethods)
    .values([
      {
        tenantId: tenant.id,
        name: 'Envío estándar',
        description: 'Entrega en 3 a 5 días hábiles',
        price: 15000,
        freeShippingThreshold: 200000,
        estimatedDaysMin: 3,
        estimatedDaysMax: 5,
        isActive: 'true',
        sortOrder: 0,
      },
      {
        tenantId: tenant.id,
        name: 'Envío express',
        description: 'Entrega en 24 horas hábiles',
        price: 35000,
        freeShippingThreshold: null,
        estimatedDaysMin: 1,
        estimatedDaysMax: 1,
        isActive: 'true',
        sortOrder: 1,
      },
    ])
    .onConflictDoNothing()
  console.log('✅ Métodos de envío creados: Estándar, Express')

  // Métodos de envío para tienda2
  await db
    .insert(schema.dbShippingMethods)
    .values([
      {
        tenantId: tenant2.id,
        name: 'Envío estándar',
        description: 'Entrega en 3 a 5 días hábiles',
        price: 19000,
        freeShippingThreshold: 300000,
        estimatedDaysMin: 3,
        estimatedDaysMax: 5,
        isActive: 'true',
        sortOrder: 0,
      },
      {
        tenantId: tenant2.id,
        name: 'Envío premium',
        description: 'Entrega en 24 horas hábiles',
        price: 45000,
        freeShippingThreshold: null,
        estimatedDaysMin: 1,
        estimatedDaysMax: 1,
        isActive: 'true',
        sortOrder: 1,
      },
    ])
    .onConflictDoNothing()
  console.log('✅ Métodos de envío para tienda2: Estándar, Premium')

  console.log('🎉 Seed completado con éxito')
  process.exit(0)
}

seed().catch((error) => {
  console.error('❌ Error en seed:', error)
  process.exit(1)
})
// SHIPPING METHODS — agregado al seed existente
// (Este bloque se agrega al final del seed, antes del console.log final)
