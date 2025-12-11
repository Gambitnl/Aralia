import en from '../locales/en.json';

type LocaleData = Record<string, any>;

const locales: Record<string, LocaleData> = {
  en,
};

let currentLocale = 'en';

export const t = (key: string, params?: Record<string, string | number>): string => {
  const keys = key.split('.');
  let value: any = locales[currentLocale];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key if not found
    }
  }

  if (typeof value !== 'string') {
      return key;
  }

  if (params) {
    return value.replace(/{(\w+)}/g, (_, k) => {
      return params[k] !== undefined ? String(params[k]) : `{${k}}`;
    });
  }

  return value;
};
