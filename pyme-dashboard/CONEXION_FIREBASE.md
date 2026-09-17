# Conexión Firebase

Este proyecto está configurado para el proyecto Firebase:
`panel-de-control-para-py-b91d2`

Colecciones utilizadas por Firestore:
- `categorias`
- `productos`
- `clientes`
- `ventas`

La página carga los datos al iniciar y mantiene una escucha en tiempo real (`onSnapshot`).
Por eso, si se agrega, modifica o elimina un documento en Firestore, la interfaz se actualiza automáticamente.

## Importante

Para publicar con Firebase CLI:

```bash
firebase login
firebase use panel-de-control-para-py-b91d2
firebase deploy
```

Las reglas actuales permiten leer y escribir sin autenticación y son apropiadas solo para una demo/práctica. Para una aplicación real conviene usar Firebase Authentication y reglas con `request.auth != null`.
