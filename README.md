# 🍽️ MenuLens — AI-Powered Restaurant Menu Analyzer

> Photograph any restaurant menu. Get instant, personalized dish recommendations based on your health goals, allergies, and dietary preferences — powered by a hybrid AI + verified nutrition database system.

---

## 📌 What MenuLens Does

MenuLens solves a real problem: when you sit down at a restaurant, you have no idea which dishes fit your health goals. You don't know the calories in the Dal Makhani, whether the Butter Chicken has too much fat for your weight loss goal, or whether the Masala Dosa contains allergens you need to avoid.

MenuLens lets you photograph the menu, and within 15–30 seconds gives you:
- Every dish on the menu with estimated nutrition (calories, protein, carbs, fat)
- A personalized recommendation score for each dish based on your health profile
- Clear "Recommended" and "Avoid" sections
- Allergen warnings
- Portion size options (small/standard/large) with adjusted calorie counts

---

## 🏗️ Architecture Overview

```
User uploads menu photo
        ↓
Cloudinary (image storage)
        ↓
Groq Vision API (menu OCR + dish name normalization)
        ↓
For each dish:
  ├── DB Lookup (FoodItem collection — INDB/IFCT data)
  │     ↓ found → use verified nutrition + restaurant multiplier
  └── Not found → Groq Text API (AI nutrition estimation)
        ↓
Recommendation Engine (rule-based scoring 0–100)
        ↓
Results displayed to user
```

---

## 🔬 How Nutrition Data Works (The Core System)

This is the most technically complex part of MenuLens. Understanding it is essential.

### Layer 1: The Food Database (Primary Source)

MenuLens maintains a MongoDB collection called `FoodItem` seeded from the **Anuvaad INDB 2024** dataset — India's most comprehensive food nutrition database, which itself draws from:

- **IFCT 2017** (Indian Food Composition Tables) — lab-measured values from NIN Hyderabad, peer-reviewed, ±5-8% accuracy
- **INDB ASC Manual** — recipe-calculated composite dishes
- **UK CoFID** — gap-fills for non-Indian items

The database contains **1,100+ dishes** after seeding, including:
- All 1,014 dishes from INDB
- 75+ manually researched missing dishes (Chicken Tikka Masala, Dal Tadka, Hakka Noodles, Momos, etc.)
- 29 corrected Indo-Chinese dishes (INDB had corrupt data for Chilli Paneer, Veg Manchurian, etc.)
- 30+ street food and chaat items

Each `FoodItem` document stores:
- `per_100g` — raw nutritional values per 100g (from INDB/IFCT)
- `portions` — 3 restaurant portion tiers (small/standard/large) with adjusted values
- `aliases` — alternate names, Hindi names, spelling variants for fuzzy matching
- `data_quality_score` — reliability score (70–95) based on data source

### Layer 2: Restaurant Portion Adjustment (The Gap Bridge)

INDB data is based on home-cooking recipes. Restaurant food is systematically higher in calories and fat. MenuLens applies **research-backed multipliers** when calculating restaurant portions:

| Category | Calorie Multiplier | Fat Multiplier | Research Basis |
|---|---|---|---|
| Creamy curries (makhani, korma, shahi) | ×1.5 | ×1.85 | Restaurants use 3-4× more butter/cream |
| Kofta curries | ×1.4 | ×1.65 | Deep-fried dumplings in rich gravy |
| Dal Makhani | ×1.35 | ×1.6 | Butter and cream finish |
| Biryani/Pulao | ×1.35 | ×1.45 | 2-3× more ghee than home recipe |
| Regular curries | ×1.25 | ×1.4 | More oil than home cooking |
| Naan/Paratha | ×1.2–1.25 | ×1.3–1.4 | Butter applied post-cooking |
| South Indian (dosa, idli) | ×1.15 | ×1.2 | More oil on tawa |
| Tandoor/grilled | ×1.0 | ×1.0 | Dry heat, no added fat |
| Beverages | ×1.0 | ×1.0 | Standardized recipes |

