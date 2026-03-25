import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-profile',
  template: `<p class="p-4 text-lg">Profile — coming soon</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {}
