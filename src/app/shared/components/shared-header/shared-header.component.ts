import { Component, Input } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle } from '@ionic/angular/standalone';

@Component({
  selector: 'app-shared-header',
  templateUrl: './shared-header.component.html',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle
  ],
  standalone: true // if you’re using standalone components
})
export class SharedHeaderComponent {
  @Input() title = '';
} 