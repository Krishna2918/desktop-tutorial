import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, SegmentedButtons, Chip, Title, HelperText } from 'react-native-paper';
import { colors } from '../../config/theme';

const CreateCaseScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [caseType, setCaseType] = useState('lost');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [reward, setReward] = useState('');

  const categories = [
    'Electronics',
    'Pets',
    'Personal Items',
    'Documents',
    'Jewelry',
    'Keys',
    'Other',
  ];

  const validateStep1 = () => {
    if (!title || !description) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!category || !location) {
      Alert.alert('Error', 'Please fill in all required fields');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = () => {
    Alert.alert(
      'Success',
      'Case created successfully!',
      [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
        <View style={styles.stepLine} />
        <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
        <View style={styles.stepLine} />
        <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]} />
      </View>

      <View style={styles.content}>
        {step === 1 && (
          <>
            <Title style={styles.stepTitle}>Step 1: Basic Information</Title>

            <SegmentedButtons
              value={caseType}
              onValueChange={setCaseType}
              buttons={[
                { value: 'lost', label: 'Lost Item' },
                { value: 'found', label: 'Found Item' },
              ]}
              style={styles.segmentedButtons}
            />

            <TextInput
              label="Title *"
              value={title}
              onChangeText={setTitle}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., Lost iPhone 13"
            />
            <HelperText type="info">
              Provide a clear, concise title
            </HelperText>

            <TextInput
              label="Description *"
              value={description}
              onChangeText={setDescription}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={styles.input}
              placeholder="Describe the item and circumstances..."
            />
            <HelperText type="info">
              Include as many details as possible
            </HelperText>
          </>
        )}

        {step === 2 && (
          <>
            <Title style={styles.stepTitle}>Step 2: Category & Location</Title>

            <Title style={styles.sectionTitle}>Select Category *</Title>
            <View style={styles.categoryContainer}>
              {categories.map((cat) => (
                <Chip
                  key={cat}
                  selected={category === cat}
                  onPress={() => setCategory(cat)}
                  style={styles.categoryChip}
                >
                  {cat}
                </Chip>
              ))}
            </View>

            <TextInput
              label="Location *"
              value={location}
              onChangeText={setLocation}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., Downtown, Main Street"
              left={<TextInput.Icon icon="map-marker" />}
            />
            <HelperText type="info">
              Where was the item lost/found?
            </HelperText>
          </>
        )}

        {step === 3 && (
          <>
            <Title style={styles.stepTitle}>Step 3: Additional Details</Title>

            <TextInput
              label="Reward Amount (Optional)"
              value={reward}
              onChangeText={setReward}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., $50"
              keyboardType="numeric"
              left={<TextInput.Icon icon="currency-usd" />}
            />
            <HelperText type="info">
              Offering a reward can increase responses
            </HelperText>

            <Button
              mode="outlined"
              onPress={() => {}}
              style={styles.photoButton}
              icon="camera"
            >
              Add Photos (Optional)
            </Button>
            <HelperText type="info">
              Add up to 5 photos
            </HelperText>
          </>
        )}

        <View style={styles.buttonContainer}>
          {step > 1 && (
            <Button
              mode="outlined"
              onPress={handleBack}
              style={styles.backButton}
            >
              Back
            </Button>
          )}

          {step < 3 ? (
            <Button
              mode="contained"
              onPress={handleNext}
              style={styles.nextButton}
            >
              Next
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={handleSubmit}
              style={styles.nextButton}
            >
              Submit Case
            </Button>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.disabled,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.disabled,
    marginHorizontal: 8,
  },
  content: {
    padding: 16,
  },
  stepTitle: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 4,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  categoryChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  photoButton: {
    marginTop: 8,
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
    backgroundColor: colors.primary,
  },
});

export default CreateCaseScreen;
