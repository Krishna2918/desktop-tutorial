import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Image, Dimensions } from 'react-native';
import { Button, Card, Title, Paragraph, Chip, Divider } from 'react-native-paper';
import { colors } from '../../config/theme';

const { width } = Dimensions.get('window');

const CaseDetailScreen = ({ navigation, route }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { caseId } = route.params || {};

  const mockCase = {
    id: caseId || '1',
    title: 'Lost iPhone 13',
    description: 'Lost my iPhone 13 Pro in blue color. Last seen near the downtown coffee shop on Main Street. Has a distinctive case with a purple pattern.',
    category: 'Electronics',
    status: 'Active',
    reward: '$50',
    location: 'Downtown, Main Street',
    date: '2024-11-05',
    images: [
      'https://via.placeholder.com/400x300/2563EB/FFFFFF?text=Photo+1',
      'https://via.placeholder.com/400x300/10B981/FFFFFF?text=Photo+2',
    ],
    postedBy: 'John Doe',
  };

  const handleSubmitTip = () => {
    navigation.navigate('SubmitTip', { caseId: mockCase.id });
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.imageCarousel}>
        <Image
          source={{ uri: mockCase.images[currentImageIndex] }}
          style={styles.image}
          resizeMode="cover"
        />
        <View style={styles.imageIndicator}>
          {mockCase.images.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentImageIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>
      </View>

      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <Title>{mockCase.title}</Title>
            <Chip mode="outlined" textStyle={styles.statusText}>
              {mockCase.status}
            </Chip>
          </View>

          <View style={styles.metaContainer}>
            <Chip icon="tag" style={styles.metaChip}>{mockCase.category}</Chip>
            <Chip icon="map-marker" style={styles.metaChip}>{mockCase.location}</Chip>
            <Chip icon="calendar" style={styles.metaChip}>{mockCase.date}</Chip>
          </View>

          <Divider style={styles.divider} />

          <Paragraph style={styles.description}>{mockCase.description}</Paragraph>

          <Divider style={styles.divider} />

          <View style={styles.rewardContainer}>
            <Paragraph style={styles.label}>Reward Offered:</Paragraph>
            <Title style={styles.rewardAmount}>{mockCase.reward}</Title>
          </View>

          <View style={styles.posterContainer}>
            <Paragraph style={styles.label}>Posted by:</Paragraph>
            <Paragraph>{mockCase.postedBy}</Paragraph>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.buttonContainer}>
        <Button
          mode="contained"
          onPress={handleSubmitTip}
          style={styles.submitButton}
          icon="send"
        >
          Submit a Tip
        </Button>
        <Button
          mode="outlined"
          onPress={() => navigation.navigate('MapView', { caseId: mockCase.id })}
          style={styles.mapButton}
          icon="map"
        >
          View on Map
        </Button>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  imageCarousel: {
    width: width,
    height: 300,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageIndicator: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: colors.primary,
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    color: colors.success,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  metaChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  divider: {
    marginVertical: 16,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  rewardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontWeight: 'bold',
    color: colors.text,
  },
  rewardAmount: {
    color: colors.primary,
  },
  posterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  submitButton: {
    marginBottom: 12,
    backgroundColor: colors.primary,
  },
  mapButton: {
    borderColor: colors.primary,
  },
});

export default CaseDetailScreen;
