# MenuLens — Complete Platform Feature Documentation

> A single source of truth for everything MenuLens is and everything it is becoming.
> This document is split into two clear sections: what exists in the live application today, and what is planned for future development.

---

# SECTION 1 — WHAT IS ALREADY BUILT ✅

> Every feature described below is fully implemented, deployed, and working in the live application at https://menu-lens-ten.vercel.app with the backend running at https://menulens.onrender.com

---

## 1. Authentication System

The entire authentication flow is built on JWT tokens stored in the client using a localStorage-based strategy, which avoids cross-origin cookie issues between the Vercel frontend and Render backend.

### Signup
- User provides name, email, and password (minimum 8 characters)
- All fields are validated on both client and server
- Password is hashed using bcrypt with a salt factor of 10 before being stored in MongoDB
- Currently OTP verification is disabled — users are auto-verified on signup and immediately receive both an access token and a refresh token in the response body
- The infrastructure for OTP (email generation, hashing, expiry) is fully built and can be re-enabled at any time

### Login
- Email + password authentication with case-insensitive email matching
- On successful login, the server generates a new access token (15 minutes lifespan) and a refresh token (7 days lifespan) and returns them in the response body
- The refresh token is stored in MongoDB alongside the user document
- The `isVerified` flag is checked before login is allowed

### Automatic Token Refresh
- The frontend uses a custom Axios interceptor that listens for 401 Unauthorized responses
- When a 401 is detected, the interceptor automatically calls `POST /api/auth/refresh-token` with the stored refresh token
- If the refresh succeeds, both the new access token and new refresh token (rotation) are stored and the original failed request is retried transparently — the user never sees an error
- If the refresh fails (expired or revoked refresh token), the user is logged out and redirected to the login page

### Refresh Token Rotation
- Every time a new access token is issued, a brand new refresh token is also generated and the old one is invalidated in the database
- This means a stolen refresh token becomes useless after it is used once, significantly limiting the attack window

### Logout
- Clears both tokens from the client
- Nullifies the refresh token in the database so it cannot be reused

### OTP Infrastructure (Built, Currently Disabled)
- 6-digit OTP generated using `crypto.randomInt()` for cryptographic security
- OTP is hashed with bcrypt before storage — never stored in plaintext
- 10-minute expiry enforced at the database level
- Resend endpoint with rate control — UI enforces a 60-second cooldown between resend attempts
- Nodemailer integration for sending OTP emails via SMTP

---

## 2. Health Profile Onboarding — 8 Steps

After account creation, new users complete a comprehensive 8-step health profile. This profile is the engine that powers every recommendation and score in the platform. Data is collected across multiple pages and stored in `sessionStorage` on the client, then submitted in a single API call on completion.

| Step | Route | Data Collected |
|---|---|---|
| 1 | `/onboarding/gender-age` | Gender (male/female/other) and age |
| 2 | `/onboarding/body` | Height in centimetres and weight in kilograms |
| 3 | `/onboarding/goal` | Primary health goal: Lose Weight / Build Muscle / Stay Healthy |
| 4 | `/onboarding/diet` | Diet types (multi-select): Vegetarian, Vegan, Non-Vegetarian, Dairy Free, Gluten Free, Keto |
| 5 | `/onboarding/allergies` | Allergens (multi-select): Peanuts, Shellfish, Dairy, Gluten, Eggs, Fish, Tree Nuts, Soy |
| 6 | `/onboarding/activity` | Activity level: Sedentary / Lightly Active / Moderately Active / Very Active / Extra Active |
| 7 | `/onboarding/conditions` | Medical conditions (multi-select): Diabetes, Hypertension, High Cholesterol, Celiac Disease, IBS, GERD, Kidney Disease, Heart Disease, Obesity, Anemia, Lactose Intolerance |
| 8 | `/onboarding/complete` | Animated completion screen, auto-redirects to `/home` after 2 seconds |

A visual progress bar is displayed across all steps. On completion, the `onboardingComplete` flag on the user document is set to `true`, which unlocks access to all protected routes. Users cannot access the main app until onboarding is complete. The health conditions list specifically includes serious clinical conditions (kidney disease, heart disease, diabetes) because the recommendation scoring engine has built-in logic for each one.

---

## 3. Menu Scanning System

The scanning system is the core product feature. It handles everything from image upload to final dish results.

### Image Upload Interface (`/scan`)
- Users can upload between 1 and 10 menu images per scan
- Accepted formats: JPEG, PNG, WebP — maximum file size 5MB per image
- The interface supports drag-and-drop as well as tap-to-upload
- Image previews with individual remove buttons are shown after selection
- An optional restaurant name text field is provided
- GPS-based restaurant auto-detection: if the user grants location permission, the device's GPS coordinates are sent with the upload request

### GPS Restaurant Auto-Detection
- When GPS coordinates are provided, the server calls the Google Places API (New) Nearby Search endpoint
- The system tries a 50-metre radius first, then expands to 150 metres if no result is found
- If a restaurant is found, its name, formatted address, and Google Place ID are automatically filled into the scan record
- This means the user never has to type the restaurant name when they are physically at the restaurant

### Rate Limiting
- Each user is limited to 10 scans per day, enforced server-side via express-rate-limit middleware keyed by user ID

