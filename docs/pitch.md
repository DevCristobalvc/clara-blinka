# ORBIT · guion del video (2:30) y pitch

Narración en español para ElevenLabs. Cada bloque indica lo que se ve en pantalla. Duración aproximada por bloque entre corchetes.

---

## 0. Gancho [0:00–0:15] · pantalla: landing

Toda empresa en Estados Unidos que trabaja con equipo y proveedores en Latinoamérica hace lo mismo cada mes: recibe facturas por correo, PDF o chat, las compara con lo acordado, persigue al proveedor cuando algo no cuadra, pide aprobación y paga a mano. Es manual, se repite, y depende de que alguien esté disponible.

ORBIT es la plataforma donde tus agentes de IA cobran y pagan por tu empresa. Actúan con autonomía. Nunca sin límites.

## 1. Una sola configuración [0:15–0:40] · pantalla: Reglas, luego Configuración → Agentes

Configuras tu agente una sola vez: límite por pago, presupuesto mensual por categoría, proveedores permitidos con su cuenta registrada, monedas, y qué motivos puede negociar y cuáles nunca.

Y lo contratas como lo haría un agente: pagándole a ORBIT en USDC. Sin cuenta, sin tarjeta. Activas el pagador, le cargas fondos a su propia wallet, y queda listo. El cobrador, que hace lo mismo para lo que te deben, se activa igual.

## 2. Un enlace por pago [0:40–1:05] · pantalla: Facturas → Nuevo caso → enlace; vista del proveedor

Cada pago es un caso con su enlace. Eliges el proveedor y el contrato, y el proveedor adjunta su factura ahí: PDF, imagen, correo o chat. ORBIT la lee, la revisa contra las reglas y decide en segundos: pagar, frenar o escalar a una persona.

## 3. Cuando algo no cuadra, lo resuelve [1:05–1:40] · pantalla: Facturas corriendo el set; caso de Lucía con la conversación

Aquí está la diferencia. Lucía manda su factura en euros, y la política solo permite dólares. ORBIT no se limita a frenarla: le escribe, le pide la factura en dólares, ella la reemite, y la versión corregida pasa por las mismas reglas. Cumple, se registra el pago, y queda un recibo firmado.

Una corrección solo puede acercarse al contrato. Nunca una cuenta nueva, nunca un monto mayor, nunca bajo presión. Tres proveedores del set intentan exactamente eso. Los tres terminan en manos de una persona.

## 4. Las personas solo ven lo que les toca [1:40–2:00] · pantalla: Aprobaciones

Lo único que llega a una persona es lo que las reglas no dejan decidir solo al agente: un pago legítimo por encima del umbral, un proveedor nuevo, un presupuesto agotado. Aprobar o rechazar, con toda la conversación y los motivos a la vista.

## 5. Confianza que se puede verificar [2:00–2:20] · pantalla: Reportes; recibo firmado

Veintiún facturas, doce trampas, tres proveedores comprometidos. Cien por ciento de precisión. Cero pagos fuera de las reglas, antes y después de negociar. Cada decisión firmada con el hash de las reglas vigentes, verificable por cualquiera.

## 6. Cierre [2:20–2:30] · pantalla: landing o logo

ORBIT. Agentes que pagan y cobran por tu empresa, dentro de tus límites, y que te explican cada decisión. Construido sobre Blinka, con JEV como capa de juicio rápido.

---

## Pitch de 60 segundos (para la sesión en vivo)

1. **Problema.** Finanzas hace a mano, cada mes, lo que un agente debería hacer: leer, comparar, perseguir, aprobar, pagar. Lo que falta es confianza.
2. **Qué es ORBIT.** Agentes que pagan y cobran por la empresa, dentro de reglas que la empresa define una vez. Se contratan pagando en USDC; cada pago es un enlace donde el agente conversa con el proveedor hasta que la factura cuadra.
3. **Por qué se puede confiar.** Los límites viven en código. El modelo (JEV, Claude) solo puede volver una decisión más estricta, nunca más laxa. Una corrección solo puede acercarse al contrato. Cada decisión queda firmada.
4. **Prueba.** 21 facturas, 12 trampas, 3 proveedores comprometidos: 100% de precisión, 0 pagos fuera de reglas, 76% sin intervención humana, 3 de 10 frenadas resueltas con el proveedor.
5. **Qué sigue.** El cobrador con las reglas invertidas; agentes pagándole a agentes por caso con x402; negociación sin revelar los límites de ninguna de las partes.

## Datos para el formulario de HackRadar

- **Nombre:** ORBIT
- **Reto:** Blinka · Agentes que pagan por la empresa
- **Descripción (corta):** ORBIT es la plataforma donde los agentes de IA de una empresa cobran y pagan por ella. El pagador lee cada factura, la revisa contra las reglas de la empresa, negocia correcciones con el proveedor en un enlace por pago, y paga, frena o escala a una persona, con un recibo firmado por decisión. Se contrata pagando en USDC (x402). 21 facturas de prueba con 12 trampas y 3 proveedores comprometidos: 0 pagos fuera de reglas.
- **Enlaces:** repo https://github.com/DevCristobalvc/orbit · demo https://orbit.devcristobalvc.com (login 123/123 o Privy) · eval `docs/eval.md` · video (pendiente)
