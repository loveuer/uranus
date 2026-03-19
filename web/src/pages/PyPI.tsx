import { useEffect, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Alert,
  CircularProgress, Paper, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Button, TextField, Chip, Link, Grid, Dialog,
  DialogTitle, DialogContent, DialogActions, IconButton, Tooltip,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import StorageIcon from '@mui/icons-material/Storage'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { pypiApi } from '../api'
import type { PyPIPackage } from '../types'

export default function PyPIPage() {
  const [packages, setPackages] = useState<PyPIPackage[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(20)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stats, setStats] = useState<any>(null)
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; version?: string } | null>(null)
  
  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [uploadError, setUploadError] = useState('')

  const loadPackages = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await pypiApi.listPackages(page + 1, rowsPerPage)
      setPackages(res.data.data?.packages || [])
      setTotal(res.data.data?.total || 0)
    } catch {
      setError('Failed to load packages')
    } finally {
      setLoading(false)
    }
  }
  
  const loadStats = async () => {
    try {
      const res = await pypiApi.getStats()
      setStats(res.data.data)
    } catch {
      // Ignore stats error
    }
  }

  useEffect(() => {
    loadPackages()
    loadStats()
  }, [page, rowsPerPage])

  const handleSearch = () => {
    setPage(0)
    loadPackages()
  }
  
  const handleDeleteClick = (name: string, version?: string) => {
    setDeleteTarget({ name, version })
    setDeleteDialogOpen(true)
  }
  
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    
    try {
      if (deleteTarget.version) {
        await pypiApi.deleteVersion(deleteTarget.name, deleteTarget.version)
      } else {
        await pypiApi.deletePackage(deleteTarget.name)
      }
      setDeleteDialogOpen(false)
      setDeleteTarget(null)
      loadPackages()
      loadStats()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete')
    }
  }
  
  const handleCleanCache = async () => {
    try {
      await pypiApi.cleanCache()
      loadStats()
      loadPackages()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to clean cache')
    }
  }
  
  const handleUploadClick = () => {
    setUploadDialogOpen(true)
  }
  
  const handleUploadConfirm = async () => {
    if (!uploadFile) return
    
    setUploading(true)
    setUploadError('')
    setUploadSuccess('')
    
    const formData = new FormData()
    formData.append('content', uploadFile)
    
    try {
      // Note: This requires implementing the actual upload endpoint
      // For now, just show a message
      setUploadSuccess('Upload functionality requires backend implementation')
      // In production: await http.post('/legacy/', formData)
    } catch (err: any) {
      setUploadError(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        PyPI Repository
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <StorageIcon color="primary" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Packages</Typography>
                    <Typography variant="h5">{stats.package_count || 0}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <StorageIcon color="info" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Versions</Typography>
                    <Typography variant="h5">{stats.version_count || 0}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <StorageIcon color="success" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Files</Typography>
                    <Typography variant="h5">{stats.file_count || 0}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1}>
                  <StorageIcon color="warning" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Size</Typography>
                    <Typography variant="h5">{((stats.total_size || 0) / 1024 / 1024).toFixed(2)} MB</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              size="small"
              label="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search packages..."
              sx={{ minWidth: 200 }}
            />
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
            >
              Search
            </Button>
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="Upload Package">
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={handleUploadClick}
              >
                Upload
              </Button>
            </Tooltip>
            <Tooltip title="Clean Cache">
              <IconButton onClick={handleCleanCache} color="warning">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      <Paper sx={{ width: '100%', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.8)' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Summary</TableCell>
                    <TableCell>Versions</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {packages.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No packages found
                      </TableCell>
                    </TableRow>
                  ) : (
                    packages.map((pkg) => (
                      <TableRow key={pkg.id} hover>
                        <TableCell>
                          <Link href={`/simple/${pkg.name}/`} target="_blank" rel="noopener">
                            {pkg.name}
                          </Link>
                        </TableCell>
                        <TableCell>{pkg.summary || '-'}</TableCell>
                        <TableCell>
                          {pkg.versions && pkg.versions.length > 0 ? (
                            <Chip 
                              label={`${pkg.versions.length} version${pkg.versions.length > 1 ? 's' : ''}`} 
                              size="small" 
                              variant="outlined"
                            />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {pkg.is_uploaded ? (
                            <Chip label="Uploaded" size="small" color="primary" />
                          ) : (
                            <Chip label="Cached" size="small" color="default" />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Delete Package">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => handleDeleteClick(pkg.name)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={total}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10))
                setPage(0)
              }}
              rowsPerPageOptions={[10, 20, 50]}
            />
          </>
        )}
      </Paper>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <Typography>
            {deleteTarget?.version 
              ? `Are you sure you want to delete version "${deleteTarget.version}" of package "${deleteTarget.name}"?`
              : `Are you sure you want to delete the entire package "${deleteTarget?.name}" and all its versions?`
            }
          </Typography>
          <Typography color="error" sx={{ mt: 2 }}>
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)}>
        <DialogTitle>Upload Package</DialogTitle>
        <DialogContent>
          {uploadSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>{uploadSuccess}</Alert>
          )}
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>{uploadError}</Alert>
          )}
          <input
            accept=".whl,.tar.gz,.zip"
            type="file"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            style={{ marginTop: 16 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Supported formats: .whl, .tar.gz, .zip
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleUploadConfirm} 
            variant="contained"
            disabled={!uploadFile || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
