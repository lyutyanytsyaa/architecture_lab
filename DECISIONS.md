# Decision log

## Decision 1: єдина нормалізація payment status у Payments

**Problem:** однакове перетворення Stripe-статусу скопійоване в Orders, Reports і Notifications.

**Evidence:** `src/orders/mapPaymentStatus.ts:3-7`, `src/reports/mapPaymentStatus.ts:3-7`, `src/notifications/mapPaymentStatus.ts:3-7`.

**Decision:** одна функція `normalizeStripeStatus` у Payments; три копії видалено, consumers отримують тип `PaymentStatus`.

**Why:** новий статус `processing` тепер додається в одному місці, тож статуси в замовленні, звіті й сповіщенні не можуть розійтися, а зміна provider не зачіпає consumers.

**Alternative:** спільна функція в `shared/`.

**Why rejected:** назви статусів Stripe знову стали б загальним знанням для всіх модулів.

**Trade-off:** Reports і Notifications залежать від типу з Payments.

**Verification:** unit tests для `paid`, `processing`, `failed`, невідомого статусу; стартові тести проходять.

## Decision 2: невідомий статус provider означає processing

**Problem:** provider може повернути статус, якого немає в нашому mapping.

**Evidence:** стартовий mapping повертав `failed` для будь-якого невідомого значення (`src/orders/mapPaymentStatus.ts:6`).

**Decision:** невідомий статус нормалізується в `processing`: замовлення не підтверджується, але й не вважається неоплаченим.

**Why:** невідомий статус — це невідомий результат. Гроші могли бути списані: `failed` підштовхне клієнта заплатити вдруге, `paid` відвантажить товар без оплати.

**Alternative:** `failed` або виняток.

**Why rejected:** `failed` ризикує подвійним списанням, виняток ламає checkout для клієнта, гроші якого, можливо, вже отримано.

**Trade-off:** такі замовлення потребують окремої звірки статусу з provider.

**Verification:** тест на `some_new_state` і порожній рядок.