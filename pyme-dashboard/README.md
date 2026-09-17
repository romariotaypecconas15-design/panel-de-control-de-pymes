# Panel de Control PyME — Dashboard de Ventas

Dashboard web para PyMES: control de ventas, productos, clientes e
indicadores, con gráficos (Chart.js) y diseño responsivo (Bootstrap 5).

## Acceso de demostración
- Usuario: `admin`
- Contraseña: `admin123`

## Importante sobre los datos

Este proyecto guarda los datos en **Firestore** (la base de datos de
Firebase), no en el navegador. Así los datos se comparten entre
cualquier dispositivo o usuario que abra el dashboard.

Toda la conexión con Firebase vive en un único archivo, `js/firebase.js`.
El resto del proyecto (`js/data.js`, `js/app.js`) no sabe nada de
Firebase: solo usa las funciones `dbGet`, `dbSet`, `dbNextId` y
`seedDatabase` de `js/data.js`.

**Antes de usarlo tienes que hacer 2 cosas:**

1. **Configurar la conexión.** Abre `js/firebase.js` y reemplaza el
   objeto `firebaseConfig` por el de tu proyecto (Firebase Console →
   Configuración del proyecto → Tus apps → SDK setup and configuration).
2. **Activar Firestore y sus reglas.** En la consola de Firebase, crea
   una base de datos Firestore (botón "Firestore Database" → "Crear
   base de datos"). Este proyecto incluye `firestore.rules` con reglas
   abiertas (lectura/escritura sin restricción), pensadas para una
   demo o proyecto académico sin login real. Publícalas con:
   ```
   firebase deploy --only firestore:rules
   ```
   ⚠️ El login de la app sigue siendo una pantalla de demostración
   (usuario/contraseña fijos), no usa Firebase Authentication. Si
   despliegas esto en un sitio público, cualquiera que descubra tu
   configuración podría leer o modificar los datos. Para producción
   real, agrega Firebase Authentication y ajusta `firestore.rules`.

La primera vez que se abre el dashboard con Firestore vacío, se crean
automáticamente datos de ejemplo (productos, clientes y ventas) para
que los gráficos y KPIs no se vean vacíos.

## Estructura del proyecto
```
pyme-dashboard/
├── index.html          → Login + toda la interfaz (SPA)
├── css/style.css        → Estilos
├── js/firebase.js        → ÚNICA conexión con Firebase (config + Firestore)
├── js/data.js             → Acceso a datos (Firestore) + datos de ejemplo
├── js/app.js               → Lógica: navegación, CRUD, gráficos
├── firebase.json            → Configuración de Firebase Hosting + Firestore
├── firestore.rules           → Reglas de acceso a Firestore
└── .firebaserc                → Alias del proyecto Firebase (edítalo con tu ID)
```

## Cómo subirlo a Firebase Hosting

1. Instala Firebase CLI (una sola vez):
   ```
   npm install -g firebase-tools
   ```
2. Inicia sesión:
   ```
   firebase login
   ```
3. Descomprime este ZIP y entra a la carpeta:
   ```
   cd pyme-dashboard
   ```
4. Edita `.firebaserc` y coloca el ID de tu proyecto de Firebase
   (lo ves en la consola de Firebase, en "Configuración del proyecto").
   También puedes crear el proyecto y enlazarlo con:
   ```
   firebase init hosting
   ```
   (elige "Use an existing project" y selecciona `.` como carpeta pública;
   cuando pregunte "Configure as a single-page app" responde **Sí**).
5. Publica el sitio (esto también sube las reglas de `firestore.rules`
   porque ya están declaradas en `firebase.json`):
   ```
   firebase deploy
   ```
6. Al terminar, la terminal te mostrará la URL pública, algo como:
   ```
   https://tu-proyecto.web.app
   ```

## Probar localmente antes de subir (opcional)
```
firebase emulators:start --only hosting
```
o simplemente abre `index.html` en el navegador.

## Funcionalidades incluidas
- **Inicio:** ventas de hoy, ventas del mes, pedidos, clientes registrados,
  productos vendidos, ingresos totales, gráfico de ventas por mes,
  productos más vendidos, stock bajo, últimas ventas.
- **Ventas:** registrar venta (multi-producto con cálculo automático),
  listar, filtrar por rango de fechas, ver detalle, descuento automático
  de stock.
- **Productos:** crear, editar, eliminar, control de stock y alerta de
  bajo inventario.
- **Clientes:** crear, editar, eliminar, historial de compras.
- **Reportes:** ventas por día (14 días), ventas por categoría, top 5
  productos, ingresos por mes.

## Datos de ejemplo
El proyecto incluye datos de muestra (productos, clientes y ventas de los
últimos meses) generados automáticamente la primera vez que se abre, para
que los gráficos y KPIs no se vean vacíos. Puedes borrarlos desde las
herramientas de desarrollador del navegador (Application → Local Storage)
si quieres empezar desde cero.
