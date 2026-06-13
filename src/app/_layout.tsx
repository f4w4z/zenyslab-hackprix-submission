import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { useFonts } from 'expo-font';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf',
    'Inter-Medium': 'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa2boKoduKmMEVuI6fMZhrib2Bg-4.ttf',
    'Inter-SemiBold': 'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1XoKoduKmMEVuI6fMZhrib2Bg-4.ttf',
    'Inter-Bold': 'https://fonts.gstatic.com/s/inter/v18/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1poKoduKmMEVuI6fMZhrib2Bg-4.ttf',
    'InstrumentSerif-Regular': 'https://fonts.gstatic.com/s/instrumentserif/v3/pxiGyp84nq_I19dO_F26P9b1P6_6z72q3l8W.ttf',
    'InstrumentSerif-Italic': 'https://fonts.gstatic.com/s/instrumentserif/v3/pxiEyp84nq_I19dO_F26P9b1P6_6z72q3l8W813B.ttf',
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}
