
# 📱 MenuLens — AI-Powered Menu Scanner & Personalized Nutrition Recommender

> Scan any restaurant menu → Instantly get **AI-powered, personalized dish recommendations** based on your health goals, diet, allergies, and medical conditions.

🌐 **Live App:** https://menu-lens-ten.vercel.app  
🔗 **Backend API:** https://menulens.onrender.com  

---

# 🚀 Overview

**MenuLens** is a full-stack **MERN Progressive Web App (PWA)** that transforms how users interact with restaurant menus.

Instead of guessing what’s healthy, users can:

- 📸 Scan menu images  
- 🧠 Let AI extract dishes & estimate nutrition  
- 🎯 Get **personalized recommendations**  
- ⚠️ Avoid harmful dishes based on allergies/conditions  
- 💾 Save dishes across visits  

This is not just a scanner — it is a **clinical-grade nutrition decision system** built using **validated research, real food databases, and AI augmentation**.

---

# 🧱 Tech Stack

## Frontend
- React 18 + Vite  
- Tailwind CSS  
- Framer Motion  
- React Router v6  
- Axios (JWT interceptor)  
- React Hot Toast  
- PWA via vite-plugin-pwa  

## Backend
- Node.js + Express.js  
- MongoDB Atlas + Mongoose  
- JWT Authentication (Access + Refresh tokens)  
- Cloudinary (image storage)  
- Nodemailer (OTP email verification)  
- Multer (file uploads)  
- Express Rate Limiting  
- Cookie Parser  

## AI / ML
- Groq API  
- Model: `meta-llama/llama-4-scout-17b-16e-instruct`  
- Pipeline:
  - Vision → Dish extraction  
  - Text → Nutrition estimation  

## External APIs
- Google Places API (restaurant detection)  
- Cloudinary CDN  

---

# 🧠 System Architecture

```

Client (React PWA)
↓
Express API Server
↓
Scan Controller → Async AI Pipeline
↓
Groq AI + Food Database
↓
Scoring Engine
↓
MongoDB

```

---

# 🔐 Authentication System

### Flow
1. Signup → OTP sent via email  
2. Verify OTP → account activated  
3. Login → returns tokens  

### Tokens
- Access Token → 15 minutes  
- Refresh Token → 7 days  
- Stored in `localStorage`

### Request Format
```

Authorization: Bearer <accessToken>

````

### Auto Refresh Mechanism
- Axios interceptor detects `401`
- Calls `/api/auth/refresh-token`
- Retries original request

### Security
- bcrypt password hashing  
- OTP expiry (10 min)  
- Refresh token rotation  

---

# 👤 User Profile System

```js
profile: {
  gender,
  age,
  height,
  weight,
  activityLevel,
  goal,
  dietType[],
  allergies[],
  healthConditions[],
  macros
}
````

* Strong validation enforced
* Drives recommendation engine

---

# 🧭 Onboarding Flow (7 Steps)

1. Gender + Age
2. Height + Weight
3. Goal (lose_weight / build_muscle / stay_healthy)
4. Diet Type
5. Allergies
6. Activity Level
7. Health Conditions

---

# 📸 Menu Scanning Pipeline

## Step 1: Image Upload

* 1–10 images
* Client-side compression
* Uploaded to Cloudinary
* Returns `scanId` immediately

---

## Step 2: Restaurant Detection

Priority:

1. User input
2. GPS → Google Places
3. AI extraction

---

## Step 3: Dish Extraction (AI Vision)

```json
{
  "restaurant_name": "",
  "dishes": [
    {
      "name": "Butter Chicken",
      "raw_name": "Murgh Makhani",
      "price": 320
    }
  ]
}
```

* Fixes OCR
* Normalizes names
* Translates dishes

---

## Step 4: Deduplication

* Removes duplicate dishes

---

## Step 5: Database Lookup

* Exact match only
* Uses canonical names + aliases

---

## Step 6: AI Nutrition Estimation

Batch processed:

* Calories
* Protein
* Carbs
* Fat
* Ingredients
* Cooking method
* Confidence score

---

## Step 7: Scoring Engine

Each dish scored from **0–100**

---

## Step 8: Review Queue

* AI dishes stored for admin review
* Can be promoted to database

---

## Step 9: Scan Quality

