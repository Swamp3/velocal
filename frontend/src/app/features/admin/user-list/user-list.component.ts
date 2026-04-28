import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminService,
  AdminUser,
  AdminUserSearchParams,
} from '@core/services/admin.service';
import { AuthService } from '@core/services/auth.service';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  BadgeComponent,
  ButtonComponent,
  PaginationComponent,
  SkeletonComponent,
  ToastService,
} from '@shared/ui';

@Component({
  selector: 'app-user-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoPipe,
    BadgeComponent,
    ButtonComponent,
    PaginationComponent,
    SkeletonComponent,
    DatePipe,
    FormsModule,
  ],
  templateUrl: './user-list.component.html',
})
export class UserListComponent implements OnInit {
  private readonly admin = inject(AdminService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly page = signal(1);
  protected readonly limit = signal(20);
  protected readonly searchQuery = signal('');
  protected readonly roleFilter = signal<'all' | 'admin' | 'user'>('all');
  protected readonly togglingId = signal<string | null>(null);
  protected readonly confirmingId = signal<string | null>(null);

  protected readonly currentUserId = computed(() => this.auth.currentUser()?.id);

  ngOnInit(): void {
    this.loadUsers();
  }

  protected onSearch(q: string): void {
    this.searchQuery.set(q);
    this.page.set(1);
    this.loadUsers();
  }

  protected onRoleFilter(role: 'all' | 'admin' | 'user'): void {
    this.roleFilter.set(role);
    this.page.set(1);
    this.loadUsers();
  }

  protected onPageChange(p: number): void {
    this.page.set(p);
    this.loadUsers();
  }

  protected requestToggleRole(user: AdminUser): void {
    this.confirmingId.set(user.id);
  }

  protected cancelToggle(): void {
    this.confirmingId.set(null);
  }

  protected confirmToggleRole(user: AdminUser): void {
    this.confirmingId.set(null);
    this.togglingId.set(user.id);

    this.admin.toggleUserRole(user.id).subscribe({
      next: (updated) => {
        this.users.update((list) =>
          list.map((u) => (u.id === updated.id ? updated : u)),
        );
        this.togglingId.set(null);
        const name = updated.displayName || updated.email;
        this.toast.success(
          updated.isAdmin
            ? `${name} is now an admin`
            : `${name} is no longer an admin`,
        );
      },
      error: () => {
        this.togglingId.set(null);
      },
    });
  }

  private loadUsers(): void {
    const params: AdminUserSearchParams = {
      page: this.page(),
      limit: this.limit(),
    };

    const q = this.searchQuery();
    if (q) params.q = q;

    const role = this.roleFilter();
    if (role !== 'all') params.role = role;

    this.admin.getUsers(params).subscribe({
      next: (res) => {
        this.users.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
