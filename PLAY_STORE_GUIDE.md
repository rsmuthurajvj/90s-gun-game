# Publishing & monetizing 90s Gun Game on Google Play

The code side of ads is already done (`frontend/src/app/services/ads.service.ts`).
What's left is account setup and swapping placeholder IDs. Follow the steps in order.

---

## How the app makes money

| Ad type | Where it shows | Why there |
|---|---|---|
| **Banner** (adaptive, bottom) | Home screen and online lobby only | Never covers the board, so it can't ruin the game |
| **Interstitial** (full screen) | When you tap **Rematch** or **Home** after a round | A natural pause. Shown every 2nd round at most, and never more than once per 2.5 minutes |

You can tune the frequency in `frontend/src/environments/environment.ts` (`interstitialEveryRounds`, `interstitialMinSeconds`).
Too many ads → bad reviews → fewer installs → less money. Start gentle.

**Rough expectations (India):** banner eCPM ≈ ₹5–20, interstitial eCPM ≈ ₹30–120 per 1,000 views.
With 1,000 daily players doing about 3 rounds each, expect very roughly ₹100–400 per day. Most of the
revenue comes from interstitials. Installs matter more than anything else.

**Later options** (not built yet): a one-time "Remove ads" purchase (₹49–99) via Google Play Billing,
and an optional rewarded video (for example to unlock pen colours or soldier skins).

---

## Step 1 — Choose your package name (do this first!)

The package name **can never change** after the first upload. The placeholder is `com.notebookgungame.app`.
If you want something else (for example matching your other app, `com.yourname.gungame90s`), change it in all 3 places:

1. `frontend/capacitor.config.ts` → `appId`
2. `frontend/src/environments/environment.ts` and `environment.development.ts` → `storeUrl`
3. Delete the `frontend/android` folder, then run `npx cap add android`, then `npm run android:assets`, then redo Step 3.3 below.
   (This regenerates the native project with the new id.)

## Step 2 — Host the privacy policy (required for apps with ads)

1. Edit `frontend/public/privacy.html` and replace `rsmuthurajvj@gmail.com`.
2. Deploy the frontend to Netlify (already configured: `frontend/netlify.toml`). The policy will be at
   `https://<your-site>.netlify.app/privacy.html`.
3. Put that URL in `privacyPolicyUrl` in both environment files. The Settings screen links to it.

## Step 3 — Create the AdMob account and ad units

1. Go to <https://admob.google.com>, sign in with the **same Google account** as your Play Console, and accept the terms.
2. **Apps → Add app → Android → "Is it listed on Google Play?" → No** (you can link it after publishing).
3. Copy the **App ID** (`ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`) into
   `frontend/android/app/src/main/res/values/strings.xml` → `admob_app_id`.
4. **Ad units → Add ad unit**:
   - **Banner** → name it "Home banner" → copy its ID (`ca-app-pub-…/…`)
   - **Interstitial** → name it "Between rounds" → copy its ID
5. In `frontend/src/environments/environment.ts`:
   ```ts
   testing: false,
   bannerId: 'ca-app-pub-XXXX/BANNER',
   interstitialId: 'ca-app-pub-XXXX/INTERSTITIAL',
   ```
6. **Privacy & messaging → GDPR → Create message.** This is the consent pop-up that the app already shows to
   EU/UK users. Without it, AdMob limits your ads there.
7. **Payments:** add your bank account and PAN/tax info. Google pays monthly once you pass the threshold (about ₹1,000).
8. **app-ads.txt:** edit `frontend/public/app-ads.txt` with your publisher ID (`pub-…`), deploy it, and set the
   same site as "Website" in the Play Store listing. This stops lost ad revenue from "unverified" inventory.

> ⚠ **Never tap real ads on your own phone.** While testing, keep `testing: true`. Google's test IDs are
> already configured, so you'll see "Test Ad" banners. Clicking your own real ads can get the AdMob account banned.

## Step 4 — Deploy the game server

Online play needs the backend (`backend/`). You already use Render (`nine0s-gun-game.onrender.com`).

1. Create a free MongoDB Atlas cluster and copy its connection string.
2. On Render, set these environment variables (see `backend/.env.example`):
   `MONGODB_URI`, `FRONTEND_URL` (your Netlify URL).
3. Free Render servers **sleep after 15 minutes** and take about 50 seconds to wake. The app warns players
   ("Waking up the game server…"). Two fixes: (a) upgrade to the $7/month plan, or (b) ping
   `https://<server>/health` every 10 minutes with a free uptime monitor (UptimeRobot / cron-job.org).
   Pass & Play and vs Computer work fully offline either way.

## Step 5 — Build the release bundle (.aab)

```bash
cd frontend
npm run android:sync          # builds the web app + copies it into android/
npm run android:open          # opens Android Studio
```
In Android Studio: **Build → Generate Signed App Bundle → Android App Bundle**.
Create a new **upload keystore** and **back it up somewhere safe** (Google Drive plus a USB drive). If you lose it,
you need Google's support to reset it. The output is `app-release.aab`.

Each new release: increase `versionCode` (1 → 2 → 3…) and `versionName` in `frontend/android/app/build.gradle`.

## Step 6 — Play Console listing

1. **Create app** → Game → Free.
2. **App content** (Policy section). These matter for an ads app:
   - **Privacy policy** → your URL from Step 2
   - **Ads** → "Yes, my app contains ads"
   - **Data safety** → declare: *Device or other IDs* (advertising ID, collected by AdMob, used for advertising),
     *App interactions / diagnostics* (by AdMob). Data is encrypted in transit. Users can't request deletion of
     ad data from you (they reset the ad ID instead). Player names in online rooms are deleted after 24 h.
   - **Target audience** → choose **13+** (or 16+). Do **not** include under-13. A game with guns plus ads aimed at
     kids falls under the strict "Families" policy and AdMob child-directed limits.
   - **Content rating questionnaire** → violence: *cartoon/fantasy violence* (stick figures, no blood). It usually
     gets PEGI 7 / IARC 7+.
   - **Advertising ID** → "Yes, uses advertising ID" (AdMob adds the permission automatically).
3. **Store listing**:
   - Title: `90s Gun Game – Notebook Battle` (30 characters max)
   - Short description: `The school notebook game! Open the book, draw soldiers, shoot!`
   - Icon: `frontend/assets/icon-only.png` resized to 512×512
   - Feature graphic: 1024×500 (notebook paper + two soldiers + title)
   - Screenshots: at least 2 phone screenshots — home, the open-book roll, the targeting screen, and the BANG! moment work well
   - Mention "Pass & Play — no internet needed" and the Thalai/Poo toss. The nostalgia is the hook for 90s kids.
4. **Release → Testing → Closed testing first.** New personal developer accounts must run a closed test with
   **at least 12 testers for 14 days** before production access. Invite your friends; that school group is perfect.
5. After publishing, link the app in AdMob (**App settings → Link to Google Play**).

## Checklist before you press "Publish"

- [ ] Package name final (Step 1)
- [ ] `admob_app_id` in `strings.xml` is **yours** (not `3940256099942544`)
- [ ] `testing: false` and your own banner/interstitial IDs in `environment.ts`
- [ ] `privacyPolicyUrl` and `storeUrl` correct; privacy page live with your email
- [ ] Backend deployed with `MONGODB_URI` and `FRONTEND_URL`
- [ ] `versionCode` increased
- [ ] Keystore backed up
