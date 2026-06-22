# Hotel Booking Tool — Test Data Reference

> **Testing dates:** 2026-06-22 (today), 2026-06-23 (tomorrow), 2026-06-24 (day after tomorrow)
> **PIN for all customers:** `1234`

---

## Customers

| Customer ID | Phone Number |
|-------------|--------------|
| CUST-001 | +971529070011 |
| CUST-002 | +971501230022 |
| CUST-003 | +971529010033 |

---

## Bookings

| Booking ID | Customer | Phone | Hotel | Check-in | Check-out | First Night | Total | Policy | Free Cancel Deadline | Status (as of Jun 22) |
|------------|----------|-------|-------|----------|-----------|-------------|-------|--------|----------------------|-----------------------|
| BK-2026-001 | CUST-001 | +971529070011 | Burj Al Arab Jumeirah | 2026-07-15 | 2026-07-20 | AED 2,500 | AED 12,500 | NON_REFUNDABLE | — | Always penalised |
| BK-2026-002 | CUST-001 | +971529070011 | Atlantis The Palm | 2026-07-01 | 2026-07-03 | AED 800 | AED 1,600 | FIRST_NIGHT_PENALTY | 2026-06-29 | Free to cancel |
| BK-2026-003 | CUST-001 | +971529070011 | Address Downtown | 2026-08-05 | 2026-08-08 | AED 450 | AED 1,350 | FULL_PRICE_PENALTY | 2026-08-03 | Free to cancel |
| BK-2026-004 | CUST-002 | +971501230022 | Armani Hotel Dubai | 2026-07-10 | 2026-07-15 | AED 950 | AED 2,850 | FIRST_NIGHT_PENALTY | 2026-07-08 | Free to cancel |
| BK-2026-005 | CUST-003 | +971529010033 | Burj Al Arab Hotel Dubai | 2026-08-20 | 2026-08-25 | AED 1,200 | AED 6,000 | FIRST_NIGHT_PENALTY | 2026-08-18 | Free to cancel |
| BK-2026-006 | CUST-001 | +971529070011 | Jumeirah Beach Hotel | 2026-06-23 | 2026-06-26 | AED 600 | AED 1,800 | FIRST_NIGHT_PENALTY | ~~2026-06-21~~ | **VIOLATION — AED 600 penalty** |
| BK-2026-007 | CUST-001 | +971529070011 | Four Seasons Resort Dubai | 2026-06-24 | 2026-06-27 | AED 750 | AED 2,250 | FULL_PRICE_PENALTY | ~~2026-06-22~~ | **VIOLATION — AED 2,250 penalty** |

---

## Cancellation Policy Types

| Policy | Behaviour |
|--------|-----------|
| `NON_REFUNDABLE` | Full booking price charged regardless of when cancelled |
| `FIRST_NIGHT_PENALTY` | No charge if cancelled before deadline; first night charged after |
| `FULL_PRICE_PENALTY` | No charge if cancelled before deadline; full booking price charged after |

---

## Free Cancellation Violation Scenarios

These two bookings are specifically designed to test penalty enforcement during the Jun 22–24 testing window. Both use `freeCancellationDays: 2`, meaning the deadline falls 2 days before check-in.

### BK-2026-006 — First Night Penalty (test on Jun 23)
- **Hotel:** Jumeirah Beach Hotel
- **Customer:** CUST-001 / +971529070011
- **Check-in:** 2026-06-23 (tomorrow)
- **Free cancellation expired:** 2026-06-21
- **Penalty:** AED 600 (first night)

### BK-2026-007 — Full Price Penalty (test on Jun 24)
- **Hotel:** Four Seasons Resort Dubai
- **Customer:** CUST-001 / +971529070011
- **Check-in:** 2026-06-24 (day after tomorrow)
- **Free cancellation expired:** 2026-06-22 (today)
- **Penalty:** AED 2,250 (full booking price)

