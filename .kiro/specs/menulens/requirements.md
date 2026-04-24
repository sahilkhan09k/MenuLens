# Requirements Document

## Introduction

MenuLens is a full-stack MERN web application that enables users to photograph or upload restaurant menu images, extract all dishes using AI vision (Groq Vision API), and receive personalized meal recommendations based on their health profile. Each recommendation includes estimated nutritional data with confidence ranges and reasoning. The system covers user authentication with OTP email verification, a 4-step health onboarding flow, AI-powered menu scanning, recommendation scoring, scan history, and profile management.

## Glossary

- **System**: The MenuLens web application as a whole
- **Auth_Service**: The authentication subsystem handling signup, login, OTP, and token management
- **User**: A registered account holder interacting with the application
- **Onboarding_Flow**: The 4-step wizard collecting a user's health profile after first login
- **Health_Profile**: A user's stored preferences including goal, diet type, allergies, and daily calorie target
- **Scan_Service**: The backend subsystem that receives menu images and orchestrates the AI pipeline
- **Groq_Vision_API**: The external AI service used for menu OCR and dish extraction
- **Nutrition_Service**: The backend subsystem that estimates nutritional content per dish via Groq text API
- **Recommendation_Engine**: The rule-based scoring subsystem that assigns a match score to each dish
- **Scan**: A single menu analysis session containing one to three images and all resulting dishes
- **Dish**: A single menu item extracted from a scan, with nutrition estimates, tags, and a match score
- **Match_Score**: A 0–100 integer representing how well a dish fits the user's health profile
- **Confidence_Score**: A 0–100 integer representing how certain the AI is about a dish's nutritional estimates
- **OTP**: A 6-digit one-time password sent via email for account verification
- **Access_Token**: A short-lived JWT (15 minutes) stored in an HTTP-only cookie used to authenticate requests
- **Refresh_Token**: A long-lived JWT (7 days) stored in an HTTP-only cookie and in the database used to renew the Access_Token
- **Cloudinary**: The external image storage service used to persist uploaded menu images
- **Rate_Limiter**: The middleware that enforces a maximum of 10 scan uploads per user per day

---

## Requirements

### Requirement 1: User Registration

**User Story:** As a new visitor, I want to create an account with my email and password, so that I can access personalized menu recommendations.

#### Acceptance Criteria

1. WHEN a user submits a signup form with a valid name, email, and password of at least 8 characters, THE Auth_Service SHALL hash the password with bcrypt and create a new unverified user record.
2. WHEN a new user record is created, THE Auth_Service SHALL generate a 6-digit OTP, hash it with bcrypt, store the hash with a 10-minute expiry, and send the plain OTP to the user's email via Nodemailer.
3. IF a signup request is submitted with an email that already exists in the database, THEN THE Auth_Service SHALL return a 409 error response with a descriptive message.
4. IF a signup request is submitted with a password shorter than 8 characters, THEN THE Auth_Service SHALL return a 400 error response listing the validation failure.
5. THE Auth_Service SHALL never store a plain-text password or plain-text OTP in the database.

---

### Requirement 2: OTP Email Verification

**User Story:** As a registered user, I want to verify my email address with a one-time code, so that my account is activated and secured.

#### Acceptance Criteria

1. WHEN a user submits a valid 6-digit OTP within 10 minutes of generation, THE Auth_Service SHALL mark the user's account as verified and clear the stored OTP hash and expiry.
2. IF a user submits an OTP that does not match the stored hash, THEN THE Auth_Service SHALL return a 400 error response indicating an invalid code.
3. IF a user submits an OTP after the 10-minute expiry window, THEN THE Auth_Service SHALL return a 400 error response indicating the code has expired.
4. WHEN a user requests OTP resend, THE Auth_Service SHALL invalidate the previous OTP, generate a new 6-digit OTP, hash it, store it with a fresh 10-minute expiry, and send it to the user's email.
5. THE Auth_Service SHALL rate-limit OTP resend requests to a maximum of 3 requests per 15-minute window per email address.

---

### Requirement 3: User Login and Token Management

**User Story:** As a verified user, I want to log in with my credentials and stay authenticated across sessions, so that I can use the app without re-entering my password frequently.

#### Acceptance Criteria