### Async Processing Architecture
- When a scan is submitted, images are immediately uploaded to Cloudinary in parallel
- A Scan document is created in MongoDB with `status: 'processing'`
- The server immediately returns the `scanId` with HTTP 202 Accepted — the user is redirected to the processing page without waiting for AI
- The entire AI pipeline runs asynchronously in the background after the response is sent

### Image Hashing
- Each uploaded image buffer is MD5-hashed before upload
- Hashes are stored on the Scan document in the `imageHashes` field for future duplicate detection capabilities

---

## 4. AI Processing Pipeline

The processing pipeline runs entirely on the server after the scan upload response has been sent. It is a multi-stage sequential pipeline.

### Stage 1 — Groq Vision: Dish Extraction
- Model: `qwen/qwen3.8-27b` (vision-capable)
- All Cloudinary image URLs are processed in batches of 3 concurrently
- For each image, the model extracts:
  - Restaurant name and address (if visible on the menu)
  - All food and beverage items
  - For each dish: `name` (normalized canonical English name with OCR corrections and Hindi translation), `raw_name` (exact original text), `category` (starter/main/dessert/beverage/bread/rice/salad/other), `description`, `price` (plain number; FULL price preferred over HALF)
- Failed images are retried once after 2 seconds before being skipped
- Results across all images are merged, taking the first non-null restaurant name found

### Stage 2 — Deduplication
- Dish names are lowercased and trimmed; exact duplicate names are removed

### Stage 3 — Scan Quality Assessment
- 0 dishes extracted → `status: failed`, `scanQuality: unreadable`, scan deleted
- 1–2 dishes extracted → `scanQuality: partial` with an explanatory note
- 3+ dishes extracted → `scanQuality: good` (may be downgraded later)

### Stage 4 — Food Database Lookup
- Each dish name is matched against the 1,137+ item verified food database using:
  1. Exact canonical name match (lowercase)
  2. Case-insensitive exact alias match across 69KB of alias variations
- No fuzzy matching — intentional design choice, as false positives produce worse data than the AI fallback

### Stage 5 — AI Nutrition Estimation (unmatched dishes only)
- Model: `openai/gpt-oss-20b` (text-only)
- Dishes processed in sub-batches of 5 to stay within token limits
- Per dish, the model provides: calorie/protein/carbs/fat min-max ranges, cooking method, estimated ingredients, culinary description, confidence score (0–100), recommend reason, avoid reasons
- Explicit model rules prevent category confusion (beverages get near-zero calories, not food-level macros)
- AI confidence scores are floored at 65% to prevent unfair scoring penalties for genuinely good estimates

### Stage 6 — Scoring Engine (Personalized 0–100 per dish)

**TDEE Calculation (Mifflin-St Jeor Formula):**
```
Male:   BMR = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) + 5
Female: BMR = (10 × weight_kg) + (6.25 × height_cm) − (5 × age) − 161
TDEE = BMR × activity multiplier
Sedentary ×1.2 | Lightly Active ×1.375 | Moderately Active ×1.55 | Very Active ×1.725 | Extra Active ×1.9
```

**Score Adjustments (Base: 50):**
- Allergen hard-block: ANY matching allergen → score = 0, no exceptions
- `lose_weight`: low-calorie → +22; fried → −20
- `build_muscle`: high protein → +25; low protein → −15
- `stay_healthy`: balanced macros → +10; fiber-rich → bonus
- Vegetarian/Vegan + meat detected → −30; Vegan + dairy → −30
- Keto + high carbs → −25; Gluten-Free + gluten → −30
- Grilled/steamed/baked → +10; Fried → −10
- Diabetes: high sugar → −30; fiber → +15
- Heart disease: high saturated fat → −30; fish → +15
- Kidney disease: excess protein → penalty
- Hypertension: high-sodium dishes → penalty
- Low AI confidence → small downward adjustment
- Every adjustment stored in `scoreBreakdown: { base, adjustments[], final }` for "Why this score?" UI

### Stage 7 — Tag Generation
High Protein · Low Carb · Low Calorie · High Calorie · Healthy Cook · Deep Fried · Fits Your Goal

### Stage 8 — Classification
- Recommended (≥65) · Good (45–64) · Other (26–44) · Avoid (≤25)

### Stage 9 — Recommended Meal Combos
- Starter + Main + Dessert/Drink combinations built from non-avoided dishes
- Optimized for user's health goal with combined macro totals and combo score
- Stored on Scan document, displayed on Results page with clickable dish links

### Stage 10 — Dish Photo Fetching
- Unsplash API queried by dish name for recommended and good dishes only
- Photo is downloaded and re-uploaded to Cloudinary (CORS-safe for html2canvas)
- Runs non-blocking; `dishImageUrl` on Dish document updated when available

### Stage 11 — Admin Review Queue Population
- Every AI-sourced dish is added to `FoodReviewQueue`
- Existing entries have `scan_count` incremented instead of duplicates
- Priority score: `(scan_count × 3) + (confidence < 70 ? 10 : 0)`

### Stage 12 — Final Quality Check
- Average AI confidence across AI-sourced dishes calculated
- If average < 50%: downgraded to `scanQuality: low_confidence` with note

---

## 5. Scan Results Page (`/results/:scanId`)

### Processing Screen (`/processing/:scanId`)
- Polls `GET /api/scan/:scanId` every 3 seconds
- Animated pulsing dots with cycling status messages
- Auto-navigates to Results on completion; shows error + retry on failure

