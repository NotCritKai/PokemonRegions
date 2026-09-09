/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useAppAppearance } from '@/hooks/use-app-appearance';

export function useTheme() {
  return Colors[useAppAppearance().colorScheme];
}
