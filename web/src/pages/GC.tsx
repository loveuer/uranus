import { useEffect, useState } from 'react'
import {
  Box, Card, CardContent, Typography, Alert, Button, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, IconButton, Tooltip, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Tabs, Tab, Paper, Grid,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import RestoreIcon from '@mui/icons-material/Restore'
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep'
import { gcApi } from '../api'
import type { GcStatus, GcCandidate, GcResult, GcUnreferencedBlobs } from '../types'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  )
}

export default function GCPage() {
  const [tab, setTab] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Status tab
  const [gcStatus, setGcStatus] = useState<GcStatus[]>([])
  const [autoGcRunning, setAutoGcRunning] = useState(false)

  // Candidates tab
  const [candidates, setCandidates] = useState<GcCandidate[]>([])

  // Unreferenced tab
  const [unreferenced, setUnreferenced] = useState<GcUnreferencedBlobs | null>(null)

  // Dialogs
  const [runDialogOpen, setRunDialogOpen] = useState(false)
  const [dryRunResult, setDryRunResult] = useState<GcResult | null>(null)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState<number | null>(null)
  const [runningGc, setRunningGc] = useState(false)

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString()
  }

  const loadStatus = async () => {
    try {
      const [statusRes, autoRes] = await Promise.all([
        gcApi.getStatus(),
        gcApi.getAutoStatus(),
      ])
      setGcStatus(statusRes.data.data || [])
      setAutoGcRunning(autoRes.data.data?.running || false)
    } catch {
      // ignore
    }
  }

  const loadCandidates = async () => {
    try {
      const res = await gcApi.getCandidates()
      setCandidates(res.data.data || [])
    } catch {
      // ignore
    }
  }

  const loadUnreferenced = async () => {
    try {
      const res = await gcApi.getUnreferenced()
      setUnreferenced(res.data.data)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadData = () => {
    setLoading(true)
    Promise.all([loadStatus(), loadCandidates(), loadUnreferenced()]).finally(() => {
      setLoading(false)
    })
  }

  const handleDryRun = async () => {
    setRunningGc(true)
    setError('')
    try {
      const res = await gcApi.dryRun()
      setDryRunResult(res.data.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Dry run failed')
    } finally {
      setRunningGc(false)
    }
  }

  const handleRunGC = async () => {
    setRunningGc(true)
    setError('')
    try {
      const res = await gcApi.runWithDetail()
      const result = res.data.data
      setSuccess(`GC completed: ${result.deleted_count} blobs deleted, ${formatBytes(result.freed_size)} freed`)
      setDryRunResult(null)
      loadData()
    } catch (err: any) {
      setError(err.response?.data?.error || 'GC failed')
    } finally {
      setRunningGc(false)
      setRunDialogOpen(false)
    }
  }

  const handleRestore = async (id: number) => {
    try {
      await gcApi.restore(id)
      setSuccess('Blob restored successfully')
      loadCandidates()
      loadUnreferenced()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Restore failed')
    }
    setRestoreDialogOpen(null)
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'running':
        return <Chip size="small" color="info" label="Running" />
      case 'completed':
        return <Chip size="small" color="success" label="Completed" />
      case 'failed':
        return <Chip size="small" color="error" label="Failed" />
      default:
        return <Chip size="small" label={status} />
    }
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={2}>
        Garbage Collection Management
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Actions */}
      <Card sx={{ mb: 2, backgroundColor: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)' }}>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" gutterBottom>Actions</Typography>
              <Typography variant="body2" color="text.secondary">
                Auto GC: {autoGcRunning ? <Chip size="small" color="success" label="Running" /> : <Chip size="small" label="Stopped" />}
              </Typography>
            </Box>
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                onClick={handleDryRun}
                disabled={runningGc}
                startIcon={runningGc ? <CircularProgress size={16} /> : <PlayArrowIcon />}
              >
                Dry Run
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setRunDialogOpen(true)}
                disabled={runningGc}
                startIcon={runningGc ? <CircularProgress size={16} /> : <DeleteSweepIcon />}
              >
                Run GC
              </Button>
              <Tooltip title="Refresh">
                <IconButton onClick={loadData} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Dry Run Result */}
          {dryRunResult && (
            <Paper variant="outlined" sx={{ mt: 2, p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom>Dry Run Result</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="body2" color="text.secondary">Marked</Typography>
                  <Typography variant="h6">{dryRunResult.marked_count}</Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="body2" color="text.secondary">Candidates</Typography>
                  <Typography variant="h6">{dryRunResult.candidate_count}</Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="body2" color="text.secondary">Total Size</Typography>
                  <Typography variant="h6">{formatBytes(dryRunResult.total_size)}</Typography>
                </Grid>
                <Grid size={{ xs: 3 }}>
                  <Typography variant="body2" color="text.secondary">Candidates Detail</Typography>
                  <Box sx={{ maxHeight: 100, overflow: 'auto' }}>
                    {dryRunResult.candidates?.map((c) => (
                      <Typography key={c.id} variant="caption" display="block" fontFamily="monospace">
                        {c.digest.substring(7, 19)}... ({formatBytes(c.size)})
                      </Typography>
                    ))}
                  </Box>
                </Grid>
              </Grid>
            </Paper>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="GC History" />
          <Tab label="Pending Deletion" />
          <Tab label="Unreferenced Blobs" />
        </Tabs>

        <CardContent>
          {/* Tab 1: GC History */}
          <TabPanel value={tab} index={0}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Status</TableCell>
                    <TableCell>Started</TableCell>
                    <TableCell>Ended</TableCell>
                    <TableCell>Marked</TableCell>
                    <TableCell>Deleted</TableCell>
                    <TableCell>Freed</TableCell>
                    <TableCell>Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gcStatus.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography color="text.secondary">No GC history</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    gcStatus.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{getStatusChip(s.status)}</TableCell>
                        <TableCell>{formatDate(s.started_at)}</TableCell>
                        <TableCell>{s.ended_at ? formatDate(s.ended_at) : '-'}</TableCell>
                        <TableCell>{s.marked}</TableCell>
                        <TableCell>{s.deleted}</TableCell>
                        <TableCell>{formatBytes(s.freed_size)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={s.dry_run ? 'Dry Run' : 'Real'} variant="outlined" />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* Tab 2: Pending Deletion */}
          <TabPanel value={tab} index={1}>
            <Typography variant="body2" color="text.secondary" mb={2}>
              These blobs are marked for deletion but not yet removed. They will be cleaned up automatically after the soft delete delay.
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Digest</TableCell>
                    <TableCell>Size</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Repository</TableCell>
                    <TableCell>Marked At</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {candidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary">No pending deletions</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    candidates.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.digest.substring(0, 19)}...
                          </Typography>
                        </TableCell>
                        <TableCell>{formatBytes(c.size)}</TableCell>
                        <TableCell>{c.reason}</TableCell>
                        <TableCell>{c.repository_name}</TableCell>
                        <TableCell>{formatDate(c.created_at)}</TableCell>
                        <TableCell>
                          <Tooltip title="Restore">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => setRestoreDialogOpen(c.id)}
                            >
                              <RestoreIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* Tab 3: Unreferenced Blobs */}
          <TabPanel value={tab} index={2}>
            {unreferenced ? (
              <>
                <Paper variant="outlined" sx={{ mb: 2, p: 2, bgcolor: 'grey.50' }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2" color="text.secondary">Unreferenced Count</Typography>
                      <Typography variant="h6">{unreferenced.count}</Typography>
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="body2" color="text.secondary">Total Size</Typography>
                      <Typography variant="h6">{formatBytes(unreferenced.total_size)}</Typography>
                    </Grid>
                  </Grid>
                </Paper>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>ID</TableCell>
                        <TableCell>Digest</TableCell>
                        <TableCell>Size</TableCell>
                        <TableCell>Ref Count</TableCell>
                        <TableCell>Created</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {unreferenced.blobs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography color="text.secondary">No unreferenced blobs</Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        unreferenced.blobs.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell>{b.id}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontFamily="monospace" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {b.digest.substring(0, 19)}...
                              </Typography>
                            </TableCell>
                            <TableCell>{formatBytes(b.size)}</TableCell>
                            <TableCell>{b.ref_count}</TableCell>
                            <TableCell>{formatDate(b.created_at)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            ) : (
              <Typography color="text.secondary" textAlign="center" py={4}>
                Loading...
              </Typography>
            )}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Run GC Dialog */}
      <Dialog open={runDialogOpen} onClose={() => setRunDialogOpen(false)}>
        <DialogTitle>Run Garbage Collection</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to run garbage collection? This will delete unreferenced blobs permanently.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRunDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRunGC} color="error" disabled={runningGc}>
            {runningGc ? <CircularProgress size={20} /> : 'Run GC'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen !== null} onClose={() => setRestoreDialogOpen(null)}>
        <DialogTitle>Restore Blob</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to restore this blob? It will be removed from the deletion queue.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(null)}>Cancel</Button>
          <Button onClick={() => restoreDialogOpen && handleRestore(restoreDialogOpen)} color="primary">
            Restore
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