### Results Display
- Four sections: Recommended · Good Choices · Other Dishes · Avoid
- Top 3 recommended dishes shown with green score ring
- Each dish card: name, score badge, top 3 tags, calorie range, allergen warning badges

### Search and Filtering
- Live text search filtering by name or tag
- Tag filter chips: All · High Protein · Low Carb · Low Calorie · High Calorie · Healthy Cook · Deep Fried · Fits Your Goal
- Active filter → flat list view; clear → sectioned view

### Recommended Combos Section
- Starter + Main + Dessert/Drink combos with combined nutrition totals
- Component dishes are clickable links to their detail pages

### Restaurant Memory ("You've Been Here Before")
- If restaurant name matches any past scan by the same user → contextual banner appears
- Shows total past visit count and last visit date
- Expandable panel: last 3 visits with date, dish count, top 3 dishes (clickable)
- Link to full Scan History

### Scan Save Toggle
- Toggles `isSaved` flag on the Scan document

---

## 6. Dish Detail Page (`/dish/:dishId`)

### Nutrition Display
- Macros as min–max ranges with average: Calories, Protein, Carbs, Fat
- Fiber shown as single value when available from database

### Confidence Indicator
- Colour-coded progress bar (green ≥70%, yellow ≥40%, red <40%)
- Warning banner below 40%
- Data source labelled: "Verified Food Database" vs "AI Estimate"

### Score Reasons
- Recommend reason in green box
- Avoid reasons in red box
- Allergen flags as distinct warning badges per allergen type
- Cooking method badge

### Portion Picker (Database-Sourced Dishes Only)
- Three tiers: Small / Standard / Large (with gram weights)
- Selecting a tier dynamically updates all displayed nutrition values
- Disclaimer: "Estimates based on INDB data with restaurant adjustment"

### Save / Unsave Dish
- Individual dish bookmarking; saved dishes appear on the `/saved` page

### Shareable Nutrition Cards (3 Designs)

| Design | Style | Aspect Ratio |
|---|---|---|
| 🌅 Sunrise | Warm amber/orange gradient | 9:16 vertical |
| 💜 Vibrant | Dark navy/indigo gradient | 9:16 vertical |
| 🖼️ Wide | Green split panel with dish photo | 16:9 landscape |

Each card: dish name, restaurant name, score ring, macro pills, dish photo (if available), goal-aware badge ("💪 Smart Muscle Pick" / "🔥 Weight Loss Win" / "✅ Healthy Choice"). Generated via html2canvas at 3× resolution. Web Share API on mobile; PNG download fallback on desktop.

### User Feedback System
- "Report incorrect data" with types: Wrong nutrition values / Wrong dish identified / Missing allergen warning / Other
- Optional free-text comment
- Submission creates `FoodReviewQueue` entry with `entry_type: user_feedback`
- Button disappears after one submission per dish

### Allergen Disclaimer
- Permanent at bottom of every dish: "Allergen detection is AI-based. Always confirm with restaurant staff."

---

## 7. Scan Summary Share Card
- Generated from the Results page
- Shows: restaurant name, total dishes, recommended count, top 3 picks with scores
- Green gradient design with MenuLens branding

---

## 8. Scan History (`/history`)
- Paginated (10/page), newest-first
- Each card: restaurant name, date, total dishes, recommended count, saved status
- Delete with confirmation dialog (cascades to all Dish documents)
- Load More pagination; empty state with CTA

---

## 9. Saved Dishes (`/saved`)
- All bookmarked dishes across all scans
- Each card: dish name, restaurant name, save date
- Empty state with CTA

---

## 10. User Profile Management (`/profile`)
- View mode: all profile fields displayed
- Edit mode: name, goal, diet types, allergies, health conditions, activity level, height, weight, age, gender — all editable with same validation as onboarding
- Logout: clears tokens + invalidates refresh token in DB
- Delete Account: confirms → deletes all Scans, all Dishes, then User document

---

## 11. Home Dashboard (`/home`)
- Personalized greeting with user's first name
- Stats: total scans, total saved dishes
- Prominent "Scan a Menu" CTA
- Last 3 completed scans as clickable cards

---

## 12. Admin Panel

### Dashboard (`/admin`)
- Total users, total scans, scans in last 7 days, total verified food items, pending queue count, database-sourced item count

### Review Queue (`/admin/queue`)
- Filterable by status (pending/reviewed/promoted/rejected) and entry type (ai_sourced/user_feedback)
- Per item: dish name, type, scan count, priority score, AI confidence, AI nutrition estimates
- Actions: **Promote** (admin provides verified nutrition → upserted into FoodItem collection), **Reject** (with notes), **Edit**
- Queue stats panel: counts by status, top 5 highest-priority pending items
- Access protected by both JWT auth middleware AND email-based admin check

---

## 13. Verified Food Database

### Sources
- INDB 2024 (Indian Nutrient Database) — primary for Indian dishes
- UK CoFID — UK Composition of Foods
- USDA FoodData Central — US nutritional data
- Manual research — developer-added items

**Total: 1,137+ verified items**

### Per-Item Data
`canonical_name`, `aliases[]` (69KB alias file including OCR variations and regional names), `per_100g` (calories/protein/carbs/fat/fiber/sodium), `portions[]` (with restaurant multipliers), `cooking_method`, `allergens[]`, `is_veg`, `data_quality_score`

