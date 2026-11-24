# Compras Ágiles · Mercado Público (versión gratis en GitHub)

Buscador de **Compras Ágiles abiertas** y de las **órdenes de compra de tu empresa**, protegido con **usuario y clave**, con avisos por **email, WhatsApp o Telegram** cuando un organismo le emite a tu empresa una **orden de compra de Compra Ágil**.

**No necesitas servidor y no pagas nada.** Todo corre en GitHub:

| Pieza | Qué hace | Costo |
|---|---|---|
| **GitHub Actions** | Cada 15 minutos descarga las Compras Ágiles, revisa tus órdenes de compra y envía los avisos | Gratis en repositorios públicos |
| **GitHub Pages** | Publica el sitio, por ejemplo en `https://magato.github.io/compras-agiles/` | Gratis en repositorios públicos |
| **Gmail** | Email | Gratis |
| **CallMeBot** | WhatsApp a tu propio número (uso personal) | Gratis |
| **Telegram** (opcional) | Mensaje a tu Telegram | Gratis |

> El repositorio debe ser **público** para que todo sea gratis. Tus claves (ticket, contraseña de Gmail, etc.) van en **Secrets**, que son privados y no se ven aunque el repositorio sea público. Los **datos** del sitio se publican **cifrados**: solo se pueden leer ingresando con un usuario y clave válidos. Ver la sección "Seguridad y privacidad" más abajo.

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
| `SITE_USUARIOS` | Usuarios y claves para entrar al sitio, uno por línea: `usuario:clave` (ver paso 3b) | **Sí** (sin esto el sitio no muestra datos) |
| `MP_TICKET` | Tu ticket de la API de Mercado Público | Sí |
| `MP_RUT_PROVEEDOR` | RUT de tu empresa, con o sin puntos, ej. `76.123.456-7` | Sí, para recibir avisos de OCs |
| `MP_CODIGO_PROVEEDOR` | Código de proveedor en Mercado Público. Solo hace falta si la búsqueda por RUT no encuentra tu empresa | Opcional |
| `SMTP_USER` | Tu correo Gmail | Para email |
| `SMTP_PASS` | **Contraseña de aplicación** de Gmail (ver paso 4) | Para email |
| `MAIL_TO` | Correo(s) que reciben el aviso, separados por coma | Para email |
| `CALLMEBOT` | `+56912345678:APIKEY` (ver paso 5) | Para WhatsApp |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Ver paso 6 | Opcional |
| `GH_DISPARO_TOKEN` | Permiso para que el botón **Actualizar ahora** funcione con un clic (ver paso 6b) | Recomendado |

### 3b. Usuarios y claves de acceso al sitio
Crea el secret `SITE_USUARIOS` con **una línea por persona**, en el formato `usuario:clave`:
```
manuel:Una-Clave-Larga-2026
socio:Otra-Clave-Distinta-99
```
- El usuario no distingue mayúsculas; la clave sí.
- **Usa claves de al menos 12 caracteres** (letras, números y símbolos). Los datos cifrados son públicos, así que una clave corta podría adivinarse probando muchas combinaciones.
- **Agregar o quitar personas, o cambiar una clave:** edita el secret (lápiz → *Update secret*). El cambio rige desde la siguiente actualización (máximo 15 minutos). Al cambiar las claves, todas las sesiones abiertas se cierran y cada persona debe volver a ingresar.
- "Recordarme en este equipo" mantiene la sesión abierta en ese navegador hasta que se presione **Salir**. Úsalo solo en equipos personales.

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

### 6b. Botón "Actualizar ahora" con un solo clic (recomendado, gratis)
Sin este permiso, el botón abre GitHub y tienes que presionar *Run workflow*. Con él, la plataforma lanza la actualización sola, muestra el avance y recarga el listado al terminar (1 a 3 minutos).

1. En GitHub, haz clic en tu foto (arriba a la derecha) → **Settings** → **Developer settings** (al final del menú izquierdo) → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Completa:
   - **Token name:** `Compras Ágiles - botón actualizar`
   - **Expiration:** la duración más larga que ofrezca (o *No expiration*, si aparece).
   - **Repository access:** **Only select repositories** → elige `compras-agiles`.
   - **Permissions → Repository permissions → Actions:** **Read and write**. No marques nada más.
