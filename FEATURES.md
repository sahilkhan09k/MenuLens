# MenuLens — Platform Features & Pages

## Overview

MenuLens is a full-stack MERN web application that lets users photograph restaurant menus and receive AI-powered, personalized meal recommendations based on their health profile.

---

## Current Features

### Authentication
- User signup with name, email, and password (min 8 characters)
- Email OTP verification (6-digit code, 10-minute expiry)
- OTP resend with 60-second cooldown on the frontend
- Login with JWT access token (15min) + refresh token (7 days) stored in HTTP-only cookies
- Auto token refresh via Axios interceptor on 401 responses
- Logout clears cookies and removes refresh token from DB

### Health Profile Onboarding (4 steps)
- Step 1: Select health goal — Lose Weight, Build Muscle, Stay Healthy
- Step 2: Select diet type(s) — Vegetarian, Vegan, Non-Vegetarian, Dairy Free, Gluten Free, Keto
- Step 3: Select allergies — Peanuts, Shellfish, Dairy, Gluten, Eggs, Fish, Tree Nuts, Soy, None
- Step 4: Set daily calorie target (1000–5000 kcal) with a slider
- Data persisted in sessionStorage across steps, submitted in one API call on completion

### Menu Scanning (AI Pipeline)
- Upload 1–3 menu images (JPEG, PNG, WebP, max 5MB each)
- Drag-and-drop or tap-to-upload interface with image previews
- Optional restaurant name input
- Rate limited to 10 scans per user per day
- Step 1: Groq Vision API extracts all dish names, descriptions, and prices from the image
- Step 2: All extracted dishes sent in a single batch call to Groq text API for nutrition estimation
- Each dish gets: calories, protein, carbs, fat (min/max/avg ranges), cooking method, ingredients, confidence score, recommend reason, avoid reasons
- Scan responds immediately with a scanId and processes AI pipeline asynchronously

### Recommendation Engine
- Rule-based scoring (0–100) per dish based on user's health profile
- Goal scoring: build_muscle rewards high protein, lose_weight rewards low calories and penalizes fried, stay_healthy rewards balance
- Allergen hard-block: any dish matching user allergies gets score = 0
- Diet penalties: vegetarian users penalized for meat dishes, keto users penalized for high-carb dishes
- Cooking method bonus: grilled/steamed/baked +10, fried -10
- Confidence penalty: low-confidence AI estimates reduce score
- Tag generation: High Protein, Low Carb, Low Calorie, High Calorie, Healthy Cook, Deep Fried, Fits Your Goal

### Scan Results
- Dishes split into three sections: Recommended (score ≥ 60), Avoid (allergen or score ≤ 30), All Dishes
- Top 3 recommended dishes shown prominently with a green ring
- Each dish card shows name, match score badge, top 3 tags, calorie range, allergen warning
- Save/unsave toggle for the entire scan
- Click any dish card to view full detail

### Dish Detail
- Full nutrition breakdown: calories, protein, carbs, fat as min–max range + average
- Confidence score with color-coded progress bar (green ≥ 70, yellow ≥ 40, red < 40)
- Low-confidence warning shown when confidence < 40
- AI-generated recommend reason (green box) or avoid reasons (red box)
- Allergen flags with warning badges
- Cooking method badge
- Estimated price (if extracted from menu)
- Allergen disclaimer always visible at the bottom

### Scan History
- Paginated list of all past scans sorted by date (newest first)
- Each entry shows restaurant name, date, dish count, recommended count, saved status
- Click to reopen full results
- Delete scan with confirmation dialog (cascades to all dish records)
- Load more pagination

### Profile Management
- View current name, email, goal, diet types, allergies, daily calories
- Edit mode: update any profile field with the same validation as onboarding
- Logout button
- Delete account with confirmation (cascades to all scans and dishes)

---

## Pages

### `/` — Landing
Public page. Hero section with app description and two CTA buttons: Get Started (→ /signup) and Sign In (→ /login). Green gradient background with Framer Motion fade-in animation.

### `/signup` — Signup
Public page. Form with name, email, password fields. Client-side validation. On success redirects to /verify-otp passing email via router state.

### `/login` — Login
Public page. Form with email and password. On success stores user in AuthContext and navigates to /home (ProtectedRoute handles onboarding redirect if needed).

