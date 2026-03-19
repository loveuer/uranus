import { useEffect, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Alert,
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Button, Chip, Grid,
  FormControl, InputLabel, Select, MenuItem, IconButton,
  Tooltip, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import RefreshIcon from '@mui/icons-material/Refresh'
import DeleteIcon from '@mui/icons-material/Delete'
import StorageIcon from '@mui/icons-material/Storage'
import DownloadIcon from '@mui/icons-material/Download'
import InfoIcon from '@mui/icons-material/Info'
import { alpineApi } from '../api'
import type { AlpinePackage, AlpineCacheStats } from '../types'

const BRANCHES = ['v3.23', 'v3.22', 'v3.21', 'v3.20', 'edge']
const REPOS = ['main', 'community']
const ARCHS = ['x86_64', 'aarch64', 'armv7', 'x86']

export default function AlpinePage() {
  const [packages, setPackages] = useState<AlpinePackage[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<AlpineCacheStats | null>(null)

  const [branch, setBranch] = useState('v3.19')
  const [repo, setRepo] = useState('main')
  const [arch, setArch] = useState('x86_64')

  const [selectedPackage, setSelectedPackage] = useState<AlpinePackage | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadStats = async () => {
    try {
      const res = await alpineApi.getStats()
      setStats(res.data.data)
    } catch {
      // ignore
    }
  }

  const loadPackages = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await alpineApi.listPackages(branch, repo, arch)
      setPackages(res.data.data || [])
    } catch {
      setError('Failed to load packages')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!search.trim()) {
      loadPackages()
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await alpineApi.searchPackages(search, branch, repo, arch)
      setPackages(res.data.data || [])
    } catch {
      setError('Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    try {
      await alpineApi.sync(branch, repo, arch)
      setError('')
      alert('Sync started')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Sync failed')
    }
  }

  const handleCleanCache = async () => {
    if (!confirm('Are you sure you want to clean all Alpine cache?')) return
    try {
      await alpineApi.cleanCache()
      loadStats()
      loadPackages()
      alert('Cache cleaned')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Clean failed')
    }
  }

  const handleShowDetail = (pkg: AlpinePackage) => {
    setSelectedPackage(pkg)
    setDetailOpen(true)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  useEffect(() => {
    loadStats()
    loadPackages()
  }, [branch, repo, arch])

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Alpine APK Repository</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ backgroundColor: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.8)' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <StorageIcon color="primary" />
                <Typography color="textSecondary">Indexes</Typography>
              </Box>
              <Typography variant="h4">{stats?.TotalIndexes || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ backgroundColor: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.8)' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <DownloadIcon color="primary" />
                <Typography color="textSecondary">Packages</Typography>
              </Box>
              <Typography variant="h4">{stats?.TotalPackages?.toLocaleString() || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ backgroundColor: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.8)' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <StorageIcon color="success" />
                <Typography color="textSecondary">Cached</Typography>
              </Box>
              <Typography variant="h4">{stats?.CachedPackages?.toLocaleString() || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ backgroundColor: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.8)' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <StorageIcon color="info" />
                <Typography color="textSecondary">Cache Size</Typography>
              </Box>
              <Typography variant="h4">{formatSize(stats?.CacheSize || 0)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Usage Info */}
      <Paper sx={{ p: 2, mb: 2, backgroundColor: 'rgba(17, 153, 142, 0.1)', border: '1px solid rgba(17, 153, 142, 0.2)' }}>
        <Box display="flex" alignItems="flex-start" gap={1}>
          <InfoIcon sx={{ mt: 0.5, color: '#11998e' }} />
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
              Docker 中使用 Alpine 代理
            </Typography>
            <Typography variant="body2" component="div">
              在 Dockerfile 或 docker run 中替换 Alpine 源：
              <Box
                component="pre"
                sx={{
                  mt: 1,
                  p: 1.5,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  fontSize: '0.85rem',
                  overflow: 'auto',
                }}
              >
{`# 方法1: Dockerfile 中替换
FROM alpine:3.23
RUN echo 'http://<your-uranus-host>:9817/alpine/v3.23/main' > /etc/apk/repositories \\
    && echo 'http://<your-uranus-host>:9817/alpine/v3.23/community' >> /etc/apk/repositories \\
    && apk update \\
    && apk add --no-cache nodejs npm

# 方法2: docker run 时替换
 docker run --rm alpine:3.23 sh -c "
   echo 'http://<your-uranus-host>:9817/alpine/v3.23/main' > /etc/apk/repositories
   echo 'http://<your-uranus-host>:9817/alpine/v3.23/community' >> /etc/apk/repositories
   apk update && apk add --no-cache curl wget
 "

# 方法3: 使用 docker-compose
services:
  app:
    image: alpine:3.23
    command: sh -c "apk update && apk add nodejs && node -v"
    volumes:
      - ./alpine-repositories:/etc/apk/repositories:ro`}
              </Box>
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Branch</InputLabel>
              <Select value={branch} label="Branch" onChange={(e) => setBranch(e.target.value)}>
                {BRANCHES.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Repository</InputLabel>
              <Select value={repo} label="Repository" onChange={(e) => setRepo(e.target.value)}>
                {REPOS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Architecture</InputLabel>
              <Select value={arch} label="Architecture" onChange={(e) => setArch(e.target.value)}>
                {ARCHS.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search packages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              InputProps={{
                endAdornment: (
                  <IconButton onClick={handleSearch} size="small">
                    <SearchIcon />
                  </IconButton>
                ),
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Box display="flex" gap={1}>
              <Tooltip title="Sync Index">
                <IconButton onClick={handleSync} color="primary">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Clean Cache">
                <IconButton onClick={handleCleanCache} color="error">
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Packages Table */}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Size</TableCell>
              <TableCell>License</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : packages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No packages found
                </TableCell>
              </TableRow>
            ) : (
              packages.slice(0, 100).map((pkg) => (
                <TableRow key={pkg.Name} hover>
                  <TableCell>
                    <Typography fontWeight="medium">{pkg.Name}</Typography>
                  </TableCell>
                  <TableCell>{pkg.Version}</TableCell>
                  <TableCell>
                    <Typography noWrap sx={{ maxWidth: 300 }} title={pkg.Description}>
                      {pkg.Description}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatSize(pkg.Size)}</TableCell>
                  <TableCell>
                    <Chip label={pkg.License} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Button size="small" onClick={() => handleShowDetail(pkg)}>
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {packages.length > 100 && (
        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
          Showing first 100 of {packages.length} packages. Use search to filter.
        </Typography>
      )}

      {/* Package Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Package Details</DialogTitle>
        <DialogContent>
          {selectedPackage && (
            <Box sx={{ pt: 1 }}>
              <Typography variant="h6">{selectedPackage.Name}</Typography>
              <Typography color="textSecondary" gutterBottom>
                {selectedPackage.Description}
              </Typography>

              <Grid container spacing={2} sx={{ mt: 2 }}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="textSecondary">Version</Typography>
                  <Typography>{selectedPackage.Version}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="textSecondary">Architecture</Typography>
                  <Typography>{selectedPackage.Architecture}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="textSecondary">Size</Typography>
                  <Typography>{formatSize(selectedPackage.Size)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="textSecondary">Installed Size</Typography>
                  <Typography>{formatSize(selectedPackage.InstalledSize)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="textSecondary">License</Typography>
                  <Typography>{selectedPackage.License}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="textSecondary">Origin</Typography>
                  <Typography>{selectedPackage.Origin}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="textSecondary">Maintainer</Typography>
                  <Typography>{selectedPackage.Maintainer}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="textSecondary">URL</Typography>
                  <Typography>
                    <a href={selectedPackage.URL} target="_blank" rel="noopener noreferrer">
                      {selectedPackage.URL}
                    </a>
                  </Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="body2" color="textSecondary">Checksum</Typography>
                  <Typography variant="caption" sx={{ wordBreak: 'break-all' }}>
                    {selectedPackage.Checksum}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
