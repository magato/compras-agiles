# Compras Ágiles · Mercado Público (versión gratis en GitHub)

Buscador de **Compras Ágiles abiertas**, con avisos por **email, WhatsApp o Telegram** cuando un organismo le emite a tu empresa una **orden de compra de Compra Ágil**.

**No necesitas servidor y no pagas nada.** Todo corre en GitHub:

| Pieza | Qué hace | Costo |
|---|---|---|
| **GitHub Actions** | Cada 15 minutos descarga las Compras Ágiles, revisa tus órdenes de compra y envía los avisos | Gratis en repositorios públicos |
| **GitHub Pages** | Publica el sitio, por ejemplo en `https://magato.github.io/compras-agiles/` | Gratis en repositorios públicos |
| **Gmail** | Email | Gratis |
| **CallMeBot** | WhatsApp a tu propio número (uso personal) | Gratis |
| **Telegram** (opcional) | Mensaje a tu Telegram | Gratis |

> El repositorio debe ser **público** para que todo sea gratis. Tus claves (ticket, contraseña de Gmail, etc.) van en **Secrets**, que son privados y no se ven aunque el repositorio sea público. Ver la sección "Privacidad" más abajo.

---

## Puesta en marcha (una sola vez, unos 20 minutos)

### 1. Crea el repositorio
1. En GitHub: **New repository**.
2. Nombre: `compras-agiles`. Visibilidad: **Public**.
3. Sube todos los archivos de esta carpeta con **Add file → Upload files**: arrastra el contenido de la carpeta y luego haz clic en **Commit changes**.
   - ⚠️ La carpeta `.github` está oculta en Mac y Windows y a veces no se sube al arrastrar. Revisa que exista `.github/workflows/actualizar.yml` en el repositorio. Si no está, créala con **Add file → Create new file**: escribe `.github/workflows/actualizar.yml` como nombre y pega el contenido del archivo.

### 2. Activa GitHub Pages
**Settings → Pages → Build and deployment → Source: "GitHub Actions"**.

### 3. Guarda tus datos como *Secrets*
Ve a **Settings → Secrets and variables → Actions → New repository secret** y crea los secrets que vayas a usar:

| Secret | Valor | ¿Obligatorio? |
|---|---|---|
| `MP_TICKET` | Tu ticket de la API de Mercado Público | Sí |
| `MP_RUT_PROVEEDOR` | RUT de tu empresa, con o sin puntos, ej. `76.123.456-7` | Sí, para recibir avisos de OCs |
| `MP_CODIGO_PROVEEDOR` | Código de proveedor en Mercado Público. Solo hace falta si la búsqueda por RUT no encuentra tu empresa | Opcional |
| `SMTP_USER` | Tu correo Gmail | Para email |
| `SMTP_PASS` | **Contraseña de aplicación** de Gmail (ver paso 4) | Para email |
| `MAIL_TO` | Correo(s) que reciben el aviso, separados por coma | Para email |
| `CALLMEBOT` | `+56912345678:APIKEY` (ver paso 5) | Para WhatsApp |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Ver paso 6 | Opcional |

### 4. Email con Gmail (gratis)
1. Activa la **verificación en 2 pasos** en tu cuenta de Google.
2. Entra a https://myaccount.google.com/apppasswords y crea una contraseña llamada "Compras Ágiles".
3. Copia las 16 letras en el secret `SMTP_PASS`.

### 5. WhatsApp con CallMeBot (gratis, a tu propio número)
1. Agrega a tus contactos el número del bot que indica https://www.callmebot.com/blog/free-api-whatsapp-messages/.
2. Envíale por WhatsApp el mensaje: `I allow callmebot to send me messages`.
3. El bot te responde con tu **APIKEY**.
4. Crea el secret `CALLMEBOT` con el valor `+569XXXXXXXX:APIKEY`. Si quieres avisar a varias personas, cada una debe activar su propia APIKEY. Pon una por línea.

> CallMeBot es un servicio gratuito para uso personal: solo envía mensajes al número que lo activó. A veces se demora unos segundos o se cae. Por eso conviene activar también el email.

### 6. Telegram (opcional, gratis y muy confiable)
1. En Telegram, escribe a **@BotFather**, envía `/newbot` y sigue los pasos. Te entrega un **token**: guárdalo en `TELEGRAM_BOT_TOKEN`.
2. Escríbele cualquier mensaje a tu bot nuevo.
3. Abre `https://api.telegram.org/bot<TOKEN>/getUpdates` y copia el número que aparece en `"chat":{"id": ...}`. Guárdalo en `TELEGRAM_CHAT_ID`.

