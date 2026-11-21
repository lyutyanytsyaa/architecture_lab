# Decision log

Кожне рішення: 80–120 слів. Рядки evidence посилаються на стартовий код (`8a52a13`), якщо не сказано інше.

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

## Decision 3: provider-neutral публічний контракт Payments

**Problem:** Checkout і Orders знали формат Stripe payload і імпортували `payments/internal`.

**Evidence:** `src/checkout/CheckoutController.ts:3`, `:22-28`; `src/orders/OrderService.ts:4`, `:14`.

**Decision:** `src/payments/index.ts` експортує `createPaymentGateway()` і типи `PaymentRequest`, `PaymentResult`, `PaymentStatus`. Stripe payload, response і client — лише в `payments/internal/stripe`.

**Why:** зміна provider або формату Stripe тепер локалізована в Payments; Checkout і Orders говорять мовою замовлення, а не мовою Stripe.

**Alternative:** лишити `StripeClient` публічним і додати поруч другий client.

**Why rejected:** кожен consumer мусив би обирати client і будувати payload сам, тобто знання про provider розійшлося б ще ширше.

**Trade-off:** з'явився додатковий шар adapter і копіювання полів між типами.

**Verification:** тест, що результат має лише `status` і `paymentId`; стартові тести без змін.

## Decision 4: Inventory сам резервує залишки, все або нічого

**Problem:** Orders напряму читав і перезаписував `database.stock`, а інваріант `available ≥ 0` ніхто не захищав.

**Evidence:** `src/orders/OrderService.ts:15-26`, `src/inventory/StockRepository.ts:9-11`.

**Decision:** `Inventory.reserve(lines)` спочатку перевіряє всі позиції, потім списує. При нестачі кидає `OutOfStockError` і нічого не змінює. `updateAvailable` видалено, storage доступний лише через `inventory/internal`.

**Why:** правило складу тепер живе в одному власнику й не може бути обійдене; часткове списання неможливе.

**Alternative:** лишити перевірку в Orders, але обгорнути її в «транзакцію».

**Why rejected:** правило все одно знали б кілька модулів, і новий consumer міг би його пропустити.

**Trade-off:** при невдалій оплаті резерв не повертається — поведінку стартової версії збережено, відкат резерву потребує окремого рішення.

**Verification:** тест із двома позиціями без часткової зміни залишків.

## Decision 5: Payments не залежить від Orders

**Problem:** `StripeClient` імпортував `orders/internal/orderMutations` і сам змінював статус замовлення, утворюючи цикл.

**Evidence:** `src/payments/internal/StripeClient.ts:2`, `:20`; `src/orders/OrderService.ts:4`, `:32-33`.

**Decision:** Payments лише повертає `PaymentResult`. Статус замовлення оновлює Orders через власний `orders/internal/orderRecords.ts`. Напрям залежностей: Checkout → Orders → {Inventory, Payments}.

**Why:** напрям випливає з ownership: замовленням володіє Orders, тому лише він змінює його статус. Payments можна тестувати й винести окремо без Orders.

**Alternative:** callback `onPaid` у Payments, який реєструє Orders.

**Why rejected:** цикл зник би з imports, але лишився б у поведінці, і Payments знову керував би чужими даними.

**Trade-off:** Orders тепер явно викликає два кроки: оплату й запис результату.

**Verification:** тест Orders із фейковим `PaymentGateway`.

## Decision 6: calculateTotal — чиста функція з явними входами

**Problem:** розрахунок читав глобальний config, мутував вхідні рядки кошика і писав audit log.

**Evidence:** `src/shared/calculateTotal.ts:1`, `:15`, `:19-21`.

**Decision:** `calculateTotal({ lines, taxRate, discountPercent })` у модулі `pricing` повертає лише число. Checkout читає config, викликає розрахунок і після нього пише audit.

**Why:** результат можна зрозуміти й перевірити лише за аргументами; caller не отримує несподівано змінений кошик.

**Alternative:** передавати весь `runtimeConfig` об'єктом.

**Why rejected:** функція знову залежала б від усього config, а не від двох потрібних значень, і зміна config непомітно впливала б на розрахунок.

**Trade-off:** Checkout має більше коду оркестрації, а tax і discount треба явно передавати в кожному виклику.

**Verification:** тести на детермінованість, відсутність audit і незмінність frozen lines.