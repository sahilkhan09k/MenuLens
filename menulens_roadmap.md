# MenuLens — Prioritized Feature Roadmap

> Ordered by **impact × feasibility** given your current codebase. Each feature shows exactly what to build and where.

---

## Priority 1 — Quick Wins (1–2 days each)
*High impact, minimal code changes, leverages what you already have.*

---

### 1.1 ⭐ Feedback → Scoring Loop (Close the Loop)

**Why first:** You already have [FeedbackButton.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/components/FeedbackButton.jsx) and [feedback.controller.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/controllers/feedback.controller.js) — but feedback goes to the review queue and **dies there**. Right now user feedback doesn't improve scoring. Closing this loop makes your AI get smarter over time.

**What to build:**
| Change | File | Detail |
|---|---|---|
| Add `👍/👎` quick reaction | [DishDetail.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/DishDetail.jsx) | Add a simple "Was this recommendation helpful? 👍 👎" row below the recommend/avoid reasons (line ~215). No modal needed, just two icon buttons. |
| Store reaction on the Dish | [Dish.model.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/models/Dish.model.js) | Add `userReaction: { type: String, enum: ['helpful', 'not_helpful', null] }` |
| New endpoint | [dish.routes.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/routes/dish.routes.js) | `PUT /api/dish/:dishId/react` — sets the reaction |
| Admin stats | [AdminDashboard.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/admin/AdminDashboard.jsx) | Show % helpful vs not_helpful to know where scoring fails |

**Effort:** ~4 hours

---

### 1.2 📤 Polish the Share Flow (Your Growth Engine)

**Why now:** [ShareCard.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/components/ShareCard.jsx) is already 489 lines with 3 beautiful designs. But sharing is **only accessible from DishDetail** (line 238–244 in [DishDetail.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/DishDetail.jsx)). Users need to tap into a dish → scroll down → hit share. Too many steps.

**What to build:**
| Change | File | Detail |
|---|---|---|
| Add share button to DishCard | [DishCard.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/components/DishCard.jsx) | Add a small share icon (📤) on each card in the Results page, so users can share directly from the results list |
| "Share Full Scan" card | [Results.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/Results.jsx) | Create a new ShareScanCard component — a summary card showing "Scanned at [restaurant] · Top pick: [dish] · Score: 85" — sharable to Instagram Stories |
| Add share CTA after scan completes | [Processing.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/Processing.jsx) | When redirect to results, show a brief toast "Share your results with friends!" |
| Open Graph meta tags | [index.html](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/index.html) | Add proper `og:image`, `og:title`, `og:description` for link previews when shared |

**Effort:** ~6 hours

---

### 1.3 🏪 Restaurant Memory & Repeat Visit Detection

**Why now:** Your [Scan.model.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/models/Scan.model.js) already stores `restaurantName` and `restaurantLocation.placeId`. You have all the data — just not surfacing it.

**What to build:**
| Change | File | Detail |
|---|---|---|
| "You've been here before" banner | [Results.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/Results.jsx) | Before rendering results, query history for same `restaurantName`. If found, show "🔄 You've visited [restaurant] 3 times. Last visit: June 2" |
| Previous orders from same restaurant | [scan.controller.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/controllers/scan.controller.js) | New endpoint `GET /api/scan/restaurant-history?name=X` — returns past dishes from the same restaurant with scores |
| "Your history at this restaurant" section | [Results.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/Results.jsx) | Collapsible section showing dishes from previous scans at the same place |

**Effort:** ~5 hours

---

## Priority 2 — Core Features (3–5 days each)
*These transform MenuLens from a "tool" into a "daily-use product".*

---

### 2.1 📊 Daily Nutrition Tracker & Dashboard

**Why critical:** This is the single most important feature for retention. Right now, users scan → see results → leave. A daily tracker creates a daily check-in habit.

**What to build:**