3. Haz clic en **Generate token** y copia el texto que empieza con `github_pat_` (solo se muestra una vez).
4. Crea el secret `GH_DISPARO_TOKEN` con ese texto.

El permiso se publica **cifrado** junto con los datos: solo lo pueden usar las personas que ingresan con usuario y clave, y solo sirve para lanzar actualizaciones de este repositorio. Cuando venza, el botón vuelve a abrir GitHub; crea uno nuevo y actualiza el secret.

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
     Además descarga de a poco el **historial** de órdenes de compra (todos los estados y tipos, 12 días por ejecución, hasta 365 días atrás) y vuelve a consultar cada 6 horas las que todavía pueden cambiar de estado.
  2. Actualiza la lista de Compras Ágiles abiertas. Una vez al día hace una descarga completa región por región; en el resto de las ejecuciones pide solo los cambios.
  3. Genera `public/data/*.json` y publica el sitio.
- **Memoria entre ejecuciones:** se guarda en la rama `estado` del repositorio, que siempre tiene un único commit para no acumular historial.
- **Sitio:** es una página estática con tres secciones:
  - **Compras Ágiles:** filtros por fechas, presupuesto, sector (lista desplegable, con botones **Excluir Salud** y **Excluir palabras vetadas** que se recuerdan entre visitas), región, llamado y palabras clave, con botón **IR** a cada compra.
  - **Órdenes de compra:** todas las OCs de tu empresa, en cualquier estado, con filtros por estado, tipo (Compra Ágil u otras), fecha, monto, comprador, región y texto; totales, detalle de productos y contacto del comprador, botón **IR** y exportación a CSV.
  - **Estado y alertas:** incluye el **monitor de consumo diario de la API**: consultas de hoy, proyección hasta medianoche, promedio de 7 días, gráfico de los últimos 30 días contra el límite de 10.000, y en qué se usan las consultas. Si el límite real de tu ticket fuera otro, configúralo en la variable `LIMITE_DIARIO_API`.
  Los filtros se aplican en tu navegador, así que son instantáneos.
- **Detalle de cada compra** (descripción y productos): se descarga de a poco (40 por ejecución, máximo 2.500 al día) para cuidar la cuota de **10.000 llamadas diarias** del ticket.
- **Actualización en pantalla:** con el sitio abierto, cada 2 minutos se revisa si GitHub publicó datos nuevos y, si los hay, el listado se recarga solo. El botón **Actualizar ahora** lanza una actualización rápida en el momento (solo cambios recientes y órdenes de compra nuevas, sin la descarga completa diaria).
- **Límite de tiempo:** cada ejecución tiene un máximo de 25 minutos (6 en la actualización rápida del botón). Si la API de Mercado Público está lenta, la ejecución guarda y publica lo avanzado, y lo pendiente sigue en la siguiente. Así nunca se pierde una ejecución completa por demoras de la API.
- **Historial de órdenes resistente a errores:** si Mercado Público falla en un día puntual, se reintenta en 3 ejecuciones y luego se salta, sin detener el resto del historial.
- **Filtros de fecha:** se escriben en formato chileno `dd/mm/aaaa` (o se eligen con el ícono de calendario). Si "Desde" es posterior a "Hasta", se invierten y se avisa. Las fechas no se recuerdan entre visitas; los demás filtros sí. Los filtros activos se muestran sobre los resultados y se quitan con ✕.
- **Avisos que fallan:** si ningún canal logra enviar el aviso de una OC, se reintenta en las siguientes ejecuciones, hasta 5 veces.
- **Ticket inválido:** la ejecución queda marcada en rojo y GitHub te avisa por email.

