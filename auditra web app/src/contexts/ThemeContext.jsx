import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline, useMediaQuery } from '@mui/material';
import createAppTheme from '../theme';
import axiosClient from '../api/axiosClient';

const ThemeContext = createContext();

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemeMode must be used within ThemeProvider');
  return context;
}

function resolveMode(preference) {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

export default function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(() => {
    try {
      return localStorage.getItem('auditra-theme-mode') || 'system';
    } catch {
      return 'system';
    }
  });

  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const mode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  const toggleTheme = useCallback(() => {
    setPreference((prev) => {
      const next = prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light';
      try { localStorage.setItem('auditra-theme-mode', next); } catch {}
      // Persist to server (best-effort)
      try {
        axiosClient.patch('/auth/profile/me/', { theme_preference: next }).catch(() => {});
      } catch {}
      return next;
    });
  }, []);

  const setThemePreference = useCallback((next) => {
    if (!['light', 'dark', 'system'].includes(next)) return;
    setPreference(next);
    try { localStorage.setItem('auditra-theme-mode', next); } catch {}
    // Persist to server (best-effort)
    try {
      axiosClient.patch('/auth/profile/me/', { theme_preference: next }).catch(() => {});
    } catch {}
  }, []);

  /** Called on login with the server-stored preference */
  const applyServerTheme = useCallback((serverPref) => {
    if (serverPref && ['light', 'dark', 'system'].includes(serverPref)) {
      setPreference(serverPref);
      try { localStorage.setItem('auditra-theme-mode', serverPref); } catch {}
    }
  }, []);

  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, preference, toggleTheme, setThemePreference, applyServerTheme }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}
