# ADR-001: Payments boundary

- **Status:** Accepted
- **Date:** 2026-11-20

## Context

Checkout backend розробляє одна команда, і він викладається як один deployment unit. До рефакторингу межі Payments фактично не було: Checkout будував Stripe payload, Orders, Reports і Notifications імпортували `payments/internal`, а `StripeClient` сам змінював статус замовлення через `orders/internal` (`REVIEW.md`, рядки 1–3 і 5).

Change request вимагає другого provider і статусу `processing` без змін для consumers. Отже, Payments потребує явного рішення: **яка в нього межа** — внутрішній модуль чи окремий сервіс.

Що вже є після рефакторингу:

- публічний контракт `src/payments/index.ts` (`createPaymentGateway`, `PaymentRequest`, `PaymentResult`, `PaymentStatus`);
- два adapters у `payments/internal` (Stripe і LocalPay), кожен зі своєю нормалізацією статусів;
- Payments не залежить від Orders;
- межа перевіряється автоматично: `npm run check:architecture`.

## Decision

**Payments залишається модулем усередині того самого застосунку.** Межу забезпечують публічний контракт і fitness functions, а не мережа.

Provider обирається конфігурацією (`runtimeConfig.paymentProvider`) у фабриці `createPaymentGateway()`. Consumers про вибір не знають.

## Alternatives considered

1. **Окремий Payments service** (власний deployment, власна база, HTTP або черга між Orders і Payments). Відхилено зараз: немає окремої команди, немає виміряної потреби масштабувати Payments окремо, а ціна велика — мережеві збої між Orders і Payments, невизначений результат при timeout, окремий pipeline, моніторинг і on-call.
2. **Без явної межі** (як у стартовій версії). Відхилено: кожен новий provider змінював би Checkout, Orders, Reports і Notifications.

## Consequences

**Переваги:**

- новий provider = новий adapter у `payments/internal` + один рядок у фабриці; consumers не змінюються (перевірено LocalPay);
- оплата викликається звичайною функцією без мережі, тож немає нових режимів відмови;
- межу легко перетворити на сервіс пізніше: публічний контракт уже provider-neutral і не залежить від Orders.

**Складність і обмеження:**

- Payments не масштабується і не релізиться окремо від решти застосунку;
- межа тримається на дисципліні та `check:architecture`; якщо прибрати перевірку з CI, межа може «розповзтися»;
- додатковий шар adapters і копіювання полів між типами.

## Microservice trigger

Payments варто винести в окремий сервіс, якщо виконується **хоча б одна** з вимірюваних умов:

1. **Незалежні релізи.** З'являється окрема команда Payments, і зміни Payments блокують або чекають реліз решти системи частіше ніж 2 рази на місяць протягом 2 місяців поспіль.
2. **Окреме масштабування.** Load test або production показують, що Payments споживає понад 50% CPU застосунку, або повільний provider піднімає checkout p95 вище 800 мс у 2+ інцидентах за квартал, і bulkhead у моноліті цього не виправляє.
3. **Ізоляція безпеки.** Система має почати сама обробляти дані карток (а не токени). Тоді вимоги PCI DSS роблять вигідним маленький ізольований периметр для Payments.
4. **Асинхронні підтвердження.** Providers переходять на webhooks з власним SLA (наприклад, 99,99%), який вищий за SLA решти застосунку, і приймач webhooks має бути доступним навіть під час релізу checkout.

Формулювання «microservices краще масштабуються» без однієї з цих змін **не** є причиною виносити Payments.