### Restaurant Portion Multipliers
| Dish Type | Multiplier |
|---|---|
| Creamy curry | ×1.5 |
| Fried items | ×1.3 |
| Default restaurant | ×1.1 |

---

## 14. Progressive Web App (PWA)
- Service Worker via vite-plugin-pwa — offline support for app shell
- Installable on Android and iOS (Add to Home Screen)
- App icons at 192px and 512px
- iOS-specific meta tags for full-screen display
- OpenGraph + Twitter Card meta tags for social link previews

---

## 15. Security
- JWT access tokens (15 min) + refresh tokens (7 days) with full rotation
- bcrypt hashing (salt factor 10) for passwords; bcrypt hashing for OTPs
- Rate limiting: 10 scans/day per user
- Input validation + enum enforcement on every API endpoint
- Admin routes: two-layer protection (JWT auth + email check)
- CORS: allows only localhost and production Vercel URL

---

## 16. Complete Data Models

### User
```
name, email, password (hashed), isVerified, otp (hashed), otpExpiry,
onboardingComplete, refreshToken,
profile: { gender, age, height (cm), weight (kg), activityLevel, goal,
  dietType[], allergies[], healthConditions[], dailyCalories,
  macros: { protein%, carbs%, fat% } }
```

### Scan
```
userId, restaurantName, restaurantLocation: { lat, lng, address, placeId },
images[], imageHashes[], status, errorMessage, scanQuality, scanQualityNote,
isSaved, dishes[], recommendedDishes[], avoidDishes[],
totalDishesFound, totalMatchingDishes, totalFlaggedDishes,
recommendedCombos: [{ label, starter, main, dessertDrink,
  totalCalories, totalProtein, totalCarbs, totalFat, comboScore }]
```

### Dish
```
scanId, name, description (raw menu text), dishDescription (AI culinary description),
estimatedNutrition: { calories/protein/carbs/fat: { min, max, avg }, fiber, sugar },
confidenceScore, matchScore, tags[], allergenFlags[], avoidReasons[], recommendReason,
cookingMethod, estimatedPrice, dataSource (database | ai), multiplierNote,
scoreBreakdown: { base, adjustments[{ reason, delta }], final },
isSaved, savedAt, dishImageUrl,
portionTiers: { small, standard, large } (each: label, weight_grams,
  calories_kcal, protein_g, carbs_g, fat_g)
```

### FoodItem
```
canonical_name, display_name_en, category, cooking_method, allergens[],
is_veg, data_source, data_quality_score, verified,
per_100g: { calories_kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg },
portions[]: { label, weight_grams, calories_kcal, protein_g, carbs_g, fat_g,
  restaurant_multiplier_applied, is_default, multiplier_note },
aliases[]: { alias_text, language, script }
```

### FoodReviewQueue
```
entry_type (ai_sourced | user_feedback), dish_name, raw_name,
scan_count, priority_score, status (pending | reviewed | promoted | rejected),
ai_nutrition: { calories/protein/carbs/fat min/max, cooking_method,
  estimated_ingredients[], confidence, recommend_reason, avoid_reasons[] },
admin_notes, reviewed_at, promoted_to_food_item_id,
feedback_type, feedback_comment
```

---

## 17. Complete API Reference (Current)

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Register, auto-verify, return tokens |
| POST | `/api/auth/verify-otp` | No | Verify OTP (built, currently disabled) |
| POST | `/api/auth/login` | No | Login, return access + refresh tokens |
| POST | `/api/auth/logout` | Yes | Invalidate refresh token |
| POST | `/api/auth/refresh-token` | Refresh Token | New access token with rotation |
| POST | `/api/auth/resend-otp` | No | Resend OTP via email |

### User
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/user/profile` | Yes | Get full user profile |
| PUT | `/api/user/profile` | Yes | Update any profile field |
| PUT | `/api/user/onboarding` | Yes | Submit onboarding, set complete |
| DELETE | `/api/user/account` | Yes | Delete account + all data |

### Scan
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/scan` | Yes | Upload images, trigger async AI pipeline |
| GET | `/api/scan/history` | Yes | Paginated scan history |
| GET | `/api/scan/last` | Yes | Last 5 completed scans |
| GET | `/api/scan/restaurant-history` | Yes | Past visits to same restaurant |
| GET | `/api/scan/:scanId` | Yes | Full scan with populated dishes |
| PUT | `/api/scan/:scanId/save` | Yes | Toggle isSaved flag |
| DELETE | `/api/scan/:scanId` | Yes | Delete scan + all dishes |

### Dish
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/dish/saved` | Yes | All saved dishes |
| GET | `/api/dish/:dishId` | Yes | Full dish detail |
| PUT | `/api/dish/:dishId/save` | Yes | Toggle dish save |

### Feedback
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/feedback/dish/:dishId` | Yes | Submit dish report |

### Admin
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | Admin | Dashboard statistics |
| GET | `/api/admin/queue` | Admin | Review queue with filters |
| GET | `/api/admin/queue/stats` | Admin | Queue counts + top priority |
| PUT | `/api/admin/queue/:id` | Admin | Update item status and notes |
| POST | `/api/admin/queue/:id/promote` | Admin | Promote to verified food DB |

---
---

# SECTION 2 — WHAT IS YET TO BE BUILT 🗺️

