import { BrowserRouter } from 'react-router-dom'
import { CssBaseline, ThemeProvider } from '@mui/material'
import glassTheme from './theme/glass-theme'
import { AuthProvider } from './store/auth'
import AppRoutes from './components/AppRoutes'

// Glass theme is provided by glass-theme.ts
export default function App() {
  return (
    <ThemeProvider theme={glassTheme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}
