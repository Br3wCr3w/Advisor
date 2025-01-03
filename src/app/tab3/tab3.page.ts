import { Component } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { ExploreContainerComponent } from '../explore-container/explore-container.component';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  imports: [IonContent, ExploreContainerComponent],
})
export class Tab3Page {
  constructor() {}
}
