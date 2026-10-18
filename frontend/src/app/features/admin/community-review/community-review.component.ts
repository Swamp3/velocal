import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminCommunityDetail, AdminService } from '@core/services/admin.service';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { FormsModule } from '@angular/forms';
import { ConfirmDeleteDialogComponent, ConfirmDialogComponent, RichTextViewComponent } from '@shared/components';
import { communityVisibilityVariant } from '@shared/models';
import {
  BadgeComponent,
  ButtonComponent,
  ModalComponent,
  SkeletonComponent,
  ToastService,
} from '@shared/ui';

type Pending =
  | { kind: 'community' }
  | { kind: 'subgroup'; id: string; name: string }
  | { kind: 'post'; id: string; name: string };

/** Site-admin review of one community: what is in it, and tools to remove content. */
@Component({
  selector: 'app-admin-community-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    RouterLink,
    TranslocoPipe,
    BadgeComponent,
    ButtonComponent,
    SkeletonComponent,
    ConfirmDeleteDialogComponent,
    FormsModule,
    ModalComponent, RichTextViewComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './community-review.component.html',
})
export class CommunityReviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly community = signal<AdminCommunityDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly missing = signal(false);
  protected readonly pending = signal<Pending | null>(null);
  protected readonly busy = signal(false);
  protected readonly suspending = signal(false);
  protected readonly suspendReason = signal('');
  protected readonly badge = communityVisibilityVariant;

  protected readonly slugDraft = signal('');
  protected readonly savingSlug = signal(false);
  protected readonly confirmingSlug = signal(false);

  private id = '';

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  protected dialogTitle(pending: Pending): string {
    return this.transloco.translate(`admin.communities.delete.${pending.kind}`);
  }

  protected dialogMessage(pending: Pending, community: AdminCommunityDetail): string {
    const name = pending.kind === 'community' ? community.name : pending.name;
    return this.transloco.translate(`admin.communities.delete.${pending.kind}Message`, { name });
  }

  protected confirmText(pending: Pending, community: AdminCommunityDetail): string {
    return pending.kind === 'community' ? community.name : pending.name;
  }

  protected confirm(): void {
    const pending = this.pending();
    if (!pending || this.busy()) return;
    this.busy.set(true);
    const request$ =
      pending.kind === 'community'
        ? this.admin.deleteCommunity(this.id)
        : pending.kind === 'subgroup'
          ? this.admin.deleteCommunitySubgroup(this.id, pending.id)
          : this.admin.deleteCommunityPost(this.id, pending.id);
    request$.subscribe({
      next: () => {
        this.busy.set(false);
        this.pending.set(null);
        this.toast.success(this.transloco.translate('admin.communities.deleted'));
        if (pending.kind === 'community') {
          void this.router.navigate(['/admin/communities']);
        } else {
          this.load();
        }
      },
      error: () => {
        this.busy.set(false);
        this.toast.error(this.transloco.translate('admin.communities.deleteError'));
      },
    });
  }

  protected suspend(): void {
    const reason = this.suspendReason().trim();
    if (!reason || this.busy()) return;
    this.busy.set(true);
    this.admin.suspendCommunity(this.id, reason).subscribe({
      next: () => {
        this.busy.set(false);
        this.suspending.set(false);
        this.suspendReason.set('');
        this.toast.success(this.transloco.translate('admin.communities.suspendedDone'));
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.toast.error(this.transloco.translate('admin.communities.deleteError'));
      },
    });
  }

  protected unsuspend(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.admin.unsuspendCommunity(this.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(this.transloco.translate('admin.communities.unsuspendedDone'));
        this.load();
      },
      error: () => {
        this.busy.set(false);
        this.toast.error(this.transloco.translate('admin.communities.deleteError'));
      },
    });
  }

  protected saveSlug(community: AdminCommunityDetail): void {
    const slug = this.slugDraft().trim().toLowerCase();
    if (!slug || slug === community.slug || this.savingSlug()) return;
    this.confirmingSlug.set(false);
    this.savingSlug.set(true);
    this.admin.renameCommunitySlug(this.id, slug).subscribe({
      next: () => {
        this.savingSlug.set(false);
        this.toast.success(this.transloco.translate('admin.communities.slug.saved'));
        this.load();
      },
      error: (err: { status?: number }) => {
        this.savingSlug.set(false);
        this.toast.error(
          this.transloco.translate(
            err.status === 409 ? 'admin.communities.slug.problem.taken' : 'admin.communities.slug.problem.invalid',
          ),
        );
      },
    });
  }

  private load(): void {
    this.admin.getCommunity(this.id).subscribe({
      next: (community) => {
        this.community.set(community);
        this.slugDraft.set(community.slug);
        this.loading.set(false);
      },
      error: () => {
        this.missing.set(true);
        this.loading.set(false);
      },
    });
  }
}
