
# 🍽️ MenuLens — AI-Powered Menu Scanner & Personalized Nutrition Recommender

> Scan any restaurant menu → Instantly get **AI-powered, personalized dish recommendations** based on your health goals, diet, allergies, and medical conditions.

🌐 **Live App:** https://menu-lens-ten.vercel.app  
🔗 **Backend API:** https://menulens.onrender.com  

---

## 🚀 Overview

**MenuLens** is a full-stack **MERN Progressive Web App (PWA)** that transforms how users interact with restaurant menus.

Instead of guessing what's healthy, users can:

- 📸 **Scan** menu images (up to 10)
- 🧠 Let AI **extract dishes & estimate nutrition** with min/max ranges
- 🎯 Get **personalized recommendations** scored 0–100
- 🍱 View **AI-built meal combos** (starter + main + dessert)
- 🔄 See **restaurant visit history** ("You've been here before")
- 📤 **Share beautiful nutrition cards** on social media
- 🔖 **Save individual dishes** for later reference
- ⚠️ **Avoid harmful dishes** based on allergies & health conditions
- 🚩 **Report incorrect data** with built-in feedback system

---

## 🧱 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + Vite | UI framework & build tool |
| Tailwind CSS | Utility-first styling |
| Framer Motion | Animations & transitions |
| React Router v6 | Client-side routing |
| Axios (JWT interceptor) | HTTP client with auto token refresh |
| React Hot Toast | Notification toasts |
| html2canvas | Shareable card image generation |
| PWA via vite-plugin-pwa | Offline support & installability |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express.js | API server |
| MongoDB Atlas + Mongoose | Database & ODM |
| JWT (HTTP-only cookies) | Access token (15 min) + Refresh token (7 days) |
| Bcrypt | Password hashing |
| Cloudinary | Image storage & CDN |
| Nodemailer | OTP email verification |
| Multer (memory storage) | File upload handling |
| Express Rate Limiting | Scan rate limiting (10/day) |

### AI / ML
| Technology | Purpose |
|---|---|
| Groq API | AI inference provider |
| Model: `meta-llama/llama-4-scout-17b-16e-instruct` | Vision + text AI model |
| Vision pipeline | Menu image → dish extraction |
| Text pipeline | Batch nutrition estimation |

### External APIs
| API | Purpose |
|---|---|
| Google Places API | GPS-based restaurant auto-detection |
| Unsplash API | Dish photo sourcing (recommended/good dishes) |
| Cloudinary CDN | Image re-hosting & optimization |

---

## 🧠 System Architecture

```
Client (React PWA)
       ↓
Express API Server
       ↓
Scan Controller → Async AI Pipeline
       ↓
┌──────────────────────────────┐
│  Groq Vision → Dish Extract  │
│  Food DB Lookup (1,137+)     │
│  Groq Text → AI Nutrition    │
│  Scoring Engine (0–100)      │
│  Combo Builder               │
│  Dish Photo Fetcher          │
└──────────────────────────────┘
       ↓
MongoDB (Scans, Dishes, Queue)
```

---

## 🔐 Authentication System

### Flow
1. **Signup** → OTP sent via email (6-digit, 10-minute expiry)
2. **Verify OTP** → Account activated (resend with 60s cooldown)
3. **Login** → JWT tokens set as HTTP-only cookies

### Tokens
| Token | Lifespan | Storage |
|---|---|---|
| Access Token | 15 minutes | HTTP-only cookie |
| Refresh Token | 7 days | HTTP-only cookie + DB |

### Auto Refresh
- Axios interceptor detects `401` responses
- Calls `/api/auth/refresh-token` automatically
- Retries original request transparently

### Security
- bcrypt password hashing
- OTP expiry (10 min) with resend cooldown
- Refresh token rotation
- Rate limiting on scan uploads

---

## 👤 User Profile & Onboarding (7 Steps)

New users complete a comprehensive health profile:

