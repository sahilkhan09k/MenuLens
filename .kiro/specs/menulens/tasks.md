# Implementation Plan: MenuLens — AI-Powered Restaurant Menu Analyzer

## Overview

Incremental build of the full-stack MERN application. Each task builds on the previous, ending with all components wired together. The server is built first (models → auth → user → scan/AI pipeline → dish routes), then the client (scaffolding → auth pages → onboarding → core pages → components), followed by property-based and unit tests.

## Tasks

- [x] 1. Project scaffolding
  - Initialize `server/` with `npm init`, install all server dependencies: express, mongoose, bcryptjs, jsonwebtoken, nodemailer, multer, cloudinary, groq-sdk, cookie-parser, cors, dotenv, express-rate-limit
  - Initialize `client/` with Vite + React template, install all client dependencies: react-router-dom, axios, framer-motion, chart.js, react-chartjs-2, react-hot-toast, tailwindcss, postcss, autoprefixer
  - Create `server/app.js` with Express app, CORS (credentials + CLIENT_URL origin), cookie-parser, JSON body parser, and route mounts (placeholders)
  - Create `server/.env` and `client/.env` with all required environment variable keys (values left as placeholders)
  - Configure Tailwind CSS (`tailwind.config.js`, `postcss.config.js`, import in `src/index.css`)
  - _Requirements: all_

- [x] 2. Backend: config, models, and utilities
  - [x] 2.1 Create `server/config/db.js` (Mongoose connection with error handling) and `server/config/cloudinary.js` (Cloudinary SDK config from env)
    - _Requirements: 5.4_
  - [x] 2.2 Create `server/models/User.model.js` with full schema: name, email, password, isVerified, otp, otpExpiry, onboardingComplete, profile (goal, dietType, allergies, dailyCalories, macros), refreshToken, createdAt
    - _Requirements: 1.1, 4.2–4.5, 15.1_
  - [x] 2.3 Create `server/models/Scan.model.js` with full schema including status enum (`processing|complete|failed`), imageHashes, errorMessage, and all dish ref arrays
    - _Requirements: 5.6, 6.3–6.5_
  - [x] 2.4 Create `server/models/Dish.model.js` with full schema: estimatedNutrition (min/max/avg per macro), confidenceScore, matchScore, tags, allergenFlags, cookingMethod enum
    - _Requirements: 7.2, 8.1, 9.1_
  - [x] 2.5 Create `server/utils/generateTokens.js` (sign accessToken + refreshToken using env secrets/expiries) and `server/utils/sendEmail.js` (Nodemailer transporter, sendOtpEmail function)
    - _Requirements: 3.1, 1.2_

- [x] 3. Backend: authentication
  - [x] 3.1 Create `server/middleware/auth.middleware.js` — verify accessToken from `req.cookies.accessToken`; return 401 on missing/invalid/expired token
    - _Requirements: 3.1, 15.3_
  - [x] 3.2 Implement `server/controllers/auth.controller.js` — `signup`: validate input (name, email, password ≥ 8 chars), bcrypt hash password (saltRounds=10), create unverified user, generate 6-digit OTP, bcrypt hash OTP, store hash + 10-min expiry, send plain OTP via Nodemailer
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 15.1, 15.2_
  - [x] 3.3 Implement `verifyOtp` in auth.controller: compare submitted OTP against stored hash, check expiry, mark isVerified=true, clear otp+otpExpiry fields
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 3.4 Implement `login` in auth.controller: check isVerified (403 if not), compare password, issue accessToken + refreshToken cookies (HttpOnly, Secure in prod, SameSite=Strict), store refreshToken in DB
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 15.3_
  - [x] 3.5 Implement `logout`, `refreshToken`, and `resendOtp` in auth.controller
    - logout: clear both cookies, set refreshToken=null in DB
    - refreshToken: validate cookie against DB, issue new accessToken cookie
    - resendOtp: rate-limited (3 per 15 min per email), invalidate old OTP, generate + hash new OTP, send email
    - _Requirements: 3.5, 3.6, 3.7, 2.4, 2.5_
  - [x] 3.6 Create `server/routes/auth.routes.js` and mount all auth endpoints on `app.js`
    - _Requirements: 3.1–3.7_

