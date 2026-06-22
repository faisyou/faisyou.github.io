# Voxi Movie Night Planner — Lambda Reference & Budget Test Scenarios

Extracted directly from the Lambda implementation (`index.js`). This is what the tools actually do
and return at runtime — useful for testing an AVA build against real behavior, not just the documented
schema.

---

## 1. Tool Routing (as implemented)

The Lambda dispatches on a `tool_name` field. These are the exact strings it matches on:

| `tool_name` string | Function | One-line behavior |
|---|---|---|
| `get_movies_by_genre` | `getMoviesByGenre` | Filters the in-memory movie list by genre |
| `get_showtimes` | `getShowtimes` | Filters showtimes for one movie by day-type, time window, and optional max price |
| `get_food_items` | `getFoodItems` | Filters food items by category and optional max price |
| `create_cart` | `createCart` | Creates a cart in DynamoDB, optionally with a budget |
| `add_item_to_cart` | `addItemToCart` | Adds a ticket or food item, enforcing the budget if one exists |
| `remove_item_from_cart` | `removeItemFromCart` | Removes one line item, recalculates total/remaining budget |
| `get_cart_detail` | `getCartDetail` | Returns full cart state — **note the singular "detail," not "details"** |
| `checkout_cart` | `checkoutCart` | Locks the cart, returns a payment code, 15-minute window |
| `confirm_payment` | `confirmPayment` | Simulates payment (80% success), returns ticket + food pickup info |

`confirm_payment` is the post-checkout step that was explicitly scoped **out** of the main workshop
exercise — it's implemented here as the challenge-exercise extension, in case anyone wants to push past
the payment code.

Cart records live in DynamoDB with a 15-minute TTL; payment records have a 5-minute TTL. Both expire
automatically — useful if you want to test what happens to a stale `cart_id`.

---

## 2. Mock Data Reference

### Movies

| movie_id | title | genre | duration_minutes | rating | description |
|---|---|---|---|---|---|
| mov_001 | The Action Hero Returns | action | 142 | PG-13 | An action-packed thriller |
| mov_002 | Laugh Out Loud | comedy | 98 | PG | A hilarious comedy |
| mov_003 | Epic Space Journey | scifi | 156 | PG-13 | A scifi adventure |
| mov_004 | The Horror House | horror | 105 | R | A terrifying horror film |
| mov_005 | Love in Paris | romance | 118 | PG-13 | A romantic drama |

**⚠️ mov_004 and mov_005 have zero showtimes in the mock data.** `get_showtimes` will always return an
empty array for either of these — useful for testing the "nothing available" conversation branch.

### Showtimes

Showtimes are **not** stored against specific calendar dates — they're stored against a `day_type`
(`weekday` or `weekend`). The Lambda converts whatever `date` you pass into a day of week (UTC) and
returns showtimes matching that type, with your requested date attached to the response.

**mov_001 — The Action Hero Returns**

| showtime_id | day_type | time | price_aed | screen_type | cinema | available_seats |
|---|---|---|---|---|---|---|
| show_001 | weekday | 14:00 | 35.00 | standard | Cinema Dubai Mall | 120 |
| show_002 | weekday | 17:30 | 40.00 | standard | Cinema Dubai Mall | 95 |
| show_003 | weekday | 21:00 | 45.00 | standard | Cinema Dubai Mall | 84 |
| show_004 | weekend | 12:00 | 50.00 | standard | Cinema Dubai Mall | 100 |
| show_005 | weekend | 15:30 | 55.00 | standard | Cinema Dubai Mall | 75 |
| show_006 | weekend | 19:00 | 60.00 | standard | Cinema Dubai Mall | 60 |
| show_007 | weekend | 21:30 | 75.00 | imax | Cinema Dubai Mall | 52 |

**mov_002 — Laugh Out Loud**

| showtime_id | day_type | time | price_aed | screen_type | cinema | available_seats |
|---|---|---|---|---|---|---|
| show_008 | weekday | 15:00 | 35.00 | standard | Cinema Marina | 110 |
| show_009 | weekday | 19:00 | 40.00 | standard | Cinema Marina | 88 |
| show_010 | weekend | 13:00 | 45.00 | standard | Cinema Marina | 95 |
| show_011 | weekend | 20:00 | 50.00 | standard | Cinema Marina | 70 |

**mov_003 — Epic Space Journey**

| showtime_id | day_type | time | price_aed | screen_type | cinema | available_seats |
|---|---|---|---|---|---|---|
| show_012 | weekday | 18:00 | 70.00 | imax | Cinema Mall of Emirates | 45 |
| show_013 | weekday | 21:00 | 75.00 | imax | Cinema Mall of Emirates | 38 |
| show_014 | weekend | 14:00 | 80.00 | imax | Cinema Mall of Emirates | 55 |
| show_015 | weekend | 18:00 | 85.00 | imax | Cinema Mall of Emirates | 42 |
| show_016 | weekend | 22:00 | 85.00 | imax | Cinema Mall of Emirates | 30 |

