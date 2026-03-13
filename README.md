# Calendario emocional

Aplicacion web anual para registrar emociones por dia, guardar notas, filtrar por emociones, exportar el calendario, trabajar offline y sincronizar cambios locales desde SQLite hacia una fuente central en MongoDB.

## Stack

- Astro 6.0.4
- Node.js 24 LTS en runtime de despliegue
- React 19 con integracion oficial `@astrojs/react` 5.0.0
- TypeScript 5.9
- Tailwind CSS 4.2 con `@tailwindcss/vite`
- shadcn/ui manual para Astro
- SQLite local con `better-sqlite3` + Drizzle ORM
- MongoDB como fuente central para sincronizacion entre instancias
- Docker con salida Node standalone de Astro

## Decisiones arquitectonicas

- Astro se mantiene como framework principal con SSR y rutas API. React se usa solo para la isla interactiva del calendario.
- La persistencia queda desacoplada mediante contratos de repositorio en `src/repositories/contracts.ts` y adaptadores SQLite concretos.
- La inicializacion de base de datos aplica migraciones propias y seed de emociones al primer acceso.
- La representacion visual de dias usa color principal consistente para accesibilidad y PDF, pero la UI anual ya renderiza segmentos multicolor reales cuando hay varias emociones.
- La exportacion de imagen y PDF corre solo del lado cliente, aislando librerias browser-only del build SSR.
- El modo offline usa service worker para cache de shell/API GET y una cola local persistente para mutaciones sobre entradas y emociones.
- Backup/restauracion y sincronizacion usan servicios de sistema aislados para no acoplar la UI a operaciones SQLite o al backend central.
- Cada cambio se escribe primero en SQLite y luego se intenta enviar a MongoDB en segundo plano. Si Mongo no esta disponible, la cola local queda pendiente para el siguiente intento.
- La sincronizacion entre instancias usa operaciones incrementales por registro, cursores locales y merge por campo para evitar sobreescrituras de cambios no solapados.

## Estructura

```text
.
├── components.json
├── data/
├── docker-compose.yml
├── Dockerfile
├── drizzle.config.ts
├── public/
├── src/
│   ├── components/
│   │   ├── calendar/
│   │   └── ui/
│   ├── db/
│   │   ├── migrations/
│   │   ├── client.ts
│   │   ├── migrate.ts
│   │   ├── migrations.ts
│   │   ├── schema.ts
│   │   └── seed.ts
│   ├── features/
│   │   ├── emotions/
│   │   └── entries/
│   ├── hooks/
│   ├── layouts/
│   ├── lib/
│   ├── pages/
│   │   ├── api/
│   │   └── index.astro
│   ├── repositories/
│   ├── services/
│   ├── styles/
│   ├── types/
│   └── utils/
├── package.json
└── tsconfig.json
```

## Instalacion local

```bash
npm install
Copy-Item .env.example .env
```

## Variables de entorno

- Variables usadas por la aplicacion:
	`DATABASE_PATH`: ruta base del archivo SQLite. Por defecto `./data/emotional-calendar.sqlite`.
	`MONGODB_URI`: cadena de conexion al Mongo central. Si no se define, la app sigue funcionando solo con SQLite local.
	`MONGODB_DB_NAME`: nombre de la base en Mongo. Valor por defecto: `emotional-calendar`.
	`MONGODB_COLLECTION_PREFIX`: prefijo para las colecciones de sync. Valor por defecto: `emotional_calendar`.
	`DISABLE_AUTO_MONGO_SYNC`: si vale `1`, desactiva el envio automatico a Mongo tras cada escritura local y deja solo la sincronizacion manual.
	`INSTANCE_ID`: identificador estable opcional para la instancia local de sincronizacion. Si no se define, la app genera uno y lo persiste en SQLite.
	`MAX_SQLITE_BACKUP_UPLOAD_BYTES`: limite maximo para restauraciones de backup SQLite subidas por la interfaz. Por defecto `10485760` (10 MB).

