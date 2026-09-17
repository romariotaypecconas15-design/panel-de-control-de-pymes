/* ============================================================
   data.js
   "Base de datos" del dashboard, ahora usando Firestore
   (la conexión real vive en js/firebase.js; aquí solo se usa
   el objeto "db" que ese archivo deja listo).

   Mantiene EXACTAMENTE las mismas funciones que usaba app.js
   con localStorage (dbGet, dbSet, dbNextId, seedDatabase), para
   que el resto de la app no tenga que cambiar su lógica:

   - dbGet(key)        → array en memoria (caché), igual que antes.
   - dbSet(key, data)  → actualiza la caché al instante (para que
                          la interfaz responda rápido) y guarda el
                          cambio en Firestore en segundo plano.
   - dbNextId(key)     → igual que antes, calculado sobre la caché.
   - seedDatabase()    → AHORA ES ASYNC: carga las colecciones
                          desde Firestore (y las crea con datos de
                          ejemplo la primera vez que no existan).
   ============================================================ */

// Nombre de cada colección en Firestore
const DB_KEYS = {
  categorias: 'categorias',
  productos: 'productos',
  clientes: 'clientes',
  ventas: 'ventas'
};

// Caché en memoria: se llena una vez desde Firestore al iniciar
// la app y se mantiene sincronizada en cada dbSet().
const CACHE = {
  categorias: [],
  productos: [],
  clientes: [],
  ventas: []
};

/* ---------------- Datos de ejemplo (solo se usan si la colección
   todavía no existe en Firestore) ---------------- */
function semillaCategorias() {
  return [
    { id: 1, nombre: 'Abarrotes' },
    { id: 2, nombre: 'Lácteos' },
    { id: 3, nombre: 'Bebidas' },
    { id: 4, nombre: 'Limpieza' }
  ];
}

function semillaProductos() {
  return [
    { id: 1, nombre: 'Arroz 5kg', id_categoria: 1, precio: 22.5, stock: 40 },
    { id: 2, nombre: 'Aceite 1L', id_categoria: 1, precio: 9.9, stock: 3 },
    { id: 3, nombre: 'Leche evaporada', id_categoria: 2, precio: 4.2, stock: 5 },
    { id: 4, nombre: 'Azúcar 1kg', id_categoria: 1, precio: 5.5, stock: 7 },
    { id: 5, nombre: 'Gaseosa 1.5L', id_categoria: 3, precio: 7.0, stock: 25 },
    { id: 6, nombre: 'Detergente 1kg', id_categoria: 4, precio: 12.9, stock: 18 },
    { id: 7, nombre: 'Fideos 500g', id_categoria: 1, precio: 3.2, stock: 30 }
  ];
}

function semillaClientes() {
  return [
    { id: 1, nombre: 'María Torres', dni: '45678912', telefono: '987654321', correo: 'maria@correo.com' },
    { id: 2, nombre: 'Carlos Ramírez', dni: '41234567', telefono: '956123456', correo: 'carlos@correo.com' },
    { id: 3, nombre: 'Ana Flores', dni: '48912345', telefono: '912345678', correo: 'ana@correo.com' }
  ];
}

function semillaVentas() {
  // Generamos algunas ventas de ejemplo en los últimos meses para que
  // los gráficos y KPIs no se vean vacíos la primera vez.
  const hoy = new Date();
  const ventas = [];
  let idVenta = 1;
  for (let i = 0; i < 40; i++) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - Math.floor(Math.random() * 150));
    const idCliente = 1 + Math.floor(Math.random() * 3);
    const nItems = 1 + Math.floor(Math.random() * 3);
    const items = [];
    let total = 0;
    for (let j = 0; j < nItems; j++) {
      const idProd = 1 + Math.floor(Math.random() * 7);
      const cantidad = 1 + Math.floor(Math.random() * 4);
      const precios = [22.5, 9.9, 4.2, 5.5, 7.0, 12.9, 3.2];
      const precio = precios[idProd - 1];
      const subtotal = +(precio * cantidad).toFixed(2);
      total += subtotal;
      items.push({ id_producto: idProd, cantidad, precio, subtotal });
    }
    ventas.push({
      id: idVenta++,
      id_cliente: idCliente,
      fecha: fecha.toISOString().slice(0, 10),
      items,
      total: +total.toFixed(2)
    });
  }
  return ventas;
}

/* ---------------- Acceso a Firestore ---------------- */

// Trae todos los documentos de una colección tal cual están guardados.
async function firestoreCargarColeccion(key) {
  const snap = await db.collection(DB_KEYS[key]).get();
  return snap.docs.map(doc => doc.data());
}

// Escribe un array completo de "items" como documentos de la colección
// (un documento por item, usando su "id" como id de documento) y borra
// de Firestore los que ya no estén en el array.
async function firestoreGuardarColeccion(key, items, itemsAnteriores) {
  const batch = db.batch();
  const coleccion = db.collection(DB_KEYS[key]);

  items.forEach(item => {
    batch.set(coleccion.doc(String(item.id)), item);
  });

  if (itemsAnteriores) {
    const idsNuevos = new Set(items.map(i => i.id));
    itemsAnteriores.forEach(item => {
      if (!idsNuevos.has(item.id)) batch.delete(coleccion.doc(String(item.id)));
    });
  }

  await batch.commit();
}

// Carga cada colección desde Firestore; si alguna está vacía (primera
// vez que se usa el proyecto), la crea con datos de ejemplo.
async function seedDatabase() {
  const semillas = {
    categorias: semillaCategorias,
    productos: semillaProductos,
    clientes: semillaClientes,
    ventas: semillaVentas
  };

  for (const key of Object.keys(DB_KEYS)) {
    let items = await firestoreCargarColeccion(key);
    if (items.length === 0) {
      items = semillas[key]();
      await firestoreGuardarColeccion(key, items, []);
    }
    CACHE[key] = items;
  }
}

/* ---------------- Sincronización en tiempo real ---------------- */
// Escucha cambios realizados desde Firebase (o desde otra pestaña/dispositivo)
// y actualiza automáticamente la interfaz.
function iniciarEscuchaTiempoReal() {
  Object.keys(DB_KEYS).forEach(key => {
    db.collection(DB_KEYS[key]).onSnapshot(snapshot => {
      CACHE[key] = snapshot.docs.map(doc => doc.data());

      // La interfaz se actualiza sola cuando cambia la colección.
      if (typeof refrescarTodo === 'function') refrescarTodo();
      if (typeof renderReportes === 'function') {
        const reportes = document.getElementById('section-reportes');
        if (reportes && !reportes.classList.contains('d-none')) renderReportes();
      }
    }, error => {
      console.error(`Error escuchando ${DB_KEYS[key]} en Firestore:`, error);
    });
  });
}

/* ---------------- Helpers genéricos (misma firma que antes) ---------------- */
function dbGet(key) {
  return CACHE[key];
}

function dbSet(key, data) {
  const anteriores = CACHE[key];
  // Se actualiza la caché de inmediato para que la interfaz
  // responda al instante; el guardado en Firestore va en paralelo.
  CACHE[key] = data;

  firestoreGuardarColeccion(key, data, anteriores).catch(err => {
    console.error('Error guardando en Firestore:', err);
    if (typeof mostrarToast === 'function') {
      mostrarToast('No se pudo guardar en Firebase. Revisa tu conexión o la configuración de js/firebase.js.', 'danger');
    }
  });
}

function dbNextId(key) {
  const items = CACHE[key];
  return items.length ? Math.max(...items.map(i => i.id)) + 1 : 1;
}
