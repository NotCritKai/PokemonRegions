import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AppearanceProvider, useAppAppearance } from '@/hooks/use-app-appearance';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  return (
    <AppearanceProvider>
      <ThemedRouter />
    </AppearanceProvider>
  );
}

function ThemedRouter() {
  const { colorScheme } = useAppAppearance();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AppTabs />
    </ThemeProvider>
  );
}