- Variables para autenticacion con Clerk:
	`PUBLIC_CLERK_PUBLISHABLE_KEY`
	`CLERK_SECRET_KEY`

- Variables para sincronizacion remota entre instancias:
	`SYNC_REMOTE_URL`: URL base de otra instancia para intercambio remoto de snapshots y cambios incrementales protegidos por token.
	`SYNC_SHARED_TOKEN`: token compartido para autorizar las rutas remotas de snapshot y cambios incrementales.

- Variables de proceso o despliegue:
	`HOST`: host del servidor Astro o del runtime Node.
	`PORT`: puerto del servidor.
	`APP_BIND_ADDRESS`: solo usada por `docker-compose.yml` para decidir en qué interfaz del host publicar el puerto de la app.
	`APP_PORT`: solo usada por `docker-compose.yml` para decidir qué puerto del host expone la app.

- Variables solo para test:
	`TEST_USER_ID`: fallback de usuario usado solo en modo test cuando no hay `locals.auth`.

## Ejecutar en local

```bash
npm run dev -- --host 127.0.0.1 --port 4321
```

Abrir `http://127.0.0.1:4321`.

## Validaciones disponibles

```bash
npm test
npm run check
npm run lint
npm run build
```

`npm test` cubre repositorios, servicios, rutas API, restauracion de backup y cola offline en entorno navegador simulado.

## Ejecutar con Docker

```bash
docker compose up --build
```

La aplicacion quedara disponible en `http://localhost:4321`, SQLite persistira en el volumen `calendario_emocional_data` y MongoDB en `calendario_emocional_mongo`.

## Despliegue en VPS con Docker

La configuracion Docker esta orientada a un VPS con una sola instancia de aplicacion:

- La imagen usa `node:24-trixie-slim` tanto para build como para runtime para reducir la superficie base del contenedor.
- El contenedor arranca directamente con `node dist/server/entry.mjs`.
- El runtime corre como usuario `node`, no como root.
- SQLite persiste en un volumen Docker montado en `/app/data`.
- Mongo queda en la red interna de Compose y no publica `27017` hacia fuera por defecto.
- El build no copia `.env` al contexto de Docker; las variables deben inyectarse en runtime.

Variables minimas recomendadas para el VPS:

