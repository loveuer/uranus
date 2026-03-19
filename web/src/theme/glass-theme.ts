import { createTheme } from '@mui/material/styles'

// Glassmorphism design tokens and theme overrides

const glassTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#11998e',
      light: '#38ef7d',
      dark: '#0d7a6e',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#38ef7d',
      light: '#6aff9e',
      dark: '#2bc46a',
    },
    background: {
      default: '#f5f7fa',
      paper: 'rgba(255,255,255,0.72)', // glass surface
    },
  },
  shape: {
    // Base radius for rounded components
    borderRadius: 12,
  },
  typography: {
    // Global font fallbacks aligned with design spec
    fontFamily: ['Poppins', 'Arial', 'Noto Sans', 'sans-serif'].join(','),
    h1: { fontFamily: 'Merriweather, Georgia, serif' },
    h2: { fontFamily: 'Merriweather, Georgia, serif' },
    h3: { fontFamily: 'Merriweather, Georgia, serif' },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255,255,255,0.6)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.6)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.6)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        contained: {
          borderRadius: 12,
          paddingLeft: 16,
          paddingRight: 16,
          background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
          color: '#fff',
          boxShadow: '0 6px 20px rgba(0,0,0,.15)',
          '&:hover': {
            background: 'linear-gradient(135deg, #0d7a6e 0%, #2bc46a 100%)',
            boxShadow: '0 8px 24px rgba(0,0,0,.18)',
          },
        },
        // Ghost/outlined also get a subtle glass feel if used
        containedSecondary: {
          borderRadius: 12,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    // DataGrid styling will be applied via sx on usage to maintain compatibility
    MuiTypography: {
      styleOverrides: {
        root: {
          // Use body font as default, headings already mapped in typography
        },
      },
    },
  },
})

export default glassTheme
