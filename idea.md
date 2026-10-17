# Clara Protocol: A2A Treasury & Governance with x402 and ERC-8004

> **Documento de Visión y Propuesta Estratégica · 30X Hackathon (Blinka Track)**  
> **Autores:** Cristobal Valencia (`DevCristobalvc`), Antigravity CLI (`30agy`), Claude Code (`30x1`)  
> **Fecha:** 17 de Octubre de 2026

---

## 🎯 Resumen Ejecutivo

El MVP actual de **Clara** implementado por `30x1` demostró velocidad y solidez técnica básica (Next.js, motor de reglas en TypeScript y dataset de 18 trampas evaluado). Sin embargo, como producto de hackathon se queda corto: es un **dashboard administrativo tradicional de 2023** donde un humano sube PDFs a mano y mira un tablero Kanban.

Esta propuesta transforma a Clara en una **infraestructura pionera de tesorería y gobernanza Agent-to-Agent (A2A)**, integrando los dos estándares más avanzados de la economía de agentes:
1. **x402 (HTTP 402 Payment Required):** Pagos directos máquina a máquina sin logins, sin API keys, sin tarjetas de crédito y sin suscripciones mensuales (*Loginless, APIKeyless, Cardless, Subscriptionless*).
2. **ERC-8004 (Trustless Agents Standard):** Identidad verificada (*Identity Registry*), historial inmutable de desempeño (*Reputation Registry*) y validación de decisiones (*Validation Registry*), respaldado por MetaMask, Ethereum Foundation, Google y Coinbase.

---

## 1. Radiografía del MVP Actual (`30x1`)

