import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { CheckCircle, Block, Verified } from '@mui/icons-material';
import { usersAPI } from '../services/api';
import { format } from 'date-fns';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionDialog, setActionDialog] = useState({ open: false, type: null });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll();
      setUsers(response.data.data.users || response.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyUser = async (userId) => {
    try {
      await usersAPI.verify(userId);
      await fetchUsers();
      setActionDialog({ open: false, type: null });
      setSelectedUser(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to verify user');
    }
  };

  const handleSuspendUser = async (userId) => {
    try {
      await usersAPI.suspend(userId);
      await fetchUsers();
      setActionDialog({ open: false, type: null });
      setSelectedUser(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to suspend user');
    }
  };

  const openActionDialog = (user, type) => {
    setSelectedUser(user);
    setActionDialog({ open: true, type });
  };

  const closeActionDialog = () => {
    setActionDialog({ open: false, type: null });
    setSelectedUser(null);
  };

  const columns = [
    { field: 'id', headerName: 'ID', width: 80 },
    { field: 'name', headerName: 'Name', width: 180 },
    { field: 'email', headerName: 'Email', width: 220 },
    {
      field: 'role',
      headerName: 'Role',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'admin' ? 'error' : 'default'}
        />
      ),
    },
    {
      field: 'is_verified',
      headerName: 'Verified',
      width: 100,
      renderCell: (params) =>
        params.value ? (
          <CheckCircle color="success" fontSize="small" />
        ) : (
          <Block color="error" fontSize="small" />
        ),
    },
    {
      field: 'account_status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value || 'active'}
          size="small"
          color={params.value === 'suspended' ? 'error' : 'success'}
        />
      ),
    },
    {
      field: 'created_at',
      headerName: 'Joined',
      width: 120,
      renderCell: (params) =>
        params.value ? format(new Date(params.value), 'MMM dd, yyyy') : 'N/A',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 220,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!params.row.is_verified && (
            <Button
              size="small"
              variant="outlined"
              color="success"
              onClick={() => openActionDialog(params.row, 'verify')}
            >
              Verify
            </Button>
          )}
          {params.row.account_status !== 'suspended' ? (
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
              onClick={() => openActionDialog(params.row, 'unsuspend')}
            >
              Unsuspend
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
            User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage user accounts, verification, and access control
          </Typography>
        </div>
        <Button variant="contained" onClick={fetchUsers}>
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
          rows={users}
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
          {actionDialog.type === 'verify' && 'Verify User'}
          {actionDialog.type === 'suspend' && 'Suspend User'}
          {actionDialog.type === 'unsuspend' && 'Unsuspend User'}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {actionDialog.type === 'verify' &&
              `Are you sure you want to verify ${selectedUser?.name}? This will grant them verified status on the platform.`}
            {actionDialog.type === 'suspend' &&
              `Are you sure you want to suspend ${selectedUser?.name}? They will no longer be able to access the platform.`}
            {actionDialog.type === 'unsuspend' &&
              `Are you sure you want to unsuspend ${selectedUser?.name}? They will regain access to the platform.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeActionDialog}>Cancel</Button>
          <Button
            variant="contained"
            color={actionDialog.type === 'suspend' ? 'error' : 'primary'}
            onClick={() => {
              if (actionDialog.type === 'verify') {
                handleVerifyUser(selectedUser.id);
              } else {
                handleSuspendUser(selectedUser.id);
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

export default UsersPage;
