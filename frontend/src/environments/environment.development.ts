// `ng serve` (development). Swapped in for environment.ts via angular.json
// fileReplacements — so it must not import environment.ts (it would import itself).
export const environment = {
  production: false,
  serverUrl: 'http://localhost:3000',

  admob: {
    testing: true,
    bannerId: 'ca-app-pub-3940256099942544/6300978111',
    interstitialId: 'ca-app-pub-3940256099942544/1033173712',
    interstitialEveryRounds: 2,
    interstitialMinSeconds: 150
  },

  storeUrl: 'https://play.google.com/store/apps/details?id=com.notebookgungame.app',
  privacyPolicyUrl: 'https://nine0s-gun-game.onrender.com/privacy.html'
};