1. WHEN a verified user submits valid login credentials, THE Auth_Service SHALL issue an Access_Token with a 15-minute expiry and a Refresh_Token with a 7-day expiry, both set as HTTP-only cookies.
2. WHEN a verified user logs in, THE Auth_Service SHALL store the Refresh_Token in the user's database record.
3. IF a login request is submitted for an unverified account, THEN THE Auth_Service SHALL return a 403 error response instructing the user to verify their email.
4. IF a login request is submitted with incorrect credentials, THEN THE Auth_Service SHALL return a 401 error response without revealing which field is incorrect.
5. WHEN a client sends a request to the refresh-token endpoint with a valid Refresh_Token cookie, THE Auth_Service SHALL issue a new Access_Token as an HTTP-only cookie.
6. IF the Refresh_Token is expired or not found in the database, THEN THE Auth_Service SHALL return a 401 error response and clear both cookies.
7. WHEN a user logs out, THE Auth_Service SHALL clear both HTTP-only cookies and delete the Refresh_Token from the database.
8. THE Auth_Service SHALL never expose the Access_Token or Refresh_Token in a response body or allow them to be stored in localStorage.

---

### Requirement 4: Health Profile Onboarding

**User Story:** As a newly verified user, I want to complete a guided 4-step onboarding flow, so that the app can personalize dish recommendations to my health goals.

#### Acceptance Criteria

1. WHEN a verified user completes login for the first time with `onboardingComplete` set to false, THE System SHALL redirect the user to the first onboarding step at `/onboarding/goal`.
2. THE Onboarding_Flow SHALL collect the user's goal (one of: `lose_weight`, `build_muscle`, `stay_healthy`) in step 1.
3. THE Onboarding_Flow SHALL collect the user's diet types (one or more of: `vegetarian`, `vegan`, `non_vegetarian`, `dairy_free`, `gluten_free`, `keto`) in step 2.
4. THE Onboarding_Flow SHALL collect the user's allergies (one or more of: `peanuts`, `shellfish`, `dairy`, `gluten`, `eggs`, `fish`, `tree_nuts`, `soy`, `none`) in step 3.
5. THE Onboarding_Flow SHALL collect the user's daily calorie target as a positive integer between 1000 and 5000 in step 4.
6. WHEN a user submits the final onboarding step, THE System SHALL persist all collected Health_Profile data and set `onboardingComplete` to true.
7. WHEN `onboardingComplete` is true, THE System SHALL redirect any request to an onboarding route back to `/home`.
8. IF a user navigates directly to a protected route before completing onboarding, THEN THE System SHALL redirect the user to `/onboarding/goal`.

---

### Requirement 5: Menu Image Upload

**User Story:** As an authenticated user, I want to upload one to three photos of a restaurant menu, so that the app can extract dishes and analyze them for me.

#### Acceptance Criteria

1. THE Scan_Service SHALL accept between 1 and 3 image files per upload request.
2. THE Scan_Service SHALL reject any image file exceeding 5 MB in size with a 400 error response.
3. THE Scan_Service SHALL accept only files with MIME types `image/jpeg`, `image/png`, or `image/webp`, and reject all other types with a 400 error response.
4. WHEN valid images are received, THE Scan_Service SHALL upload them to Cloudinary and store the resulting secure URLs in the Scan record.
5. THE Rate_Limiter SHALL allow a maximum of 10 scan upload requests per user per calendar day, returning a 429 error response when the limit is exceeded.
6. WHEN a scan upload is initiated, THE System SHALL create a Scan record with status tracking and return the `scanId` to the frontend so the user can be redirected to `/processing/:scanId`.
7. THE System SHALL validate image size and type on both the frontend before submission and the backend upon receipt.

---

### Requirement 6: AI Menu OCR and Dish Extraction

**User Story:** As a user who has uploaded a menu image, I want the app to extract all dishes from the image, so that I don't have to type them in manually.

#### Acceptance Criteria

1. WHEN menu images are uploaded and stored, THE Scan_Service SHALL send each image URL to the Groq_Vision_API with a structured extraction prompt requesting a JSON array of dishes.
2. WHEN the Groq_Vision_API returns a valid JSON array, THE Scan_Service SHALL parse each entry and create a Dish record containing the dish name, description, and price (if available).
3. IF the Groq_Vision_API returns an empty array or fails to parse a valid JSON response, THEN THE Scan_Service SHALL record zero dishes for that image and continue processing remaining images without crashing.
4. IF the Groq_Vision_API call fails due to a network error or API error, THEN THE Scan_Service SHALL retry the request once after a 2-second delay before marking the scan as failed.
5. WHEN a scan fails after retry, THE Scan_Service SHALL update the Scan record with an error status and return a descriptive error message to the frontend so the user can retry.
6. WHEN the same menu image hash has been processed in a previous Scan for the same user, THE Scan_Service SHALL reuse the previously extracted dishes instead of calling the Groq_Vision_API again.

---

### Requirement 7: Nutrition Estimation

**User Story:** As a user reviewing extracted dishes, I want to see estimated nutritional information for each dish, so that I can make informed choices.