These multipliers are applied **only to the restaurant portion** — the INDB home-recipe values are preserved separately for reference.

### Layer 3: Three-Tier Portion System

A "bowl" means different things at a dhaba (350g), a QSR chain (220g), and fine dining (180g). MenuLens stores three portion tiers per dish:

- **Small** — fine dining / light eater
- **Standard** (default) — typical restaurant serving
- **Large** — dhaba / generous serving

Weights are based on research: Swiggy/Zomato container sizes, UK NHS restaurant portion studies, and INDB implied weights.

On the dish detail page, users can tap a portion picker to select their actual serving size — the nutrition display updates in real-time.

### Layer 4: AI Estimation (Fallback)

When a dish is not found in the database, MenuLens sends it to **Groq's Llama-4-Scout model** for nutrition estimation. All dishes not in the DB are sent in a **single batch call** (not one call per dish) for efficiency.

The AI prompt is carefully engineered to:
- Correctly identify item type (beverage vs food vs dessert)
- Apply realistic restaurant serving sizes
- Return min/max ranges (never a single number presented as fact)
- Set low confidence (<50) when uncertain
- Generate `recommendReason` and `avoidReasons` from its knowledge

AI-estimated dishes are automatically logged to the **FoodReviewQueue** for admin verification.

### Data Quality Scores

Every dish has a `data_quality_score` (0–100) that reflects how reliable the nutrition data is:

| Source | Base Score | After ×1.5 multiplier |
|---|---|---|
| IFCT 2017 (lab-measured) | 95 | 87 |
| INDB ASC Manual | 88 | 80 |
| USDA | 80 | 72 |
| UK CoFID | 78 | 70 |
| Recipe analysis (manually researched) | 72–80 | 70+ |
| AI estimation | 45 | — |

The score is shown as a confidence bar on the dish detail page.

---

## 🤖 How Menu OCR Works

### Step 1: Image Upload
User uploads 1–3 photos (JPEG/PNG/WebP, max 5MB each). Images are validated client-side and server-side, then uploaded to **Cloudinary** for persistent storage.

### Step 2: Grounded Extraction
The Cloudinary URLs are sent to **Groq Vision API** with a specialized prompt that instructs the model to:

1. Extract all food and beverage items from the image
2. **Normalize dish names** using its own knowledge:
   - Fix OCR errors: `"Btr Chkn"` → `"Butter Chicken"`
   - Expand abbreviations: `"Chx Tikka"` → `"Chicken Tikka"`
   - Translate Hindi: `"पनीर मखनी"` → `"Paneer Makhani"`
   - Standardize variants: `"Murgh Makhani"` → `"Butter Chicken"`
3. Return both the normalized name and the raw text from the menu

This approach works because the LLM was trained on massive amounts of Indian food content and already knows that "Murgh Makhani = Butter Chicken", that "Pnr Mkhni" is likely "Paneer Makhani", etc. No reference list needs to be sent — the LLM uses its own knowledge.

### Step 3: Database Lookup
For each normalized dish name, `lookupFoodItem()` runs 4 strategies in sequence:
1. **Exact canonical match** — `"butter chicken"` → direct hit
2. **Alias match** — `"murgh makhani"` → found via alias array
3. **MongoDB $text search** — weighted full-text search on `display_name_en` + `aliases.alias_text`
4. **Fuzzy word match** — splits name into words (>3 chars), matches each against canonical names

### Step 4: Batch AI for Misses
Dishes not found in the DB are collected and sent to Groq text API in **one single batch call**. The response is a JSON array with nutrition for all missing dishes simultaneously. This is significantly faster and cheaper than one call per dish.

---

## 🎯 Recommendation Engine

Each dish gets a score from 0–100 based on the user's health profile.

### Scoring Algorithm

