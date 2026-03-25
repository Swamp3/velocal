import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '@core/services/auth.service';
import { DisciplineService } from '@core/services/discipline.service';
import { FavoriteService } from '@core/services/favorite.service';
import { UserService } from '@core/services/user.service';
import { ToastService } from '@shared/ui';
import { ButtonComponent, ChipComponent, InputComponent } from '@shared/ui';
import { EventCardComponent, CountrySelectorComponent } from '@shared/components';
import { CyclingEvent, Discipline } from '@shared/models';

const FAVORITES_PAGE_SIZE = 10;

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    ButtonComponent,
    ChipComponent,
    InputComponent,
    CountrySelectorComponent,
    EventCardComponent,
  ],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly disciplineService = inject(DisciplineService);
  private readonly favoriteService = inject(FavoriteService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly saving = signal(false);
  protected readonly disciplines = signal<Discipline[]>([]);
  protected readonly selectedSlugs = signal<Set<string>>(new Set());
  protected readonly savingPrefs = signal(false);

  protected readonly favoriteEvents = signal<CyclingEvent[]>([]);
  protected readonly favoritesTotal = signal(0);
  protected readonly favoritesPage = signal(1);
  protected readonly loadingFavorites = signal(false);
  protected readonly hasMoreFavorites = computed(
    () => this.favoriteEvents().length < this.favoritesTotal(),
  );

  protected readonly profileForm = this.fb.nonNullable.group({
    displayName: [''],
    homeZip: [''],
    homeCountry: [''],
    preferredLocale: ['de', Validators.required],
  });

  ngOnInit(): void {
    this.initForm();
    this.loadDisciplines();
    this.loadDisciplinePrefs();
    this.loadFavorites();
  }

  protected activeLang(): string {
    return this.transloco.getActiveLang();
  }

  private initForm(): void {
    const user = this.auth.currentUser();
    if (!user) return;

    this.profileForm.patchValue({
      displayName: user.displayName ?? '',
      homeZip: user.homeZip ?? '',
      homeCountry: user.homeCountry ?? '',
      preferredLocale: user.preferredLocale ?? 'de',
    });
  }

  private loadDisciplines(): void {
    this.disciplineService.getDisciplines().subscribe({
      next: (d) => this.disciplines.set(d),
    });
  }

  private loadDisciplinePrefs(): void {
    this.userService.getDisciplinePrefs().subscribe({
      next: (slugs) => this.selectedSlugs.set(new Set(slugs)),
    });
  }

  protected onSaveProfile(): void {
    if (this.profileForm.invalid || this.saving()) return;
    this.saving.set(true);

    const vals = this.profileForm.getRawValue();
    this.userService.updateProfile(vals).subscribe({
      next: (user) => {
        this.auth.updateCurrentUser(user);

        if (vals.preferredLocale !== this.transloco.getActiveLang()) {
          this.transloco.setActiveLang(vals.preferredLocale);
        }

        this.toast.success(this.transloco.translate('profile.savedSuccess'));
        this.saving.set(false);
      },
      error: () => {
        this.toast.error(this.transloco.translate('profile.savedError'));
        this.saving.set(false);
      },
    });
  }

  protected toggleDiscipline(slug: string): void {
    this.selectedSlugs.update((set) => {
      const next = new Set(set);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
    this.saveDisciplinePrefs();
  }

  private saveDisciplinePrefs(): void {
    const slugs = [...this.selectedSlugs()];
    if (!slugs.length) return;

    this.savingPrefs.set(true);
    this.userService.setDisciplinePrefs(slugs).subscribe({
      next: () => this.savingPrefs.set(false),
      error: () => {
        this.toast.error(this.transloco.translate('profile.prefsError'));
        this.savingPrefs.set(false);
      },
    });
  }

  private loadFavorites(): void {
    this.loadingFavorites.set(true);
    this.userService
      .getFavorites(this.favoritesPage(), FAVORITES_PAGE_SIZE)
      .subscribe({
        next: (res) => {
          this.favoriteEvents.update((prev) => [
            ...prev,
            ...res.data.map((f) => f.event),
          ]);
          this.favoritesTotal.set(res.total);
          this.loadingFavorites.set(false);
        },
        error: () => this.loadingFavorites.set(false),
      });
  }

  protected onLoadMore(): void {
    this.favoritesPage.update((p) => p + 1);
    this.loadFavorites();
  }

  protected onRemoveFavorite(eventId: string): void {
    this.favoriteService.removeFavorite(eventId).subscribe({
      next: () => {
        this.favoriteEvents.update((list) =>
          list.filter((e) => e.id !== eventId),
        );
        this.favoritesTotal.update((t) => t - 1);
      },
    });
  }
}
