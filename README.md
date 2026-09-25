GenalSAT - MVP (HTML/JS)

Descripción
-----------
Aplicación cliente único (SPA) para la gestión de una empresa de reparaciones electrónicas.
Guarda los datos por usuario en Firebase Firestore y requiere iniciar sesión con Google.

Configuración de Firebase
-------------------------
1. En Firebase Console, activa **Authentication > Sign-in method > Google**.
2. Añade los dominios desde los que se servirá la aplicación en **Authentication > Settings > Authorized domains**.
3. Publica las reglas de [firestore.rules](./firestore.rules) en **Firestore Database > Rules**.
4. Sirve la aplicación mediante HTTP/HTTPS. Firebase Authentication y el service worker no funcionan correctamente abriendo `index.html` directamente con `file://`.
5. La configuración pública del proyecto está incluida en [db.js](./db.js). La API key web de Firebase no es un secreto; la protección real la proporcionan Authentication y las reglas de Firestore.

Configuración de Google Drive
-----------------------------
Las fotos y vídeos adjuntos se suben a Google Drive dentro de la carpeta `WEB`; Firestore guarda únicamente el identificador, nombre, tipo y enlace del archivo. La aplicación conserva el token de Drive en memoria durante la sesión para no volver a pedir la cuenta en cada subida o eliminación.
1. En Google Cloud Console, selecciona el proyecto `genalsat-13` y activa **Google Drive API** en **APIs y servicios > Biblioteca**.
2. En **APIs y servicios > Pantalla de consentimiento de OAuth**, configura la aplicación y añade tu cuenta como usuario de prueba si la aplicación está en modo de pruebas.
3. En **APIs y servicios > Credenciales**, abre el cliente OAuth web cuyo ID termina en `apps.googleusercontent.com`.
4. Añade como **Orígenes de JavaScript autorizados** el origen de GitHub Pages, por ejemplo `https://TU_USUARIO.github.io`, sin la ruta del repositorio.
5. La aplicación solicita el alcance reducido `https://www.googleapis.com/auth/drive.file`. Vuelve a cargar la aplicación, inicia sesión con Google y concede este permiso una sola vez. Este alcance permite gestionar los archivos creados por la aplicación sin conceder acceso completo a todo Drive.
6. Si no encuentra una carpeta llamada `WEB`, crea una automáticamente y la usa para las siguientes subidas.

La aplicación usa las colecciones `users/{uid}/products`, `clients`, `parts`, `budgets`, `invoices`, `settings`, `moves` y `appointments`. Cada usuario solo puede leer y modificar sus propias colecciones según las reglas incluidas.

Seguridad y límites
-------------------
- Publica siempre [firestore.rules](./firestore.rules) después de modificarlo. Las reglas rechazan usuarios no autenticados, aíslan cada usuario en su propio `uid`, limitan las colecciones permitidas y rechazan documentos con más de 100 campos.
- Los adjuntos permitidos son JPG, PNG, WebP, MP4 y WebM. Las imágenes están limitadas a 10 MB y los vídeos a 100 MB; también se comprueba la firma binaria del archivo.
- Las importaciones JSON están limitadas a 20 MB, deben contener un objeto y no pueden superar 10.000 registros por colección.
- Tras cambiar el alcance de Drive puede ser necesario volver a autorizar Google Drive. Revisa en Google Cloud Console los dominios autorizados y considera activar Firebase App Check antes de abrir el servicio a más usuarios.
- El service worker solo cachea recursos locales de la aplicación. Las respuestas de Firebase, Google y Drive se solicitan siempre a la red y no se guardan en la caché local.
- GitHub Pages no permite configurar cabeceras HTTP personalizadas desde este repositorio. Para aplicar `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors` y HSTS como cabeceras reales, publica el sitio detrás de un CDN o proxy que permita configurarlas.

