[33mcommit ac5eed3b8912651792999f4800922a8faa9bbfcc[m[33m ([m[1;36mHEAD[m[33m -> [m[1;32mmain[m[33m)[m
Author: Anita <lyutyanytsyaa@gmail.com>
Date:   Sat Nov 21 13:09:27 2026 +0200

    level 75: public Payments contract, Inventory ownership, no Orders-Payments cycle, pure calculateTotal

 DECISIONS.md                                       |  76 [32m+++++++++++[m[31m-[m
 REVIEW.md                                          |  25 [32m+++[m[31m-[m
 src/checkout/CheckoutController.ts                 |  42 [32m++++[m[31m---[m
 src/inventory/StockRepository.ts                   |  12 [31m--[m
 src/inventory/index.ts                             |  46 [32m+++++++[m
 src/inventory/internal/stockStore.ts               |  15 [32m+++[m
 src/notifications/paymentMessage.ts                |   2 [32m+[m[31m-[m
 src/orders/OrderService.ts                         |  68 [32m++++++[m[31m-----[m
 src/orders/internal/orderMutations.ts              |   9 [31m--[m
 src/orders/internal/orderRecords.ts                |  18 [32m+++[m
 src/payments/contract.ts                           |  26 [32m++++[m
 src/payments/index.ts                              |  11 [32m++[m
 src/payments/internal/{ => stripe}/StripeClient.ts |   8 [32m+[m[31m-[m
 src/payments/internal/stripe/StripeGateway.ts      |  26 [32m++++[m
 .../stripe/stripeStatus.ts}                        |   6 [32m+[m[31m-[m
 src/pricing/calculateTotal.ts                      |  23 [32m++++[m
 src/reports/paymentReport.ts                       |   2 [32m+[m[31m-[m
 src/shared/calculateTotal.ts                       |  23 [31m----[m
 tests/boundaries.test.ts                           | 136 [32m+++++++++++++++++++++[m
 tests/paymentStatus.test.ts                        |   2 [32m+[m[31m-[m
 20 files changed, 468 insertions(+), 108 deletions(-)