```
Base score: 50

Goal scoring:
  build_muscle:
    protein.avg >= 30g → +25
    protein.avg >= 20g → +15
    protein.avg < 20g  → -10

  lose_weight:
    calories.avg <= 35% of daily target → +20
    calories.avg > 49% of daily target  → -20
    cookingMethod === 'fried'           → -15

  stay_healthy:
    protein.avg >= 15g                  → +10
    calories.avg <= 40% of daily target → +10

Allergen hard-block:
  Any allergen match → score = 0 (regardless of other factors)

Diet penalties:
  vegetarian + contains meat → -40
  keto + carbs.avg > 20g    → -25

Cooking method:
  grilled/steamed/baked → +10
  fried                 → -10

Confidence penalty:
  confidenceScore < 50  → -10

Final: clamp to [0, 100]
```

### Classification
- **Recommended**: score ≥ 60
- **Avoid**: allergen flag OR score ≤ 30
- **Neutral**: everything else

### Tag Generation
Tags are assigned based on thresholds:
- `High Protein` — protein.avg ≥ 25g
- `Low Carb` — carbs.avg ≤ 20g
- `Low Calorie` — calories.avg ≤ 400 kcal
- `High Calorie` — calories.avg ≥ 700 kcal
- `Healthy Cook` — cooking method is grilled/steamed/baked
- `Deep Fried` — cooking method is fried
- `Fits Your Goal` — score ≥ 80

---

## 👤 User Health Profile & Onboarding

Users complete a 7-step onboarding flow that collects:

1. **Gender & Age** — used for BMR calculation context
2. **Height & Weight** — supports cm/ft and kg/lbs with unit toggle
3. **Health Goal** — Lose Weight / Build Muscle / Stay Healthy
4. **Diet Type** — Vegetarian, Vegan, Non-Vegetarian, Dairy Free, Gluten Free, Keto
5. **Allergies** — Peanuts, Shellfish, Dairy, Gluten, Eggs, Fish, Tree Nuts, Soy, None
6. **Activity Level** — Sedentary → Extra Active (5 options)
7. **Health Conditions** — Diabetes, Hypertension, High Cholesterol, IBS, GERD, Kidney Disease, Heart Disease, Obesity, Anemia, Lactose Intolerance, None

All data is stored in the user's `profile` subdocument and used by the recommendation engine on every scan.

---

## 🔐 Authentication System

### Flow
1. User signs up → password bcrypt-hashed (saltRounds=10) → 6-digit OTP generated, hashed, stored with 10-min expiry → OTP emailed via Nodemailer
2. User verifies OTP → account activated
3. User logs in → `accessToken` (15min) + `refreshToken` (7 days) set as **HTTP-only cookies**
4. Protected routes → `auth.middleware.js` verifies accessToken from cookie
5. Token expired → `/api/auth/refresh-token` issues new accessToken using refreshToken
6. Logout → both cookies cleared + refreshToken deleted from DB

### Security
- Passwords and OTPs: never stored in plain text, always bcrypt-hashed
- JWTs: HTTP-only cookies only, never localStorage
- Cookie flags: `HttpOnly`, `Secure` (production), `SameSite=Strict`
- OTP resend: rate-limited to 3 per 15 minutes per email
- Scan upload: rate-limited to 10 per user per day

---

## 🗄️ Database Schema

### User
```javascript
{
  name, email, password (bcrypt),
  isVerified, otp (bcrypt hash), otpExpiry,
  onboardingComplete,
  profile: {
    gender, age, height (cm), weight (kg),
    activityLevel, goal, dietType[], allergies[],
    healthConditions[], dailyCalories, macros
  },
  refreshToken
}
```

### Scan
```javascript
{
  userId, restaurantName, images[], imageHashes[],
  status: 'processing' | 'complete' | 'failed',
  errorMessage,
  scanQuality: 'good' | 'partial' | 'low_confidence' | 'unreadable',
  scanQualityNote,
  dishes[], recommendedDishes[], avoidDishes[],
  totalDishesFound, totalMatchingDishes, totalFlaggedDishes,
  isSaved
}
```

