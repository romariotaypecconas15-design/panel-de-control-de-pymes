/* ============================================================
   app.js - Lógica del Panel de Control PyME
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Estos solo enganchan eventos del DOM, no dependen de tener
  // datos cargados todavía, así que se inicializan de inmediato.
  initLogin();
  initSidebar();
  initVentas();
  initProductos();
  initClientes();

  // seedDatabase() ahora es asíncrono: carga (o crea) las
  // colecciones en Firestore. Hasta que termine, deshabilitamos
  // el botón de login para no mostrar un dashboard vacío.
  const btnLogin = document.querySelector('#login-form button[type="submit"]');
  const textoOriginalBtn = btnLogin.textContent;
  btnLogin.disabled = true;
  btnLogin.textContent = 'Conectando con Firebase...';

  seedDatabase()
    .then(() => {
      btnLogin.disabled = false;
      btnLogin.textContent = textoOriginalBtn;
      // Desde este momento, cualquier cambio en Firestore se reflejará
      // automáticamente en la página, incluso si se hace desde otro dispositivo.
      iniciarEscuchaTiempoReal();

      if (sessionStorage.getItem('pyme_logueado') === '1') {
        mostrarApp();
      }
    })
    .catch(err => {
      console.error('Error conectando con Firebase:', err);
      const errorBox = document.getElementById('login-error');
      errorBox.textContent = 'No se pudo conectar con Firebase. Revisa la configuración en js/firebase.js y las reglas de Firestore.';
      errorBox.classList.remove('d-none');
    });
});

/* ---------------- LOGIN ---------------- */
function initLogin() {
  const form = document.getElementById('login-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value.trim();
    const errorBox = document.getElementById('login-error');

    // Autenticación simple de demostración (usuario: admin / admin123).
    // Para producción real, reemplazar por Firebase Authentication.
    if (user === 'admin' && pass === 'admin123') {
      sessionStorage.setItem('pyme_logueado', '1');
      sessionStorage.setItem('pyme_usuario', user);
      errorBox.classList.add('d-none');
      mostrarApp();
    } else {
      errorBox.textContent = 'Usuario o contraseña incorrectos.';
      errorBox.classList.remove('d-none');
    }
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem('pyme_logueado');
    document.getElementById('app-screen').classList.add('d-none');
    document.getElementById('login-screen').classList.remove('d-none');
  });
}

function mostrarApp() {
  document.getElementById('login-screen').classList.add('d-none');
  document.getElementById('app-screen').classList.remove('d-none');
  document.getElementById('current-user').textContent = sessionStorage.getItem('pyme_usuario') || 'admin';
  refrescarTodo();
}

/* ---------------- SIDEBAR / NAVEGACIÓN ---------------- */
function initSidebar() {
  const links = document.querySelectorAll('.sidebar-nav .nav-link');
  const titulos = {
    inicio: 'Inicio',
    ventas: 'Ventas',
    productos: 'Productos',
    clientes: 'Clientes',
    reportes: 'Reportes'
  };

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const seccion = link.dataset.section;
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.app-section').forEach(s => s.classList.add('d-none'));
      document.getElementById('section-' + seccion).classList.remove('d-none');
      document.getElementById('section-title').textContent = titulos[seccion];
      document.querySelector('.sidebar').classList.remove('show');

      if (seccion === 'inicio') renderDashboard();
      if (seccion === 'ventas') renderTablaVentas();
      if (seccion === 'productos') renderTablaProductos();
      if (seccion === 'clientes') renderTablaClientes();
      if (seccion === 'reportes') renderReportes();
    });
  });

  document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('show');
  });
}

function refrescarTodo() {
  renderDashboard();
  renderTablaVentas();
  renderTablaProductos();
  renderTablaClientes();
}

