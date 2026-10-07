import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  AdMob, AdmobConsentStatus, BannerAdPluginEvents, BannerAdPosition, BannerAdSize,
  InterstitialAdPluginEvents
} from '@capacitor-community/admob';
import { environment } from '../../environments/environment';

/**
 * AdMob ads for the Android app (does nothing in the browser).
 *
 *  • Banner: on menu screens only — never covers the game board.
 *  • Interstitial: between rounds, every Nth round and at most once per
 *    `interstitialMinSeconds`, so players are not interrupted mid-game.
 *  • Consent: Google's UMP form for EEA/UK users (required by AdMob policy).
 */
@Injectable({ providedIn: 'root' })
export class AdsService {
  private readonly native = Capacitor.isNativePlatform();
  private ready = false;
  private bannerShown = false;
  private bannerWanted = false;
  private interstitialLoaded = false;
  private roundsSinceAd = 0;
  private lastAdAt = Date.now();

  /** Height in px the banner occupies; screens pad their bottom by this. */
  readonly bannerHeight = signal(0);
  /** True when the user must be offered a way to change their ad consent. */
  readonly privacyOptionsRequired = signal(false);

  async init(): Promise<void> {
    if (!this.native) return;
    try {
      await AdMob.initialize({ initializeForTesting: environment.admob.testing });

      const consent = await AdMob.requestConsentInfo();
      let canRequest = consent.canRequestAds;
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        canRequest = (await AdMob.showConsentForm()).canRequestAds;
      }
      this.privacyOptionsRequired.set(String(consent.privacyOptionsRequirementStatus) === 'REQUIRED');
      if (!canRequest) return;

      AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => this.bannerHeight.set(size.height));
      AdMob.addListener(BannerAdPluginEvents.FailedToLoad, () => this.bannerHeight.set(0));
      AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => (this.interstitialLoaded = true));
      AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => (this.interstitialLoaded = false));

      this.ready = true;
      this.loadInterstitial();
      if (this.bannerWanted) this.showBanner();
    } catch (err) {
      console.warn('[ads] init failed', err);
    }
  }

  /** Call on screens where a bottom banner is OK (menus, lobby). */
  showBanner(): void {
    this.bannerWanted = true;
    if (!this.ready) return;
    const call = this.bannerShown
      ? AdMob.resumeBanner()
      : AdMob.showBanner({
          adId: environment.admob.bannerId,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: environment.admob.testing
        });
    this.bannerShown = true;
    call.catch(() => (this.bannerShown = false));
  }

  /** Call when entering the game board. */
  hideBanner(): void {
    this.bannerWanted = false;
    this.bannerHeight.set(0);
    if (this.ready && this.bannerShown) AdMob.hideBanner().catch(() => {});
  }

  roundFinished(): void {
    this.roundsSinceAd += 1;
  }

  /**
   * Shows an interstitial if one is due, and resolves once it is closed
   * (or immediately when no ad is shown). Call at natural breaks only:
   * after a round, before rematch / leaving.
   */
  async maybeShowInterstitial(): Promise<void> {
    const due =
      this.roundsSinceAd >= environment.admob.interstitialEveryRounds &&
      Date.now() - this.lastAdAt >= environment.admob.interstitialMinSeconds * 1000;
    if (!this.ready || !this.interstitialLoaded || !due) return;

    const closed = new Promise<void>((resolve) => {
      const done = () => { handles.forEach((h) => h.then((x) => x.remove())); resolve(); };
      const handles = [
        AdMob.addListener(InterstitialAdPluginEvents.Dismissed, done),
        AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, done)
      ];
    });
    try {
      this.interstitialLoaded = false;
      await AdMob.showInterstitial();
      this.roundsSinceAd = 0;
      this.lastAdAt = Date.now();
      await closed;
    } catch {
      /* ad failed to show: carry on */
    } finally {
      this.loadInterstitial();
    }
  }

  showPrivacyOptions(): void {
    if (this.native) AdMob.showPrivacyOptionsForm().catch(() => {});
  }

  private loadInterstitial(): void {
    AdMob.prepareInterstitial({ adId: environment.admob.interstitialId, isTesting: environment.admob.testing })
      .then(() => (this.interstitialLoaded = true))
      .catch(() => (this.interstitialLoaded = false));
  }
}