- [x] 4. Backend: user routes
  - [x] 4.1 Implement `server/controllers/user.controller.js` — `getProfile`: return user doc (exclude password, otp, refreshToken); `updateProfile`: validate goal/dietType/allergies enums + dailyCalories range, persist changes; `completeOnboarding`: save all 4 onboarding fields, set onboardingComplete=true; `deleteAccount`: delete user + cascade delete all Scans + Dishes, clear cookies
    - _Requirements: 4.2–4.6, 13.1–13.4_
  - [x] 4.2 Create `server/routes/user.routes.js` (all routes protected by auth.middleware) and mount on `app.js`
    - _Requirements: 13.1–13.4_

- [x] 5. Backend: upload middleware and rate limiting
  - [x] 5.1 Create `server/middleware/upload.middleware.js` — Multer memStorage, fileFilter (jpeg/png/webp only → 400 on reject), limits (fileSize: 5MB), field name `images`, max 3 files
    - _Requirements: 5.1, 5.2, 5.3, 15.5_
  - [x] 5.2 Create `server/middleware/rateLimit.middleware.js` — express-rate-limit for scan upload: max 10 per user per day (key by userId from cookie/token), 429 on exceed; also create resend-OTP rate limiter (3 per 15 min per IP/email)
    - _Requirements: 5.5, 2.5_

- [x] 6. Backend: AI services
  - [x] 6.1 Create `server/services/groq.service.js`
    - `extractDishes(imageUrls)`: call Groq Vision API with extraction prompt, parse JSON array, return `[]` on invalid JSON; retry once after 2s on network/API error
    - `estimateNutrition(dish)`: call Groq text API with nutrition prompt, parse JSON, return null on failure
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 15.6_
  - [x] 6.2 Create `server/services/nutrition.service.js`
    - `processDishNutrition(rawDish, groqResult)`: compute `avg = (min + max) / 2` for each macro, set confidenceScore, flag low confidence (< 40)
    - _Requirements: 7.1, 7.2, 7.4, 7.5_
  - [x] 6.3 Create `server/services/recommendation.service.js`
    - `scoreDish(dish, userProfile)`: implement full scoring logic (goal scoring, allergen hard-block to 0, diet penalties, cooking method bonus/penalty, confidence penalty), clamp to [0, 100]
    - `generateTags(dish, score)`: assign tags per threshold rules (High Protein, Low Carb, Low Calorie, High Calorie, Healthy Cook, Deep Fried, Fits Your Goal)
    - `classifyDish(dish)`: return `'recommended'` if score ≥ 60, `'avoid'` if allergenFlags.length > 0 || score ≤ 30, else `'neutral'`
    - _Requirements: 8.1–8.10, 9.1–9.8, 10.1–10.3_

- [x] 7. Backend: scan and dish controllers + routes
  - [x] 7.1 Implement `server/controllers/scan.controller.js`
    - `uploadScan`: run upload.middleware → compute image hashes → check dedup (reuse existing dishes if hash match) → Cloudinary upload → create Scan (status: processing) → respond with scanId → async: call groq.service.extractDishes → per dish: call nutrition.service + recommendation.service → create Dish records → update Scan (status: complete, dish refs, counts)
    - On any unrecoverable error: set scan.status='failed', store errorMessage
    - _Requirements: 5.1–5.6, 6.1–6.6, 7.1–7.5, 8.1–8.10, 9.1–9.8_
  - [x] 7.2 Implement `getScan`, `getHistory` (paginated, sorted by createdAt desc), `toggleSave`, `deleteScan` (cascade delete Dish records) in scan.controller
    - _Requirements: 10.6, 12.1–12.5_
  - [x] 7.3 Implement `server/controllers/dish.controller.js` — `getDish`: fetch single Dish by id, verify it belongs to a scan owned by req.user
    - _Requirements: 11.1–11.5_
  - [x] 7.4 Create `server/routes/scan.routes.js` and `server/routes/dish.routes.js`, mount both on `app.js`
    - _Requirements: 5.6, 12.1–12.5, 11.1_

- [x] 8. Checkpoint — backend complete
  - Ensure all routes are mounted, env vars documented, and server starts without errors. Ask the user if questions arise.

