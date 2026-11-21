# Architecture review

> Заповнено **до** рефакторингу на стартовому коді (commit `8a52a13`). Номери рядків стосуються саме цієї версії.

| # | Principle | Evidence (file:line) | Practical risk | Fix |
|---|---|---|---|---|
| 1 | Information hiding | `src/checkout/CheckoutController.ts:3`, `:22-28` | Checkout сам будує Stripe payload: поля `id`, `amount` у копійках, `metadata.orderId`. Для другого provider із іншим форматом запиту доведеться міняти HTTP/controller-код, хоча логіка checkout не змінюється. | Payments приймає provider-neutral `PaymentRequest` і сам перетворює його на payload конкретного provider. |
| 2 | Explicit contracts | `src/orders/OrderService.ts:4`, `src/checkout/CheckoutController.ts:3`, `src/orders/mapPaymentStatus.ts:1`, `src/reports/mapPaymentStatus.ts:1`, `src/notifications/mapPaymentStatus.ts:1` | П'ять місць імпортують `payments/internal/StripeClient`. Будь-яке перейменування поля Stripe або заміна клієнта ламає модулі, які не відповідають за оплату. Межі Payments фактично немає. | Один публічний вхід `src/payments/index.ts`; все в `payments/internal` — implementation details. |
| 3 | Low coupling | `src/orders/mapPaymentStatus.ts:3-7`, `src/reports/mapPaymentStatus.ts:3-7`, `src/notifications/mapPaymentStatus.ts:3-7` | Одне й те саме перетворення Stripe-статусу скопійоване тричі. Щоб додати `processing`, треба синхронно змінити три модулі; пропуск одного дасть різні статуси того самого платежу в замовленні, звіті й сповіщенні. | Єдина нормалізація в Payments; consumers отримують уже стабільний `PaymentStatus`. |
| 4 | Ownership | `src/orders/OrderService.ts:15-26`, `src/inventory/StockRepository.ts:9-11` | Orders сам читає і перезаписує `database.stock`, а `updateAvailable` дозволяє будь-кому записати довільне число. Правило `available ≥ 0` ніхто не захищає. Крім того, цикл списує позиції по одній: якщо друга позиція недоступна, перша вже списана — часткова зміна залишків. | Inventory отримує операцію `reserve(lines)`: перевіряє всі позиції, потім списує все або нічого. Інші модулі не мають доступу до stock storage. |
| 5 | Dependency direction | `src/payments/internal/StripeClient.ts:2`, `:20`; `src/orders/OrderService.ts:4` | Payments імпортує `orders/internal/orderMutations` і сам змінює статус замовлення. Виходить цикл Orders → Payments → Orders: Payments не можна протестувати чи винести окремо без Orders, а статус замовлення записується у двох місцях (`StripeClient.ts:20` і `OrderService.ts:32-33`). | Payments повертає результат і нічого не знає про Orders; Orders сам оновлює своє замовлення. |
| 6 | Local reasoning | `src/shared/calculateTotal.ts:1`, `:15`, `:19-21` | Результат залежить від глобального `runtimeConfig`, функція мутує вхідні `lines` (`lineTotal`) і пише в `auditLog`. Один і той самий виклик дає різний результат залежно від стану config; тест мусить скидати глобальний стан. | Явні входи `{ lines, taxRate, discountPercent }`, без мутації та side effects; audit — у Checkout після обчислення. |
| 7 | High cohesion | `src/orders/OrderService.ts:14-35` | `placeOrder` одночасно перевіряє склад, списує залишки, створює замовлення, викликає Stripe і мапить статус. У методу щонайменше три причини змін: склад, оплата, життєвий цикл замовлення. | Orders лише координує життєвий цикл замовлення, а склад і оплату делегує власникам через їхні публічні API. |
| 8 | Fitness functions | `package.json:9-13` (немає перевірок архітектури); правила існують лише як коментарі `OrderService.ts:3`, `:21` | Правила меж ніде не перевіряються автоматично. Після рефакторингу будь-який новий import з `internal` або запис у чужу таблицю знову пройде непомітно. | `npm run check:architecture` з ненульовим exit code для порушень (рівень 90). |
| 9 | Design for change | `src/shared/calculateTotal.ts:1-23` | Бізнес-правило ціноутворення лежить у безликому `shared`. Будь-який модуль може залежати від `shared`, а `shared` сам залежить від `config` — так з'являються неявні залежності «всі від усіх». | Перенести розрахунок у модуль `pricing` з явним контрактом. |