| Step | Page | Data Collected |
|---|---|---|
| 1 | `/onboarding/gender-age` | Gender & age |
| 2 | `/onboarding/body` | Height & weight |
| 3 | `/onboarding/goal` | Goal — Lose Weight / Build Muscle / Stay Healthy |
| 4 | `/onboarding/diet` | Diet types — Vegetarian, Vegan, Keto, Dairy Free, Gluten Free, etc. |
| 5 | `/onboarding/allergies` | Allergies — Peanuts, Shellfish, Dairy, Gluten, Eggs, Fish, Tree Nuts, Soy |
| 6 | `/onboarding/activity` | Activity level |
| 7 | `/onboarding/conditions` | Health conditions (diabetes, heart disease, kidney disease, etc.) |

- Progress bar shown across all steps
- Data persisted in sessionStorage across steps
- Submitted in one API call on completion
- Drives the entire recommendation and scoring engine

---

## 📸 Menu Scanning Pipeline

### Image Upload
- Upload **1–10 menu images** (JPEG, PNG, WebP, max 5MB each)
- Drag-and-drop or tap-to-upload with image previews
- Optional restaurant name input
- **GPS auto-detection** via Google Places API
- Rate limited to **10 scans per user per day**
- Returns `scanId` immediately, processes AI pipeline **asynchronously**

### Processing Pipeline

```
1. Image Upload → Cloudinary
2. Restaurant Detection (user input → GPS → AI extraction)
3. Groq Vision API → Dish name, description, price extraction
4. Deduplication → Remove duplicate dishes
5. Food Database Lookup → Exact match against 1,137+ items
6. AI Nutrition Estimation → Batch Groq API for unmatched dishes
7. Scoring Engine → Personalized 0–100 scores
8. Tag Generation → High Protein, Low Carb, etc.
9. Combo Builder → AI-recommended starter + main + dessert combos
10. Dish Photo Fetch → Unsplash photos for recommended dishes
11. Review Queue → AI dishes queued for admin review
12. Scan Quality Assessment → Good / Partial / Low Confidence
```

### Scan Quality

| Condition | Quality | Action |
|---|---|---|
| ≥3 dishes, good confidence | ✅ Good | Normal results |
| <3 dishes | ⚠️ Partial | Warning banner + rescan CTA |
| Low avg AI confidence | 🔍 Low Confidence | Warning banner |
| 0 dishes | ❌ Unreadable | Scan deleted |

---

## 🧮 Nutrition Scoring System

### TDEE Formula
```
BMR = (10 × weight) + (6.25 × height) - (5 × age) ± constant
TDEE = BMR × activity multiplier
```

### Scoring Breakdown (Base Score: 50)

| Factor | Logic |
|---|---|
| **Allergen** | Detected allergen → **score = 0** (hard block) |
| **Build Muscle** | High protein → +25, Low protein → -15 |
| **Lose Weight** | Low calories → +22, Fried → -20 |
| **Stay Healthy** | Balanced macros → +10 |
| **Diet penalties** | Vegan + dairy → -30, Keto + high carbs → -25 |
| **Cooking method** | Grilled/steamed/baked → +10, Fried → -10 |
| **Health conditions** | Diabetes: high sugar → -30, fiber → +15 |
| | Heart disease: high sat fat → -30, fish → +15 |
| | Kidney disease: excess protein → penalty |
| **Confidence** | Low AI confidence → penalty |

### Classification

| Score | Category | UI Treatment |
|---|---|---|
| ≥65 | ✅ Recommended | Green ring, top section |
| 45–64 | 👍 Good | Good choices section |
| 26–44 | 🍽️ Other | Neutral section |
| ≤25 | ⚠️ Avoid | Red warning section |

### Tag Generation
- High Protein · Low Carb · Low Calorie · High Calorie · Healthy Cook · Deep Fried · Fits Your Goal

---

## 🍱 Recommended Combos

The system automatically builds **balanced meal combos** from scan results:

- **Starter + Main + Dessert/Drink** combinations
- Optimized for the user's health goal
- Shows combined nutrition totals (calories, protein, carbs, fat)
- Combo score displayed with clickable dish links

---

## 📤 Shareable Nutrition Cards

### Dish Cards (3 Designs)
Users can generate and share beautiful nutrition cards for individual dishes:

