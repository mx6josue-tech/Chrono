# Chrono — Stopwatch PWA

Cronómetro de pantalla completa para iPad Air 11" M4. Diseñado para modo horizontal, instalable como PWA desde Safari.

## Características

- Pantalla completa en modo landscape con números neón gigantes
- Formato HH:MM:SS con sincronización exacta (basado en `Date.now()`)
- Wake Lock: la pantalla no se apaga mientras el cronómetro está corriendo
- Funciona offline: service worker cachea todos los assets
- Imagen de fondo personalizable (PNG, JPG, WebP, GIF, máx. 5 MB)
- 6 colores neón predefinidos + selector de color personalizado
- Control de brillo simulado por CSS
- Doble tap en el cronómetro para reiniciar (con confirmación)
- Haptic feedback en pausa/reanudación

## Instalación en iPad

1. Abrir en Safari
2. Compartir → **Agregar a pantalla de inicio**
3. Rotar el iPad a modo horizontal

## Archivos

```
index.html   — Estructura HTML
style.css    — Estilos y animaciones
app.js       — Lógica de la aplicación
manifest.json — Configuración PWA
sw.js        — Service worker (cache offline + generación de iconos)
```

## Seguridad

- Sin dependencias externas — Vanilla JS puro
- Sin llamadas a APIs externas — todo es local
- Validación de tipo MIME en subida de imágenes (PNG, JPG, WebP, GIF)
- Validación de valores de color (regex hex)
- Content Security Policy habilitada via meta tag
- Todos los datos del usuario permanecen en `localStorage` del dispositivo
- `textContent` en lugar de `innerHTML` en toda la app

### Permisos utilizados

| API | Uso |
|-----|-----|
| `localStorage` | Guardar color, brillo e imagen de fondo |
| `navigator.wakeLock` | Mantener pantalla activa mientras corre el cronómetro |
| `navigator.vibrate` | Retroalimentación háptica al pausar/reanudar |
| `ServiceWorker` | Cache offline y generación de iconos |

## Licencia

MIT License — Copyright (c) 2026 Gandalf

Ver archivo [LICENSE](LICENSE) para más detalles.