#### Backend
| Change | File | Detail |
|---|---|---|
| [NEW] MealLog model | `server/models/MealLog.model.js` | `{ userId, dishId (optional), scanId (optional), name, calories, protein, carbs, fat, mealType: ['breakfast','lunch','dinner','snack'], loggedAt, source: ['scan', 'manual', 'quick_add'] }` |
| [NEW] Meal log controller | `server/controllers/meal.controller.js` | CRUD: `POST /api/meals` (log a meal), `GET /api/meals?date=YYYY-MM-DD` (get day's meals), `DELETE /api/meals/:id` |
| [NEW] Daily summary endpoint | `server/controllers/meal.controller.js` | `GET /api/meals/summary?date=YYYY-MM-DD` — returns `{ totalCalories, totalProtein, totalCarbs, totalFat, mealCount, targetCalories }` |
| [NEW] Meal routes | `server/routes/meal.routes.js` | Wire up all the above |
| Add "Log this meal" to scan flow | [scan.controller.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/controllers/scan.controller.js) | When a user saves a dish, optionally auto-log it as a meal |

#### Frontend
| Change | File | Detail |
|---|---|---|
| [NEW] Tracker page | `client/src/pages/Tracker.jsx` | Daily view with circular progress rings (calories, protein, carbs, fat) + meal timeline + "Quick Add" button |
| [NEW] QuickAdd component | `client/src/components/QuickAdd.jsx` | Modal to manually log a meal: name + calories + macros, or search from past dishes |
| "Log this meal" button | [DishDetail.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/DishDetail.jsx) | Add next to "Save" button — logs the dish as today's meal |
| Redesign Home dashboard | [Home.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/Home.jsx) | Replace the simple stats card (line 83–93) with today's nutrition progress: "1,240 / 2,000 kcal consumed" ring chart + recent meals |
| Add `/tracker` route | [App.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/App.jsx) | New protected route |
| Update BottomNav | [BottomNav.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/components/BottomNav.jsx) | Add tracker icon to bottom nav bar |

**Effort:** ~4–5 days

---

### 2.2 📈 Weekly/Monthly Reports

**Why now:** Once you have the daily tracker (2.1), reports are just aggregation queries. Users love seeing their progress visualized.

**What to build:**
| Change | File | Detail |
|---|---|---|
| [NEW] Reports endpoint | `server/controllers/meal.controller.js` | `GET /api/meals/report?range=week` — returns daily totals for last 7 or 30 days |
| [NEW] Reports page | `client/src/pages/Reports.jsx` | Bar chart (daily calories), line chart (protein trend), stats summary ("avg 1,800 cal/day, 65% recommended meals") |
| Lightweight chart library | `client/package.json` | Add `recharts` (small, React-native chart library) — no heavy D3 needed |

**Effort:** ~2–3 days (depends on 2.1 being done first)

---

### 2.3 🤖 AI Diet Coach (Chat Interface)

**Why impactful:** You already have Groq integrated in [groq.service.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/services/groq.service.js). Adding a conversational interface is mostly a new endpoint + frontend page. The scoring engine context from [recommendation.service.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/services/recommendation.service.js) can feed into the system prompt.

**What to build:**
| Change | File | Detail |
|---|---|---|
| [NEW] Chat endpoint | `server/controllers/chat.controller.js` | `POST /api/chat` — takes `{ message, conversationHistory[] }`. System prompt includes user's profile (goal, allergies, conditions, TDEE). Uses Groq text API you already have. Rate limit: 20 messages/day. |
| [NEW] Chat page | `client/src/pages/Coach.jsx` | Simple chat UI: message bubbles, input bar, suggested quick questions ("What should I eat for dinner?", "Am I eating too much fat?", "Is paneer good for muscle building?") |
| [NEW] Chat route | [App.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/App.jsx) | `/coach` — protected route |
| Context from scans | `server/controllers/chat.controller.js` | Inject last 3 scan summaries into system prompt so coach can say "Based on your last scan at Haldiram's..." |

**Effort:** ~3–4 days

---

## Priority 3 — Growth & Expansion (1–2 weeks each)
*These expand your user base and monetization potential.*

---

### 3.1 🔓 Freemium Gating

**What to build:**
| Change | File | Detail |
|---|---|---|
| Add `plan` field to User model | [User.model.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/models/User.model.js) | `plan: { type: String, enum: ['free', 'premium'], default: 'free' }` |
| Rate limit by plan | [rateLimit.middleware.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/middleware/rateLimit.middleware.js) | Free: 3 scans/day, 10 coach messages. Premium: unlimited. |
| Upgrade prompt on limit | Frontend | When rate limited, show "Upgrade to Premium for unlimited scans" modal |
| Payment integration | New | Razorpay (India) or Stripe — separate controller |

**Effort:** ~1 week

---

### 3.2 👥 Group Dining Mode

**What to build:**
| Change | File | Detail |
|---|---|---|
| "Dining With" UI on scan page | [Scan.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/Scan.jsx) | Let user add dining partners by email (must be MenuLens users) |
| Group scoring endpoint | [scan.controller.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/controllers/scan.controller.js) | After AI pipeline, score dishes against ALL group members' profiles. Mark dishes that work for everyone. |
| "Works for everyone" tag | [recommendation.service.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/services/recommendation.service.js) | New tag: "Group Safe" — dish scores ≥ 60 for all group members AND hits no allergens |
| Group results view | [Results.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/Results.jsx) | New section: "✅ Works for Everyone" at the top |

**Effort:** ~1 week

---

### 3.3 📱 Barcode / Packaged Food Scanner

**What to build:**
| Change | File | Detail |
|---|---|---|
| Barcode scan UI | `client/src/pages/BarcodeScan.jsx` | Use `html5-qrcode` or `quagga2` library for camera-based barcode scanning |
| [NEW] Barcode lookup service | `server/services/barcode.service.js` | Call Open Food Facts API: `https://world.openfoodfacts.org/api/v0/product/{barcode}.json` — free, no API key needed |
| Score packaged food | [recommendation.service.js](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/services/recommendation.service.js) | Run the same scoring engine on packaged food nutrition data |
| Add to BottomNav or Scan page | [Scan.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/Scan.jsx) | Tab toggle: "📸 Menu" / "📦 Barcode" |

**Effort:** ~5 days

---

### 3.4 🌐 Multi-Language Support (Hindi First)

**What to build:**
| Change | File | Detail |
|---|---|---|
| i18n setup | `client/src/i18n/` | Use `react-i18next`. Create `en.json` and `hi.json` translation files |
| Translate all UI strings | All pages + components | Extract hardcoded strings to translation keys |
| Language picker | [Profile.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/Profile.jsx) | Add language selector in profile settings |
| Hindi food aliases | [aliases.json](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/data/aliases.json) already has 69KB of aliases, and [hindi_aliases.json](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/server/data/hindi_aliases.json) exists but is empty | Populate `hindi_aliases.json` with Hindi dish names |

**Effort:** ~1 week

---

## Priority 4 — Polish & Launch

### 4.1 🚀 Product Hunt / Social Launch Checklist

These aren't code features — they're launch prep:

- [ ] **Landing page redesign** — Your [Landing.jsx](file:///c:/Users/Msahi/OneDrive/Desktop/FitAI/client/src/pages/Landing.jsx) is basic (2.3KB). Needs: hero video/animation, feature showcase, social proof, "How it works" section
- [ ] **Demo mode** — Let visitors try scanning without signup (1 free scan, no account needed). Reduces friction massively
- [ ] **App Store screenshots** — Generate 5 beautiful screenshots showing the scan flow, results, share cards
- [ ] **OG meta tags** — For link previews when shared on social media
- [ ] **Analytics** — Add Mixpanel/PostHog to track: scans/day, share rate, retention, feedback rate

---

## Summary — Implementation Order

```
Week 1:  1.1 (Feedback loop)  →  1.2 (Share polish)  →  1.3 (Restaurant memory)
Week 2-3: 2.1 (Daily tracker — the BIG one)
Week 3:  2.2 (Weekly reports)
Week 4:  2.3 (AI Diet Coach)
Week 5:  4.1 (Landing page redesign + launch prep)
Week 6:  🚀 LAUNCH on Product Hunt
Week 7+: 3.1 (Freemium) → 3.2 (Group dining) → 3.3 (Barcode) → 3.4 (Hindi)
```

> [!TIP]
> **The golden rule:** Ship 1.1 + 1.2 + 1.3 this week. They're small, high-impact, and leverage code you already have. Then spend 2 focused weeks on the daily tracker (2.1) — that's the feature that transforms MenuLens from a cool tool into a daily habit app.
