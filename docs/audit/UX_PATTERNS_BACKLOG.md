# UX patterns backlog (honest status)

| Pattern | Status | Notes |
| --- | --- | --- |
| Skeleton loaders (`BoneyardSkeleton`) | **DONE** | All major `pages/` + `ChartPanel` loading |
| Optimistic UI | **PARTIAL** | Alerts ack/resolve, admin role assign |
| Undo toasts | **STARTED** | `notifyWithUndo` in `toast.js` — wire per action |
| Stale-while-revalidate | **PARTIAL** | Dashboard/ops staged load; no SWR library |
| BlurHash placeholders | **DEFER** | `LazyImage` uses native lazy only |
| View Transitions API | **DEFER** | `@view-transition` when browser support stable |
| Swipe-to-dismiss sheets | **DEFER** | Drawers use Escape; no touch sheet lib |
| Interruptible motion | **PARTIAL** | `prefers-reduced-motion` global |
| Safe area insets | **PARTIAL** | Landing back-top + marketing chrome |
| OTP autofill | **DONE** | Login MFA `autocomplete="one-time-code"` |
| Tabular nums | **PARTIAL** | KPIs/EDT; expand via tokens |
| Balanced headlines | **PARTIAL** | Landing `text-balance` |
| Copy button | **PARTIAL** | Reports; reuse pattern elsewhere |
| Form success/error | **PARTIAL** | Auth + ConfirmDialog |
