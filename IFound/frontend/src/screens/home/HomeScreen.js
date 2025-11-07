import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Searchbar, Chip, Card, Title, Paragraph, FAB } from 'react-native-paper';
import { colors } from '../../config/theme';

const HomeScreen = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const filters = [
    { key: 'all', label: 'All Cases' },
    { key: 'lost', label: 'Lost' },
    { key: 'found', label: 'Found' },
    { key: 'recent', label: 'Recent' },
  ];

  const mockCases = [
    { id: '1', title: 'Lost iPhone 13', category: 'Electronics', reward: '$50', location: 'Downtown' },
    { id: '2', title: 'Found Cat', category: 'Pets', reward: 'No reward', location: 'Central Park' },
    { id: '3', title: 'Lost Wallet', category: 'Personal Items', reward: '$100', location: 'Mall' },
  ];

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => setRefreshing(false), 1500);
  };

  const renderCase = ({ item }) => (
    <Card
      style={styles.card}
      onPress={() => navigation.navigate('CaseDetail', { caseId: item.id })}
    >
      <Card.Content>
        <Title>{item.title}</Title>
        <Paragraph>{item.category} • {item.location}</Paragraph>
        <Paragraph style={styles.reward}>Reward: {item.reward}</Paragraph>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Searchbar
        placeholder="Search cases..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />

      <View style={styles.filterContainer}>
        {filters.map((filter) => (
          <Chip
            key={filter.key}
            selected={selectedFilter === filter.key}
            onPress={() => setSelectedFilter(filter.key)}
            style={styles.chip}
          >
            {filter.label}
          </Chip>
        ))}
      </View>

      <FlatList
        data={mockCases}
        renderItem={renderCase}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('CreateCase')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchbar: {
    margin: 16,
    elevation: 2,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  chip: {
    marginRight: 8,
  },
  list: {
    padding: 16,
  },
  card: {
    marginBottom: 12,
    elevation: 2,
  },
  reward: {
    color: colors.primary,
    fontWeight: 'bold',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
  },
});

export default HomeScreen;