### 7. Primera ejecución y mensaje de prueba
1. Pestaña **Actions**. Si GitHub lo pide, haz clic en *I understand… enable them*.
2. Elige **Actualizar Compras Ágiles → Run workflow**, marca **"Enviar un mensaje de prueba"** y luego haz clic en **Run workflow**.
3. Cuando termine (entre 10 y 20 minutos la primera vez), deberías tener el mensaje de prueba y el sitio en:
   **`https://<tu-usuario>.github.io/compras-agiles/`**

A partir de ese momento se actualiza solo cada 15 minutos. Puedes agregar un link al buscador desde tu sitio actual (magato.github.io).

---

## Cómo funciona

- **Cada 15 minutos**, GitHub ejecuta `src/run.js`, que hace tres cosas:
  1. Revisa las OCs emitidas a tu RUT (hoy y ayer) y avisa las **nuevas de Compra Ágil**. Son las de tipo AG, cuyo código termina en `-AG26`.
  2. Actualiza la lista de Compras Ágiles abiertas. Una vez al día hace una descarga completa región por región; en el resto de las ejecuciones pide solo los cambios.
  3. Genera `public/data/*.json` y publica el sitio.
- **Memoria entre ejecuciones:** se guarda en la rama `estado` del repositorio, que siempre tiene un único commit para no acumular historial.
- **Sitio:** es una página estática. Los filtros (fechas, presupuesto, sector, región, llamado y palabras clave) se aplican en tu navegador, así que son instantáneos.
- **Detalle de cada compra** (descripción y productos): se descarga de a poco (40 por ejecución, máximo 2.500 al día) para cuidar la cuota de **10.000 llamadas diarias** del ticket.
- **Avisos que fallan:** si ningún canal logra enviar el aviso de una OC, se reintenta en las siguientes ejecuciones, hasta 5 veces.
- **Ticket inválido:** la ejecución queda marcada en rojo y GitHub te avisa por email.

### Ajustes opcionales (Settings → Secrets and variables → Actions → pestaña *Variables*)
| Variable | Efecto |
|---|---|
| `OC_SOLO_COMPRA_AGIL` = `0` | Avisar todas tus OCs, no solo las de Compra Ágil |
| `CA_URL_FICHA` | Cambiar el formato del link a la ficha de cada Compra Ágil (`{codigo}` se reemplaza) |

Para cambiar la frecuencia, edita la línea `cron` de `.github/workflows/actualizar.yml`.

---

## Limitaciones de la versión gratuita

- **Retrasos:** GitHub no garantiza la hora exacta de las ejecuciones programadas. Con carga alta pueden atrasarse entre 5 y 30 minutos, y muy de vez en cuando saltarse una. Para avisos de OCs esto es normalmente suficiente.
- **Inactividad:** GitHub **desactiva las ejecuciones programadas si el repositorio pasa 60 días sin actividad**, y avisa por email antes de hacerlo. Si te pasa, entra a **Actions → Actualizar Compras Ágiles → Enable workflow**. También lo evitas editando cualquier archivo (por ejemplo, este README) una vez al mes.
- **"Actualizar ahora"** en el sitio abre la página del workflow en GitHub. Para ejecutarlo debes tener tu sesión de GitHub iniciada.

## Privacidad

- El **código** y los **datos de Compras Ágiles** son públicos, igual que en Mercado Público.
- Los **Secrets** (ticket, contraseñas, APIKEY, teléfono) **nunca** se publican.
- En la rama `estado` solo se guarda el **código** de cada OC detectada y si se avisó. No se guardan montos ni compradores. Igual considera que las OCs de cualquier proveedor son información pública en Mercado Público.

## Probar en tu computador (opcional)

```bash
npm install
npm run mock                       # API simulada en otra terminal
MP_BASE_URL=http://localhost:4999/v1 MP2_BASE_URL=http://localhost:4999 MP_TICKET=demo \
  MP_RUT_PROVEEDOR=1-9 NOTIFY_DRY_RUN=1 npm run actualizar
npm run ver                        # abre http://localhost:8080
```

## Archivos

```
.github/workflows/actualizar.yml  Tarea programada (cada 15 min) y publicación en Pages
src/run.js         Una ejecución: OCs + Compras Ágiles + publicación
src/mp.js          Clientes de las APIs de Mercado Público (v1 OCs, v2 Compra Ágil)
src/sync.js        Descarga completa/incremental de Compras Ágiles y detalle
src/monitor.js     Detección de OCs nuevas de Compra Ágil y reintentos de aviso
src/notify.js      Email (Gmail), WhatsApp (CallMeBot) y Telegram
src/sectores.js    Reglas de clasificación por sector (edítalas a tu rubro)
src/publicar.js    Genera public/data/*.json para el sitio
public/index.html  El sitio (estático)
mock/mock-mp.js    API simulada para pruebas
```