Funcionalidades incluidas en esta entrega (MVP):
- Gestión de stock: añadir, editar cantidad, eliminar productos. La tabla incluye el tipo de producto y el buscador permite localizar por código, nombre o tipo.
- Informes de trabajo: informes numerados de reparación con cliente, equipo (marca, modelo y número de serie), problema comunicado, trabajos realizados y piezas utilizadas. Incluyen vista previa y exportación a PDF.
- Clientes: pestaña independiente con buscadores separados por nombre/apellidos, DNI/NIF, teléfono y localidad. La tabla muestra también la fecha de alta. Al pulsar una fila se abre una ventana flotante con todos los datos del cliente, su fecha de alta, sus partes y presupuestos vinculados, y un botón Editar; las acciones de editar y eliminar también están disponibles en la tabla. Al pulsar un parte o presupuesto relacionado, se cambia a su pestaña correspondiente y se abre automáticamente su vista previa.
- Ajustes: moneda (EUR por defecto), IVA por defecto (21%), datos de empresa y logo organizados en secciones desplegables.
- Exportar/Importar JSON para copia de seguridad/restauración.
- PWA instalable y adaptada a móvil: navegación inferior táctil, formularios optimizados para pantallas pequeñas y soporte de caché de la aplicación.
- No se crean datos de ejemplo: productos y clientes empiezan vacíos.

Archivos
-------
- index.html - interfaz principal
- styles.css - estilos básicos
- db.js - autenticación Firebase y capa de persistencia Firestore
- firestore.rules - reglas de acceso por usuario
- app.js - lógica de interfaz y operaciones
- manifest.webmanifest - metadatos de instalación de la PWA
- sw.js - caché y funcionamiento básico sin conexión
- icon.svg - icono de la aplicación

Probar localmente
-----------------
1. Servir la carpeta mediante HTTP/HTTPS (por ejemplo, con un servidor estático local) y abrir la URL en un navegador moderno (Chrome/Edge/Firefox). No abrir directamente con `file://`.
2. En "Stock" se pueden consultar los productos, buscar también por tipo y añadir nuevos desde el formulario de movimientos indicando el tipo.
3. En "Partes" se puede crear un informe de trabajo numerado. El campo Nombre del cliente ofrece un desplegable con los clientes existentes y autocompleta sus datos; si el nombre no existe, el cliente se crea automáticamente en Clientes al guardar el informe. También se registran el equipo revisado, el problema, los trabajos realizados, las piezas utilizadas y el estado del parte. Las piezas pueden seleccionarse del stock o escribirse manualmente cuando no existan en el inventario; las piezas manuales no modifican el stock. Las piezas de stock se descuentan por defecto y cada línea permite desmarcar individualmente el descuento.
4. En "Partes", el botón "Nuevo parte" abre el formulario de alta en una ventana flotante grande. El buscador filtra los informes por número, datos del cliente, equipo, problema, trabajos y piezas. La ventana puede cerrarse con "Cancelar" o con el botón de cierre.
5. La pestaña "Partes" muestra inicialmente los informes guardados y dispone de filtros independientes por número, fecha, cliente, marca, modelo, número de serie, problema, trabajos, piezas y estado. Los estados disponibles son "Pte revisión", "Pte de gestion", "Presupuesto enviado", "Pte de piezas", "Pte de recogida", "Presupuesto rechazado" y "Finalizado". La fecha permite elegir entre búsqueda concreta (modo predeterminado) o rango desde/hasta.
6. Los partes se muestran resumidos con número, fecha, cliente, equipo, marca, número de serie y estado. Se pueden desplegar haciendo clic sobre ellos. Las acciones principales aparecen como botones compactos con iconos.
7. Cada parte admite fotos y vídeos adjuntos tanto al crearlo como posteriormente desde su detalle desplegado. Cada archivo dispone de botones para verlo, descargarlo conservando su nombre original o eliminarlo con confirmación. Los adjuntos incluyen un visor con ampliación, reproducción de vídeo, navegación entre archivos y cierre con Escape. Los partes existentes se pueden modificar desde el icono de edición; la edición conserva su número y fecha y permite actualizar sus datos, piezas y archivos adjuntos. En estados "Finalizado" y "Presupuesto rechazado" el parte queda bloqueado; para modificarlo primero hay que cambiar el estado a otro estado no finalizado. Al modificar las piezas o sus casillas de descuento, el inventario se ajusta por la diferencia.
4. En "Ajustes" exportar/importar datos y modificar IVA/moneda.

