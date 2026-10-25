import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { ApiError } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { DisciplineService } from '@core/services/discipline.service';
import { CommunityService } from '@core/services/community.service';
import { EventService } from '@core/services/event.service';
import { RouteService } from '@core/services/route.service';
import { UploadService } from '@core/services/upload.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RichTextComponent } from '@shared/components/rich-text/rich-text.component';
import { CountrySelectorComponent } from '@shared/components/country-selector/country-selector.component';
import { ImageUploadComponent } from '@shared/components/image-upload/image-upload.component';
import { LocationPickerComponent } from '@shared/components/location-picker/location-picker.component';
import {
  CyclingEvent,
  Discipline,
  PACE_CATEGORIES,
  PaceGroupInput,
  RecurrenceDto,
  Route,
  EventClass,
  LicenseClass,
  EventFormat,
  ParkingArea,
} from '@shared/models';
import { RacingService } from '@core/services/racing.service';
import { ButtonComponent, IconButtonComponent, ToastService } from '@shared/ui';
import {
  toDisplayDate as toDisplayDateUtil,
  parseDisplayDate,
  datePlaceholder,
} from '@shared/utils/event-date';
import { LocaleService } from '@core/services/locale.service';

@Component({
  selector: 'app-event-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconButtonComponent,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    ButtonComponent,
    CountrySelectorComponent,
    LocationPickerComponent,
    ImageUploadComponent,
    RichTextComponent,
  ],
  templateUrl: './event-form.component.html',
})
export class EventFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly communities = inject(CommunityService);
  private readonly disciplineService = inject(DisciplineService);
  private readonly auth = inject(AuthService);
  private readonly routeService = inject(RouteService);
  private readonly toast = inject(ToastService);
  private readonly uploadService = inject(UploadService);
  private readonly transloco = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);

  protected readonly disciplines = signal<Discipline[]>([]);
  protected readonly loading = signal(false);
  protected readonly dateInputPlaceholder = computed(() =>
    datePlaceholder(this.localeService.locale()),
  );
  protected readonly submitting = signal(false);
  protected readonly eventId = signal<string | null>(null);
  protected readonly isEdit = computed(() => this.eventId() !== null);
  protected readonly mapCoordinates = signal<{ lat: number; lng: number } | null>(null);
  protected readonly imageUrl = signal<string | null>(null);

  protected readonly uploadImageFn = (file: File) =>
    this.uploadService.uploadEventImage(this.eventId()!, file);
  protected readonly deleteImageFn = () => this.uploadService.deleteEventImage(this.eventId()!);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(200)],
    }),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(5000)],
    }),
    disciplineSlug: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/^(0[1-9]|[12]\d|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/),
      ],
    }),
    startTime: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)],
    }),
    endDate: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^(0[1-9]|[12]\d|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/)],
    }),
    endTime: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)],
    }),
    locationName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    address: new FormControl('', { nonNullable: true }),
    country: new FormControl('', { nonNullable: true }),
    lat: new FormControl<number | null>(null),
    lng: new FormControl<number | null>(null),
    registrationStart: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^(0[1-9]|[12]\d|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/)],
    }),
    registrationStartTime: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)],
    }),
    registrationDeadline: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^(0[1-9]|[12]\d|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/)],
    }),
    registrationDeadlineTime: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)],
    }),
    externalUrl: new FormControl('', { nonNullable: true }),
    status: new FormControl('published', { nonNullable: true }),
    listing: new FormControl<'public' | 'members'>('members', { nonNullable: true }),
    repeat: new FormControl<'none' | 'weekly' | 'biweekly'>('none', { nonNullable: true }),
    repeatCount: new FormControl(12, {
      nonNullable: true,
      validators: [Validators.min(2), Validators.max(104)],
    }),
    repeatUntil: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^(0[1-9]|[12]\d|3[01])\.(0[1-9]|1[0-2])\.\d{4}$/)],
    }),
    routeId: new FormControl('', { nonNullable: true }),
    stravaLinksText: new FormControl('', { nonNullable: true }),
    paceGroups: new FormArray<ReturnType<EventFormComponent['newPaceGroup']>>([]),
    championship: new FormControl<string>('', { nonNullable: true }),
    format: new FormControl<string>('', { nonNullable: true }),
    classes: new FormArray<ReturnType<EventFormComponent['newClass']>>([]),
    parkingAreas: new FormArray<ReturnType<EventFormComponent['newParkingArea']>>([]),
    stravaUrl: new FormControl('', { nonNullable: true }),
    meetupPlace: new FormControl('', { nonNullable: true }),
    meetupDate: new FormControl('', { nonNullable: true }),
    meetupTime: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)],
    }),
    meetupNote: new FormControl('', { nonNullable: true }),
  });

  protected readonly myRoutes = signal<Route[]>([]);
  private readonly usedRoutes = signal<Route[]>([]);
  /** Own routes plus routes the event already uses, so saving never drops one silently. */
  protected readonly routeOptions = computed(() => {
    const mine = this.myRoutes();
    const extra = this.usedRoutes().filter((r) => !mine.some((m) => m.id === r.id));
    return [...extra, ...mine];
  });
  protected readonly paceCategories = PACE_CATEGORIES;

  protected newPaceGroup(init?: {
    name?: string;
    category?: PaceGroupInput['category'];
    speedMinKmh?: number;
    speedMaxKmh?: number;
    routeId?: string;
    stravaText?: string;
  }) {
    return new FormGroup({
      name: new FormControl(init?.name ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(80)],
      }),
      category: new FormControl<PaceGroupInput['category']>(init?.category ?? 'social', {
        nonNullable: true,
      }),
      speedMinKmh: new FormControl(init?.speedMinKmh ?? 25, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(5), Validators.max(80)],
      }),
      speedMaxKmh: new FormControl(init?.speedMaxKmh ?? 28, {
        nonNullable: true,
        validators: [Validators.required, Validators.min(5), Validators.max(80)],
      }),
      routeId: new FormControl(init?.routeId ?? '', { nonNullable: true }),
      stravaText: new FormControl(init?.stravaText ?? '', { nonNullable: true }),
    });
  }

  private readonly racing = inject(RacingService);
  protected readonly championshipLevels = this.racing.championshipLevels;
  protected readonly categories = this.racing.categories;
  protected readonly formats = this.racing.formats;
  protected readonly classLicenses = this.racing.classLicenses;
  protected readonly licenseClassOptions = this.racing.licenseClasses;
  /** Classes are only sent when changed, so an imported event keeps its imported classes. */
  private classesChanged = false;

  protected newClass(init?: Partial<EventClass>) {
    return new FormGroup({
      name: new FormControl(init?.name ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(120)],
      }),
      gender: new FormControl<EventClass['gender']>(init?.gender ?? 'open', { nonNullable: true }),
      ageMin: new FormControl<number | null>(init?.ageMin ?? null, [Validators.min(0), Validators.max(120)]),
      ageMax: new FormControl<number | null>(init?.ageMax ?? null, [Validators.min(0), Validators.max(120)]),
      category: new FormControl<string>(init?.category ?? '', { nonNullable: true }),
      license: new FormControl<EventClass['license']>(init?.license ?? 'open', { nonNullable: true }),
      dayLicense: new FormControl(!!init?.dayLicense, { nonNullable: true }),
      licenseClasses: new FormControl<LicenseClass[]>(init?.licenseClasses ?? [], { nonNullable: true }),
      startTime: new FormControl(init?.startTime ? this.toTimeString(init.startTime) : '', {
        nonNullable: true,
        validators: [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)],
      }),
      distanceKm: new FormControl<number | null>(init?.distanceKm ?? null, [Validators.min(0), Validators.max(9999)]),
      elevationM: new FormControl<number | null>(init?.elevationM ?? null, [Validators.min(0), Validators.max(99999)]),
      championship: new FormControl<string>(init?.championship ?? '', { nonNullable: true }),
      note: new FormControl(init?.note ?? '', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    });
  }

  /** Touring events (RTF, CTF …) list their routes instead of rating classes. */
  protected isTouring(): boolean {
    return this.racing.isTouring(this.form.controls.format.value);
  }

  /** Choosing a category fills its ages (and the name when empty). */
  protected onCategoryChange(index: number): void {
    const group = this.form.controls.classes.at(index);
    const preset = this.categories().find((c) => c.key === group.controls.category.value);
    if (!preset) return;
    group.patchValue({ ageMin: preset.ageMin, ageMax: preset.ageMax });
    if (!group.controls.name.value.trim()) {
      group.controls.name.setValue(this.transloco.translate('classes.category.' + preset.key));
    }
  }

  protected toggleLicenseClass(index: number, value: LicenseClass, checked: boolean): void {
    const control = this.form.controls.classes.at(index).controls.licenseClasses;
    const next = control.value.filter((v) => v !== value);
    control.setValue(checked ? [...next, value] : next);
    control.markAsDirty();
  }

  /** Parking areas are only sent when changed, so an imported event keeps its imported ones. */
  private parkingChanged = false;
  protected readonly parkingKinds = this.racing.parkingKinds;
  protected readonly parkingFees = this.racing.parkingFees;
  protected readonly maxParkingAreas = this.racing.maxParkingAreas;

  protected newParkingArea(init?: Partial<ParkingArea>) {
    const time = [Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)];
    return new FormGroup({
      name: new FormControl(init?.name ?? '', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(80)],
      }),
      kinds: new FormControl<string[]>(init?.kinds ?? ['participants'], {
        nonNullable: true,
        validators: [Validators.required, (c) => (c.value?.length ? null : { required: true })],
      }),
      coordinates: new FormControl<{ lat: number; lng: number } | null>(init?.coordinates ?? null, [
        Validators.required,
      ]),
      address: new FormControl(init?.address ?? '', { nonNullable: true, validators: [Validators.maxLength(255)] }),
      capacity: new FormControl<number | null>(init?.capacity ?? null, [Validators.min(1), Validators.max(100000)]),
      fee: new FormControl<string>(init?.fee ?? '', { nonNullable: true }),
      feeNote: new FormControl(init?.feeNote ?? '', { nonNullable: true, validators: [Validators.maxLength(80)] }),
      openFrom: new FormControl(init?.openFrom ?? '', { nonNullable: true, validators: time }),
      openUntil: new FormControl(init?.openUntil ?? '', { nonNullable: true, validators: time }),
      note: new FormControl(init?.note ?? '', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    });
  }

  protected addParkingArea(): void {
    this.form.controls.parkingAreas.push(this.newParkingArea());
    this.parkingChanged = true;
  }

  protected removeParkingArea(index: number): void {
    this.form.controls.parkingAreas.removeAt(index);
    this.parkingChanged = true;
  }

  protected toggleParkingKind(index: number, kind: string, checked: boolean): void {
    const control = this.form.controls.parkingAreas.at(index).controls.kinds;
    const next = control.value.filter((k) => k !== kind);
    control.setValue(checked ? [...next, kind] : next);
    control.markAsDirty();
  }

  protected setParkingPoint(index: number, coords: { lat: number; lng: number }): void {
    const control = this.form.controls.parkingAreas.at(index).controls.coordinates;
    control.setValue(coords);
    control.markAsDirty();
  }

  protected addClass(): void {
    this.form.controls.classes.push(this.newClass());
    this.classesChanged = true;
  }

  protected removeClass(index: number): void {
    this.form.controls.classes.removeAt(index);
    this.classesChanged = true;
  }

  protected addPaceGroup(): void {
    this.form.controls.paceGroups.push(this.newPaceGroup());
  }

  protected removePaceGroup(index: number): void {
    this.form.controls.paceGroups.removeAt(index);
  }

  /** One Strava link per line, optionally followed by a label. */
  private parseLinks(text: string): { url: string; label?: string }[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [url, ...rest] = line.split(/\s+/);
        const label = rest.join(' ');
        return label ? { url, label } : { url };
      });
  }

  private linksToText(links: { url: string; label?: string | null }[] | undefined): string {
    return (links ?? []).map((l) => (l.label ? `${l.url} ${l.label}` : l.url)).join('\n');
  }

  protected readonly hosted = signal(false);
  /** Community the event was opened from (shared public events); kept across edit and cancel. */
  private readonly contextCommunity = signal<string | null>(null);
  private readonly contextSubgroup = signal<string | null>(null);
  protected readonly communitySlug = signal<string | null>(null);
  protected readonly subgroupSlug = signal<string | null>(null);

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    this.contextCommunity.set(query.get('community'));
    this.contextSubgroup.set(query.get('subgroup'));
    this.communitySlug.set(this.route.snapshot.paramMap.get('slug'));
    this.subgroupSlug.set(this.route.snapshot.paramMap.get('subgroupSlug'));
    this.hosted.set(!!this.communitySlug());
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.eventId.set(id);
      this.loadEvent(id);
    }

    this.disciplineService.getDisciplines().subscribe((d) => this.disciplines.set(d));
    if (this.auth.isAuthenticated()) {
      this.routeService.listMine().subscribe({
        next: (routes) => this.myRoutes.set(routes),
        error: () => this.myRoutes.set([]),
      });
    }
  }

  protected onCoordinatesChange(coords: { lat: number; lng: number }): void {
    this.form.patchValue({ lat: coords.lat, lng: coords.lng });
    this.mapCoordinates.set(coords);
  }

  /** Query params that return the user to the same community view of the event. */
  protected backQuery(): Record<string, string> {
    const community = this.contextCommunity();
    if (!this.isEdit() || !community) return {};
    const subgroup = this.contextSubgroup();
    return subgroup ? { community, subgroup } : { community };
  }

  protected backCommands(): string[] {
    if (this.isEdit() && this.eventId()) return ['/events', this.eventId()!];
    const community = this.communitySlug();
    const subgroup = this.subgroupSlug();
    if (community && subgroup) {
      return ['/communities', community, 'subgroups', subgroup];
    }
    if (community) return ['/communities', community];
    return ['/events'];
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    if (
      raw.registrationStart &&
      raw.registrationDeadline &&
      new Date(this.combineDatetime(raw.registrationStart, raw.registrationStartTime)) >
        new Date(this.combineDatetime(raw.registrationDeadline, raw.registrationDeadlineTime))
    ) {
      this.toast.error(this.transloco.translate('event.form.error.registrationOrder'));
      return;
    }

    this.submitting.set(true);

    const dto = {
      name: raw.name,
      description: raw.description || undefined,
      disciplineSlug: raw.disciplineSlug,
      // Without a time only the day is sent; the server stores it as midnight in Germany.
      startDate: raw.startTime ? this.combineDatetime(raw.startDate, raw.startTime) : this.parseDate(raw.startDate),
      startTimeKnown: !!raw.startTime,
      endDate: raw.endDate
        ? raw.endTime || raw.startTime
          ? this.combineDatetime(raw.endDate, raw.endTime)
          : this.parseDate(raw.endDate)
        : undefined,
      locationName: raw.locationName,
      address: raw.address || undefined,
      country: raw.country || undefined,
      coordinates: raw.lat != null && raw.lng != null ? { lat: raw.lat, lng: raw.lng } : undefined,
      registrationStart: raw.registrationStart
        ? this.combineDatetime(raw.registrationStart, raw.registrationStartTime)
        : this.isEdit()
          ? null
          : undefined,
      registrationDeadline: raw.registrationDeadline
        ? this.combineDatetime(raw.registrationDeadline, raw.registrationDeadlineTime)
        : this.isEdit()
          ? null
          : undefined,
      externalUrl: raw.externalUrl || undefined,
      championship: raw.championship || null,
      format: (raw.format || null) as EventFormat | null,
      ...(this.classesChanged || this.form.controls.classes.dirty || !this.isEdit()
        ? {
            classes: raw.classes.map((c) => ({
              name: c.name.trim(),
              gender: c.gender,
              ageMin: c.ageMin ?? null,
              ageMax: c.ageMax ?? null,
              category: c.category || null,
              license: c.license,
              dayLicense: c.license === 'license' && c.dayLicense,
              licenseClasses: c.license === 'unlicensed' ? [] : c.licenseClasses,
              distanceKm: c.distanceKm ?? null,
              elevationM: c.elevationM ?? null,
              startTime: c.startTime ? this.combineDatetime(raw.startDate, c.startTime) : null,
              championship: c.championship || null,
              note: c.note.trim() || null,
            })),
          }
        : {}),
      ...(this.parkingChanged || this.form.controls.parkingAreas.dirty || !this.isEdit()
        ? {
            parkingAreas: raw.parkingAreas.map((p) => ({
              name: p.name.trim(),
              kinds: p.kinds,
              coordinates: p.coordinates!,
              address: p.address.trim() || null,
              capacity: p.capacity ?? null,
              fee: p.fee || null,
              feeNote: p.feeNote.trim() || null,
              openFrom: p.openFrom || null,
              openUntil: p.openUntil || null,
              note: p.note.trim() || null,
            })),
          }
        : {}),
      recurrence: undefined as RecurrenceDto | undefined,
      status: this.isEdit() ? (raw.status as 'published' | 'cancelled' | 'completed') : undefined,
      ...(this.hosted()
        ? {
            listing: raw.listing,
            stravaUrl: raw.stravaUrl,
            meetupPlace: raw.meetupPlace,
            meetupAt: raw.meetupDate ? this.combineDatetime(raw.meetupDate, raw.meetupTime) : '',
            meetupNote: raw.meetupNote,
          }
        : {}),
    };

    const recurrence =
      !this.isEdit() && raw.repeat !== 'none'
        ? {
            frequency: raw.repeat,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            ...(raw.repeatUntil
              ? { until: this.combineDatetime(raw.repeatUntil, '23:59') }
              : { count: raw.repeatCount }),
          }
        : undefined;
    const community = this.communitySlug();
    const paceGroups: PaceGroupInput[] = raw.paceGroups.map((group) => ({
      name: group.name.trim(),
      category: group.category,
      speedMinKmh: group.speedMinKmh,
      speedMaxKmh: group.speedMaxKmh,
      routeId: group.routeId || null,
      stravaLinks: this.parseLinks(group.stravaText),
    }));
    const stravaLinks = this.parseLinks(raw.stravaLinksText);
    const createDto = {
      ...dto,
      recurrence,
      routeId: raw.routeId || undefined,
      paceGroups: paceGroups.length ? paceGroups : undefined,
      stravaLinks: stravaLinks.length ? stravaLinks : undefined,
    };
    const action = this.isEdit()
      ? this.eventService
          .updateEvent(this.eventId()!, { ...dto, routeId: raw.routeId || null })
          .pipe(
            switchMap(() =>
              forkJoin([
                this.eventService.setPaceGroups(this.eventId()!, paceGroups),
                this.eventService.setStravaLinks(this.eventId()!, stravaLinks),
              ]),
            ),
            switchMap(([event]) => of(event)),
          )
      : community
        ? this.communities.createEvent(community, createDto, this.subgroupSlug() ?? undefined)
        : this.eventService.createEvent(createDto);

    action.subscribe({
      next: (event) => {
        this.submitting.set(false);
        const key = this.isEdit() ? 'event.form.success.update' : 'event.form.success.create';
        this.toast.success(this.transloco.translate(key));
        if (community && !this.isEdit()) {
          void this.router.navigate(this.backCommands());
        } else {
          void this.router.navigate(['/events', event.id], { queryParams: this.backQuery() });
        }
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        if (err.status === 422 && err.body?.['error'] === 'content_policy_violation') {
          this.applyBadWordErrors(err.body['violations'] as { field: string }[]);
          this.toast.error(this.transloco.translate('validation.badWord'));
        } else {
          const key = this.isEdit() ? 'event.form.error.update' : 'event.form.error.create';
          this.toast.error(this.transloco.translate(key));
        }
      },
    });
  }

  protected hasError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!control?.hasError(error) && (control.dirty || control.touched);
  }

  private applyBadWordErrors(violations: { field: string }[]): void {
    for (const { field } of violations) {
      const control = this.form.get(field);
      if (control) {
        control.setErrors({ badWord: true });
        control.markAsTouched();
      }
    }
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
    if (!this.canManage(event)) {
      this.loading.set(false);
      void this.router.navigate(['/events', event.id], { queryParams: this.backQuery() });
      return;
    }
    this.form.patchValue({
      name: event.name,
      description: event.description ?? '',
      disciplineSlug: event.disciplineSlug,
      startDate: this.toDateString(event.startDate),
      startTime: this.toTimeString(event.startDate),
      endDate: event.endDate ? this.toDateString(event.endDate) : '',
      endTime: event.endDate ? this.toTimeString(event.endDate) : '',
      locationName: event.locationName,
      address: event.address ?? '',
      country: event.country ?? '',
      lat: event.coordinates?.lat ?? null,
      lng: event.coordinates?.lng ?? null,
      registrationStart: event.registrationStart ? this.toDateString(event.registrationStart) : '',
      registrationStartTime: event.registrationStart
        ? this.toTimeString(event.registrationStart)
        : '',
      registrationDeadline: event.registrationDeadline
        ? this.toDateString(event.registrationDeadline)
        : '',
      registrationDeadlineTime: event.registrationDeadline
        ? this.toTimeString(event.registrationDeadline)
        : '',
      externalUrl: event.externalUrl ?? '',
      status: event.status,
      listing: event.listing ?? 'members',
      stravaUrl: event.stravaUrl ?? '',
      meetupPlace: event.meetupPlace ?? '',
      meetupDate: event.meetupAt ? this.toDateString(event.meetupAt) : '',
      meetupTime: event.meetupAt ? this.toTimeString(event.meetupAt) : '',
      meetupNote: event.meetupNote ?? '',
      routeId: event.routeId ?? '',
      stravaLinksText: this.linksToText(event.stravaLinks),
      championship: event.championship ?? '',
      format: event.format ?? '',
    });
    this.form.controls.classes.clear();
    for (const cls of event.classes ?? []) this.form.controls.classes.push(this.newClass(cls));
    this.classesChanged = false;
    this.form.controls.parkingAreas.clear();
    for (const area of event.parkingAreas ?? []) {
      this.form.controls.parkingAreas.push(this.newParkingArea(area));
    }
    this.parkingChanged = false;
    this.usedRoutes.set(
      [event.route, ...(event.paceGroups ?? []).map((group) => group.route)].filter(
        (route): route is Route => !!route,
      ),
    );
    this.form.controls.paceGroups.clear();
    for (const group of event.paceGroups ?? []) {
      this.form.controls.paceGroups.push(
        this.newPaceGroup({
          name: group.name,
          category: group.category,
          speedMinKmh: group.speedMinKmh,
          speedMaxKmh: group.speedMaxKmh,
          routeId: group.route?.id ?? '',
          stravaText: this.linksToText(group.stravaLinks),
        }),
      );
    }
    if (event.communityId) this.hosted.set(true);

    if (event.coordinates) {
      this.mapCoordinates.set(event.coordinates);
    }
    this.imageUrl.set(event.imageUrl ?? null);
    this.loading.set(false);
  }

  private canManage(event: CyclingEvent): boolean {
    const user = this.auth.currentUser();
    if (!user) return false;
    if (event.communityId) return event.canEdit === true;
    return event.createdById === user.id || !!user.isAdmin;
  }

  /** '28.04.2026' */
  private toDateString(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    const isoDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    return toDisplayDateUtil(isoDate, this.localeService.locale());
  }

  /** 'HH:mm' or '' if midnight */
  private toTimeString(iso: string): string {
    const d = new Date(iso);
    if (d.getHours() === 0 && d.getMinutes() === 0) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private parseDate(display: string): string {
    return parseDisplayDate(display, this.localeService.locale());
  }

  private combineDatetime(date: string, time: string): string {
    const iso = this.parseDate(date);
    if (time) {
      return new Date(`${iso}T${time}`).toISOString();
    }
    return new Date(`${iso}T00:00`).toISOString();
  }
}
