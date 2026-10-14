import 'dotenv/config'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    // Item 78. El default de vitest son 5000ms, y los tests de integracion
    // contra Neon lo agotan **en el caso normal**: los de `register-tenant`
    // tardan 3.2-3.5s con bcrypt + una transicion de 3 inserts, y cuando
    // corre mas de un archivo en paralelo la conexion se disputa y se pasa.
    //
    // Subir el techo no cambia el comportamiento de un test sano: el que
    // tarda 100ms sigue tardando 100ms. Lo que cambia es que un test que
    // hace trabajo legitimo contra un servicio remoto tiene margen, y que el
    // que de verdad se cuelga se reporta a los 20s en vez de ser
    // indistinguible de presion.
    //
    // 20s es el techo, no el objetivo: ningun test deberia acercarse a el.
    testTimeout: 20000,
    include: ['**/*.test.ts', '**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    deps: {
      moduleDirectories: ['node_modules', 'node_modules/.pnpm'],
    },
  },
})
