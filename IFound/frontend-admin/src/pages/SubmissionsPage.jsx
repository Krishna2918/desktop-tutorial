import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { submissionsAPI } from '../services/api';
import { format } from 'date-fns';

const SubmissionsPage = () => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [actionDialog, setActionDialog] = useState({ open: false, type: null });
  const [detailsDialog, setDetailsDialog] = useState(false);

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const response = await submissionsAPI.getAll();
      setSubmissions(response.data.data.submissions || response.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmission = async (submissionId) => {
    try {
      await submissionsAPI.verify(submissionId);
      await fetchSubmissions();
      closeActionDialog();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify submission');
    }
  };

  const handleRejectSubmission = async (submissionId) => {
    try {
      await submissionsAPI.reject(submissionId);
      await fetchSubmissions();
      closeActionDialog();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject submission');
    }
  };

  const openActionDialog = (submission, type) => {
    setSelectedSubmission(submission);
    setActionDialog({ open: true, type });
  };

  const closeActionDialog = () => {
    setActionDialog({ open: false, type: null });
    setSelectedSubmission(null);
  };

  const openDetailsDialog = (submission) => {
    setSelectedSubmission(submission);
    setDetailsDialog(true);
  };

  const closeDetailsDialog = () => {
    setDetailsDialog(false);
    setSelectedSubmission(null);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'reviewing':
        return 'info';
      case 'verified':
        return 'success';
      case 'rejected':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns = [
    { field: 'id', headerName: 'ID', width: 80 },
    {
      field: 'case_id',
      headerName: 'Case ID',
      width: 100,
    },
    {
      field: 'submission_type',
      headerName: 'Type',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value || 'sighting'} size="small" color="primary" />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color={getStatusColor(params.value)} />
      ),
    },
    {
      field: 'description',
      headerName: 'Description',
      width: 250,
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.value || 'No description'}
        </Typography>
      ),
    },
    {
      field: 'bounty_percentage',
      headerName: 'Bounty %',
      width: 100,
      renderCell: (params) => `${params.value || 0}%`,
    },
    {
      field: 'created_at',
      headerName: 'Submitted',
      width: 120,
      renderCell: (params) =>
        params.value ? format(new Date(params.value), 'MMM dd, yyyy') : 'N/A',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 280,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => openDetailsDialog(params.row)}
          >
            Details
          </Button>
          {params.row.status === 'pending' || params.row.status === 'reviewing' ? (
            <>
              <Button
                size="small"
                variant="outlined"
                color="success"
                onClick={() => openActionDialog(params.row, 'verify')}
              >
                Verify
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => openActionDialog(params.row, 'reject')}
              >
                Reject
              </Button>
            </>
          ) : null}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <div>
          <Typography variant="h4" gutterBottom fontWeight={700}>
            Submission Review
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review and verify user submissions and tips
          </Typography>
        </div>
        <Button variant="contained" onClick={fetchSubmissions}>
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card>
        <DataGrid
          rows={submissions}
          columns={columns}
          loading={loading}
          autoHeight
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25, page: 0 },
            },
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          disableRowSelectionOnClick
        />
      </Card>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialog.open} onClose={closeActionDialog}>
        <DialogTitle>
          {actionDialog.type === 'verify' ? 'Verify Submission' : 'Reject Submission'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {actionDialog.type === 'verify'
              ? 'Are you sure you want to verify this submission? The submitter will be eligible for the bounty reward.'
              : 'Are you sure you want to reject this submission? This action cannot be undone.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeActionDialog}>Cancel</Button>
          <Button
            variant="contained"
            color={actionDialog.type === 'verify' ? 'success' : 'error'}
            onClick={() => {
              if (actionDialog.type === 'verify') {
                handleVerifySubmission(selectedSubmission.id);
              } else {
                handleRejectSubmission(selectedSubmission.id);
              }
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialog} onClose={closeDetailsDialog} maxWidth="md" fullWidth>
        <DialogTitle>Submission Details</DialogTitle>
        <DialogContent>
          {selectedSubmission && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" gutterBottom>
                <strong>ID:</strong> {selectedSubmission.id}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Case ID:</strong> {selectedSubmission.case_id}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Type:</strong> {selectedSubmission.submission_type || 'sighting'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Status:</strong>{' '}
                <Chip
                  label={selectedSubmission.status}
                  size="small"
                  color={getStatusColor(selectedSubmission.status)}
                />
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Description:</strong>
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={selectedSubmission.description || 'No description provided'}
                InputProps={{ readOnly: true }}
                sx={{ mb: 2 }}
              />
              <Typography variant="body2" gutterBottom>
                <strong>Location:</strong> {selectedSubmission.location || 'Not provided'}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Bounty Percentage:</strong> {selectedSubmission.bounty_percentage || 0}%
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Submitted:</strong>{' '}
                {selectedSubmission.created_at
                  ? format(new Date(selectedSubmission.created_at), 'PPpp')
                  : 'N/A'}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDetailsDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SubmissionsPage;