### Food Items

| item_id | name | category | price_aed | size | description |
|---|---|---|---|---|---|
| food_001 | Popcorn | snack | 15.00 | medium | Classic salted popcorn |
| food_002 | Popcorn | snack | 20.00 | large | Classic salted popcorn |
| food_003 | Nachos | snack | 20.00 | regular | Tortilla chips with cheese sauce |
| food_004 | Hot Dog | maincourse | 25.00 | regular | Classic hot dog |
| food_005 | Burger | maincourse | 40.00 | regular | Beef burger with fries |
| food_006 | Pizza Slice | maincourse | 18.00 | regular | Pepperoni pizza slice |
| food_007 | Coca Cola | drinks | 8.00 | medium | Coca Cola |
| food_008 | Coca Cola | drinks | 12.00 | large | Coca Cola |
| food_009 | Orange Juice | drinks | 10.00 | regular | Fresh orange juice |
| food_010 | Ice Cream | desserts | 15.00 | regular | Vanilla ice cream |
| food_011 | Chocolate Brownie | desserts | 18.00 | regular | Warm chocolate brownie |

---

## 3. Implementation Notes — code vs. documented schema

A few things the Lambda actually does that differ from what's commonly written in the tool spec docs.
Worth knowing before you start testing:

- **Genre values use no hyphen:** the code's allow-list is `action, comedy, drama, horror, romance, thriller, scifi, animation, documentary` — `scifi`, not `sci-fi`. A call with the hyphenated form will fail `INVALID_GENRE`. (Note also: `drama` and `thriller` are allowed genres in code, but there are no movies of those genres in the mock data — they'll always return an empty list.)
- **Category values are one word:** `snack, maincourse, drinks, desserts` — `maincourse`, not `main-course`. The hyphenated form fails `INVALID_CATEGORY`.
- **`time_window_start` and `time_window_end` are required, not optional**, in `get_showtimes`. Calling without them returns `MISSING_PARAMETER`, regardless of what the tool's input schema marks as optional.
- **`get_showtimes` also returns `available_seats`** for every showtime — it isn't stripped from the response, even though it's easy to miss when skimming the schema.
- **`get_food_items` also returns a `priceRange` object** (`{ min, max }` across the filtered results) alongside `foodItems` — an extra field beyond the item list itself.
- **The tool name is `get_cart_detail` (singular), not `get_cart_detail**s**`.** If your AVA's tool is wired up with the plural name, it won't match this Lambda's routing.

---

## 4. Budget Mechanics — how it actually works in code

- Budget is **entirely optional per cart**. If `budget_aed` is omitted on `create_cart`, the cart has no
  budget at all — `cartBudget` and `cartBudgetRemaining` will never appear in *any* later response for
  that cart, and no addition will ever be blocked on price.
- If a budget is set, every `add_item_to_cart` call checks `cart.total + (price × quantity)` against
  `budget_aed` **before** adding the item. If it would exceed the budget, the item is **not added at
  all** — there's no partial-fill behavior — and the error message reports the exact shortfall:
  `Budget exceeded by X.XX AED`.
- The check uses `>`, not `>=` — spending the budget down to exactly `0.00` is allowed; only going
  *over* is blocked.
- Quantity is multiplied into the subtotal **before** the budget check runs. Three items that would
  individually fit can still collectively fail.
- `remove_item_from_cart` recalculates `remaining_budget` immediately — removing something can unlock a
  previously budget-blocked addition on a later call.
- `create_cart` itself validates `budget_aed > 0` — a zero or negative budget is rejected outright with
  `INVALID_BUDGET`, before a cart is even created.

---

## 5. Budget Test Scenarios

All scenarios below use real mock-data IDs and prices so they're directly runnable. Dates assume
**2026-06-24** (a Wednesday → `weekday`) and **2026-06-27** (a Saturday → `weekend`) as concrete example
dates; use `time_window_start: "00:00"`, `time_window_end: "23:59"` to avoid incidental time filtering.

### Scenario 1 — No budget set (unconstrained cart)
1. `create_cart` — no `budget_aed`
2. `add_item_to_cart` — ticket `show_007` (AED 75, imax)
3. `get_cart_detail`

**Expected:** every step succeeds regardless of price. `cartStatus` in step 3 contains `cartTotal` only
— `cartBudget` and `cartBudgetRemaining` are absent entirely.

### Scenario 2 — Budget spent exactly to zero (boundary case)
1. `create_cart` — `budget_aed: 35`
2. `add_item_to_cart` — ticket `show_001` (AED 35)