## Change impact prediction (заповнити до реалізації change request)

**Requirement:** підтримати другий навчальний payment provider і новий нормалізований статус `processing`. Публічний Checkout API та поведінка `paid` і `failed` не змінюються. Provider-specific payload, response і назви статусів не виходять за межі Payments.

**Expected files:**

- `src/payments/index.ts` — новий публічний контракт (`authorizePayment`, `PaymentStatus`, `PaymentResult`);
- `src/payments/internal/*` — Stripe adapter, нормалізація статусів, другий adapter;
- `src/orders/OrderService.ts` — викликати Payments через публічний API, не знати Stripe;
- `src/checkout/CheckoutController.ts` — прибрати побудову Stripe payload;
- `src/orders/mapPaymentStatus.ts`, `src/reports/mapPaymentStatus.ts`, `src/notifications/mapPaymentStatus.ts` — видалити дублікати;
- нові тести для нормалізації і для обох provider.

**Modules that should not change:**

- `src/inventory/*` — склад не стосується оплати;
- `src/shared/calculateTotal.ts` — розрахунок суми не залежить від provider;
- `src/database.ts`;
- `tests/checkout.functional.test.ts` — стартові тести мають пройти без змін;
- форма відповіді `CheckoutController.checkout()` (`orderId`, `status`, `total`, `paymentStatus`).

## Actual impact (заповнити після реалізації)

**Actual files changed (рівні 60 і 75):**

| Модуль | Зміна |
|---|---|
| Payments | нові `src/payments/contract.ts`, `src/payments/index.ts`, `internal/stripe/StripeGateway.ts`, `internal/stripe/stripeStatus.ts`; `StripeClient.ts` перенесено в `internal/stripe/` і він більше не імпортує Orders |
| Orders | `src/orders/OrderService.ts` переписано; `internal/orderMutations.ts` → `internal/orderRecords.ts` (тепер його викликає тільки Orders) |
| Checkout | `src/checkout/CheckoutController.ts` — без Stripe payload, з явними входами для розрахунку та audit після нього |
| Reports, Notifications | видалено дублікати `mapPaymentStatus.ts`; додано `paymentReport.ts` і `paymentMessage.ts`, які працюють тільки з `PaymentStatus` |
| Inventory | `StockRepository.ts` видалено; нові `src/inventory/index.ts` (`Inventory.reserve`) і `internal/stockStore.ts` |
| Pricing | `src/shared/calculateTotal.ts` → `src/pricing/calculateTotal.ts`, тепер чиста функція |
| Tests | нові `tests/paymentStatus.test.ts`, `tests/boundaries.test.ts`; `tests/checkout.functional.test.ts` **не змінено** |

Не змінилися, як і прогнозувалося: `src/database.ts`, `src/config.ts`, `src/demo.ts`, стартові тести, форма відповіді Checkout (`orderId`, `status`, `total`, `paymentStatus`).

**Difference from prediction and explanation:**

1. **Inventory і calculateTotal змінилися, хоча прогноз казав, що ні.** Для самого change request (provider + `processing`) вони справді не потрібні. Їх змінили окремі завдання рівня 75: ownership залишків і local reasoning. Тобто прогноз був правильним для change request, але не враховував запланований рефакторинг меж.
2. **Orders змінився глибше, ніж очікувалося.** Я прогнозувала лише заміну імпорту Stripe на публічний API. Насправді довелося перенести запис статусу замовлення зі `StripeClient.ts:20` в Orders, бо інакше лишався цикл Orders → Payments → Orders. Цього не було видно, поки я не почала прибирати залежність.
3. **Reports і Notifications не просто втратили файли.** Я лишила в них маленькі функції, що працюють з нормалізованим статусом, щоб показати: consumers більше не знають назв статусів provider.
4. **Другий provider (рівень 90) змінив тільки Payments і тести** — див. нижче.