> Everything below is planned, designed, and intentionally scoped. None of it is live yet.

---

## 1. Personal AI Nutrition Coach — RAG Pipeline

This is the most significant planned feature. Every user will have their own personalized AI nutritionist accessible from anywhere in the app.

### What It Is
A conversational AI chatbot that answers health and food questions with complete awareness of the specific user's entire history — not generic advice. The AI knows who you are, what you have eaten recently, where you have been, and what your health constraints are.

### How the RAG Pipeline Works
At query time (when the user sends a message), the system performs a retrieval step before calling the AI model:

1. **User Profile Retrieval** — Full health profile: goal, diet type, allergies, health conditions, TDEE, height, weight, age, gender, activity level
2. **Recent Scan Retrieval** — Last 5 restaurant scans with restaurant names, dates, top-scoring dishes, and avoided dishes
3. **24-Hour Meal Log Retrieval** — All meals logged in the last 24 hours: names, calories, protein, carbs, fat, meal type, timestamps
4. **Water Intake Retrieval** — Total water consumed today in millilitres vs daily target
5. **Restaurant History** — Top 5 most-visited restaurants with average scores
6. **Current Context** — Current time, day of week, meal timing context (breakfast/lunch/dinner/snack window)

All of this retrieved data is assembled into a structured context string and injected into the Groq AI system prompt alongside the user's question and full conversation history.

### What the Coach Can Answer
- *"What should I eat for dinner tonight?"* — Knows calories remaining, past dinner patterns, health conditions
- *"Which dish is best for my diabetes at this restaurant?"* — References the current scan's dishes
- *"Am I eating too much fat this week?"* — Calculates from the meal log
- *"How many calories do I have left today?"* — Exact answer from today's log vs TDEE
- *"Why should I avoid this dish?"* — Explains scoring logic in plain English
- *"What's the healthiest thing I've eaten this week?"* — Cross-references scan and meal history
- *"Is paneer good for muscle building?"* — Personalizes based on the user's protein target and TDEE

### Technical Architecture
```
New model: ChatSession
{ userId, messages: [{ role, content, timestamp }], sessionId, createdAt }

New endpoint: POST /api/coach/message
  Input: { message: string, sessionId?: string }
  Server steps:
  1. Load user profile from DB
  2. Load last 5 scans with top dishes from DB
  3. Load today's meal log from DB
  4. Load today's water intake from DB
  5. Load last 30 days restaurant history from DB
  6. Build structured context string
  7. Inject into Groq text model system prompt
  8. Append user message to conversation history
  9. Call Groq model with full context + history
  10. Store response in ChatSession collection
  11. Return AI response

Rate limiting: 20 messages/day on free tier, unlimited on premium
```

### UI
- Dedicated `/coach` route with a bottom-nav icon
- Chat bubble interface: user messages on the right, AI on the left
- Suggested quick-start questions on first open
- Typing indicator during AI response
- Conversation history preserved within session
- Floating "Ask AI" button also embedded on the Results page for context-aware scanning questions

---

## 2. Daily Meal & Water Intake Tracker

A full nutrition tracking system that gives users a reason to open the app every single day.

### MealLog Model
```
userId, name (dish name), source (scan | manual | barcode | saved),
dishId (optional — links to a scanned Dish), scanId (optional),
restaurantName (optional), mealType (breakfast | lunch | dinner | snack),
calories, protein_g, carbs_g, fat_g, fiber_g,
portion_label (small | standard | large), weight_grams,
loggedAt (timestamp), notes (optional)
```

### Ways to Log a Meal
1. **One-tap from Results** — "Log This Meal" button on each dish card logs the dish with currently selected portion tier, timestamped automatically
2. **One-tap from Dish Detail** — Button beside "Save" for direct logging from detail view
3. **Quick Add (manual entry)** — Modal: type food name + enter calories and macros manually for home-cooked meals
4. **Re-log from Saved Dishes** — Any bookmarked dish can be re-logged without scanning again
5. **Re-log from History** — Past dish choices can be re-logged from the history page

### Water Intake Tracker

**WaterLog Model:**
```
userId, amount_ml, loggedAt (timestamp), note (optional)
```

**UI:**
- Water intake widget on Home dashboard and Tracker page
- Daily target: calculated from body weight (standard: 35ml per kg)
- Quick-add buttons: +250ml / +500ml / +750ml / +1000ml
- Custom amount input for precise logging
- Animated fill bar showing ml consumed vs daily target
- Streak tracking: "💧 5-day water goal streak"

### Daily Nutrition Budget Dashboard (New Home Screen)
```
Today's Budget                    1,450 / 2,000 kcal consumed
────────────────────────────────────────────────────────────
Protein  ██████░░░░░░  45g / 120g
Carbs    ████████░░░░  180g / 250g
Fat      ████████████  65g / 65g ✓
Water    ████████░░░░  1,400ml / 2,800ml
────────────────────────────────────────────────────────────
Remaining: 550 kcal · 75g protein · 70g carbs · 0g fat
```

Colour-coded progress rings per macro. Today's logged meals shown in chronological order. Link to full Tracker page.

### Tracker Page (`/tracker`)
- Full-day view: all meals + water entries grouped by meal type
- Date picker to view any past day
- Totals summary at top
- Macro breakdown pie chart for the day
- Quick Add always accessible