### Dish
```javascript
{
  scanId, name, description, estimatedPrice,
  estimatedNutrition: { calories, protein, carbs, fat (each: min/max/avg) },
  confidenceScore, matchScore,
  tags[], allergenFlags[], avoidReasons[], recommendReason,
  cookingMethod, dataSource: 'database' | 'ai',
  multiplierNote, portionTiers: { small, standard, large }
}
```

### FoodItem
```javascript
{
  canonical_name, display_name_en, display_name_hi,
  category, subcategory, cuisine_region, meal_type,
  cooking_method, is_veg, is_vegan, is_jain,
  allergens[], glycemic_index,
  data_source, data_quality_score, verified,
  per_100g: { calories_kcal, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, saturated_fat_g },
  portions: [{ label, weight_grams, calories_kcal, protein_g, carbs_g, fat_g, is_default, restaurant_multiplier_applied, multiplier_note }],
  aliases: [{ alias_text, language, script }]
}
```

### FoodReviewQueue
```javascript
{
  entry_type: 'ai_sourced' | 'user_feedback',
  dish_name, raw_name, scan_count,
  ai_nutrition: { calories_min/max, protein_min/max, ... confidence },
  user_feedback: { feedback_type, user_comment, user_id, dish_id },
  priority_score,  // (scan_count × 3) + (feedback_count × 5) + (low_confidence ? 10 : 0)
  status: 'pending' | 'reviewed' | 'promoted' | 'rejected'
}
```

---

## 🔄 Scan Error Recovery

MenuLens handles three failure scenarios gracefully:

### Complete Failure (0 dishes extracted)
- `scan.status = 'failed'`, `errorMessage = 'no_dishes_found'`
- Processing page shows: camera emoji, "Couldn't read this menu", 4 actionable tips (move closer, better lighting, hold steady, different angle), re-upload button

### Partial Scan (1–2 dishes found)
- `scan.scanQuality = 'partial'`
- Results still shown (partial data is useful), amber banner at top: "Partial scan detected — only X dishes found"
- "Scan again with better photo →" link

### Low Confidence (avg AI confidence < 50%)
- `scan.scanQuality = 'low_confidence'`
- Results shown with blue banner: "Low confidence results — nutrition estimates may be less accurate"
- Re-scan option provided

---

## 🛡️ Admin Dashboard & Data Quality Loop

### Review Queue
Every AI-estimated dish is automatically logged to `FoodReviewQueue` with:
- The dish name and AI-estimated nutrition
- Scan count (how many users scanned this dish)
- Priority score (high scan count + low confidence = review first)

Users can also flag dishes via the "🚩 Report incorrect data" button on dish detail pages.

### Admin Dashboard (`/admin`)
- Platform stats: total users, scans, food items, queue size
- Top priority queue items
- Queue management: filter by status/type, expand items, review AI estimates

### Admin Queue (`/admin/queue`)
- Sorted by priority score
- Expandable items showing AI nutrition estimates
- Actions: Reject / Mark Reviewed / Promote to DB
- Promote flow: admin provides corrected nutrition, dish added to FoodItem collection with `data_quality_score: 85` and `verified: true`

Access controlled by `ADMIN_EMAIL` environment variable.

---

## 🚀 Setup & Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/menulens.git
cd menulens

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### Environment Variables

**server/.env**
```env
PORT=5000
MONGODB_URI=mongodb+srv://...
JWT_ACCESS_SECRET=your_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
GROQ_API_KEY=your_groq_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
CLIENT_URL=http://localhost:5173
NODE_ENV=development
ADMIN_EMAIL=your_admin_email@gmail.com
```

**client/.env**
```env
VITE_API_BASE_URL=http://localhost:5000
```

### Seed the Food Database

```bash
cd server

# Seed all food data (INDB + missing dishes + Indo-Chinese + street food)
npm run seed:all

# Generate Hindi aliases (one-time, uses Groq API)
npm run generate:hindi
```

