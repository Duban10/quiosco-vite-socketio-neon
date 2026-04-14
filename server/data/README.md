# Datos de Prueba del Restaurante

Este directorio contiene el archivo `seed-data.json` con datos de prueba realistas para restaurar rápidamente la base de datos.

## Contenido

- **Categories**: 5 categorías (Bebidas, Platos Principales, Postres, Ensaladas, Aperitivos)
- **Products**: 13 productos con precios e imágenes de prueba
- **Users**: 4 usuarios (Admin, 2 Meseros, Cocina)
- **Tables**: 8 mesas del restaurante
- **AppConfig**: Configuración con logo y nombre de empresa
- **Expenses**: 4 gastos de ejemplo

## Cómo usar

### Restaurar le BD con datos de prueba:

```bash
npm run restore
```

Esto hará:
1. Elimina toda la data existente
2. Carga las categorías, productos, usuarios, mesas, config y gastos
3. Muestra un mensaje de éxito o error

### Passwords de prueba:

- **admin** / `admin123` (Rol: ADMIN)
- **mesero1** / `mesero123` (Rol: MESERO)
- **mesero2** / `mesero123` (Rol: MESERO)
- **cocina** / `cocina123` (Rol: COCINA)

## Editar datos de prueba

Puedes editar `seed-data.json` directamente y ejecutar `npm run restore` nuevamente.

⚠️ **Cuidado**: El comando `npm run restore` elimina todos los datos actuales. Asegúrate de haber hecho un backup si necesitas guardar algo.