### New API Endpoints
```
POST   /api/meals              — Log a meal
GET    /api/meals?date=YYYY-MM-DD — Get all meals for a day
DELETE /api/meals/:id          — Remove a logged meal
GET    /api/meals/summary?date=YYYY-MM-DD — Daily totals vs targets
POST   /api/water              — Log water intake
GET    /api/water?date=YYYY-MM-DD — Today's water log
```

---

## 3. Weekly & Monthly Nutrition Reports

Built on top of the meal tracker data.

### Weekly Report
- Bar chart: daily calorie intake for each day of the week vs TDEE target
- Line chart: protein trend across the week
- Summary: average calories/day, average protein/day, best and worst day, number of days goal was hit
- Restaurant summary: restaurants visited and their average dish score
- Comparison to previous week: "You averaged 1,850 kcal/day this week vs 1,920 last week — 3.6% improvement"

### Monthly Report
- Same charts at monthly scale
- "Nutrition personality" section: most common dishes, favourite cuisine type, best restaurant, consistency score
- Shareable summary card matching existing share card design language
- Downloadable as PDF or CSV (premium feature)

### New Endpoint
```
GET /api/meals/report?range=week&date=YYYY-MM-DD
Returns: { days: [{ date, totalCalories, totalProtein, totalCarbs, totalFat,
  mealCount, waterMl }], summary: { avg, best, worst, goalHitDays } }
```

---

## 4. Streak & Retention System

Habit-forming mechanics to bring users back every day.

### Scan Streak
- "🔥 7-day scan streak" displayed on Home dashboard
- Push notification (PWA) at 8pm if the streak is at risk: "Don't break your streak! Scan your dinner menu."
- Streak resets if a day is missed; "streak shield" (one grace day/week) for premium users

### Meal Log Streak
- "📝 5-day tracking streak"
- Encourages logging even on days without restaurant scans

### Weekly Email Digest (via existing Nodemailer setup)
- Sent every Sunday evening
- Content: total scans, best dish of the week (highest score), restaurants visited, nutrition trend
- Unsubscribe link in every email

---

## 5. Contextual AI Chat on Results Page

A lighter, scan-scoped AI conversation embedded directly in the Results page.

### What It Does
- Small "Ask AI" button on the Results page
- Pre-populated context: this scan's dishes, user profile, today's meal log
- Suggested questions: "Which dish is best for my diabetes?", "What's the lowest calorie main?", "Can I eat here if I'm vegan?"
- Single-turn or short multi-turn interaction without navigating away
- Rate limited: 10 questions per scan on free tier

### How It Differs From the Full Coach
- Scan-scoped — only knows about the current restaurant's dishes
- Optimised for quick, single-turn answers
- Displayed inline on the Results page, not a separate route

---

## 6. Cheat Day / Flexible Goals Mode

Makes the app feel human instead of preachy.

### Three Modes (Toggle on Results Page)
1. **🥗 Health Mode** (default) — Full scoring with all goal penalties and diet restrictions. Current behaviour.
2. **😈 Cheat Day Mode** — Re-scores without goal penalties or diet-type penalties. Allergen blocks always enforced. Shows nutrition but neutral scores. Warning banner shown.
3. **🎯 Mindful Mode** — Shows which dishes are "worth the splurge" — scored on ingredient quality signals while still warning about allergens and extreme nutritional concerns.

### Technical Implementation
- Mode toggle stored in component state; no API call needed
- Score recalculation runs client-side using cached dish data
- Can run in a web worker to avoid blocking the UI

---

## 7. Live Camera Capture on Scan Page

Removes the largest friction point: the gallery-select-upload flow.

### The Problem
Currently users must open their gallery, find the photo, select it, then upload it. Many users have to leave the app to take a photo first.

### The Solution
A "📷 Use Camera" tab on the Scan page using `navigator.mediaDevices.getUserMedia()`. Live camera view in-browser; user taps capture; frame is captured as a canvas snapshot and fed directly into the upload flow — no gallery involved.

### Technical Notes
- Works on Chrome (Android) and Safari (iOS 14.3+) over HTTPS
- Graceful fallback on desktop: "Camera not available, please use file upload"
- No external library required — approximately 60–80 lines of JavaScript

---

## 8. Landing Page Redesign

The current landing page is a placeholder. A complete rebuild is required.

### Required Sections

**Hero:** Bold headline, live animated demo loop (menu scanning → results appearing), two CTAs: "Try Free — No Account" and "Create Account"

**No-Signup Demo Scan:** One free scan without creating an account. Guest session via temporary `localStorage` ID. After results: soft prompt to create account. This single feature dramatically increases conversion by letting users experience core value before committing.

**How It Works:** 3-step animated visual — Snap menu → AI scores dishes → Personalised picks

**Feature Showcase:** Allergen protection · Goal-based scoring · Meal combos · Restaurant memory · Share cards

**Trust Signals:** Data sources (INDB 2024, USDA, UK CoFID) · Groq AI · Live scan counter

**Testimonials:** 3–5 real quotes from beta users

**FAQ:** Accuracy · Privacy · Cuisines supported · How scoring works · GPS requirement

**Footer:** Privacy Policy · Terms of Service · Contact · Social media

---

## 9. Crowd-Sourced Menu Memory

A compounding data moat that improves with every new user.

