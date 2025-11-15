import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  Typography,
  Button,
  Chip,
  Alert,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { transactionsAPI } from '../services/api';
import { format } from 'date-fns';

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await transactionsAPI.getAll();
      setTransactions(response.data.data.transactions || response.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'bounty_payment':
        return 'success';
      case 'escrow':
        return 'info';
      case 'release':
        return 'primary';
      case 'refund':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns = [
    { field: 'id', headerName: 'ID', width: 80 },
    {
      field: 'transaction_type',
      headerName: 'Type',
      width: 150,
      renderCell: (params) => (
        <Chip
          label={params.value?.replace('_', ' ') || 'N/A'}
          size="small"
          color={getTypeColor(params.value)}
        />
      ),
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      renderCell: (params) => `$${parseFloat(params.value || 0).toFixed(2)}`,
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
      field: 'case_id',
      headerName: 'Case ID',
      width: 100,
    },
    {
      field: 'submission_id',
      headerName: 'Submission ID',
      width: 130,
    },
    {
      field: 'sender_id',
      headerName: 'Sender ID',
      width: 100,
    },
    {
      field: 'receiver_id',
      headerName: 'Receiver ID',
      width: 120,
    },
    {
      field: 'stripe_transaction_id',
      headerName: 'Stripe ID',
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2" noWrap>
          {params.value || 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'created_at',
      headerName: 'Date',
      width: 160,
      renderCell: (params) =>
        params.value ? format(new Date(params.value), 'MMM dd, yyyy HH:mm') : 'N/A',
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <div>
          <Typography variant="h4" gutterBottom fontWeight={700}>
            Transaction Monitoring
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor all financial transactions and bounty payments
          </Typography>
        </div>
        <Button variant="contained" onClick={fetchTransactions}>
          Refresh
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card>
        <Box sx={{ p: 2, bgcolor: 'info.lighter', borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="info.main">
            Total Transactions: {transactions.length} | Total Value: $
            {transactions
              .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0)
              .toFixed(2)}
          </Typography>
        </Box>
        <DataGrid
          rows={transactions}
          columns={columns}
          loading={loading}
          autoHeight
          initialState={{
            pagination: {
              paginationModel: { pageSize: 25, page: 0 },
            },
            sorting: {
              sortModel: [{ field: 'created_at', sort: 'desc' }],
            },
          }}
          pageSizeOptions={[10, 25, 50, 100]}
          disableRowSelectionOnClick
        />
      </Card>
    </Box>
  );
};

export default TransactionsPage;