### Ajustes opcionales (Settings → Secrets and variables → Actions → pestaña *Variables*)
| Variable | Efecto |
|---|---|
| `OC_SOLO_COMPRA_AGIL` = `0` | Avisar todas tus OCs, no solo las de Compra Ágil |
| `DIAS_HISTORIAL_OC` | Cuántos días hacia atrás guardar en la sección Órdenes de compra (por defecto 365) |
| `EXCLUIR_PALABRAS` | Palabras del botón **Excluir palabras vetadas** de la sección Compras Ágiles, separadas por coma (sin importar mayúsculas ni acentos). Si no la creas, se usa la lista de `src/exclusiones.js`. Con el valor `-` el botón desaparece |
| `CA_URL_FICHA` | Cambiar el formato del link a la ficha de cada Compra Ágil (`{codigo}` se reemplaza) |

Para cambiar la frecuencia, edita la línea `cron` de `.github/workflows/actualizar.yml`.

---

## Limitaciones de la versión gratuita

- **Retrasos:** GitHub no garantiza la hora exacta de las ejecuciones programadas. Con carga alta pueden atrasarse entre 5 y 30 minutos, y muy de vez en cuando saltarse una. Para avisos de OCs esto es normalmente suficiente.
- **Inactividad:** GitHub **desactiva las ejecuciones programadas si el repositorio pasa 60 días sin actividad**, y avisa por email antes de hacerlo. Si te pasa, entra a **Actions → Actualizar Compras Ágiles → Enable workflow**. También lo evitas editando cualquier archivo (por ejemplo, este README) una vez al mes.
- **"Actualizar ahora"** sin el secret `GH_DISPARO_TOKEN` abre la página del workflow en GitHub (hay que presionar *Run workflow* con tu sesión iniciada). Con el secret, funciona con un clic (paso 6b).

## Seguridad y privacidad

- **Datos del sitio cifrados:** las Compras Ágiles, las órdenes de compra y el estado se publican cifrados (AES-256). El navegador solo los descifra después de ingresar con un usuario y clave de `SITE_USUARIOS`. Quien abra los archivos sin clave solo ve texto ilegible.
- **Memoria interna cifrada:** la rama `estado` del repositorio guarda un archivo cifrado (`db.enc`) con una llave derivada de tu ticket. Si cambias el ticket, el sistema parte de cero: vuelve a descargar todo sin enviar avisos repetidos.
- **Secrets** (ticket, contraseñas, APIKEY, usuarios) **nunca** se publican. La única excepción es `GH_DISPARO_TOKEN`, que se publica **cifrado** para que el botón funcione: solo lo pueden usar quienes ingresan con clave, y solo permite lanzar actualizaciones.
- **Lo que sí es público:** el **código** del sitio (es un repositorio público) y el archivo `acceso.json`, que contiene la llave de los datos protegida con la clave de cada usuario. No contiene los nombres de usuario ni las claves.
- **Importante:** la protección depende de que las claves sean largas y difíciles de adivinar.

## Probar en tu computador (opcional)

```bash
npm install
npm run mock                       # API simulada en otra terminal
MP_BASE_URL=http://localhost:4999/v1 MP2_BASE_URL=http://localhost:4999 MP_TICKET=demo \
  MP_RUT_PROVEEDOR=1.111.111-1 SITE_USUARIOS='prueba:clave-de-prueba' NOTIFY_DRY_RUN=1 npm run actualizar
npm run ver                        # abre http://localhost:8080
```

## Archivos

```
.github/workflows/actualizar.yml  Tarea programada (cada 15 min) y publicación en Pages
src/run.js         Una ejecución: OCs + Compras Ágiles + publicación
src/mp.js          Clientes de las APIs de Mercado Público (v1 OCs, v2 Compra Ágil)
src/sync.js        Descarga completa/incremental de Compras Ágiles y detalle
src/monitor.js     OCs: avisos de nuevas de Compra Ágil, historial y seguimiento de estados
src/notify.js      Email (Gmail), WhatsApp (CallMeBot) y Telegram
src/cifrado.js     Cifrado de los datos y llaves de acceso de cada usuario
src/exclusiones.js Palabras vetadas (botón "Excluir palabras vetadas")
src/sectores.js    Reglas de clasificación por sector (edítalas a tu rubro)
src/publicar.js    Genera los datos cifrados del sitio (public/data/)
public/index.html  El sitio (estático)
mock/mock-mp.js    API simulada para pruebas
```