Siguientes pasos recomendados
----------------------------
- Añadir edición completa de productos (precio, código), validaciones y control de duplicados más robusto.
- Presupuestos y facturas: ya implementados en esta versión con cálculo de IVA, numeración automática y descarga a PDF (html2pdf). Los presupuestos muestran la dirección del cliente separada en dirección, localidad, provincia y código postal; el PDF no incluye la vinculación de factura, que se conserva en la información de la aplicación. No se puede crear una factura sin un presupuesto previo guardado: la factura queda vinculada obligatoriamente al presupuesto, al cliente y, cuando corresponde, al informe de trabajo. Crear una factura desde un parte no muestra ninguna confirmación ni modifica el stock; el inventario se gestiona únicamente al guardar o editar el parte. No se permite crear dos facturas para el mismo informe de trabajo, aunque se intente desde el parte o desde un presupuesto asociado. Al eliminar una factura no emitida ni cobrada se libera el informe de trabajo para poder facturarlo de nuevo. Cada factura dispone de los estados `Marcar emitida` y `Marcar cobrada`; una factura emitida o cobrada no puede eliminarse. Para desmarcar cualquiera de esos estados se solicita confirmación. Las facturas no se pueden modificar. Las facturas incluyen todos los datos disponibles del cliente: nombre, dirección, localidad, provincia, código postal, DNI/NIF, teléfono y email cuando existe. La pestaña Facturas usa filtros por número, cliente y fecha, una tabla homogénea con Presupuestos y acciones compactas de vista previa, emisión, cobro, descarga PDF y eliminación. Los presupuestos creados desde un parte quedan vinculados al parte y al cliente; al volver a pulsar Crear presupuesto se puede modificar el presupuesto existente o crear una nueva versión. Desde la pestaña Presupuestos se pueden modificar directamente y usar la acción Descargar PDF. El editor incluye Imprimir: si aún no se ha guardado, primero solicita guardar el presupuesto o crear uno nuevo y después abre la vista previa imprimible; si no hay cambios, guarda/imprime directamente sin mostrar el aviso. Ahora se pueden configurar los datos de la empresa (nombre, dirección, código postal, población, provincia, CIF/NIF, teléfono, email) y subir un logo en Ajustes, que aparecerán en facturas y presupuestos exportados a PDF.
- Gestión de inventario: la sección de inventario ahora usa un formulario de movimientos (Entrada/Salida). Para añadir un producto nuevo, escribe su Código o Nombre en el formulario de movimiento; si no existe se creará automáticamente al aplicar la entrada/salida. Los productos existentes se pueden modificar mediante una ventana con código, nombre y tipo, validando que el código no esté duplicado. Se registra un historial completo de movimientos en la base de datos (store 'moves'). El precio unitario del producto se calcula como media ponderada en las entradas.
- Relaciones y borrado protegido: los vínculos de partes, presupuestos y facturas cambian a la pestaña correspondiente y abren automáticamente la vista previa del registro. La vista previa ofrece además las acciones disponibles para ese registro (modificar, crear los documentos relacionados, marcar emisión/cobro y exportar/imprimir). No se puede eliminar un parte con presupuestos vinculados ni un presupuesto con facturas vinculadas; al eliminar una factura permitida desaparece su vínculo y se puede crear otra relación.
- Trazabilidad de stock: cada pieza descontada desde un parte crea un movimiento de salida identificado con el número de parte y enlazado a su informe. Si el parte se elimina, las piezas descontadas se reincorporan al stock y se crea un movimiento de entrada independiente con el motivo "devuelto a stock por eliminación de informe"; los movimientos originales no se borran. El historial conserva también una copia del código y nombre del producto para seguir siendo legible aunque el producto se elimine.
- Historial de movimientos: incluye filtros separados por fecha, código, producto, tipo de producto, unidades, origen (stock manual o movimientos desde partes) y Entrada/Salida. En los movimientos de partes solo el número de parte es un enlace al informe. Los movimientos asociados a partes permiten abrir el informe mientras exista.
- Las listas de productos, movimientos, partes, presupuestos, facturas y clientes se muestran en páginas de un máximo de 50 líneas, con navegación entre páginas.
- En Inventario, los productos con unidades disponibles no se pueden eliminar; las acciones de editar y eliminar se muestran como iconos.
- El logo configurado en Ajustes se muestra también en la esquina superior derecha del encabezado principal de la aplicación y se actualiza al guardar los ajustes.
- Los avisos informativos y de validación que anteriormente bloqueaban la pantalla con un botón "Aceptar" se muestran ahora como notificaciones temporales en la esquina superior derecha y desaparecen automáticamente. Las confirmaciones que requieren elegir entre continuar o cancelar se mantienen como confirmaciones.
- Las notificaciones temporales usan verde para operaciones realizadas correctamente y rojo para acciones no permitidas, validaciones o errores.
- Las ventanas flotantes de vista previa de presupuestos y facturas se cierran al pulsar fuera del contenido, conservando abiertas las acciones y enlaces al pulsar dentro.
- Se renovó el diseño general de la SPA con una identidad visual azul profesional, navegación activa destacada, tarjetas con profundidad, tablas legibles, formularios con foco accesible, botones consistentes y mejor adaptación responsive.
- Los informes de trabajo, presupuestos y facturas usan ahora una plantilla documental común para vista previa y PDF: cabecera corporativa, jerarquía tipográfica, secciones diferenciadas, tablas con cabecera y filas alternas, espaciado optimizado y reglas específicas de impresión.
- Los presupuestos creados desde un parte incorporan los trabajos realizados por el técnico; una vez que el parte tiene una factura vinculada, no se permite crear otro presupuesto desde él.
- El número de parte se conserva como referencia en la línea informativa de la factura, pero no se imprime dentro del documento de factura.
- Las eliminaciones de partes, presupuestos y facturas solicitan confirmación mediante ventana flotante, también en las acciones masivas.
- Los diálogos de confirmación de eliminación se muestran como ventanas compactas centradas, sin ocupar el tamaño de los formularios principales.
- La tabla de facturas separa las columnas «Presupuesto vinculado» y «Parte vinculado»; cada número conserva su enlace independiente a la vista correspondiente.
- La casilla «Descontar stock» mantiene la semántica directa: marcada descuenta unidades al guardar o modificar el parte; desmarcada no descuenta y, al modificar una línea previamente descontada, repone correctamente sus unidades.
- Facturación desde partes: la factura utiliza exactamente las líneas, cantidades y precios del presupuesto asociado. Si el parte tiene varios presupuestos, se muestra una ventana para elegir cuál utilizar antes de crear la factura.
- Vista de presupuestos: al pulsar cualquier zona informativa de una fila se abre la vista previa en una ventana flotante. La fila muestra la factura vinculada, su importe y si está pendiente o emitida cuando existe; los botones de acciones siguen funcionando de forma independiente.
- Facturas: el presupuesto vinculado aparece en la línea informativa del listado y se puede abrir desde allí. El número de presupuesto no se incluye dentro del documento de factura ni en su PDF.
- Clientes y ventanas: las acciones de las líneas de clientes usan iconos de editar y eliminar. La ficha extendida del cliente muestra también sus facturas relacionadas, con número, importe y estado, y permite abrirlas. Las ventanas flotantes usan una X en la esquina superior derecha como único control de cierre.
- Listados documentales: partes, presupuestos y facturas permiten ordenar de forma ascendente o descendente mediante el icono de dos flechas. Las filas de los tres listados incluyen selección múltiple para eliminar y descargar; en facturas también se pueden marcar varias como emitidas. Se respetan las restricciones existentes: no se eliminan partes con presupuestos, presupuestos con facturas ni facturas ya emitidas.
- La pestaña activa queda resaltada visualmente y las operaciones correctas muestran una notificación temporal en la esquina superior derecha. Las filas de facturas abren su vista previa al pulsar la información, mientras que sus acciones y vínculos mantienen su comportamiento independiente. con número, importe y estado, y permite abrirlas. Las ventanas flotantes usan una X en la esquina superior derecha como único control de cierre.
- Inventario: el formulario de movimiento se abre mediante el botón "Realizar movimiento" en una ventana a pantalla completa. El listado de productos incluye un buscador por código y nombre.
- Migrar a aplicación de escritorio o móvil: Electron para ejecutable de escritorio, o Capacitor/Ionic para móvil.

Notas técnicas
--------------
- Los datos se almacenan en Firestore bajo `users/{uid}/...`; la aplicación ya no usa IndexedDB.
- Para convertir a multiusuario/servidor, crear una API (Node.js/Express) y sincronizar con una base de datos central (SQLite/Postgres).

Soporte
-------
Si quieres que continúe implementando presupuestos, facturas (PDF) y la numeración automática, dime y lo sigo desarrollando.