| Condition      | Result  |
| -------------- | ------- |
| <3 dishes      | Partial |
| Low confidence | Warning |
| 0 dishes       | Deleted |

---

# 🧮 Nutrition Scoring System

## TDEE Formula

```
BMR = (10 × weight) + (6.25 × height) - (5 × age) ± constant
TDEE = BMR × activity multiplier
```

---

## Score Logic

### Base Score

```
50
```

---

### Allergen Rule

* If allergen detected → score = 0

---

### Goal-Based Scoring

#### Build Muscle

* High protein → +25
* Low protein → -15

#### Lose Weight

* Low calories → +22
* Fried → -20

#### Stay Healthy

* Balanced macros → +10

---

### Diet Penalties

* Vegan + dairy → -30
* Keto + high carbs → -25

---

### Health Condition Logic

Examples:

* Diabetes:

  * High sugar → -30
  * Fiber → +15

* Heart disease:

  * High saturated fat → -30
  * Fish → +15

* Kidney disease:

  * Excess protein → penalty

---

### Confidence Adjustment

* Low AI confidence → penalty

---

## Final Classification

| Score | Category    |
| ----- | ----------- |
| ≥65   | Recommended |
| 45–64 | Good        |
| 26–44 | Neutral     |
| ≤25   | Avoid       |

---

# 🍛 Food Database

## Sources

* INDB 2024
* UK CoFID
* USDA
* Manual research

**Total:** 1,137+ dishes

---

## Structure

```js
canonical_name
aliases[]
per_100g
portions[]
```

---

## Portion System

* Small
* Standard
* Large

---

## Restaurant Multipliers

* Creamy curry → ×1.5
* Fried → ×1.3
* Default → ×1.1

---

# 🧾 Dish System

Each dish stores:

* Nutrition ranges
* Score + breakdown
* Tags
* Cooking method
* Save status
* Portion tiers

---

# 🧠 Review Queue System

* AI dishes stored for admin review
* Priority based on:

```
(scan_count × 3) + confidence penalty
```

Admin actions:

* Promote
* Reject
* Edit

---

# 💾 Save Feature

* Save individual dishes
* Fields:

```
isSaved
savedAt
```

* Accessible via `/saved`

---

# 🔎 Search & Filters

* High Protein
* Low Carb
* Low Calorie
* High Fiber
* Healthy Cook
* Deep Fried

---

# 📊 Scan System

Stores:

* Restaurant info
* Images
* Dishes
* Scan quality
* Recommendations

---

# 🔁 API Endpoints

## Auth

* POST `/api/auth/signup`
* POST `/api/auth/verify-otp`
* POST `/api/auth/login`
* POST `/api/auth/refresh-token`

## User

* GET `/api/user/profile`
* PUT `/api/user/profile`
* DELETE `/api/user/account`

## Scan

* POST `/api/scan`
* GET `/api/scan/:id`
* GET `/api/scan/history`

## Dish

* GET `/api/dish/:id`
* POST `/api/dish/:id/save`

## Admin

* GET `/api/admin/queue`
* POST `/api/admin/promote`

---

# 📦 Progressive Web App (PWA)

* Offline support
* Installable
* Service Worker caching
* App icons (192px, 512px)

---

# 🛡️ Security

* JWT authentication
* Password hashing
* Rate limiting
* Input validation
* Token rotation

---

# ⚡ Performance Optimizations

* Image compression (10MB → ~1MB)
* Batch AI processing
* Async pipeline
* Indexed DB queries

---

# 🧪 Error Handling

| Scenario       | Action      |
| -------------- | ----------- |
| Pipeline crash | Delete scan |
| No dishes      | Delete scan |
| Low confidence | Warning     |

---

# 📈 Future Improvements

* Meal planning
* Weekly nutrition tracking
* AI diet coach
* Multi-language support

---

# 🤝 Contributing

1. Fork repository
2. Create branch
3. Commit changes
4. Submit pull request

---

# 📄 License

MIT License

---

# 👨‍💻 Author

**Mohamad Sahil Khan**

---

# ⭐ Final Note

MenuLens is a **real-world AI + nutrition + engineering system** designed to solve:

* Poor food decision-making
* Lack of menu transparency
* Health risks from wrong choices
