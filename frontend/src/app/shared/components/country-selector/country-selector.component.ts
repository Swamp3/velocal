import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  forwardRef,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

const COUNTRY_CODES = [
  'AT', 'BE', 'BG', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT',
  'LU', 'LV', 'MC', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT',
  'RO', 'RS', 'SE', 'SI', 'SK', 'TR', 'UA',
] as const;

interface CountryOption {
  code: string;
  name: string;
}

function buildCountryList(): CountryOption[] {
  const dn = new Intl.DisplayNames(['en'], { type: 'region' });
  return COUNTRY_CODES.map((code) => ({
    code,
    name: dn.of(code) ?? code,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

@Component({
  selector: 'app-country-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CountrySelectorComponent),
      multi: true,
    },
  ],
  templateUrl: './country-selector.component.html',
})
export class CountrySelectorComponent implements ControlValueAccessor {
  private readonly countries = buildCountryList();

  protected readonly search = signal('');
  protected readonly open = signal(false);
  protected readonly selectedCode = signal('');
  protected readonly isDisabled = signal(false);
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly filteredCountries = computed(() => {
    const term = this.search().toLowerCase();
    if (!term) return this.countries;
    return this.countries.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term),
    );
  });

  protected readonly displayValue = computed(() => {
    const code = this.selectedCode();
    if (!code) return '';
    const match = this.countries.find((c) => c.code === code);
    return match ? `${match.name} (${match.code})` : code;
  });

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(val: string): void {
    this.selectedCode.set(val ?? '');
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.isDisabled.set(disabled);
  }

  protected onFocus(): void {
    this.search.set('');
    this.open.set(true);
  }

  protected onBlur(): void {
    this.onTouched();
    setTimeout(() => this.open.set(false), 200);
  }

  protected onSearchInput(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.open.set(true);
  }

  protected selectCountry(country: CountryOption): void {
    this.selectedCode.set(country.code);
    this.search.set('');
    this.open.set(false);
    this.onChange(country.code);
    this.inputEl()?.nativeElement.blur();
  }

  protected clear(): void {
    this.selectedCode.set('');
    this.search.set('');
    this.onChange('');
  }
}