### How It Works
1. User A scans Restaurant X — GPS identifies its Google Place ID
2. Extracted dish list is stored against the Place ID in a new `RestaurantMenu` collection
3. User B visits the same restaurant — app checks if a recent menu exists (< 30 days old)
4. If found: "📋 We have a menu from [Restaurant Name] from 3 days ago. Use it for instant results?"
5. User B confirms → scoring runs immediately without any image upload
6. User B can still upload new images if the menu has changed

### The Network Effect
More users → more restaurants covered → faster results for everyone. A genuine competitive moat.

### New Data Model
```
RestaurantMenu:
{ placeId, restaurantName, restaurantAddress,
  dishes: [{ name, description, price, category }],
  lastUpdatedAt, lastScanId, scanCount, contributedByUserIds[] }
```

---

## 10. Group Dining Mode with Real-Time Conflict Map

Solves a universal pain point: ordering for a group with different dietary needs.

### Flow
1. User scans the menu and gets their own results
2. "Dining With" button → enter dining partners' emails (must be MenuLens users)
3. Shareable group link generated: `menu-lens.app/group/abc123`
4. Each friend opens the link — system loads their profile automatically
5. Server re-scores all dishes against ALL group members' profiles
6. New section at top: **"✅ Works for Everyone"** — dishes scoring ≥60 for all members with no allergen conflicts
7. **Conflict Map**: a grid of dishes × people; cells coloured green (good) / yellow (okay) / red (avoid/allergen)

### The Viral Loop
Every group dining session requires the host to share a link with friends, who discover MenuLens through genuine use — not an ad.

### New Data Model
```
DiningSession:
{ sessionId, hostUserId, participantUserIds[], scanId, expiresAt }

New endpoints:
  POST /api/group/session   — create group session from a scan
  GET  /api/group/:sessionId — join and get group-scored results
```

---

## 11. Nutrition Fingerprint — Personalized Insight Engine

After 5+ scans, the platform generates weekly insight cards telling the user's dietary story.

### Sample Insights
- "You consistently choose high-protein dishes — averaging 72g protein per meal. Your goal is 90g. You're 80% there."
- "Your top restaurant is Mainland China with an average dish score of 72."
- "Paneer shows up in your top picks at almost every Indian restaurant you visit."
- "You avoid fried food 83% of the time — excellent for your weight loss goal."

### Nutrition Fingerprint Card
- Shareable visual card matching existing share card design language
- "Your Nutrition Personality This Month" — top macro category, most visited cuisine, best restaurant, consistency score
- Generated on demand or automatically every Monday
- Designed for Instagram Stories sharing

---

## 12. Freemium Monetization

### Plan Structure

| Feature | Free | Premium (₹199/mo) |
|---|---|---|
| Menu scans | 3/day | Unlimited |
| AI Coach messages | 0 | 30/day |
| Meal logging | ✅ | ✅ |
| Weekly email digest | ✅ | ✅ |
| Saved dishes | 20 | Unlimited |
| Share card designs | 1 (Vibrant) | All 3 designs |
| Barcode scanner | ❌ | ✅ |
| Monthly report (PDF/CSV) | ❌ | ✅ |
| Group dining mode | ❌ | ✅ |
| Streak shield | ❌ | 1/week |

### Payment Integration
- India: Razorpay (UPI, cards, net banking)
- International: Stripe
- Subscription lifecycle via webhooks

### Plan Enforcement
- `plan` field added to User model: `free | premium`
- Rate limiting middleware checks plan before enforcing limits
- Premium-only features return `402 Payment Required` on free tier
- Upgrade prompts shown contextually — exactly when a free user hits a limit

---

## 13. Barcode Scanner — Packaged Food Support

Extends MenuLens beyond restaurant menus to packaged supermarket food.

### How It Works
1. "Barcode" tab on the Scan page
2. User taps → camera opens with barcode targeting frame
3. `html5-qrcode` or `quagga2` reads EAN/UPC barcode in real time
4. Barcode sent to server: `GET /api/barcode/:code`
5. Server queries Open Food Facts API (free, no API key, 3M+ products globally)
6. Returned nutrition facts run through the same scoring engine
7. Results displayed with same UI: score, macros, tags, allergen warnings

