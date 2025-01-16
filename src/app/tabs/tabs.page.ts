import { Component, EnvironmentInjector, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { triangle, ellipse, square } from 'ionicons/icons';
import { SharedHeaderComponent } from '../shared/components/shared-header/shared-header.component';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [
    IonTabs,
    IonTabBar,
    IonTabButton,
    IonIcon,
    IonLabel,
    SharedHeaderComponent
  ],
})
export class TabsPage {
  public environmentInjector = inject(EnvironmentInjector);
  public tabTitle = 'My App';

  constructor() {
    addIcons({ triangle, ellipse, square });
  }

  onTabsDidChange(event: any) {
    console.log('event', event);
    const tab = event.tab;
    switch (tab) {
      case 'tab1':
        this.tabTitle = 'Tab 1';
        break;
      case 'tab2':
        this.tabTitle = 'Tab 2';
        break;
      case 'tab3':
        this.tabTitle = 'Tab 3';
        break;
      default:
        this.tabTitle = 'My App';
    }
  }
}
