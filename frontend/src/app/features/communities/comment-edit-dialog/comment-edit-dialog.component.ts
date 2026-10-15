import { ChangeDetectionStrategy, Component, input, OnInit, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { RichTextComponent } from '@shared/components';
import { plainText } from '@shared/components/rich-text/rich-text';
import { ButtonComponent, ModalComponent } from '@shared/ui';

/** Dialog to edit the text of a comment. The parent saves it and closes the dialog. */
@Component({
  selector: 'app-comment-edit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe, ModalComponent, ButtonComponent, RichTextComponent],
  template: `
    <ui-modal [title]="'communities.posts.editComment' | transloco" (closed)="closed.emit()">
      <app-rich-text [formControl]="body" [compact]="true" />
      <ng-container footer>
        <ui-button type="button" variant="ghost" (click)="closed.emit()">
          {{ 'common.cancel' | transloco }}
        </ui-button>
        <ui-button
          type="button"
          [loading]="saving()"
          [disabled]="saving() || !canSave()"
          (click)="save()"
        >
          {{ 'common.save' | transloco }}
        </ui-button>
      </ng-container>
    </ui-modal>
  `,
})
export class CommentEditDialogComponent implements OnInit {
  readonly initial = input.required<string>();
  readonly saving = input(false);
  readonly saved = output<string>();
  readonly closed = output<void>();

  protected readonly body = new FormControl('', { nonNullable: true });

  ngOnInit(): void {
    this.body.setValue(this.initial());
  }

  protected canSave(): boolean {
    return !!plainText(this.body.value);
  }

  protected save(): void {
    if (this.canSave()) this.saved.emit(this.body.value);
  }
}