**Expected:** success. `cartTotal: 35`, `cartBudgetRemaining: 0`. Confirms the check is `>`, not `>=`.

### Scenario 3 — Single item exceeds budget (hard block)
1. `create_cart` — `budget_aed: 30`
2. `add_item_to_cart` — ticket `show_001` (AED 35)

**Expected:** `BUDGET_EXCEEDED`, message `Budget exceeded by 5.00 AED`. Item is not added; cart total
stays `0`.

### Scenario 4 — Budget exceeded partway through a multi-item cart
1. `create_cart` — `budget_aed: 50`
2. `add_item_to_cart` — ticket `show_001` (AED 35) → success, remaining `15`
3. `add_item_to_cart` — food `food_005` Burger (AED 40) → **expected: `BUDGET_EXCEEDED`,** `Budget exceeded by 25.00 AED`; remaining still `15`
4. `add_item_to_cart` — food `food_007` Coca Cola medium (AED 8) → success, remaining `7`

**Expected:** the rejected step 3 doesn't affect anything — step 4 still succeeds against the
pre-rejection remaining budget.

### Scenario 5 — Quantity multiplies against budget before the check
1. `create_cart` — `budget_aed: 40`
2. `add_item_to_cart` — food `food_001` Popcorn medium (AED 15), `quantity: 3`

**Expected:** `BUDGET_EXCEEDED`, `Budget exceeded by 5.00 AED` (subtotal = 45, not 15). Confirms quantity
is multiplied in before the budget comparison — a single popcorn would have fit, three doesn't.

### Scenario 6 — Removing an item frees budget for a previously-rejected item
1. `create_cart` — `budget_aed: 50`
2. `add_item_to_cart` — ticket `show_002` (AED 40) → success, remaining `10`, note the returned `cart_item_id`
3. `add_item_to_cart` — food `food_005` Burger (AED 40) → **expected: `BUDGET_EXCEEDED`** (remaining only 10)
4. `remove_item_from_cart` — the ticket's `cart_item_id` from step 2 → remaining returns to `50`
5. `add_item_to_cart` — food `food_005` Burger (AED 40) again → **expected: success this time,** remaining `10`

**Expected:** confirms `remove_item_from_cart` recalculates `remaining_budget` correctly, and that a
previously-blocked addition can succeed once budget is freed up.

### Scenario 7 — Even a cheap item fails at exactly-zero remaining
1. `create_cart` — `budget_aed: 35`
2. `add_item_to_cart` — ticket `show_001` (AED 35) → success, remaining `0`
3. `add_item_to_cart` — food `food_007` Coca Cola (AED 8) → **expected: `BUDGET_EXCEEDED`,** `Budget exceeded by 8.00 AED`
4. `get_cart_detail` → `cartTotal: 35`, `cartBudget: 35`, `cartBudgetRemaining: 0`, exactly 1 item

**Expected:** confirms there's no rounding leniency — `0` remaining blocks everything, no matter how
small.

### Scenario 8 — Invalid budget input is rejected at creation
1. `create_cart` — `budget_aed: 0` → expected: `INVALID_BUDGET`, `budget_aed must be greater than 0`
2. `create_cart` — `budget_aed: -20` → expected: same `INVALID_BUDGET` error

**Expected:** no cart is created in either case.

### Scenario 9 — Discovery-time budget filtering (`max_price_aed`), not cart-time enforcement
This is a different budget mechanic — filtering search results, not blocking an addition.
1. `get_showtimes` — `movie_id: mov_001`, `date: 2026-06-24`, `time_window_start: 00:00`, `time_window_end: 23:59`, `max_price_aed: 40`

   **Expected:** only `show_001` (35) and `show_002` (40) returned; `show_003` (45) excluded.
2. `get_food_items` — `category: snack`, `max_price_aed: 18`

   **Expected:** only `food_001` Popcorn medium (15) returned; `food_002` (20) and `food_003` (20)
   excluded.

Good for testing the "search within what's left of the budget" behavior an AVA should exhibit once a
cart's `cartBudgetRemaining` drops — that remaining figure is exactly what should be passed in as
`max_price_aed` on the next search.

### Scenario 10 — End-to-end: budget spent down, then checkout
1. `create_cart` — `budget_aed: 50`
2. `add_item_to_cart` — ticket `show_001` (AED 35) → remaining `15`
3. `add_item_to_cart` — food `food_009` Orange Juice (AED 10) → total `45`, remaining `5`
4. `checkout_cart`

**Expected:** success, `payment_code` in the format `MOVIE` + 4 characters (e.g. `MOVIEA7K2`),
`total: 45`, `expires_at` ≈ 15 minutes ahead. This is the finish line for the core exercise — stop here
unless you're doing the `confirm_payment` challenge extension.