#### Acceptance Criteria

1. WHEN a Dish record is created from extraction, THE Nutrition_Service SHALL send the dish name and description to the Groq text API and request a JSON object containing calorie, protein, carbs, fat, cooking method, and confidence estimates.
2. WHEN the Groq text API returns valid nutrition data, THE Nutrition_Service SHALL compute the average for each macro from the min and max values and store `{ min, max, avg }` for calories, protein, carbs, and fat on the Dish record.
3. THE System SHALL always display nutrition values as a range (min–max) in the UI and never present a single number as an absolute fact.
4. WHEN the Groq text API returns a confidence value below 40, THE Nutrition_Service SHALL store that value in `confidenceScore` and THE System SHALL display a low-confidence warning alongside the dish's nutrition data.
5. IF the Groq text API fails to return valid nutrition JSON for a dish, THEN THE Nutrition_Service SHALL store null nutrition values and set `confidenceScore` to 0 for that dish, then continue processing remaining dishes.

---

### Requirement 8: Recommendation Scoring

**User Story:** As a user with a health profile, I want each dish to be scored against my goals and dietary restrictions, so that I can quickly identify what to eat and what to avoid.

#### Acceptance Criteria

1. WHEN nutrition estimation is complete for all dishes in a scan, THE Recommendation_Engine SHALL compute a Match_Score between 0 and 100 for each dish using the user's Health_Profile.
2. WHEN the user's goal is `build_muscle`, THE Recommendation_Engine SHALL add 25 points if average protein is ≥ 30 g, add 15 points if average protein is ≥ 20 g, or subtract 10 points if average protein is below 20 g.
3. WHEN the user's goal is `lose_weight`, THE Recommendation_Engine SHALL add 20 points if average calories are ≤ 35% of the user's daily calorie target, subtract 20 points if average calories exceed 49% of the daily target, and subtract 15 points if the cooking method is `fried`.
4. WHEN the user's goal is `stay_healthy`, THE Recommendation_Engine SHALL add 10 points if average protein is ≥ 15 g and add 10 points if average calories are ≤ 40% of the daily calorie target.
5. IF a dish contains an ingredient matching any allergen in the user's allergies list, THEN THE Recommendation_Engine SHALL set the Match_Score to 0 and add the allergen to the dish's `allergenFlags` list.
6. WHEN the user's diet type includes `vegetarian`, THE Recommendation_Engine SHALL subtract 40 points if the dish contains meat.
7. WHEN the user's diet type includes `keto`, THE Recommendation_Engine SHALL subtract 25 points if average carbs exceed 20 g.
8. WHEN the cooking method is `grilled`, `steamed`, or `baked`, THE Recommendation_Engine SHALL add 10 points. WHEN the cooking method is `fried`, THE Recommendation_Engine SHALL subtract 10 points.
9. WHEN the dish's Confidence_Score is below 50, THE Recommendation_Engine SHALL subtract 10 points from the Match_Score.
10. THE Recommendation_Engine SHALL clamp the final Match_Score to the range [0, 100].

---

### Requirement 9: Tag Generation

**User Story:** As a user browsing dishes, I want to see descriptive tags on each dish, so that I can quickly understand its nutritional profile at a glance.

#### Acceptance Criteria

1. WHEN a Match_Score is computed for a dish, THE Recommendation_Engine SHALL generate tags based on the dish's nutrition and score.
2. THE Recommendation_Engine SHALL assign the tag `High Protein` if average protein is ≥ 25 g.
3. THE Recommendation_Engine SHALL assign the tag `Low Carb` if average carbs are ≤ 20 g.
4. THE Recommendation_Engine SHALL assign the tag `Low Calorie` if average calories are ≤ 400 kcal.
5. THE Recommendation_Engine SHALL assign the tag `High Calorie` if average calories are ≥ 700 kcal.
6. THE Recommendation_Engine SHALL assign the tag `Healthy Cook` if the cooking method is `grilled`, `steamed`, or `baked`.
7. THE Recommendation_Engine SHALL assign the tag `Deep Fried` if the cooking method is `fried`.
8. THE Recommendation_Engine SHALL assign the tag `Fits Your Goal` if the Match_Score is ≥ 80.

---

### Requirement 10: Scan Results Display

**User Story:** As a user who has completed a scan, I want to see my results organized into recommended, avoid, and all-dishes sections, so that I can make a quick decision at the restaurant.

#### Acceptance Criteria