- [x] 9. Frontend: scaffolding, routing, and shared utilities
  - [x] 9.1 Create `src/utils/api.js` — Axios instance with `baseURL: VITE_API_BASE_URL`, `withCredentials: true`; response interceptor: on 401 attempt `POST /api/auth/refresh-token`, retry original request once; on refresh failure clear auth state and redirect to `/login`
    - _Requirements: 3.5, 3.6, 14.2_
  - [x] 9.2 Create `src/utils/helpers.js` — calorie/macro formatters (format range as "min–max kcal", format avg, etc.)
    - _Requirements: 7.3, 11.2_
  - [x] 9.3 Create `src/context/AuthContext.jsx` — state: `{ user, loading }`; on mount: GET `/api/user/profile` to rehydrate; actions: `login(userData)`, `logout()`, `updateUser(partial)`; export `useAuth` hook
    - _Requirements: 14.5_
  - [x] 9.4 Create `src/context/ScanContext.jsx` — state: `{ scanId, images, status, results }`; status enum: `idle|uploading|processing|done|error`; actions: `startScan(files)`, `pollStatus(scanId)` (polls every 3s), `clearScan()`; export `useScan` hook
    - _Requirements: 10.6_
  - [x] 9.5 Create `src/App.jsx` with React Router v6 routes: public routes (`/`, `/signup`, `/login`, `/verify-otp`), onboarding routes (wrapped in auth check), protected routes (wrapped in ProtectedRoute); wrap app in AuthContext + ScanContext providers
    - _Requirements: 14.1–14.5_

- [x] 10. Frontend: reusable components
  - [x] 10.1 Create `src/components/ProtectedRoute.jsx` — if loading → `<LoadingScreen />`; if !user → `<Navigate to="/login" />`; if !user.onboardingComplete → `<Navigate to="/onboarding/goal" />`; else → children
    - _Requirements: 14.2, 14.3, 14.5_
  - [x] 10.2 Create `src/components/LoadingScreen.jsx` — full-screen centered spinner with Framer Motion fade-in
    - _Requirements: 14.5_
  - [x] 10.3 Create `src/components/Navbar.jsx` — top bar with logo and profile link; shown on protected pages
    - _Requirements: 14.1_
  - [x] 10.4 Create `src/components/BottomNav.jsx` — mobile bottom navigation with links to Home, Scan, History, Profile; highlights active route
    - _Requirements: 14.1_
  - [x] 10.5 Create `src/components/DishCard.jsx` — props: dish object; renders name, matchScore badge, top 3 tags (TagChip), calorie range (NutritionPill), allergen warning if allergenFlags present; navigates to `/dish/:dishId` on click
    - _Requirements: 10.5, 11.5_
  - [x] 10.6 Create `src/components/NutritionPill.jsx` — small pill badge showing a macro label + range value
    - _Requirements: 7.3, 11.2_
  - [x] 10.7 Create `src/components/TagChip.jsx` — small colored chip for a single tag string
    - _Requirements: 9.1_

- [x] 11. Frontend: auth pages
  - [x] 11.1 Create `src/pages/Landing.jsx` — hero section with app description, CTA buttons to `/signup` and `/login`; public route
    - _Requirements: 14.1_
  - [x] 11.2 Create `src/pages/Signup.jsx` — form: name, email, password (≥ 8 chars); client-side validation; POST `/api/auth/signup`; on success redirect to `/verify-otp` passing email via state; show react-hot-toast on error
    - _Requirements: 1.1, 1.3, 1.4, 5.7_
  - [x] 11.3 Create `src/pages/Login.jsx` — form: email, password; POST `/api/auth/login`; on success call `login(userData)` then redirect to `/home` (or `/onboarding/goal` if !onboardingComplete); show toast on error
    - _Requirements: 3.1, 3.3, 3.4, 4.1_
  - [x] 11.4 Create `src/pages/OtpVerify.jsx` — 6-digit OTP input; POST `/api/auth/verify-otp`; on success redirect to `/login`; resend OTP button (POST `/api/auth/resend-otp`); show countdown or disable resend for 60s
    - _Requirements: 2.1–2.5_

- [x] 12. Frontend: onboarding flow
  - [x] 12.1 Create `src/pages/onboarding/OnboardingGoal.jsx` — step 1: select one goal from 3 options; store in local state; Next button
    - _Requirements: 4.2_
  - [x] 12.2 Create `src/pages/onboarding/OnboardingDiet.jsx` — step 2: multi-select diet types; Next/Back buttons
    - _Requirements: 4.3_
  - [x] 12.3 Create `src/pages/onboarding/OnboardingAllergies.jsx` — step 3: multi-select allergies (including "none"); Next/Back buttons
    - _Requirements: 4.4_
  - [x] 12.4 Create `src/pages/onboarding/OnboardingCalories.jsx` — step 4: number input 1000–5000; PUT `/api/user/onboarding` with all collected data on submit; on success call `updateUser`, redirect to `/onboarding/complete`
    - _Requirements: 4.5, 4.6_
  - [x] 12.5 Create `src/pages/onboarding/OnboardingComplete.jsx` — success screen with Framer Motion animation; auto-redirect to `/home` after 2s
    - _Requirements: 4.6, 4.7_

