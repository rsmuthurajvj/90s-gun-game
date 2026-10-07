import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { AdsService } from './services/ads.service';
import { BackButtonService } from './services/back-button.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: `<router-outlet />`
})
export class AppComponent implements OnInit {
  // BackButtonService is injected here so the Android listener exists from startup.
  constructor(private ads: AdsService, _back: BackButtonService) {}

  ngOnInit(): void {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#fbf6e6' }).catch(() => {});
      SplashScreen.hide().catch(() => {});
    }
    this.ads.init();
  }
}