- `PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `MONGODB_URI` si no usaras el servicio `mongo` del propio compose
- `MONGODB_DB_NAME`
- `MONGODB_COLLECTION_PREFIX`
- `APP_BIND_ADDRESS` si quieres limitar el puerto publicado solo a `127.0.0.1`
- `APP_PORT` si quieres publicar un puerto distinto en el host

Flujo sugerido:

```bash
cp .env.example .env
docker compose build
docker compose up -d
```

Si usas un proxy inverso como Nginx o Caddy, conviene publicar la app en un puerto interno del VPS y dejar TLS/hostname en el proxy.

La configuracion Vite/Astro ahora permite hosts reenviados por proxy inverso, asi que puedes entrar con tu dominio real sin tener que mantener un compose alternativo solo para el proxy.

## Base de datos

- Escritura local: SQLite.
- Fuente central compartida: MongoDB cuando `MONGODB_URI` esta configurada.
- Archivo local por defecto: `data/emotional-calendar.sqlite`.
- La app crea directorios, esquema y seed inicial automaticamente al iniciar.
- Las migraciones viven en `src/db/migrations.ts` y se aplican de forma incremental usando la tabla `_migrations`.
- Las emociones base tienen `syncId` estable (`system-<slug>`) para que varias instancias converjan sobre los mismos identificadores logicos.

## Flujo de sincronizacion

1. La UI crea o edita una emocion o entrada.
2. El cambio se guarda primero en SQLite y se registra en `sync_operations` con timestamps por campo.
3. La app intenta enviar la cola pendiente a Mongo inmediatamente.
4. Otra instancia puede traer operaciones remotas, aplicarlas sobre su SQLite local y mostrar diagnostico de cursores, pendientes y ultimos cambios aplicados.
5. Los conflictos se resuelven por campo usando el timestamp mas reciente de cada propiedad, no por sobreescritura del registro completo.

## Agregar nuevas emociones

- Desde la interfaz: abrir `Gestionar emociones`, indicar nombre y color, y guardar.
- Desde seed base: editar `src/db/seed.ts` si quieres que aparezcan por defecto en nuevas bases.

## Exportacion

- Imagen: genera un PNG del calendario anual usando una vista oculta especifica para exportacion.
- PDF: incluye encabezado, calendario anual y tabla paginada con fecha, emociones, color principal y nota.
- La libreria PDF se carga de forma diferida solo al exportar para reducir el peso del bundle inicial.
- Backup SQLite: descarga una copia consistente del archivo SQLite activo y permite restaurarla desde la UI.

## Offline, PWA y sincronizacion

- La app publica un `manifest.webmanifest` y registra `public/sw.js` para funcionar como PWA instalable.
- El manifest declara iconos dedicados para instalacion (`192`, `512` y `maskable` en SVG), accesos rapidos y metadatos de instalacion para escritorio y Android.
- Las respuestas `GET` del shell y de las APIs de calendario/emociones/estadisticas quedan cacheadas para reutilizacion offline.
- Las navegaciones HTML tienen fallback a `public/offline.html` cuando no hay red y la ruta no esta disponible en cache.
- Las operaciones de crear/editar/eliminar entradas y emociones se guardan en una cola local si no hay red y se sincronizan al reconectar.
- Si `MONGODB_URI` esta configurada, cada instancia usa MongoDB como fuente central y SQLite como cache editable local-first.
- Los borrados se propagan con tombstones en SQLite y la resolucion de conflictos hace merge por campo usando timestamps independientes.
- La barra de herramientas expone diagnostico de sincronizacion: instance id, operaciones pendientes, cursores push/pull y cantidad de cambios aplicados.

## Estadisticas y tendencias

- El panel mensual resume dias registrados, dias con nota, promedio de emociones por dia, emocion dominante y variacion respecto al mes previo.
- El calendario anual muestra representacion multicolor real por dia cuando un registro contiene varias emociones.

## Compatibilidad de dependencias

- Astro 6 requiere usar Tailwind 4 mediante `@tailwindcss/vite`, no `@astrojs/tailwind`.
- `@astrojs/react` 5.0.0 es compatible con React 19.
- shadcn/ui no se inicializa con plantilla especifica para Astro; se configuro en modo manual usando Tailwind 4, aliases TS y componentes `ui/` locales.
- Para evitar friccion con `better-sqlite3` en contenedor se usa `node:24-trixie-slim` en lugar de Alpine.

## Limitaciones actuales

- La exportacion depende de capacidades del navegador para renderizado cliente.
- El cambio de ano visible requiere conexion; offline se conserva el ultimo ano cacheado y la cola local del usuario.
- Mongo sigue siendo opcional; si no se configura, no hay convergencia entre varias instancias.
- Las emociones base marcadas como `isSystem` no se eliminan desde la interfaz; se pueden desactivar.
- La instalacion PWA en iOS sigue siendo mas limitada que en Android/escritorio porque Safari aplica criterios propios sobre iconos y pantalla de inicio.
- Si escalas a varias instancias del contenedor, cada instancia tendra su propio volumen SQLite local; esta arquitectura esta pensada para una sola instancia por despliegue VPS.

## Mejoras futuras recomendadas

1. Extender la autenticacion actual con perfiles, roles o preferencias persistentes si el producto necesita gestion mas rica por usuario.
2. Persistir y visualizar un historial completo de operaciones aplicadas para auditoria.
3. Añadir mas tests de caos para reconexiones largas, colas grandes y restauraciones de backups con instancias concurrentes.
4. Evaluar CRDT si aparecen ediciones concurrentes del mismo campo con mayor frecuencia.
