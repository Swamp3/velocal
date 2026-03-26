import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { QuillEditorComponent } from 'ngx-quill';
import { PostService } from '@core/services/post.service';
import { CreatePostDto, Post, PostStatus } from '@shared/models';
import { ButtonComponent, InputComponent, ToastService } from '@shared/ui';

@Component({
  selector: 'app-news-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
    QuillEditorComponent,
    ButtonComponent,
    InputComponent,
  ],
  templateUrl: './news-form.component.html',
})
export class NewsFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly postService = inject(PostService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);

  protected readonly existingPost = signal<Post | null>(null);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);

  protected readonly isEdit = computed(() => this.existingPost() !== null);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(300)]],
    body: ['', [Validators.required, Validators.minLength(1)]],
    tags: [''],
    eventId: [''],
    status: ['published' as PostStatus],
    isPinned: [false],
  });

  protected readonly quillModules = {
    toolbar: [
      [{ header: [2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['blockquote', 'link'],
      ['clean'],
    ],
  };

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      this.loading.set(true);
      this.postService.getPost(slug).subscribe({
        next: (post) => {
          this.existingPost.set(post);
          this.form.patchValue({
            title: post.title,
            body: post.body,
            tags: post.tags.join(', '),
            eventId: post.event?.id ?? '',
            status: post.status,
            isPinned: post.isPinned,
          });
          this.loading.set(false);
        },
        error: () => {
          this.router.navigate(['/news']);
        },
      });
    }
  }

  protected onSubmit(): void {
    if (this.form.invalid) return;

    this.submitting.set(true);
    const val = this.form.getRawValue();

    const dto: CreatePostDto = {
      title: val.title,
      body: val.body,
      status: val.status,
      isPinned: val.isPinned,
      tags: val.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
      eventId: val.eventId || undefined,
    };

    const existing = this.existingPost();
    const request = existing
      ? this.postService.updatePost(existing.id, dto)
      : this.postService.createPost(dto);

    request.subscribe({
      next: (post) => {
        this.toast.success(this.transloco.translate('news.form.submit'));
        this.router.navigate(['/news', post.slug]);
      },
      error: () => {
        this.submitting.set(false);
      },
    });
  }

  protected saveDraft(): void {
    this.form.patchValue({ status: 'draft' });
    this.onSubmit();
  }
}