1. WHEN a scan is complete, THE System SHALL display dishes with a Match_Score ≥ 60 in a "Recommended" section, sorted by Match_Score descending.
2. WHEN a scan is complete, THE System SHALL display dishes with an allergen flag or a Match_Score ≤ 30 in an "Avoid" section.
3. WHEN a scan is complete, THE System SHALL display all remaining dishes in an "All Dishes" section as a scrollable list.
4. THE System SHALL show the top 3 recommended dishes prominently at the top of the results page.
5. WHEN a user taps a dish card, THE System SHALL navigate to `/dish/:dishId` showing full dish detail.
6. WHEN results are loading, THE System SHALL display a processing screen at `/processing/:scanId` with a progress indicator until the scan status is complete or failed.

---

### Requirement 11: Dish Detail Page

**User Story:** As a user viewing a specific dish, I want to see full nutritional details, tags, and the reason it was recommended or flagged, so that I can make an informed decision.

#### Acceptance Criteria

1. WHEN a user navigates to `/dish/:dishId`, THE System SHALL display the dish name, description, estimated price (if available), cooking method, all tags, and the recommend or avoid reason.
2. THE System SHALL display all nutrition values (calories, protein, carbs, fat) as a min–max range alongside the average value.
3. THE System SHALL display the Confidence_Score as a percentage and show a visual indicator of confidence level.
4. THE System SHALL display an allergen disclaimer on every dish detail page stating that nutritional estimates are AI-generated and not medical advice.
5. WHEN a dish has allergen flags, THE System SHALL display each flagged allergen prominently with a warning indicator.

---

### Requirement 12: Scan History

**User Story:** As a returning user, I want to view my past menu scans, so that I can revisit recommendations from restaurants I've been to before.

#### Acceptance Criteria

1. WHEN a user navigates to `/history`, THE System SHALL display a paginated list of the user's past scans sorted by creation date descending.
2. THE System SHALL display for each scan entry: the restaurant name (if set), the scan date, the number of dishes found, and the number of recommended dishes.
3. WHEN a user taps a past scan entry, THE System SHALL navigate to `/results/:scanId` and load the full scan results.
4. WHEN a user toggles the save status on a scan, THE Scan_Service SHALL update the `isSaved` field and THE System SHALL reflect the updated state immediately.
5. WHEN a user deletes a scan, THE Scan_Service SHALL delete the Scan record and all associated Dish records from the database.

---

### Requirement 13: User Profile Management

**User Story:** As a user, I want to view and edit my health profile at any time, so that my recommendations stay accurate as my goals change.

#### Acceptance Criteria

1. WHEN a user navigates to `/profile`, THE System SHALL display the user's current name, email, goal, diet types, allergies, and daily calorie target.
2. WHEN a user submits updated profile data, THE System SHALL validate the input against the same constraints as onboarding and persist the changes.
3. IF a profile update request contains an invalid goal, diet type, or allergy value not in the defined enums, THEN THE System SHALL return a 400 error response listing the invalid fields.
4. WHEN a user requests account deletion, THE System SHALL delete the user record, all associated Scan records, all associated Dish records, and clear all authentication cookies.

---

### Requirement 14: Frontend Routing and Access Control

**User Story:** As a user, I want the app to route me to the correct page based on my authentication and onboarding state, so that I never land on a page I shouldn't access.

#### Acceptance Criteria

1. THE System SHALL allow unauthenticated access only to `/`, `/signup`, `/login`, and `/verify-otp`.
2. WHEN an unauthenticated user attempts to access a protected route, THE System SHALL redirect the user to `/login`.
3. WHEN an authenticated user with `onboardingComplete` set to false attempts to access a protected non-onboarding route, THE System SHALL redirect the user to `/onboarding/goal`.
4. WHEN an authenticated user with `onboardingComplete` set to true attempts to access an onboarding route, THE System SHALL redirect the user to `/home`.
5. WHILE the authentication state is loading, THE System SHALL display a loading screen and not redirect the user.

---

### Requirement 15: Security and Data Integrity

**User Story:** As a user, I want my personal data and credentials to be handled securely, so that my account and health information are protected.

#### Acceptance Criteria

1. THE Auth_Service SHALL hash all passwords using bcrypt with a minimum cost factor of 10 before storing them.
2. THE Auth_Service SHALL hash all OTPs using bcrypt before storing them and never log or return plain-text OTPs after generation.
3. THE System SHALL set all JWT cookies with the `HttpOnly`, `Secure` (in production), and `SameSite=Strict` flags.
4. THE System SHALL validate and sanitize all user-supplied input on the backend before processing or storing it.
5. THE Scan_Service SHALL validate image MIME type and file size on the backend independently of any frontend validation.
6. IF the Groq_Vision_API or Groq text API returns a response that cannot be parsed as valid JSON, THEN THE System SHALL log the raw response for debugging and continue operation without exposing the raw response to the client.
