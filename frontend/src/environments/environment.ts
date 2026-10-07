// Production build (ng build / Android app).
export const environment = {
  production: true,
  serverUrl: 'https://nine0s-gun-game.onrender.com',

  admob: {
    // ⚠ Before publishing: set testing to false and replace both IDs with the
    // ad unit IDs from your AdMob account (Apps → your app → Ad units).
    // Also replace the App ID in android/app/src/main/res/values/strings.xml.
    // While testing is true, Google's official test ads are shown — never
    // click real ads on your own phone or AdMob may suspend the account.
    testing: true,
    bannerId: 'ca-app-pub-4128486856283510/1572894476',
    interstitialId: 'ca-app-pub-4128486856283510/7196756249',
    /** Show a full-screen ad after every Nth finished round… */
    interstitialEveryRounds: 2,
    /** …but never more often than this. */
    interstitialMinSeconds: 150
  },

  // Must match appId in capacitor.config.ts.
  storeUrl: 'https://play.google.com/store/apps/details?id=com.notebookgungame.app',

  // ⚠ Placeholder: point this at wherever public/privacy.html is deployed
  // (your Netlify site). Play Console needs the same URL.
  privacyPolicyUrl:'https://nine0s-gun-game.onrender.com/privacy.html'
};