- [x] 13. Frontend: core pages
  - [x] 13.1 Create `src/pages/Home.jsx` — welcome message with user name, quick-scan CTA button, recent scan summary (last 3 from history), stats (total scans, saved scans)
    - _Requirements: 10.1_
  - [x] 13.2 Create `src/pages/Scan.jsx` — image file input (1–3 files, jpeg/png/webp, ≤ 5MB client-side check); preview thumbnails via `URL.createObjectURL`; optional restaurant name input; submit calls `startScan(files)` → POST `/api/scan/upload` → on success redirect to `/processing/:scanId`
    - _Requirements: 5.1–5.3, 5.7_
  - [x] 13.3 Create `src/pages/Processing.jsx` — polls `GET /api/scan/:scanId` every 3s via `pollStatus`; animated progress indicator; on `status === 'complete'` redirect to `/results/:scanId`; on `status === 'failed'` show error message + retry button
    - _Requirements: 10.6, 6.4, 6.5_
  - [x] 13.4 Create `src/pages/Results.jsx` — fetch scan from `GET /api/scan/:scanId`; render three sections: Recommended (score ≥ 60, sorted desc, top 3 prominent), Avoid (allergenFlags or score ≤ 30), All Dishes (remaining); each dish as DishCard; save toggle button
    - _Requirements: 10.1–10.5, 12.4_
  - [x] 13.5 Create `src/pages/DishDetail.jsx` — fetch dish from `GET /api/dish/:dishId`; display name, description, price, cookingMethod, all tags, recommendReason/avoidReasons; nutrition as min–max range + avg; confidence score with visual indicator; low-confidence warning if confidenceScore < 40; allergen disclaimer always visible; allergen flags with warning icons
    - _Requirements: 11.1–11.5, 7.3, 7.4_
  - [x] 13.6 Create `src/pages/History.jsx` — GET `/api/scan/history` (paginated); list of scan entries showing restaurantName, date, totalDishesFound, totalMatchingDishes; click navigates to `/results/:scanId`; delete scan button
    - _Requirements: 12.1–12.3, 12.5_
  - [x] 13.7 Create `src/pages/Profile.jsx` — display current profile fields; edit form for name, goal, dietType, allergies, dailyCalories; PUT `/api/user/profile` on save; logout button; delete account button with confirmation dialog
    - _Requirements: 13.1–13.4_

- [x] 14. Checkpoint — full stack wired end-to-end
  - Ensure client can reach server, auth flow works (signup → OTP → login → protected route), scan upload reaches Cloudinary and returns scanId, results page renders. Ask the user if questions arise.

