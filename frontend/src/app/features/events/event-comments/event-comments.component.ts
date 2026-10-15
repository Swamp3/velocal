import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ApiError } from '@core/services/api.service';
import { EventComment, EventHostContext, EventService } from '@core/services/event.service';
import { RichTextComponent } from '@shared/components/rich-text/rich-text.component';
import { RichTextViewComponent } from '@shared/components/rich-text/rich-text-view.component';
import { plainText } from '@shared/components/rich-text/rich-text';
import { ButtonComponent, ToastService } from '@shared/ui';

@Component({
  selector: 'app-event-comments',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TranslocoPipe,
    RichTextComponent,
    RichTextViewComponent,
    ButtonComponent,
  ],
  templateUrl: './event-comments.component.html',
})
export class EventCommentsComponent implements OnInit {
  private readonly events = inject(EventService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  readonly eventId = input.required<string>();
  readonly hostContext = input<EventHostContext>();

  protected readonly comments = signal<EventComment[]>([]);
  protected readonly submitting = signal(false);
  protected readonly form = new FormGroup({
    body: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.events.listComments(this.eventId(), this.hostContext()).subscribe({
      next: (comments) => this.comments.set(comments),
    });
  }

  protected publish(): void {
    const body = this.form.controls.body.value;
    if (!plainText(body) || this.submitting()) return;
    this.submitting.set(true);
    this.events.addComment(this.eventId(), body, this.hostContext()).subscribe({
      next: (comment) => {
        this.comments.update((comments) => [...comments, comment]);
        this.form.reset();
        this.submitting.set(false);
      },
      error: (err: ApiError) => {
        this.submitting.set(false);
        if (err.status === 422) {
          this.toast.error(this.transloco.translate('validation.badWord'));
          return;
        }
        this.toast.error(this.transloco.translate('events.comments.error'));
      },
    });
  }

  protected remove(comment: EventComment): void {
    if (!confirm(this.transloco.translate('events.comments.deleteConfirm'))) return;
    this.events.deleteComment(this.eventId(), comment.id, this.hostContext()).subscribe({
      next: () => {
        this.comments.update((comments) => comments.filter((item) => item.id !== comment.id));
      },
    });
  }

  protected authorName(name: string | null): string {
    return name ?? this.transloco.translate('communities.members.unnamed');
  }
}
