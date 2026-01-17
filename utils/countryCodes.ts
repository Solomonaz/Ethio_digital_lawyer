// Country codes with phone number validation patterns
export interface CountryCode {
  code: string;
  dialCode: string;
  name: string;
  flag: string;
  minLength: number;
  maxLength: number;
  pattern: RegExp;
}

export const countryCodes: CountryCode[] = [
  { code: 'ET', dialCode: '+251', name: 'Ethiopia', flag: '🇪🇹', minLength: 9, maxLength: 9, pattern: /^[0-9]{9}$/ },
  { code: 'FR', dialCode: '+33', name: 'France', flag: '🇫🇷', minLength: 9, maxLength: 9, pattern: /^[0-9]{9}$/ },
  { code: 'DE', dialCode: '+49', name: 'Germany', flag: '🇩🇪', minLength: 10, maxLength: 11, pattern: /^[0-9]{10,11}$/ },
  { code: 'SE', dialCode: '+46', name: 'Sweden', flag: '🇸🇪', minLength: 9, maxLength: 9, pattern: /^[0-9]{9}$/ },
  { code: 'GB', dialCode: '+44', name: 'United Kingdom', flag: '🇬🇧', minLength: 10, maxLength: 10, pattern: /^[0-9]{10}$/ },
  { code: 'US', dialCode: '+1', name: 'United States', flag: '🇺🇸', minLength: 10, maxLength: 10, pattern: /^[0-9]{10}$/ },
];

export const getCountryByCode = (code: string): CountryCode | undefined => {
  return countryCodes.find(c => c.code === code);
};

export const validatePhoneNumber = (phone: string, country: CountryCode): boolean => {
  // Remove any non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  // Remove country code if present
  const withoutCode = cleaned.replace(country.dialCode.replace('+', ''), '');
  return country.pattern.test(withoutCode) && 
         withoutCode.length >= country.minLength && 
         withoutCode.length <= country.maxLength;
};