### `/verify-otp` — OTP Verification
Public page. Six individual digit inputs with paste support and auto-focus. Resend button with 60-second countdown. On success navigates to /login.

### `/onboarding/goal` — Onboarding Step 1
Auth-required page. Three selectable goal cards with emoji, label, and description. Progress bar showing step 1 of 4. Selection saved to sessionStorage.

### `/onboarding/diet` — Onboarding Step 2
Auth-required page. Multi-select pill buttons for diet types. Back/Next navigation. Selection saved to sessionStorage.

### `/onboarding/allergies` — Onboarding Step 3
Auth-required page. Multi-select pill buttons for allergies. Selecting "None" deselects all others. Back/Next navigation. Selection saved to sessionStorage.

### `/onboarding/calories` — Onboarding Step 4
Auth-required page. Number input + range slider for daily calorie target (1000–5000). On submit sends all collected onboarding data to API in one call and sets onboardingComplete = true.

### `/onboarding/complete` — Onboarding Complete
Auth-required page. Animated green checkmark with Framer Motion. Auto-redirects to /home after 2 seconds. Manual "Go to Home" button.

### `/home` — Home Dashboard
Protected page. Shows greeting with user's first name, total scans and saved scans stats, a prominent "Scan a Menu" CTA button, and the 3 most recent scans as clickable cards.

### `/scan` — Scan Upload
Protected page. Drag-and-drop file upload area accepting up to 3 images. Image previews with remove buttons. Optional restaurant name input. Submits via ScanContext.startScan() and redirects to /processing/:scanId.

### `/processing/:scanId` — Processing Screen
Protected page. Polls GET /api/scan/:scanId every 3 seconds. Animated pulsing dots with cycling status messages (Uploading → Extracting → Analyzing → Scoring). Redirects to /results/:scanId on completion. Shows error + retry button on failure.

### `/results/:scanId` — Scan Results
Protected page. Fetches full scan with populated dishes. Renders three sections: Recommended (score ≥ 60, top 3 with green ring), Avoid (allergens or score ≤ 30), All Dishes. Save toggle button. Each dish is a clickable DishCard.

### `/dish/:dishId` — Dish Detail
Protected page. Full nutrition breakdown with min–max ranges and averages. Confidence bar. AI-generated recommend/avoid reasons. Allergen flags. Always-visible medical disclaimer. Back button.

### `/history` — Scan History
Protected page. Paginated list of all scans sorted newest first. Each card shows restaurant name, date, dish count, recommended count. Delete with confirmation. Load more button. Empty state with CTA to scan.

### `/profile` — Profile & Settings
Protected page. View mode shows all profile fields. Edit mode allows updating name, goal, diet types, allergies, and daily calories. Logout button. Delete account button with confirmation dialog.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, React Router v6, Framer Motion, Axios, React Hot Toast |
| Backend | Node.js, Express.js, MongoDB + Mongoose |
| Auth | JWT (HTTP-only cookies), Bcrypt, Nodemailer (OTP) |
| File Upload | Multer (memory storage) + Cloudinary |
| AI | Groq Vision API (menu OCR) + Groq Text API (batch nutrition) |
| Model | meta-llama/llama-4-scout-17b-16e-instruct |

---

## API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | /api/auth/signup | No | Register, send OTP |
| POST | /api/auth/verify-otp | No | Verify OTP, activate account |
| POST | /api/auth/login | No | Login, set cookies |
| POST | /api/auth/logout | Yes | Clear cookies |
| POST | /api/auth/refresh-token | Cookie | Issue new access token |
| POST | /api/auth/resend-otp | No | Resend OTP |
| GET | /api/user/profile | Yes | Get user profile |
| PUT | /api/user/profile | Yes | Update profile |
| PUT | /api/user/onboarding | Yes | Complete onboarding |
| DELETE | /api/user/account | Yes | Delete account + all data |
| POST | /api/scan | Yes | Upload images, trigger AI |
| GET | /api/scan/history | Yes | Paginated scan history |
| GET | /api/scan/:scanId | Yes | Get scan + dishes |
| PUT | /api/scan/:scanId/save | Yes | Toggle save status |
| DELETE | /api/scan/:scanId | Yes | Delete scan + dishes |
| GET | /api/dish/:dishId | Yes | Get dish detail |