### Run Development Servers

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev
```

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, React Router v6, Framer Motion, Axios, React Hot Toast |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (HTTP-only cookies), Bcrypt, Nodemailer |
| File Upload | Multer (memory storage) + Cloudinary |
| AI / OCR | Groq Vision API + Groq Text API (meta-llama/llama-4-scout-17b-16e-instruct) |
| Nutrition Data | INDB 2024 (IFCT 2017 + ASC Manual), manually researched dishes |
| Testing | Node:test + fast-check (property-based testing) |

---

## 🗺️ Frontend Routes

| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page |
| `/signup` | Public | Registration |
| `/login` | Public | Login |
| `/verify-otp` | Public | Email verification |
| `/onboarding/gender-age` | Auth | Step 1: Gender & Age |
| `/onboarding/body` | Auth | Step 2: Height & Weight |
| `/onboarding/goal` | Auth | Step 3: Health Goal |
| `/onboarding/diet` | Auth | Step 4: Diet Type |
| `/onboarding/allergies` | Auth | Step 5: Allergies |
| `/onboarding/activity` | Auth | Step 6: Activity Level |
| `/onboarding/conditions` | Auth | Step 7: Health Conditions |
| `/home` | Protected | Dashboard |
| `/scan` | Protected | Upload menu photos |
| `/processing/:scanId` | Protected | AI processing screen |
| `/results/:scanId` | Protected | Scan results |
| `/dish/:dishId` | Protected | Dish detail + portion picker |
| `/history` | Protected | Past scans |
| `/profile` | Protected | Health profile management |
| `/admin` | Admin only | Admin dashboard |
| `/admin/queue` | Admin only | Data review queue |

---

## 🔌 API Routes

### Auth (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/signup` | Register, send OTP |
| POST | `/verify-otp` | Verify OTP |
| POST | `/login` | Login, set cookies |
| POST | `/logout` | Clear cookies |
| POST | `/refresh-token` | Refresh access token |
| POST | `/resend-otp` | Resend OTP (rate limited) |

### User (`/api/user`) — Protected
| Method | Endpoint | Description |
|---|---|---|
| GET | `/profile` | Get user profile |
| PUT | `/profile` | Update profile |
| PUT | `/onboarding` | Complete onboarding |
| DELETE | `/account` | Delete account + all data |

### Scan (`/api/scan`) — Protected
| Method | Endpoint | Description |
|---|---|---|
| POST | `/` | Upload images, trigger AI pipeline |
| GET | `/history` | Paginated scan history |
| GET | `/:scanId` | Get scan + dishes |
| PUT | `/:scanId/save` | Toggle save status |
| DELETE | `/:scanId` | Delete scan + dishes |

### Dish (`/api/dish`) — Protected
| Method | Endpoint | Description |
|---|---|---|
| GET | `/:dishId` | Get dish detail |

### Feedback (`/api/feedback`) — Protected
| Method | Endpoint | Description |
|---|---|---|
| POST | `/dish/:dishId` | Submit nutrition feedback |

### Admin (`/api/admin`) — Admin only
| Method | Endpoint | Description |
|---|---|---|
| GET | `/stats` | Dashboard statistics |
| GET | `/queue` | Review queue (paginated) |
| GET | `/queue/stats` | Queue statistics |
| PUT | `/queue/:id` | Update queue item status |
| POST | `/queue/:id/promote` | Promote to FoodItem DB |

---

## ⚠️ Important Notes

1. **Nutrition estimates are not medical advice** — always confirm allergens with restaurant staff
2. **Restaurant calorie estimates have ±15–20% variance** — this is the nature of restaurant food, not a bug
3. **The food database improves over time** — AI-sourced dishes are reviewed by admin and promoted to the verified DB
4. **Rate limits** — 10 scans per user per day (Groq API cost protection)
5. **Image quality matters** — dark, blurry, or handwritten menus will produce partial or failed scans

---

*Built with MERN Stack + Groq Vision AI + INDB 2024 Nutrition Database*
