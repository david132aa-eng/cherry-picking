# Cherry Picking — Guía de instalación

## Prerequisitos
- Cuenta Google (la misma que tiene acceso al Sheet de ruteados)
- Cuenta GitHub
- Node.js 18+ instalado

---

## Paso 1 — Crear el proyecto Firebase (5 min)

1. Ve a https://console.firebase.google.com
2. Clic en **Agregar proyecto** → dale el nombre `cherry-picking`
3. Desactiva Google Analytics (no es necesario) → **Crear proyecto**
4. En el menú lateral, clic en **Authentication** → **Comenzar**
5. En la pestaña **Sign-in method**, habilita **Google** → pon tu correo como soporte → **Guardar**
6. En el menú lateral, clic en **Configuración del proyecto** (ícono de engranaje)
7. Baja hasta **Tus apps** → clic en `</>` (web)
8. Registra la app como `cherry-picking` (sin Firebase Hosting)
9. Copia los valores del objeto `firebaseConfig` — los necesitarás en el Paso 3

---

## Paso 2 — Crear el repositorio GitHub (2 min)

1. Ve a https://github.com/new
2. Nombre del repositorio: `cherry-picking`
3. Visibilidad: **Public** (GitHub Pages gratuito requiere repo público)
4. Clic en **Create repository**
5. Clona el repo y copia todos los archivos de esta carpeta dentro:
   ```
   git clone https://github.com/TU_USUARIO/cherry-picking.git
   cd cherry-picking
   # copia aquí todos los archivos del proyecto
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

---

## Paso 3 — Agregar secretos al repositorio (3 min)

En GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Agrega estos 4 secretos (los valores vienen del `firebaseConfig` del Paso 1):

| Nombre del secreto         | Valor                           |
|----------------------------|---------------------------------|
| `VITE_FIREBASE_API_KEY`    | el valor de `apiKey`            |
| `VITE_FIREBASE_AUTH_DOMAIN`| el valor de `authDomain`        |
| `VITE_FIREBASE_PROJECT_ID` | el valor de `projectId`         |
| `VITE_FIREBASE_APP_ID`     | el valor de `appId`             |

---

## Paso 4 — Habilitar GitHub Pages (1 min)

1. En GitHub: **Settings** → **Pages**
2. En **Source**, selecciona **Deploy from a branch**
3. Branch: `gh-pages` / `/ (root)`
4. Clic en **Save**

La URL de la app será: `https://TU_USUARIO.github.io/cherry-picking/`

---

## Paso 5 — Agregar dominio autorizado en Firebase (1 min)

1. En Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Clic en **Add domain**
3. Agrega: `TU_USUARIO.github.io`
4. Clic en **Add**

Esto permite que el login con Google funcione desde GitHub Pages.

---

## Paso 6 — Deploy (automático)

El push al `main` del Paso 2 ya habrá disparado el workflow de GitHub Actions.

- Ve a la pestaña **Actions** en tu repo para ver el progreso
- En ~2 minutos la app estará disponible en tu URL de GitHub Pages

---

## Desarrollo local

```bash
# 1. Instala dependencias
npm install

# 2. Crea el archivo .env (copia desde .env.example y llénalo)
cp .env.example .env
# Edita .env con los valores de tu firebaseConfig

# 3. Inicia el servidor de desarrollo
npm run dev
```

La app estará disponible en http://localhost:5173

---

## Cómo funciona

- **Login**: Sign-in con Google solicita permisos de Google Sheets
- **Carga de ruteados**: Lee la columna E del Sheet "Detalle" al iniciar sesión
- **Escaneo**: Escribe o bipa el ID y presiona Enter
  - Si el ID **NO** está en ruteados → beep corto, registra como `BUFFERED` en el Sheet de salida
  - Si el ID **SÍ** está en ruteados → alarma sonora, modal de bloqueo, registra como `RUTEADO-ALERTA`
- **Sheet de salida**: Se crea automáticamente en tu Google Drive como "Cherry Picking - Buffered" la primera vez
- **Sesiones**: Cada sesión tiene un ID único; el token de Google dura 1 hora, tras lo cual la app pide reconexión

---

## Sheet de salida — columnas

| Timestamp | Shipment ID | Operador | Estado | Sesión |
|-----------|-------------|----------|--------|--------|
| fecha/hora | ID bipeado | email del operador | BUFFERED o RUTEADO-ALERTA | ID de sesión |