The Open Food Facts database is comprehensive for Indian packaged foods (Haldiram's, Maggi, Bournvita, Amul products, etc.).

---

## 14. Restaurant QR Code Partnership Program (B2B)

The business model that creates sustainable revenue and a data moat simultaneously.

### For Restaurants (₹2,000/month)
1. Restaurant uploads their menu through a partner dashboard — no scanning required
2. MenuLens generates a unique QR code for the restaurant
3. Restaurant prints QR code on physical menus, table cards, and their entrance
4. Customers scan QR → instant personalized recommendations in under 2 seconds
5. Restaurant updates menu via dashboard → automatically reflected for all users

### For Users
- Results in < 2 seconds (no AI vision needed — pre-loaded menu)
- Higher accuracy (menu provided directly by restaurant, not extracted from photo)
- "MenuLens Partner" badge signals verified data quality

### For MenuLens
- B2B revenue independent of per-user payments
- Every QR code in a restaurant is a user acquisition channel
- Creates a directory of partner restaurants for future discovery features

---

## 15. Dietitian & Nutritionist Professional Mode (B2B2C)

A professional tier that turns nutritionists into a distribution channel.

### Professional Account Features (₹999/month per nutritionist)
- Client management dashboard: scan history, meal logs, nutrition trend charts per client
- Each client connects via a consent flow — explicit about what the dietitian can see
- Dietitian can write notes on specific dishes or scans visible only to them
- **Custom scoring overrides** per patient: e.g. "Penalize any dish with protein > 25g for this kidney patient" — overrides standard scoring rules for that specific client

### Why This Matters
- Nutritionists bring 10–50 clients each as a distribution channel
- Creates professional accountability for clients
- Opens clinical partnerships (hospitals, wellness centers, corporate health programs)
- SaaS pricing provides predictable monthly revenue

---

## 16. Trust Badges (Replacing Confidence % Bar)

The current confidence % bar is confusing — users do not know if 72% is good or bad.

### Replacement System

| Badge | Condition | Label |
|---|---|---|
| 🟢 Verified | `dataSource === 'database'` | "Verified · INDB 2024 data" |
| 🟡 AI Estimate | `dataSource === 'ai' && confidenceScore >= 65` | "AI Estimate · Range may vary" |
| 🔴 Low Confidence | `dataSource === 'ai' && confidenceScore < 65` | "Low Confidence · Treat as approximate" |

Simpler, more honest, and builds more trust than a raw percentage.

---

## 17. Processing Screen Engagement

The current processing screen (spinner + generic messages) is a dead zone where users leave. Convert it into engagement.

### Replacement
- **Live dish counter**: "Found 12 dishes... scored 8... 4 to go..." (animated smoothly)
- **Rotating food facts** every 4 seconds: facts relevant to the restaurant type being scanned
- **Database context**: "Checking against 1,137 verified dishes from INDB 2024..."
- **Progress bar** calibrated to typical pipeline completion time (not an indeterminate spinner)

---

## 18. Multi-Language Support (Hindi First)

Opens the product to 400M+ Hindi-speaking users.

### Implementation Plan
- UI language toggle in Profile settings
- `react-i18next` for internationalization
- Translation files: `en.json` (extract all current strings) + `hi.json`
- The `hindi_aliases.json` file in server data directory exists but is empty — populate with Hindi dish names
- The AI vision model already handles Hindi menus and translates to English; language switch affects UI only

### Languages Roadmap
1. Hindi (Phase 1 — largest addressable market)
2. Tamil / Telugu (Phase 2)
3. Arabic (Phase 3 — halal filtering market)

---

## 19. Analytics Integration

Currently zero behavioral data is collected. This must be fixed before any growth push.

### Implementation (PostHog or Mixpanel — both have free tiers)

**Key events to track:**

| Event | Why |
|---|---|
| `scan_started` | Upload attempt rate |
| `scan_completed` | Upload → result conversion |
| `scan_failed` | Most common failure modes |
| `dish_detail_opened` | Which dishes users care about |
| `share_card_generated` | Virality coefficient |
| `dish_saved` | Bookmarking engagement |
| `feedback_submitted` | Feedback system health |
| `onboarding_step_N_completed` | Drop-off per step |
| `coach_message_sent` | AI coach usage (once built) |
| `meal_logged` | Tracker adoption (once built) |
| `water_logged` | Hydration feature usage (once built) |

**Key metrics to monitor:**
- D1 / D7 / D30 Retention
- Scan completion rate
- Share rate (% of users who generate ≥1 share card)
- Onboarding completion rate
- Allergen trigger rate (proof of real-world safety value)

---

## 20. Privacy & Trust Infrastructure

Health data (diabetes, heart disease, kidney conditions, allergies) is among the most sensitive personal data. A formal trust layer is required before scaling.

### Required Additions
- **Privacy Policy page** (`/privacy`): Data collected, how it is stored, who has access, deletion process
- **Terms of Service page** (`/terms`): Usage terms, allergen disclaimer limitations
- **"Your Data" section in Profile**: "Download all my data" (JSON export) + "Delete all my data" (full wipe with confirmation)
- **Consent in onboarding**: Checkbox before Step 1 — health data used only for recommendations, never sold
- **Allergen disclaimer upgrade**: More prominent, medically defensible language — "MenuLens AI allergen detection is not a substitute for directly asking restaurant staff about allergens. Always verify before ordering."

---

## Implementation Timeline

```
Month 1 — Core Retention:
  → Daily Meal & Water Tracker (meal logging + budget bar)
  → Streak system + weekly email digest
  → Live camera capture on Scan page
  → Analytics integration (PostHog)
  → Processing screen engagement improvements

Month 2 — AI & Intelligence:
  → Personal AI Nutrition Coach (RAG pipeline)
  → Contextual AI chat on Results page
  → Trust badge system (replace confidence % bar)
  → Cheat Day mode toggle

Month 3 — Growth:
  → Landing page full redesign + no-signup demo scan
  → Freemium gating + Razorpay payment integration
  → Privacy Policy + Terms of Service pages
  → Weekly/monthly nutrition reports

Month 4 — Moat Building:
  → Crowd-sourced Menu Memory (placeId-based menu cache)
  → Group dining with real-time conflict map
  → Nutrition Fingerprint weekly insight cards
  → Barcode scanner (Open Food Facts)

Month 5+ — Market Expansion:
  → Restaurant QR Code partnership program (B2B revenue)
  → Dietitian/Nutritionist professional tier (SaaS)
  → Multi-language support (Hindi first)
```

---

*Document maintained by the MenuLens development team. Last updated: October 2026.*