- [x] 15. Property-based tests (fast-check)
  - Install `fast-check` as a dev dependency in `server/`
  - Create `server/tests/properties.test.js` (or `.spec.js`) with minimum 100 runs per property
  - [x] 15.1 Write property test for Property 3: short password rejection
    - Generate arbitrary strings of length 0–7; assert signup validation returns 400 and no user is created
    - `// Feature: menulens, Property 3: Short passwords are always rejected`
    - _Requirements: 1.4_
  - [x] 15.2 Write property test for Property 10: upload file count boundary
    - Generate file counts of 0 and 4+; assert 400 returned; generate counts 1–3; assert accepted
    - `// Feature: menulens, Property 10: Upload file count boundary is enforced`
    - _Requirements: 5.1_
  - [x] 15.3 Write property test for Property 11: file size boundary
    - Generate file sizes > 5MB; assert 400; generate sizes ≤ 5MB with valid MIME; assert pass
    - `// Feature: menulens, Property 11: File size limit is enforced at the boundary`
    - _Requirements: 5.2_
  - [x] 15.4 Write property test for Property 12: MIME type filtering
    - Generate arbitrary MIME type strings not in {image/jpeg, image/png, image/webp}; assert 400
    - `// Feature: menulens, Property 12: Only allowed MIME types are accepted`
    - _Requirements: 5.3_
  - [x] 15.5 Write property test for Property 16: nutrition avg computation
    - Generate arbitrary `{ min: number, max: number }` pairs (min ≤ max); assert `avg === (min + max) / 2` for all macros
    - `// Feature: menulens, Property 16: Nutrition avg is always (min + max) / 2`
    - _Requirements: 7.2_
  - [x] 15.6 Write property test for Property 18: score clamping [0, 100]
    - Generate arbitrary dish objects and userProfile combinations; assert `scoreDish(dish, profile)` always returns integer in [0, 100]
    - `// Feature: menulens, Property 18: Match_Score is always clamped to [0, 100]`
    - _Requirements: 8.1, 8.10_
  - [x] 15.7 Write property test for Property 19: allergen hard-block
    - Generate dish with at least one ingredient matching a user allergy; assert `scoreDish()` returns exactly 0
    - `// Feature: menulens, Property 19: Allergen match hard-blocks the score to 0`
    - _Requirements: 8.5_
  - [x] 15.8 Write property test for Property 20: tag threshold consistency
    - Generate arbitrary dish nutrition + score values; assert `generateTags()` assigns exactly the tags whose conditions are met and no others
    - `// Feature: menulens, Property 20: Tag generation is consistent with nutrition thresholds`
    - _Requirements: 9.1–9.8_
  - [x] 15.9 Write property test for Property 21: results partition completeness
    - Generate arbitrary list of scored dishes; assert Recommended ∪ Avoid ∪ All Dishes = full list, with no dish in more than one section
    - `// Feature: menulens, Property 21: Results sections form a complete partition of all dishes`
    - _Requirements: 10.1, 10.2, 10.3_
  - [x] 15.10 Write property test for Property 22: history sort order
    - Generate arbitrary list of scan objects with createdAt timestamps; assert returned order is strictly descending by createdAt
    - `// Feature: menulens, Property 22: Scan history is sorted by creation date descending`
    - _Requirements: 12.1_
  - [x] 15.11 Write property test for Property 23: save toggle idempotence
    - For any initial isSaved value, assert toggling twice returns to original value
    - `// Feature: menulens, Property 23: Save toggle is idempotent over two applications`
    - _Requirements: 12.4_

- [x] 16. Unit and integration tests
  - [x] 16.1 Write unit tests for auth happy path: signup → OTP verify → login → refresh → logout; mock Nodemailer and DB
    - _Requirements: 1.1, 2.1, 3.1, 3.5, 3.7_
  - [ ]* 16.2 Write unit tests for auth error cases: duplicate email (409), wrong OTP (400), expired OTP (400), unverified login (403), wrong credentials (401 without field disclosure)
    - _Requirements: 1.3, 2.2, 2.3, 3.3, 3.4_
  - [ ]* 16.3 Write unit tests for scan upload: Multer validation errors, Cloudinary mock success, scanId returned in response
    - _Requirements: 5.1–5.6_
  - [ ]* 16.4 Write unit tests for Groq retry logic: first call fails → second succeeds; both calls fail → scan.status='failed'
    - _Requirements: 6.4, 6.5_
  - [ ]* 16.5 Write integration test for full scan pipeline: POST /api/scan/upload → mock Cloudinary + Groq → assert Dish records created and Scan status='complete'
    - _Requirements: 6.1, 6.2, 7.1, 8.1, 9.1_
  - [ ]* 16.6 Write integration test for GET /api/scan/history: assert returns only scans for authenticated user, sorted descending
    - _Requirements: 12.1_
  - [ ]* 16.7 Write integration test for DELETE /api/user/account: assert user, scans, and dishes all deleted; cookies cleared
    - _Requirements: 13.4_
  - [ ]* 16.8 Write integration test for JWT cookie flags: verify HttpOnly, Secure, SameSite=Strict on Set-Cookie header after login
    - _Requirements: 15.3_

- [x] 17. Final checkpoint — all tests pass
  - Ensure all non-optional tests pass, all routes respond correctly, and the full scan flow works end-to-end. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests in task 15 use fast-check with minimum 100 runs each
- The AI pipeline (task 7.1) responds immediately with `scanId` and runs the Groq calls asynchronously; the client polls for status
- Never store plain-text passwords or OTPs — always bcrypt hash before persisting
- Rate limiting (task 5.2) must be applied before the Groq calls to protect API quota