/* ---------------- UTILIDADES ---------------- */
function formatoMoneda(valor) {
  return 'S/ ' + Number(valor).toFixed(2);
}
function nombreProducto(id) {
  const p = dbGet('productos').find(x => x.id === id);
  return p ? p.nombre : '(producto eliminado)';
}
function nombreCliente(id) {
  const c = dbGet('clientes').find(x => x.id === id);
  return c ? c.nombre : '(cliente eliminado)';
}
function nombreCategoria(id) {
  const c = dbGet('categorias').find(x => x.id === id);
  return c ? c.nombre : '-';
}
function mostrarToast(mensaje, tipo = 'success') {
  const cont = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = `toast align-items-center text-bg-${tipo} border-0`;
  div.innerHTML = `<div class="d-flex"><div class="toast-body">${mensaje}</div>
    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  cont.appendChild(div);
  const toast = new bootstrap.Toast(div, { delay: 2500 });
  toast.show();
  div.addEventListener('hidden.bs.toast', () => div.remove());
}

/* ============================================================
   DASHBOARD / INICIO
   ============================================================ */
let chartVentasMes = null;

function renderDashboard() {
  const ventas = dbGet('ventas');
  const productos = dbGet('productos');
  const clientes = dbGet('clientes');
  const hoyStr = new Date().toISOString().slice(0, 10);
  const mesActual = new Date().toISOString().slice(0, 7);

  const ventasHoy = ventas.filter(v => v.fecha === hoyStr);
  const ventasMes = ventas.filter(v => v.fecha.slice(0, 7) === mesActual);

  document.getElementById('kpi-ventas-hoy').textContent = formatoMoneda(ventasHoy.reduce((s, v) => s + v.total, 0));
  document.getElementById('kpi-ventas-mes').textContent = formatoMoneda(ventasMes.reduce((s, v) => s + v.total, 0));
  document.getElementById('kpi-pedidos').textContent = ventas.length;
  document.getElementById('kpi-clientes').textContent = clientes.length;

  const totalProductosVendidos = ventas.reduce((s, v) => s + v.items.reduce((a, i) => a + i.cantidad, 0), 0);
  document.getElementById('kpi-productos-vendidos').textContent = totalProductosVendidos;
  document.getElementById('kpi-ingresos').textContent = formatoMoneda(ventas.reduce((s, v) => s + v.total, 0));

  // Gráfico de ventas por mes (últimos 7 meses)
  const meses = [];
  const valoresMes = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    meses.push(d.toLocaleDateString('es-PE', { month: 'short' }));
    const total = ventas.filter(v => v.fecha.slice(0, 7) === key).reduce((s, v) => s + v.total, 0);
    valoresMes.push(+total.toFixed(2));
  }
  const ctxMes = document.getElementById('chart-ventas-mes');
  if (chartVentasMes) chartVentasMes.destroy();
  chartVentasMes = new Chart(ctxMes, {
    type: 'bar',
    data: { labels: meses, datasets: [{ label: 'Ventas (S/)', data: valoresMes, backgroundColor: '#2563eb', borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  // Stock bajo (umbral: 10 unidades)
  const stockBajo = productos.filter(p => p.stock <= 10).sort((a, b) => a.stock - b.stock);
  const contStock = document.getElementById('lista-stock-bajo');
  contStock.innerHTML = stockBajo.length
    ? stockBajo.map(p => `<div class="mini-item"><span>${p.nombre}</span><span class="badge-stock-bajo">${p.stock} unid.</span></div>`).join('')
    : '<p class="text-muted small">No hay productos con stock bajo.</p>';

  // Top productos más vendidos
  const conteoProductos = {};
  ventas.forEach(v => v.items.forEach(i => {
    conteoProductos[i.id_producto] = (conteoProductos[i.id_producto] || 0) + i.cantidad;
  }));
  const topProductos = Object.entries(conteoProductos).sort((a, b) => b[1] - a[1]).slice(0, 5);
  document.getElementById('lista-top-productos').innerHTML = topProductos.length
    ? topProductos.map(([id, cant]) => `<div class="mini-item"><span>${nombreProducto(+id)}</span><span>${cant} unid.</span></div>`).join('')
    : '<p class="text-muted small">Sin ventas registradas.</p>';

  // Últimas ventas
  const ultimas = [...ventas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);
  document.getElementById('lista-ultimas-ventas').innerHTML = ultimas.length
    ? ultimas.map(v => `<div class="mini-item"><span>${nombreCliente(v.id_cliente)} · ${v.fecha}</span><span>${formatoMoneda(v.total)}</span></div>`).join('')
    : '<p class="text-muted small">Sin ventas registradas.</p>';
}

/* ============================================================
   VENTAS
   ============================================================ */
function initVentas() {
  document.getElementById('modal-venta').addEventListener('show.bs.modal', prepararModalVenta);
  document.getElementById('btn-add-item').addEventListener('click', () => agregarFilaItem());
  document.getElementById('btn-guardar-venta').addEventListener('click', guardarVenta);
  document.getElementById('btn-filtrar-ventas').addEventListener('click', renderTablaVentas);
  document.getElementById('btn-limpiar-filtro-ventas').addEventListener('click', () => {
    document.getElementById('filtro-fecha-desde').value = '';
    document.getElementById('filtro-fecha-hasta').value = '';
    renderTablaVentas();
  });
}

function prepararModalVenta() {
  const selectCliente = document.getElementById('venta-cliente');
  selectCliente.innerHTML = dbGet('clientes').map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  document.getElementById('venta-fecha').value = new Date().toISOString().slice(0, 10);
  document.getElementById('venta-items').innerHTML = '';
  agregarFilaItem();
  calcularTotalVenta();
}

function agregarFilaItem() {
  const cont = document.getElementById('venta-items');
  const productos = dbGet('productos');
  const fila = document.createElement('div');
  fila.className = 'row g-2 align-items-end mb-2 fila-item';
  fila.innerHTML = `
    <div class="col-6">
      <select class="form-select form-select-sm select-producto">
        ${productos.map(p => `<option value="${p.id}" data-precio="${p.precio}">${p.nombre} (S/ ${p.precio.toFixed(2)})</option>`).join('')}
      </select>
    </div>
    <div class="col-3">
      <input type="number" min="1" value="1" class="form-control form-control-sm input-cantidad">
    </div>
    <div class="col-2 text-end small subtotal-item">0.00</div>
    <div class="col-1"><button type="button" class="btn btn-sm btn-outline-danger btn-quitar-item"><i class="fa-solid fa-trash"></i></button></div>
  `;
  cont.appendChild(fila);

  fila.querySelector('.select-producto').addEventListener('change', calcularTotalVenta);
  fila.querySelector('.input-cantidad').addEventListener('input', calcularTotalVenta);
  fila.querySelector('.btn-quitar-item').addEventListener('click', () => { fila.remove(); calcularTotalVenta(); });
  calcularTotalVenta();
}

function calcularTotalVenta() {
  let total = 0;
  document.querySelectorAll('.fila-item').forEach(fila => {
    const select = fila.querySelector('.select-producto');
    const precio = parseFloat(select.selectedOptions[0]?.dataset.precio || 0);
    const cantidad = parseInt(fila.querySelector('.input-cantidad').value || 0);
    const subtotal = precio * cantidad;
    fila.querySelector('.subtotal-item').textContent = subtotal.toFixed(2);
    total += subtotal;
  });
  document.getElementById('venta-total').textContent = total.toFixed(2);
}

function guardarVenta() {
  const idCliente = parseInt(document.getElementById('venta-cliente').value);
  const fecha = document.getElementById('venta-fecha').value;
  if (!fecha) { mostrarToast('Selecciona una fecha.', 'danger'); return; }

  const filas = document.querySelectorAll('.fila-item');
  if (!filas.length) { mostrarToast('Agrega al menos un producto.', 'danger'); return; }

  const productos = dbGet('productos');
  const items = [];
  let total = 0;
  let stockInsuficiente = null;

  filas.forEach(fila => {
    const idProducto = parseInt(fila.querySelector('.select-producto').value);
    const cantidad = parseInt(fila.querySelector('.input-cantidad').value || 0);
    const producto = productos.find(p => p.id === idProducto);
    if (producto.stock < cantidad) stockInsuficiente = producto.nombre;
    const subtotal = +(producto.precio * cantidad).toFixed(2);
    total += subtotal;
    items.push({ id_producto: idProducto, cantidad, precio: producto.precio, subtotal });
  });

  if (stockInsuficiente) {
    mostrarToast(`Stock insuficiente para "${stockInsuficiente}".`, 'danger');
    return;
  }

  // Descontar stock
  items.forEach(item => {
    const p = productos.find(x => x.id === item.id_producto);
    p.stock -= item.cantidad;
  });
  dbSet('productos', productos);

  const ventas = dbGet('ventas');
  ventas.push({ id: dbNextId('ventas'), id_cliente: idCliente, fecha, items, total: +total.toFixed(2) });
  dbSet('ventas', ventas);

  bootstrap.Modal.getInstance(document.getElementById('modal-venta')).hide();
  mostrarToast('Venta registrada correctamente.');
  refrescarTodo();
}

function renderTablaVentas() {
  const desde = document.getElementById('filtro-fecha-desde').value;
  const hasta = document.getElementById('filtro-fecha-hasta').value;
  let ventas = [...dbGet('ventas')].sort((a, b) => b.fecha.localeCompare(a.fecha));

  if (desde) ventas = ventas.filter(v => v.fecha >= desde);
  if (hasta) ventas = ventas.filter(v => v.fecha <= hasta);

  const tbody = document.querySelector('#tabla-ventas tbody');
  tbody.innerHTML = ventas.map(v => `
    <tr>
      <td>#${v.id}</td>
      <td>${v.fecha}</td>
      <td>${nombreCliente(v.id_cliente)}</td>
      <td>${v.items.reduce((s, i) => s + i.cantidad, 0)} unid.</td>
      <td>${formatoMoneda(v.total)}</td>
      <td><button class="btn btn-sm btn-outline-primary btn-ver-venta" data-id="${v.id}"><i class="fa-solid fa-eye"></i></button></td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="text-center text-muted py-3">No hay ventas registradas.</td></tr>`;

  tbody.querySelectorAll('.btn-ver-venta').forEach(btn => {
    btn.addEventListener('click', () => verDetalleVenta(parseInt(btn.dataset.id)));
  });
}

function verDetalleVenta(id) {
  const venta = dbGet('ventas').find(v => v.id === id);
  if (!venta) return;
  const body = document.getElementById('detalle-venta-body');
  body.innerHTML = `
    <p><b>Cliente:</b> ${nombreCliente(venta.id_cliente)}<br><b>Fecha:</b> ${venta.fecha}</p>
    <table class="table table-sm">
      <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
      <tbody>${venta.items.map(i => `<tr><td>${nombreProducto(i.id_producto)}</td><td>${i.cantidad}</td><td>${formatoMoneda(i.precio)}</td><td>${formatoMoneda(i.subtotal)}</td></tr>`).join('')}</tbody>
    </table>
    <h5 class="text-end">Total: ${formatoMoneda(venta.total)}</h5>
  `;
  new bootstrap.Modal(document.getElementById('modal-detalle-venta')).show();
}

/* ============================================================
   PRODUCTOS
   ============================================================ */
function initProductos() {
  document.getElementById('btn-nuevo-producto').addEventListener('click', () => {
    document.getElementById('titulo-modal-producto').textContent = 'Nuevo producto';
    document.getElementById('form-producto').reset();
    document.getElementById('producto-id').value = '';
    cargarSelectCategorias();
  });
  document.getElementById('btn-guardar-producto').addEventListener('click', guardarProducto);
  document.getElementById('buscar-producto').addEventListener('input', renderTablaProductos);
}

function cargarSelectCategorias() {
  document.getElementById('producto-categoria').innerHTML =
    dbGet('categorias').map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

function guardarProducto() {
  const id = document.getElementById('producto-id').value;
  const nombre = document.getElementById('producto-nombre').value.trim();
  const idCategoria = parseInt(document.getElementById('producto-categoria').value);
  const precio = parseFloat(document.getElementById('producto-precio').value);
  const stock = parseInt(document.getElementById('producto-stock').value);

  if (!nombre || isNaN(precio) || isNaN(stock)) { mostrarToast('Completa todos los campos.', 'danger'); return; }

  const productos = dbGet('productos');
  if (id) {
    const p = productos.find(x => x.id === parseInt(id));
    p.nombre = nombre; p.id_categoria = idCategoria; p.precio = precio; p.stock = stock;
  } else {
    productos.push({ id: dbNextId('productos'), nombre, id_categoria: idCategoria, precio, stock });
  }
  dbSet('productos', productos);
  bootstrap.Modal.getInstance(document.getElementById('modal-producto')).hide();
  mostrarToast('Producto guardado correctamente.');
  renderTablaProductos();
  renderDashboard();
}

function renderTablaProductos() {
  const filtro = (document.getElementById('buscar-producto').value || '').toLowerCase();
  const productos = dbGet('productos').filter(p => p.nombre.toLowerCase().includes(filtro));
  const tbody = document.querySelector('#tabla-productos tbody');

  tbody.innerHTML = productos.map(p => `
    <tr>
      <td>${p.nombre}</td>
      <td>${nombreCategoria(p.id_categoria)}</td>
      <td>${formatoMoneda(p.precio)}</td>
      <td>${p.stock}</td>
      <td>${p.stock <= 10 ? '<span class="badge-stock-bajo">Stock bajo</span>' : '<span class="badge-ok">OK</span>'}</td>
      <td>
        <button class="btn btn-sm btn-outline-secondary btn-editar-producto" data-id="${p.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-sm btn-outline-danger btn-eliminar-producto" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="text-center text-muted py-3">No se encontraron productos.</td></tr>`;

  tbody.querySelectorAll('.btn-editar-producto').forEach(btn =>
    btn.addEventListener('click', () => editarProducto(parseInt(btn.dataset.id))));
  tbody.querySelectorAll('.btn-eliminar-producto').forEach(btn =>
    btn.addEventListener('click', () => eliminarProducto(parseInt(btn.dataset.id))));
}

function editarProducto(id) {
  const p = dbGet('productos').find(x => x.id === id);
  if (!p) return;
  document.getElementById('titulo-modal-producto').textContent = 'Editar producto';
  cargarSelectCategorias();
  document.getElementById('producto-id').value = p.id;
  document.getElementById('producto-nombre').value = p.nombre;
  document.getElementById('producto-categoria').value = p.id_categoria;
  document.getElementById('producto-precio').value = p.precio;
  document.getElementById('producto-stock').value = p.stock;
  new bootstrap.Modal(document.getElementById('modal-producto')).show();
}

function eliminarProducto(id) {
  if (!confirm('¿Eliminar este producto?')) return;
  dbSet('productos', dbGet('productos').filter(p => p.id !== id));
  mostrarToast('Producto eliminado.', 'secondary');
  renderTablaProductos();
  renderDashboard();
}

/* ============================================================
   CLIENTES
   ============================================================ */
function initClientes() {
  document.getElementById('btn-nuevo-cliente').addEventListener('click', () => {
    document.getElementById('titulo-modal-cliente').textContent = 'Nuevo cliente';
    document.getElementById('form-cliente').reset();
    document.getElementById('cliente-id').value = '';
  });
  document.getElementById('btn-guardar-cliente').addEventListener('click', guardarCliente);
  document.getElementById('buscar-cliente').addEventListener('input', renderTablaClientes);
}

function guardarCliente() {
  const id = document.getElementById('cliente-id').value;
  const nombre = document.getElementById('cliente-nombre').value.trim();
  const dni = document.getElementById('cliente-dni').value.trim();
  const telefono = document.getElementById('cliente-telefono').value.trim();
  const correo = document.getElementById('cliente-correo').value.trim();

  if (!nombre) { mostrarToast('El nombre es obligatorio.', 'danger'); return; }

  const clientes = dbGet('clientes');
  if (id) {
    const c = clientes.find(x => x.id === parseInt(id));
    c.nombre = nombre; c.dni = dni; c.telefono = telefono; c.correo = correo;
  } else {
    clientes.push({ id: dbNextId('clientes'), nombre, dni, telefono, correo });
  }
  dbSet('clientes', clientes);
  bootstrap.Modal.getInstance(document.getElementById('modal-cliente')).hide();
  mostrarToast('Cliente guardado correctamente.');
  renderTablaClientes();
  renderDashboard();
}

function renderTablaClientes() {
  const filtro = (document.getElementById('buscar-cliente').value || '').toLowerCase();
  const clientes = dbGet('clientes').filter(c => c.nombre.toLowerCase().includes(filtro));
  const ventas = dbGet('ventas');
  const tbody = document.querySelector('#tabla-clientes tbody');

  tbody.innerHTML = clientes.map(c => {
    const compras = ventas.filter(v => v.id_cliente === c.id).length;
    return `
    <tr>
      <td>${c.nombre}</td>
      <td>${c.dni || '-'}</td>
      <td>${c.telefono || '-'}</td>
      <td>${c.correo || '-'}</td>
      <td><button class="btn btn-sm btn-outline-info btn-historial" data-id="${c.id}">${compras} compra(s)</button></td>
      <td>
        <button class="btn btn-sm btn-outline-secondary btn-editar-cliente" data-id="${c.id}"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-sm btn-outline-danger btn-eliminar-cliente" data-id="${c.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="text-center text-muted py-3">No se encontraron clientes.</td></tr>`;

  tbody.querySelectorAll('.btn-editar-cliente').forEach(btn =>
    btn.addEventListener('click', () => editarCliente(parseInt(btn.dataset.id))));
  tbody.querySelectorAll('.btn-eliminar-cliente').forEach(btn =>
    btn.addEventListener('click', () => eliminarCliente(parseInt(btn.dataset.id))));
  tbody.querySelectorAll('.btn-historial').forEach(btn =>
    btn.addEventListener('click', () => verHistorialCliente(parseInt(btn.dataset.id))));
}

function editarCliente(id) {
  const c = dbGet('clientes').find(x => x.id === id);
  if (!c) return;
  document.getElementById('titulo-modal-cliente').textContent = 'Editar cliente';
  document.getElementById('cliente-id').value = c.id;
  document.getElementById('cliente-nombre').value = c.nombre;
  document.getElementById('cliente-dni').value = c.dni || '';
  document.getElementById('cliente-telefono').value = c.telefono || '';
  document.getElementById('cliente-correo').value = c.correo || '';
  new bootstrap.Modal(document.getElementById('modal-cliente')).show();
}

function eliminarCliente(id) {
  if (!confirm('¿Eliminar este cliente?')) return;
  dbSet('clientes', dbGet('clientes').filter(c => c.id !== id));
  mostrarToast('Cliente eliminado.', 'secondary');
  renderTablaClientes();
  renderDashboard();
}

function verHistorialCliente(id) {
  const cliente = dbGet('clientes').find(c => c.id === id);
  const ventas = dbGet('ventas').filter(v => v.id_cliente === id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const body = document.getElementById('historial-cliente-body');
  body.innerHTML = `<h6>${cliente.nombre}</h6>` + (ventas.length
    ? `<table class="table table-sm"><thead><tr><th>Fecha</th><th>Items</th><th>Total</th></tr></thead>
       <tbody>${ventas.map(v => `<tr><td>${v.fecha}</td><td>${v.items.reduce((s, i) => s + i.cantidad, 0)}</td><td>${formatoMoneda(v.total)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="text-muted">Este cliente aún no tiene compras registradas.</p>');
  new bootstrap.Modal(document.getElementById('modal-historial-cliente')).show();
}

/* ============================================================
   REPORTES
   ============================================================ */
let chartsReportes = {};

function renderReportes() {
  const ventas = dbGet('ventas');
  const productos = dbGet('productos');
  const categorias = dbGet('categorias');

  Object.values(chartsReportes).forEach(c => c && c.destroy());

  // Ventas por día (últimos 14 días)
  const labelsDias = [];
  const valoresDias = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    labelsDias.push(d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit' }));
    valoresDias.push(+ventas.filter(v => v.fecha === key).reduce((s, v) => s + v.total, 0).toFixed(2));
  }
  chartsReportes.dia = new Chart(document.getElementById('chart-ventas-dia'), {
    type: 'line',
    data: { labels: labelsDias, datasets: [{ label: 'Ventas (S/)', data: valoresDias, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.15)', fill: true, tension: .3 }] },
    options: { plugins: { legend: { display: false } } }
  });

  // Ventas por categoría
  const totalPorCategoria = {};
  ventas.forEach(v => v.items.forEach(i => {
    const prod = productos.find(p => p.id === i.id_producto);
    if (!prod) return;
    totalPorCategoria[prod.id_categoria] = (totalPorCategoria[prod.id_categoria] || 0) + i.subtotal;
  }));
  chartsReportes.categoria = new Chart(document.getElementById('chart-ventas-categoria'), {
    type: 'doughnut',
    data: {
      labels: Object.keys(totalPorCategoria).map(id => nombreCategoria(+id)),
      datasets: [{ data: Object.values(totalPorCategoria).map(v => +v.toFixed(2)), backgroundColor: ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#0d9488', '#dc2626'] }]
    }
  });

  // Top 5 productos
  const conteo = {};
  ventas.forEach(v => v.items.forEach(i => { conteo[i.id_producto] = (conteo[i.id_producto] || 0) + i.cantidad; }));
  const top5 = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 5);
  chartsReportes.top = new Chart(document.getElementById('chart-top-productos'), {
    type: 'bar',
    data: { labels: top5.map(([id]) => nombreProducto(+id)), datasets: [{ label: 'Unidades vendidas', data: top5.map(([, c]) => c), backgroundColor: '#0d9488', borderRadius: 6 }] },
    options: { indexAxis: 'y', plugins: { legend: { display: false } } }
  });

  // Ingresos por mes (últimos 7 meses)
  const mesesLbl = [];
  const ingresosMes = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7);
    mesesLbl.push(d.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }));
    ingresosMes.push(+ventas.filter(v => v.fecha.slice(0, 7) === key).reduce((s, v) => s + v.total, 0).toFixed(2));
  }
  chartsReportes.ingresos = new Chart(document.getElementById('chart-ingresos-mes'), {
    type: 'bar',
    data: { labels: mesesLbl, datasets: [{ label: 'Ingresos (S/)', data: ingresosMes, backgroundColor: '#7c3aed', borderRadius: 6 }] },
    options: { plugins: { legend: { display: false } } }
  });
}
