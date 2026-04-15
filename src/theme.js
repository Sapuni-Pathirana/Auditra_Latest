import { createTheme, alpha } from '@mui/material/styles';

const lightPalette = {
  mode: 'light',
  primary: {
    main: '#1565C0',
    dark: '#0D47A1',
    light: '#42A5F5',
  },
  secondary: {
    main: '#60A5FA',
  },
  background: {
    default: '#F0F4F8',
    paper: '#FFFFFF',
  },
  text: {
    primary: '#0F172A',
    secondary: '#64748B',
  },
  divider: '#E2E8F0',
  success: {
    main: '#1565C0',
  },
  warning: {
    main: '#1E88E5',
  },
  error: {
    main: '#DC2626',
  },
  info: {
    main: '#2563EB',
  },
  custom: {
    sidebar: '#FFFFFF',
    sidebarAccent: '#1565C0',
    sidebarText: '#64748B',
    sidebarTextActive: '#0F172A',
    sidebarHover: 'rgba(21,101,192,0.06)',
    sidebarActive: 'rgba(21,101,192,0.1)',
    sidebarDivider: '#E2E8F0',
    sidebarBrand: '#0F172A',
    sidebarSubtitle: '#94A3B8',
    sidebarAvatarBg: 'rgba(21,101,192,0.08)',
    sidebarAvatarBorder: 'rgba(21,101,192,0.2)',
    sidebarLogout: '#DC2626',
    sidebarLogoutHover: 'rgba(220,38,38,0.08)',
    sidebarCollapseText: '#94A3B8',
    tableHeader: '#F1F5F9',
    cardInner: '#F8FAFC',
    appBar: '#FFFFFF',
    appBarBorder: '#E2E8F0',
    appBarText: '#0F172A',
  },
};

const darkPalette = {
  mode: 'dark',
  primary: {
    main: '#3B82F6',
    dark: '#1D4ED8',
    light: '#60A5FA',
  },
  secondary: {
    main: '#60A5FA',
  },
  background: {
    default: '#0F172A',
    paper: '#1E293B',
  },
  text: {
    primary: '#F1F5F9',
    secondary: '#94A3B8',
  },
  divider: '#334155',
  success: {
    main: '#42A5F5',
  },
  warning: {
    main: '#64B5F6',
  },
  error: {
    main: '#EF4444',
  },
  info: {
    main: '#3B82F6',
  },
  custom: {
    sidebar: '#0F172A',
    sidebarAccent: '#60A5FA',
    sidebarText: 'rgba(255,255,255,0.6)',
    sidebarTextActive: '#FFFFFF',
    sidebarHover: 'rgba(96,165,250,0.1)',
    sidebarActive: 'rgba(96,165,250,0.18)',
    sidebarDivider: 'rgba(255,255,255,0.08)',
    sidebarBrand: '#FFFFFF',
    sidebarSubtitle: 'rgba(255,255,255,0.4)',
    sidebarAvatarBg: 'rgba(96,165,250,0.15)',
    sidebarAvatarBorder: 'rgba(96,165,250,0.3)',
    sidebarLogout: '#EF4444',
    sidebarLogoutHover: 'rgba(239,68,68,0.15)',
    sidebarCollapseText: 'rgba(255,255,255,0.5)',
    tableHeader: '#1E293B',
    cardInner: '#1E293B',
    appBar: '#1E293B',
    appBarBorder: '#334155',
    appBarText: '#F1F5F9',
  },
};

export default function createAppTheme(mode = 'light') {
  const palette = mode === 'dark' ? darkPalette : lightPalette;

  return createTheme({
    palette,
    typography: {
      fontFamily: '"Inter", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            transition: 'background-color 0.3s ease, color 0.3s ease',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            fontWeight: 600,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: mode === 'light'
              ? '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'
              : '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
            border: mode === 'dark' ? '1px solid #334155' : 'none',
            transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: palette.custom.sidebar,
            color: palette.custom.sidebarTextActive,
            borderRight: mode === 'light' ? `1px solid ${palette.custom.sidebarDivider}` : 'none',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: palette.custom.appBar,
            color: palette.custom.appBarText,
            borderBottom: `1px solid ${palette.custom.appBarBorder}`,
            boxShadow: 'none',
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            '& .MuiTableCell-head': {
              backgroundColor: palette.custom.tableHeader,
              fontWeight: 600,
              color: palette.text.secondary,
              borderBottom: `2px solid ${palette.divider}`,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${palette.divider}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            borderRadius: 8,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            border: mode === 'dark' ? '1px solid #334155' : 'none',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
        },
      },
    },
  });
}
