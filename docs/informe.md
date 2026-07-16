# NEXIA-CRM — Informe de Funcionalidades

> CRM autogestionable para WhatsApp Business API  
> Versión del análisis: Julio 2026  
> Cliente objetivo: Empresas Colombianas

---

## Tabla de Contenido

1. [¿Qué es NEXIA-CRM?](#1-qué-es-nexia-crm)
2. [Resumen del Sistema](#2-resumen-del-sistema)
3. [Funcionalidades por Rol](#3-funcionalidades-por-rol)
   - [Owner (Dueño)](#31-owner)
   - [Admin (Administrador)](#32-admin)
   - [Agent (Agente)](#33-agent)
   - [Viewer (Espectador)](#34-viewer)
4. [Funcionalidades Transversales](#4-funcionalidades-transversales)
5. [Módulos del Sistema — Descripción Funcional](#5-módulos-del-sistema)

---

## 1. ¿Qué es NEXIA-CRM?

NEXIA-CRM es un sistema de gestión de relaciones con clientes (CRM) diseñado para empresas que utilizan WhatsApp Business API como su canal principal de comunicación comercial. Está construido como una aplicación web moderna a la que se accede desde cualquier navegador, sin necesidad de instalar software.

El sistema permite a un equipo de ventas y atención al cliente gestionar conversaciones de WhatsApp, administrar contactos, hacer seguimiento de oportunidades de negocio (deals), enviar campañas masivas de mensajes, automatizar procesos comerciales, y construir flujos conversacionales interactivos — todo desde una misma plataforma.

Está diseñado para operar como una solución **mono-empresa** (single-tenant): todos los miembros del equipo comparten la misma base de contactos, conversaciones y datos operativos, con roles y permisos que determinan quién puede ver, crear o configurar cada recurso.

---

## 2. Resumen del Sistema

NEXIA-CRM es un **sistema base funcional** que incluye todo lo necesario para operar desde el día uno: bandeja compartida de WhatsApp, gestión de contactos, pipeline de ventas, campañas de difusión, automatizaciones, flujos conversacionales, asistente IA, panel de rendimiento, y administración de equipo. Está diseñado para **personalizarse y evolucionar** con cada cliente, adaptándose a sus flujos de negocio específicos mediante actualizaciones futuras sin necesidad de partir de cero.

| Aspecto | Descripción |
|---------|-------------|
| **Acceso** | Web responsive, cualquier navegador moderno |
| **Canal principal** | WhatsApp Business API (Meta Cloud API v21) |
| **Idioma** | Español (Colombia) — interfaz, fechas, números y zona horaria |
| **Roles** | 4 niveles: Owner, Admin, Agent, Viewer |
| **Tiempo real** | Las conversaciones, notificaciones y presencia se actualizan al instante |
| **Inteligencia Artificial** | Cíclica AI Plan (incluido), o traiga su propia clave (BYOK) — OpenAI o Anthropic |
| **API pública** | Integración con sistemas externos vía REST API |
| **Automatización** | Reglas automáticas + flujos conversacionales visuales |

---

## 3. Funcionalidades por Rol

### 3.1 Owner

El rol **Owner** tiene control total sobre la cuenta. Puede hacer todo lo que un Admin puede hacer, más las operaciones críticas de propiedad.

#### Gestión de Cuenta

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 1 | **Transferir propiedad de la cuenta** | Ceder la titularidad de la cuenta a otro miembro del equipo. Todas las capacidades del Owner pasan al nuevo propietario. |
| 2 | **Eliminar la cuenta** | Cancelar y eliminar permanentemente la cuenta y todos sus datos asociados (contactos, conversaciones, configuraciones). Operación irreversible. |

---

### 3.2 Admin

El rol **Admin** tiene control total sobre la configuración del sistema y la gestión del equipo. Puede hacer todo lo que un Agent puede hacer, más las tareas administrativas.

#### Gestión del Equipo

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 3 | **Invitar nuevos miembros** | Enviar invitaciones por correo electrónico para que nuevos usuarios se unan al equipo. Se asigna un rol específico al invitado. |
| 4 | **Cambiar rol de miembros** | Ascender o descender a cualquier miembro entre los roles Viewer, Agent y Admin (no puede cambiarse el rol del Owner). |
| 5 | **Remover miembros del equipo** | Eliminar usuarios del equipo. La cuenta del usuario removido se conserva como cuenta personal vacía. |
| 6 | **Ver miembros y su presencia** | Consultar quién está en el equipo, con qué rol y si está actualmente en línea o ausente. |

#### Configuración de WhatsApp

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 7 | **Conectar número de WhatsApp** | Registrar y conectar un número de teléfono empresarial a través de Meta Cloud API. |
| 8 | **Verificar registro** | Confirmar ante Meta que el número está correctamente registrado y los webhooks están suscritos. |
| 9 | **Desconectar número** | Desvincular el número de WhatsApp del sistema. |
| 10 | **Ver estado de conexión** | Indicador visual del estado actual (conectado/desconectado) con información de registro y suscripción. |

#### Plantillas de Mensajes

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 11 | **Sincronizar plantillas desde Meta** | Traer las plantillas de mensaje aprobadas desde Meta Business Manager hacia el CRM. |
| 12 | **Enviar plantillas a aprobación** | Crear y enviar plantillas nuevas para revisión de Meta (Marketing, Utility, Authentication). |
| 13 | **Ver estado de plantillas** | Consultar el estado de cada plantilla (borrador, pendiente, aprobada, rechazada, pausada) con su calidad (verde/amarillo/rojo). |
| 14 | **Ver motivo de rechazo** | Consultar la razón por la cual Meta rechazó una plantilla. |

#### Configuración General

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 15 | **Editar nombre de la cuenta** | Cambiar el nombre comercial de la cuenta en el sistema. |
| 16 | **Configurar moneda por defecto** | Definir la moneda en la que se expresan los valores de los deals (COP, USD, etc.). |
| 17 | **Configurar pipelines de ventas** | Crear, editar y eliminar pipelines (tubos de venta), cada uno con sus propias etapas personalizadas. |
| 18 | **Configurar etapas de pipeline** | Definir las etapas de cada pipeline, sus nombres, colores y orden. |
| 19 | **Gestionar tags (etiquetas)** | Crear, editar y eliminar etiquetas para clasificar contactos. |
| 20 | **Gestionar campos personalizados** | Crear campos de información adicional para contactos (texto, número, fecha, lista de opciones, etc.). |

#### Configuración de Inteligencia Artificial

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 21 | **Conectar proveedor IA** | Usar el plan Cíclica AI incluido (modelos optimizados y económicos para atención al cliente) o configurar clave propia de OpenAI / Anthropic. |
| 22 | **Seleccionar modelo** | Elegir el modelo de IA a utilizar (GPT-4, Claude, etc.). |
| 23 | **Configurar prompt de sistema** | Definir la personalidad y las instrucciones de comportamiento del asistente IA. |
| 24 | **Activar auto-respuesta IA** | Habilitar que el asistente responda automáticamente a mensajes entrantes. |
| 25 | **Limitar auto-respuestas por conversación** | Definir cuántas respuestas automáticas puede dar el asistente en una misma conversación (1 a 20). |
| 26 | **Gestionar base de conocimiento** | Subir documentos (políticas, catálogos, FAQs) que el asistente IA usará para responder con información de la empresa. |
| 27 | **Reindexar base de conocimiento** | Reprocesar todos los documentos para actualizar los índices de búsqueda después de cambios. |

#### Seguridad e Integraciones

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 28 | **Crear API keys** | Generar claves de API públicas (formato `wacrm_live_*`) para integrar sistemas externos con el CRM. |
| 29 | **Revocar API keys** | Invalidar claves de API existentes para desautorizar integraciones. |
| 30 | **Configurar webhooks salientes** | Definir endpoints HTTPS a los que el CRM enviará eventos (conversación asignada, mensaje recibido, etc.). |
| 31 | **Ver estado de webhooks** | Consultar cuándo fue la última entrega exitosa y el contador de fallos de cada webhook. |

---

### 3.3 Agent

El rol **Agent** es el usuario operativo del día a día. Puede hacer todo lo que un Viewer puede ver, más las acciones de gestión comercial y atención al cliente.

#### Bandeja de Conversaciones (Inbox)

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 32 | **Ver bandeja compartida** | Visualizar todas las conversaciones de WhatsApp del equipo, ordenadas por la más reciente. |
| 33 | **Ver mensajes en tiempo real** | Los mensajes nuevos aparecen instantáneamente sin necesidad de recargar la página. |
| 34 | **Enviar mensajes de texto** | Redactar y enviar mensajes de texto a contactos vía WhatsApp. |
| 35 | **Enviar imágenes** | Adjuntar y enviar imágenes en la conversación. |
| 36 | **Enviar documentos** | Adjuntar y enviar archivos PDF, Word, Excel, etc. |
| 37 | **Enviar audio** | Adjuntar y enviar notas de voz o archivos de audio. |
| 38 | **Enviar video** | Adjuntar y enviar archivos de video. |
| 39 | **Enviar plantillas de mensaje** | Seleccionar y enviar plantillas aprobadas por Meta (notificaciones, confirmaciones, etc.). |
| 40 | **Responder citando** | Responder a un mensaje específico citándolo, para mantener el contexto de la conversación. |
| 41 | **Reaccionar con emojis** | Agregar reacciones emoji a los mensajes. |
| 42 | **Asignar conversación a un agente** | Designar a un miembro del equipo como responsable de una conversación. |
| 43 | **Desasignar conversación** | Liberar la asignación de una conversación para que otro agente la tome. |
| 44 | **Marcar conversación como leída** | Actualizar el estado de lectura de la conversación. |
| 45 | **Ver información del contacto** | Panel lateral con datos del contacto, notas, deals vinculados y estado de flujo. |
| 46 | **Iniciar flujo manual desde inbox** | Disparar un flujo conversacional para el contacto desde la misma conversación. |
| 47 | **Indicador de conectividad WhatsApp** | Ver si el servicio de WhatsApp está conectado o desconectado. |

#### Gestión de Contactos

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 48 | **Ver listado de contactos** | Tabla paginada con todos los contactos del equipo, con búsqueda por nombre, teléfono o email. |
| 49 | **Ver detalle completo del contacto** | Modal con pestañas: información general, notas internas, deals asociados y conversaciones. |
| 50 | **Crear nuevo contacto** | Registrar un nuevo contacto con nombre, teléfono, email, empresa y foto. |
| 51 | **Editar contacto** | Modificar los datos de un contacto existente. |
| 52 | **Eliminar contacto** | Remover un contacto del sistema. |
| 53 | **Asignar tags a contactos** | Etiquetar contactos para clasificarlos (ej: "Cliente potencial", "VIP", "Colombia"). |
| 54 | **Agregar notas a contactos** | Registrar observaciones internas sobre un contacto. |
| 55 | **Llenar campos personalizados** | Completar información adicional definida por el Admin en los campos personalizados. |
| 56 | **Importar contactos desde CSV** | Subir un archivo CSV con contactos. El sistema detecta y fusiona automáticamente duplicados por número de teléfono. |
| 57 | **Filtrar contactos por tags** | Visualizar solo los contactos que tienen determinadas etiquetas. |

#### Pipeline de Ventas (Kanban)

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 58 | **Ver tablero Kanban** | Visualizar todas las oportunidades (deals) organizadas por etapa del pipeline, en columnas arrastrables. |
| 59 | **Crear nuevo deal** | Registrar una oportunidad de negocio con título, valor, etapa, contacto asociado, agente asignado y fecha de cierre esperada. |
| 60 | **Editar deal** | Modificar cualquier campo de un deal existente. |
| 61 | **Mover deal entre etapas (drag & drop)** | Arrastrar un deal de una columna a otra para actualizar su etapa en el proceso de ventas. |
| 62 | **Cambiar estado del deal** | Marcar un deal como ganado (won), perdido (lost) o abierto (open). |
| 63 | **Asignar deal a un agente** | Designar un responsable para cada oportunidad. |
| 64 | **Vincular deal a contacto** | Asociar un deal con un contacto específico. |
| 65 | **Vincular deal a conversación** | Asociar un deal con una conversación de WhatsApp para tener contexto completo. |
| 66 | **Agregar notas al deal** | Registrar información adicional relevante para la negociación. |
| 67 | **Seleccionar pipeline activo** | Cambiar entre diferentes pipelines configurados (si hay más de uno). |

#### Campañas de Difusión (Broadcasts)

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 68 | **Ver listado de campañas** | Tabla con todas las campañas de difusión, su estado y métricas de rendimiento. |
| 69 | **Crear campaña — Paso 1: elegir plantilla** | Seleccionar la plantilla de mensaje que se enviará, con sus variables y personalización. |
| 70 | **Crear campaña — Paso 2: seleccionar audiencia** | Definir el público objetivo mediante filtros (tags, búsqueda). |
| 71 | **Crear campaña — Paso 3: personalizar** | Ajustar el contenido del mensaje para cada segmento de la audiencia. |
| 72 | **Crear campaña — Paso 4: programar y enviar** | Configurar la fecha/hora de envío o enviar inmediatamente. |
| 73 | **Ver detalle de campaña** | Tracking en vivo con contadores de enviados, entregados, leídos, respondidos y fallidos. |
| 74 | **Ver tracking por destinatario** | Consultar el estado individual de cada contacto en la campaña (pendiente, enviado, entregado, leído, respondió, falló). |

#### Automatizaciones

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 75 | **Ver listado de automatizaciones** | Tabla con todas las reglas de automatización, su trigger, estado activo/inactivo y contador de ejecuciones. |
| 76 | **Crear automatización** | Definir una nueva regla: seleccionar trigger (mensaje entrante, programado, etc.) y agregar pasos. |
| 77 | **Editar automatización** | Modificar los pasos y configuración de una automatización existente. |
| 78 | **Eliminar automatización** | Remover una regla de automatización. |
| 79 | **Activar/desactivar automatización** | Encender o apagar una regla sin eliminarla. |
| 80 | **Ver logs de ejecución** | Historial detallado de cada vez que se ejecutó la automatización, con los pasos realizados y su resultado (éxito/fallo). |
| 81 | **Duplicar automatización** | Copiar una automatización existente para usarla como plantilla de una nueva. |

#### Flujos Conversacionales

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 82 | **Ver listado de flujos** | Tabla con todos los flujos conversacionales, su estado (borrador/activo/archivado), trigger y ejecuciones. |
| 83 | **Crear flujo** | Definir un nuevo flujo conversacional desde cero o desde una plantilla. |
| 84 | **Editar flujo** | Modificar nodos, conexiones y configuraciones de un flujo existente. |
| 85 | **Eliminar flujo** | Remover un flujo y todas sus ejecuciones asociadas. |
| 86 | **Activar flujo con trigger** | Publicar el flujo asociándolo a un evento disparador: palabra clave, primer mensaje entrante del contacto, o inicio manual. |
| 87 | **Archivar flujo** | Desactivar un flujo sin eliminarlo, conservando su configuración. |
| 88 | **Usar Flow Builder visual** | Editor visual con canvas donde se agregan, conectan y configuran nodos arrastrándolos. |
| 89 | **Tipos de nodo disponibles (10):** | |
| | → **Inicio** | Punto de entrada del flujo. |
| | → **Enviar botones** | Mostrar botones interactivos al contacto. |
| | → **Enviar lista** | Mostrar un menú de opciones tipo lista. |
| | → **Enviar mensaje** | Enviar un mensaje de texto. |
| | → **Enviar media** | Enviar imagen, video o documento. |
| | → **Recolectar entrada** | Esperar y capturar la respuesta del contacto. |
| | → **Condición** | Evaluar una condición y bifurcar el flujo (sí/no). |
| | → **Asignar tag** | Etiquetar automáticamente al contacto. |
| | → **Transferir a humano** | Entregar la conversación a un agente humano. |
| | → **HTTP Fetch** | Consultar una API externa y usar la respuesta en el flujo. |
| | → **Fin** | Terminar el flujo. |
| 90 | **Ver ejecuciones de flujo en vivo** | Consultar en tiempo real qué contacto está en qué nodo de qué flujo. |
| 91 | **Ver historial de ejecuciones** | Registro completo de ejecuciones con eventos detallados (inicio, nodo visitado, mensaje enviado, fin, etc.). |
| 92 | **Duplicar flujo** | Copiar un flujo existente como base para uno nuevo. |

---

### 3.4 Viewer

El rol **Viewer** tiene acceso de solo lectura a toda la información del sistema. No puede crear, editar ni eliminar ningún recurso. Es ideal para supervisores, gerentes o auditores que necesitan consultar datos sin intervenir.

#### Dashboard y Reportes

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 93 | **Ver KPIs del dashboard** | Tarjetas con indicadores clave: oportunidades activas, matriculados, perdidos, comisiones del período. |
| 94 | **Ver gráfico donut de pipeline** | Distribución visual del valor total del pipeline por cada etapa comercial. |
| 95 | **Ver ranking de agentes** | Top 3 agentes del período con su valor comisionado. |
| 96 | **Ver feed de actividad reciente** | Lista cronológica de los últimos 20 eventos (deals ganados/perdidos, conversaciones asignadas, broadcasts enviados). |
| 97 | **Ver timeline de deals** | Gráfico de área con la evolución semanal de deals creados vs ganados en los últimos 30 días. |
| 98 | **Ver panel de rendimiento de agentes** | KPIs por agente (matriculados, comisiones, pipeline value, win rate) con tabla sorteable. |
| 99 | **Ver gráfico de tendencia de deals** | Área chart con dos series: oportunidades creadas vs matriculados por semana. |
| 100 | **Ver cuadrante de agentes** | Gráfico de burbujas que cruza valor promedio del deal vs tasa de cierre. |
| 101 | **Ver distribución de deals por agente** | Gráfico donut con el valor ganado por cada agente. |

#### Consultas

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 102 | **Ver bandeja de conversaciones** | Navegar por todas las conversaciones del equipo y leer los mensajes. |
| 103 | **Ver detalle de contacto** | Consultar la información completa de cualquier contacto. |
| 104 | **Ver tablero Kanban** | Visualizar el pipeline con todos los deals y sus etapas. |
| 105 | **Ver detalle de deal** | Consultar la información de cualquier oportunidad. |
| 106 | **Ver campañas de broadcast** | Listar campañas y ver sus métricas y tracking por destinatario. |
| 107 | **Ver automatizaciones** | Listar reglas de automatización y consultar sus logs de ejecución. |
| 108 | **Ver flujos conversacionales** | Listar flujos y consultar su historial de ejecuciones. |
| 109 | **Ver configuración del sistema** | Consultar todas las secciones de configuración (WhatsApp, plantillas, miembros, IA, API keys, webhooks) en modo solo lectura. |
| 110 | **Ver notificaciones** | Consultar el feed de notificaciones del sistema. |
| 111 | **Ver presencia del equipo** | Ver qué miembros están en línea o ausentes. |

---

## 4. Funcionalidades Transversales

Estas capacidades aplican a través de todos los módulos y roles del sistema.

#### Mensajería WhatsApp en Tiempo Real

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 112 | **Recepción instantánea de mensajes** | Los mensajes entrantes de WhatsApp aparecen al instante en la bandeja compartida del inbox. |
| 113 | **Actualización en vivo de estados** | Los cambios de estado de los mensajes (enviado, entregado, leído) se reflejan automáticamente. |
| 114 | **Reacciones en tiempo real** | Las reacciones emoji de los contactos aparecen instantáneamente. |
| 115 | **Sincronización automática** | Si la conexión WebSocket se pierde, el sistema se reconecta automáticamente y sincroniza los cambios perdidos. |
| 116 | **Descarga de media** | El sistema descarga y almacena automáticamente las imágenes, videos, documentos y audios que los contactos envían. |
| 117 | **Verificación de integridad** | Firma HMAC-SHA256 en cada webhook entrante de Meta para garantizar que los mensajes son legítimos. |

#### Inteligencia Artificial

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 118 | **Asistente IA configurable** | Asistente inteligente incluido con el portal (Cíclica AI Plan, modelos optimizados y económicos para atención al cliente) o usando clave propia de OpenAI / Anthropic. |
| 119 | **Generación de drafts con 1 clic** | Botón que genera un borrador de respuesta con IA basado en el contexto de la conversación. |
| 120 | **Auto-respuesta inteligente** | El asistente puede responder automáticamente a mensajes entrantes, limitado a un número configurable por conversación. |
| 121 | **Base de conocimiento empresarial** | El asistente consulta documentos internos (políticas, catálogos, FAQs) para responder con información propia de la empresa. |
| 122 | **Búsqueda híbrida en KB** | Combina búsqueda por palabras clave y búsqueda semántica para encontrar la información más relevante en los documentos. |

#### Automatización y Flujos

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 123 | **Motor de automatizaciones** | Ejecuta reglas automáticas paso a paso con branches condicionales (sí/no). |
| 124 | **Triggers de automatización** | Las automatizaciones pueden dispararse por mensaje entrante, evento programado, etc. |
| 125 | **Ejecuciones programadas (cron)** | Las automatizaciones y flujos pueden ejecutarse en horarios definidos. |
| 126 | **Garantía de un flujo activo por contacto** | El sistema asegura que un contacto solo tenga un flujo conversacional activo a la vez, evitando conflictos. |
| 127 | **Política de caída (fallback)** | Si el flujo no puede continuar, puede re-preguntar, transferir a humano o ejecutar una acción configurada. |

#### Integración con Sistemas Externos

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 128 | **API REST pública** | 12 endpoints para integrar el CRM con otros sistemas: consultar y gestionar contactos, conversaciones, mensajes, broadcasts y webhooks. |
| 129 | **Autenticación por API key** | Las integraciones usan claves de API con formato `wacrm_live_*`, con alcances (scopes) y límite de tasa (120 solicitudes por minuto). |
| 130 | **Webhooks salientes** | El CRM puede notificar a sistemas externos cuando ocurren eventos: conversación asignada, mensaje recibido, etc. |
| 131 | **Webhooks con firma HMAC** | Cada notificación saliente incluye una firma HMAC para que el sistema receptor verifique su autenticidad. |
| 132 | **Protección SSRF** | El sistema valida y protege las conexiones salientes a webhooks para evitar ataques de falsificación del lado del servidor. |

#### Seguridad

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 133 | **Autenticación segura** | Inicio de sesión con email y contraseña gestionado por Supabase Auth. |
| 134 | **Recuperación de contraseña** | Flujo completo de olvido de contraseña con envío de email de restablecimiento. |
| 135 | **Control de acceso por 3 capas** | Los permisos se validan en la base de datos, en el servidor y en la interfaz de usuario, garantizando que ningún usuario acceda a lo que no le corresponde. |
| 136 | **Encriptación de secretos** | Todos los datos sensibles (tokens de WhatsApp, claves de API, secretos de webhook) se almacenan encriptados con cifrado AES-256-GCM. |
| 137 | **Protección contra CSRF** | Las rutas de API están protegidas contra ataques de falsificación de solicitudes entre sitios. |
| 138 | **Política de seguridad de contenido (CSP)** | El sistema aplica cabeceras de seguridad HTTP para prevenir ataques XSS y de inyección. |

#### Almacenamiento y Archivos

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 139 | **Avatares de perfil** | Los usuarios pueden subir su foto de perfil (PNG, JPG, WEBP, GIF, máx 2 MB). |
| 140 | **Media para flujos** | Almacenamiento de imágenes, videos y documentos utilizados en los nodos de flujos conversacionales (máx 16 MB). |
| 141 | **Adjuntos de chat** | Almacenamiento de archivos adjuntos enviados y recibidos en las conversaciones (máx 16 MB). |

#### Notificaciones

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 142 | **Notificaciones de asignación** | Cuando una conversación se asigna a un agente, este recibe una notificación en tiempo real. |
| 143 | **Feed centralizado** | Centro de notificaciones con listado cronológico, indicador de leído/no leído. |
| 144 | **Navegación contextual** | Al hacer clic en una notificación, el sistema navega directamente al recurso relacionado (conversación, deal, etc.). |

#### Invitaciones y Onboarding

| # | Funcionalidad | Descripción |
|---|--------------|-------------|
| 145 | **Invitación por token** | Los nuevos miembros reciben un enlace único con token de invitación. |
| 146 | **Vista previa de invitación** | Antes de aceptar, el invitado puede ver a qué cuenta y rol está siendo invitado. |
| 147 | **Registro integrado** | Si el invitado no tiene cuenta, puede registrarse y automáticamente canjear la invitación. |
| 148 | **Expiración de invitaciones** | Las invitaciones tienen fecha de vencimiento configurable. |

---

## 5. Módulos del Sistema

### 5.1 Dashboard (`/dashboard`)

Panel principal con métricas resumidas del negocio:

- **Tarjetas KPI:** oportunidades activas, matriculados, perdidos y comisiones del período actual.
- **Gráfico donut de pipeline:** distribución del valor total de oportunidades por etapa comercial.
- **Ranking de agentes:** top 3 agentes del período con avatar y valor comisionado.
- **Feed de actividad:** últimos 20 eventos relevantes del equipo.
- **Timeline semanal:** evolución de oportunidades creadas vs ganadas en los últimos 30 días.

### 5.2 Agent Performance (`/dashboard/agent-performance`)

Panel de rendimiento individual del equipo de ventas:

- **KPIs por agente:** matriculados, comisiones, valor en pipeline y tasa de cierre.
- **Tabla ranking:** todos los agentes con métricas sortearles, indicador de tendencia (▲/▼/—) vs período anterior.
- **Tendencia semanal:** oportunidades creadas vs matriculadas por semana.
- **Cuadrante de productividad:** gráfico de burbujas que relaciona valor promedio del deal con tasa de cierre.
- **Distribución de comisiones:** qué porcentaje del total ha generado cada agente.
- **Rango de fechas:** selector para ver datos de 7, 30 o 90 días.

### 5.3 Inbox (Bandeja de Conversaciones) (`/inbox`)

Centro de atención al cliente vía WhatsApp, con diseño de 3 columnas:

- **Columna izquierda — Lista de conversaciones:** contactos ordenados por última actividad, con badge de mensajes no leídos, última hora de mensaje y agente asignado.
- **Columna central — Hilo de mensajes:** burbujas de chat en tiempo real (cliente a la izquierda, agente a la derecha) con marcas de estado (enviado, entregado, leído).
- **Columna derecha — Panel de contacto:** ficha completa del contacto, notas internas, deals vinculados y estado de flujo activo.
- **Compositor:** caja de texto con botón de enviar, adjuntar archivos, selector de plantillas y emojis.
- **Asignación de agentes:** asignar o desasignar conversaciones a miembros del equipo con notificación automática.
- **Citado de mensajes:** responder a un mensaje específico manteniendo el contexto visual.
- **Reacciones:** agregar emojis a los mensajes.

### 5.4 Contactos (`/contacts`)

Gestión completa de la base de contactos:

- **Tabla paginada:** listado con avatar, nombre, teléfono, email, tags y acciones.
- **Búsqueda con debounce:** filtrar contactos mientras se escribe por nombre, teléfono o email.
- **Filtro por tags:** seleccionar etiquetas para filtrar la lista.
- **Detalle del contacto:** modal con pestañas (información general, notas, deals vinculados, conversaciones).
- **CRUD completo:** crear, editar y eliminar contactos.
- **Campos personalizados:** capturar información adicional según las necesidades del negocio.
- **Notas internas:** registrar observaciones y seguimientos.
- **Importación CSV:** subir archivos con detección y fusión automática de duplicados por número de teléfono.
- **Tags:** clasificar contactos con etiquetas de colores.

### 5.5 Pipeline (Kanban de Ventas) (`/pipelines`)

Gestión visual del proceso comercial:

- **Selector de pipeline:** cambiar entre diferentes pipelines si hay múltiples configurados.
- **Tablero Kanban:** columnas que representan etapas del proceso comercial, con tarjetas de oportunidades arrastrables.
- **Tarjeta de deal:** muestra título, valor, nombre del contacto, agente asignado y fecha de cierre.
- **Modal de detalle:** formulario completo con todos los campos del deal.
- **Drag & drop:** mover deals entre etapas simplemente arrastrándolos.
- **Estados:** marcar deals como ganados, perdidos o abiertos.
- **Analíticas:** métricas y estadísticas del pipeline seleccionado.
- **Configuración:** crear y gestionar pipelines y sus etapas.

### 5.6 Broadcasts (Campañas de Difusión) (`/broadcasts`)

Envío masivo de mensajes plantilla:

- **Listado de campañas:** tabla con nombre, estado, fechas y contadores de rendimiento.
- **Wizard de 4 pasos:**
  1. Elegir plantilla de mensaje.
  2. Seleccionar audiencia mediante filtros.
  3. Personalizar contenido según segmentos.
  4. Programar o enviar inmediatamente.
- **Detalle de campaña:** tracking en vivo con contadores (enviados, entregados, leídos, respondieron, fallaron) y tabla individual por destinatario.
- **Actualización automática:** mientras la campaña está en envío, los contadores se actualizan cada 5 segundos.

### 5.7 Automatizaciones (`/automations`)

Reglas de negocio automatizadas:

- **Listado de reglas:** tabla con nombre, tipo de trigger, estado activo/inactivo y ejecuciones.
- **Editor de automatización:** interfaz visual para construir secuencias de pasos con ramificaciones condicionales (sí/no).
- **Tipos de trigger:** mensaje entrante, evento programado, etc.
- **Logs de ejecución:** registro detallado de cada ejecución con timestamp, evento que la disparó, pasos ejecutados y resultado (éxito, parcial, fallo).
- **Duplicación:** copiar reglas existentes como plantilla.
- **Activación/desactivación:** prender o apagar reglas sin perder su configuración.

### 5.8 Flujos Conversacionales (`/flows`)

Automatización visual de conversaciones:

- **Listado de flujos:** tabla con nombre, estado, trigger y contador de ejecuciones.
- **Flow Builder:** editor visual con canvas interactivo donde se diseñan flujos conectando nodos mediante arrastre.
- **10 tipos de nodo:**
  - Inicio — punto de entrada del flujo.
  - Enviar botones — mensaje con botones interactivos.
  - Enviar lista — menú de opciones tipo lista.
  - Enviar mensaje — mensaje de texto simple.
  - Enviar media — imagen, video o documento.
  - Recolectar entrada — captura la respuesta del contacto.
  - Condición — bifurca el flujo según una condición.
  - Asignar tag — etiqueta automática al contacto.
  - Transferir a humano — deriva la conversación a un agente.
  - HTTP Fetch — consulta una API externa.
  - Fin — termina el flujo.
- **Ejecuciones en vivo:** monitorizar en tiempo real qué contacto está en qué nodo.
- **Historial:** registro completo de ejecuciones con expansión de eventos.
- **Activación:** los flujos pueden dispararse por palabra clave, primer mensaje entrante del contacto, o manualmente desde el inbox.

### 5.9 Settings (Configuración) (`/settings`)

Centro de control con 11 secciones laterales:

| Sección | Funcionalidad |
|---------|---------------|
| **Resumen** | Vista general con indicadores de estado y conteos rápidos. |
| **Perfil** | Editar nombre, email y avatar del usuario. |
| **Seguridad** | Cambiar contraseña y gestionar sesiones activas. |
| **Apariencia** | Alternar entre tema claro y oscuro. |
| **WhatsApp** | Conectar/desconectar número, ver estado del registro y suscripción. |
| **Plantillas** | Gestionar plantillas de mensaje: sincronizar desde Meta, ver estado, enviar a aprobación. |
| **Campos y Tags** | Administrar campos personalizados y etiquetas para contactos. |
| **Deals** | Configuración de pipelines y etapas de venta. |
| **Miembros** | Gestionar equipo: invitar, cambiar roles, remover, ver presencia. |
| **IA** | Configurar proveedor (Cíclica AI Plan incluido, o BYOK OpenAI/Anthropic), modelo, prompt del sistema, auto-respuesta y base de conocimiento. |
| **API** | Crear y revocar claves de API públicas. |

### 5.10 Notificaciones (`/notifications`)

Feed centralizado de notificaciones del sistema:

- Listado cronológico con icono, título, cuerpo y timestamp.
- Indicador visual de leído/no leído.
- Acción de marcar como leído individual o masivamente.
- Al hacer clic, navega directamente al recurso relacionado (conversación asignada, etc.).
- Actualización en tiempo real.

---

> **Nota sobre moneda:** El sistema actualmente opera con USD como moneda por defecto. La migración a COP como moneda principal está identificada como tarea pendiente. Toda funcionalidad financiera utiliza el formato configurable por cuenta (`formatCurrency()`), por lo que el cambio a COP es una configuración sin requerir desarrollo adicional significativo.

---

*Documento generado a partir del análisis del código fuente y esquema del sistema — Julio 2026.*
