import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { OnlineLobbyComponent } from './components/online-lobby/online-lobby.component';
import { GameBoardComponent } from './components/game-board/game-board.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'online', component: OnlineLobbyComponent },
  { path: 'play', component: GameBoardComponent },
  { path: 'game/:roomId', component: GameBoardComponent },
  { path: '**', redirectTo: '' }
];