| Design | Style | Format |
|---|---|---|
| 🌅 Sunrise | Warm amber/orange gradient | 9:16 story |
| 💜 Vibrant | Dark navy/indigo gradient | 9:16 story |
| 🖼️ Wide | Green split panel | 16:9 landscape |

- Each card shows: dish name, restaurant, goal match score, macros (calories/protein/carbs/fat), dish photo (if available)
- Goal-aware badges: "💪 Smart Muscle Pick", "🔥 Weight Loss Win", "✅ Healthy Choice"
- Generated via `html2canvas` at 3x resolution
- Native share (Web Share API) or download as PNG

### Scan Summary Cards
- Share entire scan results as a card
- Shows restaurant name, total dishes, recommended count, top 3 picks with scores
- Green gradient design with MenuLens branding

---

## ⚖️ Portion Picker

For dishes matched in the **food database** (1,137+ items with INDB/USDA data):

- **Small / Standard / Large** portion tiers
- Each tier shows: label, weight in grams, calories, protein, carbs, fat
- Nutrition estimates update dynamically when portion is changed
- Disclaimer: "Estimates based on INDB data with restaurant adjustment"
- Restaurant multipliers applied (creamy curry ×1.5, fried ×1.3, default ×1.1)

---

## 🚩 User Feedback System

Users can report incorrect nutrition data directly from the dish detail page:

- **Feedback types:** Wrong nutrition values, Wrong dish identified, Missing allergen warning, Other
- Optional comment field
- Feedback creates a priority-weighted entry in the admin review queue
- One-time submission per dish (button hides after submit)

---

## 🔄 Restaurant Memory

When viewing scan results, the app shows **"You've been here before"** context:

- Displays total past visits to the same restaurant
- Expandable panel showing last 3 visits with:
  - Date, dish count, recommended count
  - Top 3 dishes from each visit with scores and calories
  - Clickable links to past dish details
- Link to full scan history

---

## 🔖 Saved Dishes

- **Save/unsave individual dishes** from results or dish detail page
- Dedicated `/saved` page with all bookmarked dishes
- Shows restaurant name and save date per dish
- Empty state with CTA to scan a menu

---

## 🔎 Search & Filters

On the scan results page:

- **Text search** — filter dishes by name or tag
- **Tag filter chips** — quick filter by category:
  - All · High Protein · Low Carb · Low Calorie · High Calorie · Healthy Cook · Deep Fried · Fits Your Goal
- Filtered results show as a flat list; clear filters to return to sections

---

## 🍛 Food Database

### Sources
- **INDB 2024** (Indian Nutrient Database)
- **UK CoFID**
- **USDA**
- Manual research

**Total:** 1,137+ verified dishes

### Structure
```js
{
  canonical_name,
  aliases[],
  per_100g: { calories, protein, carbs, fat, fiber },
  portions: [{ label, weight_grams, calories_kcal, protein_g, carbs_g, fat_g }],
  description
}
```

### Portion System
- Small · Standard · Large (with gram weights and pre-calculated nutrition)

### Restaurant Multipliers
| Dish Type | Multiplier |
|---|---|
| Creamy curry | ×1.5 |
| Fried items | ×1.3 |
| Default | ×1.1 |

---

## 🧑‍💼 Admin Panel

### Dashboard (`/admin`)
- Total scans, users, queue items statistics
- System health overview

### Review Queue (`/admin/queue`)
- AI-estimated dishes queued for human review
- User-reported feedback items
- Priority scoring: `(scan_count × 3) + confidence_penalty + feedback_bonus`
- Admin actions: **Promote** (to food DB) · **Reject** · **Edit**
- Queue stats and filtering

---

## 📄 Pages

| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page with hero, CTAs |
| `/signup` | Public | Registration form |
| `/login` | Public | Login form |
| `/verify-otp` | Public | 6-digit OTP verification |
| `/onboarding/*` | Auth | 7-step health profile setup |
| `/home` | Protected | Dashboard with stats, recent scans |
| `/scan` | Protected | Upload menu images |
| `/processing/:scanId` | Protected | Animated processing screen with polling |
| `/results/:scanId` | Protected | Categorized results with combos, search, filters, share |
| `/dish/:dishId` | Protected | Full nutrition detail, portion picker, share, feedback |
| `/history` | Protected | Paginated scan history with delete |
| `/saved` | Protected | Bookmarked dishes collection |
| `/profile` | Protected | View/edit profile, logout, delete account |
| `/admin` | Admin | Dashboard statistics |
| `/admin/queue` | Admin | Review queue management |

