const { sequelize } = require('../config/database');
const User = require('./User');
const Case = require('./Case');
const Photo = require('./Photo');
const Submission = require('./Submission');
const Transaction = require('./Transaction');

// Define Associations

// User associations
User.hasMany(Case, { foreignKey: 'poster_id', as: 'posted_cases' });
User.hasMany(Submission, { foreignKey: 'finder_id', as: 'submissions' });
User.hasMany(Transaction, { foreignKey: 'finder_id', as: 'received_transactions' });
User.hasMany(Transaction, { foreignKey: 'poster_id', as: 'paid_transactions' });

// Case associations
Case.belongsTo(User, { foreignKey: 'poster_id', as: 'poster' });
Case.belongsTo(User, { foreignKey: 'resolved_by', as: 'resolver' });
Case.hasMany(Photo, { foreignKey: 'case_id', as: 'photos' });
Case.hasMany(Submission, { foreignKey: 'case_id', as: 'submissions' });
Case.hasMany(Transaction, { foreignKey: 'case_id', as: 'transactions' });

// Photo associations
Photo.belongsTo(Case, { foreignKey: 'case_id', as: 'case' });

// Submission associations
Submission.belongsTo(Case, { foreignKey: 'case_id', as: 'case' });
Submission.belongsTo(User, { foreignKey: 'finder_id', as: 'finder' });
Submission.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewer' });
Submission.hasMany(Transaction, { foreignKey: 'submission_id', as: 'transactions' });

// Transaction associations
Transaction.belongsTo(Case, { foreignKey: 'case_id', as: 'case' });
Transaction.belongsTo(Submission, { foreignKey: 'submission_id', as: 'submission' });
Transaction.belongsTo(User, { foreignKey: 'finder_id', as: 'finder' });
Transaction.belongsTo(User, { foreignKey: 'poster_id', as: 'poster' });

// Sync database
const syncDatabase = async (options = {}) => {
  try {
    await sequelize.sync(options);
    console.log('✅ Database synchronized successfully.');
  } catch (error) {
    console.error('❌ Error synchronizing database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  User,
  Case,
  Photo,
  Submission,
  Transaction,
  syncDatabase,
};
