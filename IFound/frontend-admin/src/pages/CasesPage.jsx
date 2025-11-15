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
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { casesAPI } from '../services/api';
import { format } from 'date-fns';

const CasesPage = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCase, setSelectedCase] = useState(null);
  const [actionDialog, setActionDialog] = useState({ open: false, type: null });

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const response = await casesAPI.getAll();
      setCases(response.data.data.cases || response.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load cases');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendCase = async (caseId) => {
    try {
      await casesAPI.suspend(caseId);
      await fetchCases();
      closeActionDialog();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to suspend case');
    }
  };

  const handleActivateCase = async (caseId) => {
    try {
      await casesAPI.activate(caseId);
      await fetchCases();
      closeActionDialog();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate case');
    }
  };

  const openActionDialog = (caseData, type) => {
    setSelectedCase(caseData);
    setActionDialog({ open: true, type });
  };

  const closeActionDialog = () => {
    setActionDialog({ open: false, type: null });
    setSelectedCase(null);
  };

  const getCaseTypeColor = (type) => {
    switch (type) {
      case 'missing_person':
        return 'error';
      case 'criminal':
        return 'warning';
      case 'lost_item':
        return 'info';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'resolved':
        return 'primary';
      case 'suspended':
        return 'error';
      case 'closed':
        return 'default';
      default:
        return 'default';
    }
  };

  const columns = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'title', headerName: 'Title', width: 250 },
    {
      field: 'case_type',
      headerName: 'Type',
      width: 140,
      renderCell: (params) => (
        <Chip
          label={params.value?.replace('_', ' ') || 'N/A'}
          size="small"
          color={getCaseTypeColor(params.value)}
        />
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
      field: 'bounty_amount',
      headerName: 'Bounty',
      width: 120,
      renderCell: (params) => `$${params.value || 0}`,
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 180,
    },
    {
      field: 'created_at',
      headerName: 'Created',
      width: 120,
      renderCell: (params) =>
        params.value ? format(new Date(params.value), 'MMM dd, yyyy') : 'N/A',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {params.row.status !== 'suspended' ? (
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => openActionDialog(params.row, 'suspend')}
            >
              Suspend
            </Button>
          ) : (
            <Button
              size="small"
              variant="outlined"
              color="success"
              onClick={() => openActionDialog(params.row, 'activate')}
            >
              Activate
            </Button>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <div>
          <Typography variant="h4" gutterBottom fontWeight={700}>
            Case Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor and moderate all cases on the platform
          </Typography>
        </div>
        <Button variant="contained" onClick={fetchCases}>
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
          rows={cases}
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
          {actionDialog.type === 'suspend' ? 'Suspend Case' : 'Activate Case'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {actionDialog.type === 'suspend'
              ? `Are you sure you want to suspend the case "${selectedCase?.title}"? It will be hidden from public view.`
              : `Are you sure you want to activate the case "${selectedCase?.title}"? It will be visible to users again.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeActionDialog}>Cancel</Button>
          <Button
            variant="contained"
            color={actionDialog.type === 'suspend' ? 'error' : 'primary'}
            onClick={() => {
              if (actionDialog.type === 'suspend') {
                handleSuspendCase(selectedCase.id);
              } else {
                handleActivateCase(selectedCase.id);
              }
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CasesPage;