---

## 🔁 API Endpoints

### Auth
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Register + send OTP |
| POST | `/api/auth/verify-otp` | No | Verify OTP, activate account |
| POST | `/api/auth/login` | No | Login, set cookies |
| POST | `/api/auth/logout` | Yes | Clear cookies |
| POST | `/api/auth/refresh-token` | Cookie | Issue new access token |
| POST | `/api/auth/resend-otp` | No | Resend OTP |

### User
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/user/profile` | Yes | Get user profile |
| PUT | `/api/user/profile` | Yes | Update profile |
| PUT | `/api/user/onboarding` | Yes | Complete onboarding |
| DELETE | `/api/user/account` | Yes | Delete account + all data |

### Scan
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/scan` | Yes | Upload images, trigger AI pipeline |
| GET | `/api/scan/history` | Yes | Paginated scan history |
| GET | `/api/scan/last` | Yes | Last 5 completed scans |
| GET | `/api/scan/restaurant-history` | Yes | Past visits to same restaurant |
| GET | `/api/scan/:scanId` | Yes | Get scan + populated dishes |
| PUT | `/api/scan/:scanId/save` | Yes | Toggle scan save status |
| DELETE | `/api/scan/:scanId` | Yes | Delete scan + all dishes |

### Dish
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/dish/saved` | Yes | Get all saved dishes |
| GET | `/api/dish/:dishId` | Yes | Get full dish detail |
| PUT | `/api/dish/:dishId/save` | Yes | Toggle dish save/unsave |

### Feedback
| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/feedback/dish/:dishId` | Yes | Submit dish feedback |

### Admin
| Method | Route | Auth | Description |
|---|---|---|---|
| GET | `/api/admin/stats` | Admin | Dashboard statistics |
| GET | `/api/admin/queue` | Admin | Get review queue |
| GET | `/api/admin/queue/stats` | Admin | Queue statistics |
| PUT | `/api/admin/queue/:id` | Admin | Update queue item |
| POST | `/api/admin/queue/:id/promote` | Admin | Promote to food DB |

---

## 📦 Progressive Web App (PWA)

- ✅ Offline support via Service Worker
- ✅ Installable on mobile & desktop
- ✅ App icons (192px, 512px)
- ✅ iOS PWA meta tags
- ✅ OpenGraph + Twitter Card meta for social sharing

---

## 🛡️ Security

- JWT authentication with HTTP-only cookies
- bcrypt password hashing
- Rate limiting (10 scans/day per user)
- Input validation across all endpoints
- Refresh token rotation
- Admin-only route protection (email-based check)
- CORS configuration

---

## ⚡ Performance

- Client-side image compression before upload
- Batch AI processing (single API call for all dishes)
- Async pipeline — scan returns immediately
- Dish photos fetched non-blocking for recommended dishes only
- Database-indexed queries
- Google Fonts preloaded for card generation

---

## 🧪 Error Handling

| Scenario | Action |
|---|---|
| Pipeline crash | Scan + dishes cleaned up, deleted |
| No dishes extracted | Scan marked as failed, deleted |
| Low confidence results | Warning banner with rescan CTA |
| Partial scan (<3 dishes) | Warning banner with quality note |

---

## 📈 Future Improvements

- Meal planning & weekly tracking
- AI diet coach
- Multi-language menu support
- Calorie budget tracking per day
- Social features — follow friends' scans

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Submit a pull request

---

## 📄 License

MIT License

---

## 👨‍💻 Author

**Mohamad Sahil Khan**

---

## ⭐ Final Note

MenuLens is a **production-grade AI + nutrition + engineering system** designed to solve:

- 🍔 Poor food decision-making at restaurants
- 🔍 Lack of menu transparency and nutrition info
- ⚠️ Health risks from uninformed dietary choices
- 📊 The gap between clinical nutrition data and real-world dining
