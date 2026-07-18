import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { GameBoardComponent } from './components/game-board/game-board.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'game/:roomId', component: GameBoardComponent },
  { path: '**', redirectTo: '' }
];
