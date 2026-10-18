import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiError } from '@core/services/api.service';
import { CommunityService } from '@core/services/community.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { PollResultsVisibility, PollVisibility } from '@shared/models';
import { ButtonStyleDirective, InputComponent, SkeletonComponent, ToastService } from '@shared/ui';
import { communityErrorKey } from '../community-error';

import { FormActionsComponent } from '@shared/components/form-actions/form-actions.component';

@Component({
  selector: 'app-community-poll-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormActionsComponent,
    ReactiveFormsModule,
    TranslocoPipe,
    InputComponent,
    SkeletonComponent,
    ButtonStyleDirective,
  ],
  templateUrl: './community-poll-form.component.html',
})
export class CommunityPollFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly communityService = inject(CommunityService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly saving = signal(false);
  protected readonly loaded = signal(false);
  protected readonly publicAllowed = signal(true);
  protected readonly communitySlug = signal('');
  protected readonly subgroupSlug = signal<string | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    question: ['', Validators.required],
    multiple: [false],
    resultsVisibility: this.fb.nonNullable.control<PollResultsVisibility>('members'),
    visibility: this.fb.nonNullable.control<PollVisibility>('members'),
    closesAt: [''],
    options: this.fb.nonNullable.array([
      this.fb.nonNullable.control('', Validators.required),
      this.fb.nonNullable.control('', Validators.required),
    ]),
  });

  ngOnInit(): void {
    const communitySlug = this.route.snapshot.paramMap.get('slug');
    const subgroupSlug = this.route.snapshot.paramMap.get('subgroupSlug');
    if (!communitySlug) {
      void this.router.navigateByUrl('/communities');
      return;
    }
    this.communitySlug.set(communitySlug);
    this.subgroupSlug.set(subgroupSlug);

    if (subgroupSlug) {
      this.communityService
        .getSubgroup(communitySlug, subgroupSlug)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (subgroup) => {
            if (!subgroup.myRole && !subgroup.viewerIsCommunityAdmin) {
              void this.router.navigate(this.listLink());
              return;
            }
            this.publicAllowed.set(subgroup.visibility !== 'invite');
            this.loaded.set(true);
          },
          error: () => void this.router.navigate(['/communities', communitySlug]),
        });
      return;
    }

    this.communityService
      .getBySlug(communitySlug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (community) => {
          if (!community.myRole) {
            void this.router.navigate(this.listLink());
            return;
          }
          this.publicAllowed.set(community.visibility !== 'private');
          this.loaded.set(true);
        },
        error: () => void this.router.navigateByUrl('/communities'),
      });
  }

  protected listLink(): string[] {
    const subgroupSlug = this.subgroupSlug();
    return subgroupSlug
      ? ['/communities', this.communitySlug(), 'subgroups', subgroupSlug, 'polls']
      : ['/communities', this.communitySlug(), 'polls'];
  }

  protected addOption(): void {
    if (this.form.controls.options.length >= 12) return;
    this.form.controls.options.push(this.fb.nonNullable.control(''));
  }

  protected optionError(index: number): string {
    const control = this.form.controls.options.at(index);
    if (!control.touched || control.valid) return '';
    return this.transloco.translate('validation.required');
  }

  protected questionError(): string {
    const control = this.form.controls.question;
    if (!control.touched || control.valid) return '';
    return this.transloco.translate('validation.required');
  }

  protected create(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const options = raw.options.map((label) => label.trim()).filter(Boolean);
    if (options.length < 2) return;
    this.saving.set(true);
    this.communityService
      .createPoll(
        this.communitySlug(),
        {
          question: raw.question.trim(),
          multiple: raw.multiple,
          resultsVisibility: raw.resultsVisibility,
          visibility: raw.visibility,
          closesAt: raw.closesAt ? new Date(raw.closesAt).toISOString() : undefined,
          options: options.map((label) => ({ label })),
        },
        this.subgroupSlug(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toast.success(this.transloco.translate('communities.polls.created'));
          void this.router.navigate(this.listLink());
        },
        error: (err: ApiError) => {
          this.saving.set(false);
          this.toast.error(this.transloco.translate(communityErrorKey(err)));
        },
      });
  }
}
