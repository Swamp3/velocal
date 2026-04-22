import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { EventService } from '@core/services/event.service';
import { DisciplineService } from '@core/services/discipline.service';
import { AuthService } from '@core/services/auth.service';
import { UploadService } from '@core/services/upload.service';
import { ButtonComponent, ToastService } from '@shared/ui';
import { CountrySelectorComponent } from '@shared/components/country-selector/country-selector.component';
import { LocationPickerComponent } from '@shared/components/location-picker/location-picker.component';
import { ImageUploadComponent } from '@shared/components/image-upload/image-upload.component';
import { CyclingEvent, Discipline } from '@shared/models';

@Component({
  selector: 'app-event-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    ButtonComponent,
    CountrySelectorComponent,
    LocationPickerComponent,
    ImageUploadComponent,
  ],
  templateUrl: './event-form.component.html',
})
export class EventFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly disciplineService = inject(DisciplineService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly uploadService = inject(UploadService);

  protected readonly disciplines = signal<Discipline[]>([]);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly eventId = signal<string | null>(null);
  protected readonly isEdit = computed(() => this.eventId() !== null);
  protected readonly mapCoordinates = signal<{ lat: number; lng: number } | null>(null);
  protected readonly imageUrl = signal<string | null>(null);

  // Bound to `<app-image-upload [uploadFn] [deleteFn]>`. We declare them as
  // arrow-function properties so `this.eventId()` resolves at call time
  // (the edit page always has an id by the time the user picks a file).
  protected readonly uploadImageFn = (file: File) =>
    this.uploadService.uploadEventImage(this.eventId()!, file);
  protected readonly deleteImageFn = () =>
    this.uploadService.deleteEventImage(this.eventId()!);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(5000)] }),
    disciplineSlug: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    endDate: new FormControl('', { nonNullable: true }),
    locationName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    address: new FormControl('', { nonNullable: true }),
    country: new FormControl('', { nonNullable: true }),
    lat: new FormControl<number | null>(null),
    lng: new FormControl<number | null>(null),
    registrationDeadline: new FormControl('', { nonNullable: true }),
    externalUrl: new FormControl('', { nonNullable: true }),
    status: new FormControl('published', { nonNullable: true }),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.eventId.set(id);
      this.loadEvent(id);
    }

    this.disciplineService.getDisciplines().subscribe((d) => this.disciplines.set(d));
  }

  protected onCoordinatesChange(coords: { lat: number; lng: number }): void {
    this.form.patchValue({ lat: coords.lat, lng: coords.lng });
    this.mapCoordinates.set(coords);
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const raw = this.form.getRawValue();

    const dto = {
      name: raw.name,
      description: raw.description || undefined,
      disciplineSlug: raw.disciplineSlug,
      startDate: new Date(raw.startDate).toISOString(),
      endDate: raw.endDate ? new Date(raw.endDate).toISOString() : undefined,
      locationName: raw.locationName,
      address: raw.address || undefined,
      country: raw.country || undefined,
      coordinates:
        raw.lat != null && raw.lng != null
          ? { lat: raw.lat, lng: raw.lng }
          : undefined,
      registrationDeadline: raw.registrationDeadline
        ? new Date(raw.registrationDeadline).toISOString()
        : undefined,
      externalUrl: raw.externalUrl || undefined,
      status: this.isEdit() ? (raw.status as 'published' | 'cancelled' | 'completed') : undefined,
    };

    const action = this.isEdit()
      ? this.eventService.updateEvent(this.eventId()!, dto)
      : this.eventService.createEvent(dto);

    action.subscribe({
      next: (event) => {
        this.submitting.set(false);
        const key = this.isEdit() ? 'event.form.success.update' : 'event.form.success.create';
        this.toast.success(key);
        this.router.navigate(['/events', event.id]);
      },
      error: () => {
        this.submitting.set(false);
        const key = this.isEdit() ? 'event.form.error.update' : 'event.form.error.create';
        this.toast.error(key);
      },
    });
  }

  protected hasError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!control?.hasError(error) && (control.dirty || control.touched);
  }

  private loadEvent(id: string): void {
    this.loading.set(true);
    this.eventService.getEvent(id).subscribe({
      next: (event) => this.patchForm(event),
      error: () => {
        this.loading.set(false);
        this.router.navigate(['/events']);
      },
    });
  }

  private patchForm(event: CyclingEvent): void {
    this.form.patchValue({
      name: event.name,
      description: event.description ?? '',
      disciplineSlug: event.disciplineSlug,
      startDate: this.toDatetimeLocal(event.startDate),
      endDate: event.endDate ? this.toDatetimeLocal(event.endDate) : '',
      locationName: event.locationName,
      address: event.address ?? '',
      country: event.country ?? '',
      lat: event.coordinates?.lat ?? null,
      lng: event.coordinates?.lng ?? null,
      registrationDeadline: event.registrationDeadline
        ? this.toDatetimeLocal(event.registrationDeadline)
        : '',
      externalUrl: event.externalUrl ?? '',
      status: event.status,
    });

    if (event.coordinates) {
      this.mapCoordinates.set(event.coordinates);
    }
    this.imageUrl.set(event.imageUrl ?? null);
    this.loading.set(false);
  }

  private toDatetimeLocal(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}
