# ORBIT · guion del video (≈2:45, máximo 5:00) y pitch

Narración en español para ElevenLabs (voz de William). Cada bloque indica lo que se ve en pantalla y el momento aproximado; la línea `> …` es el rótulo que aparece abajo en pantalla durante el bloque. `scripts/record-demo.mjs` graba la pantalla en este mismo orden; `scripts/narrate.mjs` genera la voz, los rótulos y los zooms.

---

## 0. El problema [0:00–0:14] · pantalla: deck, portada y "El problema"

> Pagar a proveedores es manual, cada mes, y depende de una persona.

Si llevas las finanzas de una empresa con proveedores en Latinoamérica, cada mes llegan facturas por correo, PDF o chat. Las comparas con lo acordado, persigues al que cobró de más, pides aprobación y pagas a mano, en otra moneda. Es manual, se repite, y depende de ti.

## 1. El equipo [0:14–0:28] · pantalla: deck, "El equipo" con fotos y LinkedIn; luego "Qué construimos"

> ORBIT · agentes de IA que pagan y cobran por tu empresa

Somos Cristobal Valencia y William Martínez, de Ekinoxis. Construimos productos de pagos y agentes para Latinoamérica. Este fin de semana, en el hackathon de 30X, construimos ORBIT para el reto de Blinka: agentes de IA que pagan y cobran por tu empresa. Con autonomía. Nunca sin límites.

## 2. Estás en tu cuenta [0:28–0:42] · pantalla: login con Privy, Panel con saldo, Depositar (QR) y "21 facturas por pagar"

> Tu cuenta: saldo en USDC, depositar, 21 facturas por pagar

Entras a tu cuenta como siempre: tu saldo, depositar, enviar. Y ahí están: veintiún facturas por pagar este mes. Seis normales, doce con algún problema y tres de proveedores que intentan colarte algo. En vez de revisarlas una por una, contratas a ORBIT.

## 3. Contratas al pagador y le cargas fondos [0:42–1:04] · pantalla: Panel, pasos 1 y 2 con el pago real en USDC y sus confirmaciones

> Se contrata pagando en USDC (x402). Sus fondos viven en su propia wallet.

Contratar al agente es un pago, como lo haría un agente: tu wallet le paga a ORBIT en USDC y el pagador queda activo al instante, sin cuenta ni tarjeta. Después le cargas fondos a su propia wallet. Ese es el dinero que puede mover, y nada más. Cada pago queda confirmado en la red.

## 4. Sus reglas [1:04–1:18] · pantalla: Reglas

> Las reglas viven en código. El modelo solo puede ser más estricto, nunca más laxo.

Las reglas las pones tú, una sola vez: cuánto puede pagar por factura, el presupuesto del mes, qué proveedores, en qué moneda, y desde qué monto apruebas tú. El agente nunca las cambia: solo puede ser más estricto, nunca más laxo.

## 5. Lo pones a trabajar: reglas + JEV [1:18–1:56] · pantalla: "Pon a ORBIT a trabajar", el tablero se llena; el detalle de un caso con el juicio de JEV

> Reglas en código + JEV (TypeSafe) para las preguntas difusas. JEV solo endurece, nunca afloja.

Y lo pones a trabajar. Cada factura se vuelve un caso con su enlace, y el proveedor lo recibe por correo. ORBIT lee la factura y la pasa por dos capas. Las reglas duras viven en código: límites, presupuesto, duplicados, moneda. Las preguntas difusas las responde JEV, de TypeSafe: ¿el concepto corresponde al contrato? ¿hay presión o ingeniería social en el mensaje? ¿qué riesgo tiene? Juicios tipados, en milisegundos. Y JEV solo puede hacer la decisión más estricta, nunca más laxa. Con eso decide: pagar, frenar o escalar. Las correctas se pagan solas, desde la wallet del agente, en USDC, y el proveedor lo recibe en su cuenta a través de Blinka.

## 6. Cuando algo no cuadra, lo resuelve [1:44–2:12] · pantalla: caso de Lucía, la conversación; la vista del proveedor con "Pago enviado" y la transacción

> Negocia la corrección con el proveedor. Nunca una cuenta nueva, nunca un monto mayor.

Aquí está la diferencia. Lucía mandó su factura en euros y la política solo permite dólares. ORBIT no se limita a frenarla: le escribe, le pide la factura en dólares, ella la reemite, y la versión corregida pasa por las mismas reglas. Cumple, se paga, y quedan el recibo firmado y la transacción en la red. Una corrección solo puede acercarse al contrato: nunca una cuenta nueva, nunca un monto mayor, nunca bajo presión. Los tres proveedores que lo intentaron terminaron en manos de una persona.

## 7. Tú solo ves lo que te toca [2:12–2:24] · pantalla: Aprobaciones

> Solo apruebas lo que las reglas reservan para una persona.

A ti te llega solo lo que las reglas reservan para una persona: un pago legítimo por encima de tu umbral, un proveedor nuevo, un presupuesto agotado. Apruebas con toda la conversación y los motivos a la vista.

## 8. Confianza que se puede verificar [2:24–2:45] · pantalla: Reportes; deck "Resultados" y "Qué sigue"

> 100 % de precisión · 0 pagos fuera de las reglas · cada decisión firmada

Veintiún facturas, doce trampas, tres proveedores comprometidos. Cien por ciento de precisión. Cero pagos fuera de las reglas, antes y después de negociar. Cada decisión firmada con las reglas vigentes. ORBIT: agentes que pagan y cobran por tu empresa, dentro de tus límites. Sobre Blinka, con JEV como capa de juicio rápido.

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
- **Enlaces:** repo https://github.com/DevCristobalvc/orbit · demo https://orbit.ekinoxis.xyz (login con Privy, o 123/123; espejo https://orbit.devcristobalvc.com) · eval `docs/eval.md` · video (pendiente)
