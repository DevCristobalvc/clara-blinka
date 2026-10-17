# ORBIT · guion del video (≈3:00, máximo 5:00) y pitch

Narración en español para ElevenLabs (voz de William). Cada bloque indica lo que se ve en pantalla y el momento aproximado. `scripts/record-demo.mjs` graba la pantalla en este mismo orden; `scripts/narrate.mjs` genera la voz y la monta.

---

## 0. El problema [0:00–0:18] · pantalla: deck, portada y "El problema"

Imagina que llevas las finanzas de una empresa en Estados Unidos con equipo y proveedores en Latinoamérica. Cada mes llegan facturas por correo, PDF o chat. Las comparas con lo acordado, persigues al que cobró de más, pides aprobación y pagas a mano, en otra moneda, hacia otro país. Es manual, se repite, y depende de ti.

ORBIT es la plataforma donde tus agentes de IA cobran y pagan por tu empresa. Actúan con autonomía. Nunca sin límites.

## 1. El equipo [0:18–0:36] · pantalla: deck, "El equipo" con fotos y LinkedIn; luego "Qué construimos"

Somos Cristobal Valencia y William Martínez, de Ekinoxis. Construimos productos de pagos y agentes para empresas en Latinoamérica, y este fin de semana, en el hackathon de 30X, construimos ORBIT para el reto de Blinka: un agente que paga por la empresa, dentro de sus reglas, y que pide permiso cuando algo se sale de ellas.

## 2. Estás en tu cuenta, tienes facturas por pagar [0:36–0:52] · pantalla: login y Panel con "Tienes 21 facturas por pagar"

Entras a tu cuenta como siempre: tu saldo, depositar, enviar. Y ahí están: veintiún facturas por pagar este mes. Seis normales. Doce con algún problema. Tres de proveedores que intentan colarte algo.

En vez de revisarlas una por una, contratas a ORBIT.

## 3. Contratas al pagador y le cargas fondos [0:52–1:16] · pantalla: Panel, pasos 1 y 2 se completan con el pago real en USDC

Contratar al agente es un pago, como lo haría un agente. Tu wallet le paga a ORBIT en USDC y el pagador queda activo al instante: sin cuenta, sin tarjeta. Después le cargas fondos a su propia wallet: ese es el dinero que puede mover, y nada más.

## 4. Sus reglas [1:16–1:30] · pantalla: Reglas

Las reglas las pones tú, una sola vez: cuánto puede pagar por factura, el presupuesto del mes, qué proveedores y en qué moneda, y a partir de qué monto quieres aprobar tú. El agente nunca las cambia. Solo puede ser más estricto, nunca más laxo.

## 5. Lo pones a trabajar [1:30–2:00] · pantalla: Panel "Pon a ORBIT a trabajar", el tablero de Facturas se va llenando

Y lo pones a trabajar. Cada factura se vuelve un caso con su enlace, y cada proveedor lo recibe por correo. ORBIT lee la factura, la revisa contra las reglas y decide en segundos: pagar, frenar o escalar a una persona. Las seis correctas se pagan solas. Las que se salen de lo que puede aprobar, van a una persona.

## 6. Cuando algo no cuadra, lo resuelve [2:00–2:28] · pantalla: caso de Lucía, la conversación; luego la vista del proveedor

Aquí está la diferencia. Lucía mandó su factura en euros, y la política solo permite dólares. ORBIT no se limita a frenarla: le escribe, le pide la factura en dólares, ella la reemite, y la versión corregida pasa por las mismas reglas. Cumple, se registra el pago, y queda un recibo firmado.

Una corrección solo puede acercarse al contrato. Nunca una cuenta nueva, nunca un monto mayor, nunca bajo presión. Los tres proveedores que lo intentaron terminaron en manos de una persona.

## 7. Tú solo ves lo que te toca [2:28–2:42] · pantalla: Aprobaciones

A ti te llega únicamente lo que las reglas reservan para una persona: un pago legítimo por encima de tu umbral, un proveedor nuevo, un presupuesto agotado. Apruebas o rechazas con toda la conversación y los motivos a la vista.

## 8. Confianza que se puede verificar [2:42–3:00] · pantalla: Reportes; deck "Resultados" y "Qué sigue"

Veintiún facturas, doce trampas, tres proveedores comprometidos. Cien por ciento de precisión. Cero pagos fuera de las reglas, antes y después de negociar. Cada decisión firmada con las reglas vigentes, verificable por cualquiera.

ORBIT. Agentes que pagan y cobran por tu empresa, dentro de tus límites. Construido sobre Blinka, con JEV como capa de juicio rápido.

---

## Pitch de 60 segundos (para la sesión en vivo)

1. **Problema.** Finanzas hace a mano, cada mes, lo que un agente debería hacer: leer, comparar, perseguir, aprobar, pagar. Lo que falta es confianza.
2. **Qué es ORBIT.** Agentes que pagan y cobran por la empresa, dentro de reglas que la empresa define una vez. Se contratan y se fondean pagando en USDC; cada pago es un enlace donde el agente conversa con el proveedor hasta que la factura cuadra.
3. **Por qué se puede confiar.** Los límites viven en código. El modelo (JEV, Claude) solo puede volver una decisión más estricta, nunca más laxa. Una corrección solo puede acercarse al contrato. Cada decisión queda firmada.
4. **Prueba.** 21 facturas, 12 trampas, 3 proveedores comprometidos: 100% de precisión, 0 pagos fuera de reglas, 76% sin intervención humana, 3 de 10 frenadas resueltas con el proveedor.
5. **Qué sigue.** El cobrador con las reglas invertidas; agentes pagándole a agentes por caso con x402; negociación sin revelar los límites de ninguna de las partes.

## Datos para el formulario de HackRadar

- **Nombre:** ORBIT
- **Reto:** Blinka · Agentes que pagan por la empresa
- **Descripción (corta):** ORBIT es la plataforma donde los agentes de IA de una empresa cobran y pagan por ella. El pagador lee cada factura, la revisa contra las reglas de la empresa, negocia correcciones con el proveedor en un enlace por pago, y paga, frena o escala a una persona, con un recibo firmado por decisión. Se contrata y se fondea pagando en USDC (x402). 21 facturas de prueba con 12 trampas y 3 proveedores comprometidos: 0 pagos fuera de reglas.
- **Enlaces:** repo https://github.com/DevCristobalvc/orbit · demo https://orbit.devcristobalvc.com (login con Privy, o 123/123) · eval `docs/eval.md` · video (pendiente)