### ✅ Lo que SÍ funciona (Fortalezas a conservar)
* **Safety Invariant estricto:** El LLM (Claude) solo extrae datos estructurados. Toda la lógica de límites, presupuestos y allowlists es código TypeScript 100% determinista. JEV solo emite juicios probabilísticos y **únicamente puede endurecer la decisión (`HOLD`/`ESCALATE`), jamás relajarla a `PAY`**.
* **Dataset de pruebas con 12 "Trap Cases":** Duplicados con diferente numeración, desvíos de presupuesto, cambios de cuenta bancaria y sobreprecios del 15%.
* **Harness de evaluación cuantitativa (`eval.md`):** Suite automatizada con 100% de precisión en el dataset y 0 pagos inseguros.
* **Velocidad de despliegue:** Monorepo funcional y desplegado en producción en [blinka.devcristobalvc.com](https://blinka.devcristobalvc.com).

### ❌ Lo que NO funciona (Debilidades críticas)
* **Es un SaaS manual con botones, no un agente:** El flujo depende de que un humano entre al navegador, arrastre un archivo y haga clic en "Aprobar". No hay autonomía de ingesta por webhooks, email o protocolos de agentes.
* **Persistencia en `localStorage`:** Los datos viven en el navegador del cliente; si se abre en incógnito o desde otro agente, el estado se pierde.
* **API rígida y acoplada:** `/api/decide` requiere enviar en cada request el objeto completo de la empresa, contratos e histórico, impidiendo su uso por agentes externos.
* **Cero proactividad ante problemas:** Si una factura tiene un problema menor, el sistema solo la bloquea en `HOLD`. No hay un canal de negociación ni solicitud de aclaración al proveedor.

### ⚖️ Cumplimiento con el Track de Blinka
* **Cumple:** Respeta el alcance (no mueve dinero fiat real), clasifica en `PAY`/`HOLD`/`ESCALATE`, parametriza reglas y genera explicaciones en lenguaje natural.
* **Falla en el espíritu:** Blinka busca *"agentes que pagan por la empresa"* para resolver el problema de la **confianza**. Clara no ofrece pruebas criptográficas ni interoperabilidad nativa entre agentes.

---

## 2. La Nueva Visión: Clara como Protocolo A2A

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AGENTE EXTERNO / PROVEEDOR                     │
│               (Agente de compras, freelance, DAO, bot de infra)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1. POST /api/x402/verify (Factura)
                                    │    [Sin Login | Sin API Key | Sin Tarjeta]
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CLARA GATEWAY (HTTP 402)                        │
│             Responde: HTTP 402 Payment Required                        │
│             Headers: 0.01 USDC | Address: 0xClaraTreasury | Base L2    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 2. Reintento con Payload x402 firmado
                                    │    (Header: X-Payment: <signature>)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       CLARA GOVERNANCE ENGINE                          │
│                                                                        │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │      ERC-8004        │  │   DETERMINISTIC  │  │   JEV (TypeSafe)│  │
│  │  Identity Registry   │  │   RULES ENGINE   │  │  Semantic Match │  │
│  │ (Verificación wallet)│  │ (Límites/Budget) │  │  Risk / Phishing│  │
│  └──────────┬───────────┘  └────────┬─────────┘  └────────┬────────┘  │
│             │                       │                     │           │
│             └───────────────────────┼─────────────────────┘           │
│                                     ▼                                 │
│                        VEREDICTO: PAY | HOLD | ESCALATE               │
│                                     │                                 │
│                                     ▼                                 │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ Recibo Criptográfico Firmado (Proof of Compliance)              │  │
│  │ + Registro de Reputación on-chain (ERC-8004 Reputation Registry)│  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Pilares de la Innovación

### A. Protocolo x402: Micro-monetización máquina a máquina
* **Clara como Servidor (Decide-as-a-Service):** Cualquier agente externo que quiera validar el cumplimiento de una factura contra políticas corporativas llama a Clara pagando **0.01 USDC** por verificación. No necesita crear cuenta ni ingresar tarjeta de crédito.
* **Clara como Cliente (Pay-per-Inference):** Clara paga sus consultas a modelos especializados (como JEV) o feeds de tasas de cambio fraccionando centavos vía cabeceras HTTP 402, directamente desde el presupuesto autorizado.

### B. Estándar ERC-8004 (Trustless Agents)
* **Identity Registry (El "Agent Card" de contratistas):** Los proveedores en LATAM o EE.UU. registran su identidad y dirección de cobro como un Agent Card. Clara verifica la firma del remitente contra el registro on-chain.
  * *Impacto directo:* La **trampa #12** del dataset ("cambio repentino de cuenta bancaria vía email") se neutraliza matemáticamente: la nueva cuenta no coincide con el ERC-8004 registrado.
* **Reputation Registry (Buró de crédito para agentes):** Cada pago exitoso o intento de fraude (duplicados, sobreprecios) se registra en un feed auditable. Si un proveedor comete fraude, su reputación cae y alerta a toda la red de agentes de Blinka.
* **Validation Registry (Aprobaciones de alto valor):** Cuando un humano aprueba una factura escalada (> $3,000 USD), se emite una atestación criptográfica inmutable que certifica quién autorizó el pago y bajo qué reglas exactas.

### C. Servidor MCP (Model Context Protocol) Nativo
Clara expone herramientas MCP para que agentes en Cursor, Claude Desktop o Antigravity puedan gobernar gastos:
* `review_invoice({ invoice_data })`: Dictamina si una factura es aprobable.
* `check_category_budget({ category, amount })`: Consulta de presupuesto en tiempo real antes de contratar un servicio.
* `request_human_override({ invoice_id, reason })`: Despacha un escalamiento interactivo al humano.

---

## 4. Casos de Uso para la Demo y Video Pitch

### 🎬 Caso 1: Bouncer de Tesorería Agent-to-Agent (A2A)
Un agente de marketing contrata a un agente diseñador. El agente diseñador emite la factura y la envía directamente al endpoint de Clara. Paga la tarifa de auditoría de 0.01 USDC con x402. Clara valida que el concepto encaje con el contrato y esté dentro del presupuesto mensual de diseño, emitiendo el veredicto `PAY` con atestación firmada en 400 milisegundos.

### 🛡️ Caso 2: Cero Phishing con ERC-8004
Llega una factura de un tercero que suplanta a un proveedor habitual cambiando la cuenta de destino (Trap #12). El motor consulta el registro ERC-8004, comprueba que la clave pública no coincide con el agente oficial de "Valentina" y genera un bloqueo inmediato `HOLD` con reporte de alerta en el Reputation Registry.

### ⚡ Caso 3: Liquidación Condicional / Attestation
Una factura que supera el umbral se escala a un humano. El CFO aprueba desde su móvil (vía webhook de Telegram o interfaz web). Se genera un voucher x402 condicional que solo se liquida cuando el proveedor provee la firma de entrega del entregable.

---

## 5. Plan de Acción y Reparto de Tareas

| Tarea | Responsable | Descripción |
|---|---|---|
| **Motor de Reglas + Dataset + UI Base** | `30x1` (Claude) | ✅ Ya construido en `lib/engine/` y `app/`. |
| **Endpoint x402 (`/api/x402/verify`)** | `30agy` (Antigravity) | Handshake HTTP 402 + verificación de micropago simulado. |
| **Módulo ERC-8004 (`lib/engine/erc8004.ts`)** | `30agy` (Antigravity) | Identity lookup y emisión de recibo de reputación. |
| **Servidor MCP de Clara** | `30agy` (Antigravity) | Exposición de herramientas de tesorería para otros agentes. |
| **Persistencia y Variables Vercel** | `30x1` (Claude) | Configurar `TYPESAFE_API_KEY` live y persistencia básica. |
| **Pitch, Demo Video y HackRadar** | Cristobal (Humano) | Creación del equipo en HackRadar, grabación de voz y entrega. |

---
*Fin del documento de visión. Listo para someter a discusión con el equipo y commit en el repositorio.*
