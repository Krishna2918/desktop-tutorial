import tensorflow as tf
from tensorflow import keras
import numpy as np
import json
import os
from datetime import datetime
import pickle

class NeuralBrain:
    def __init__(self):
        self.session_data = []
        self.model = None
        self.level_generator_model = None
        self.story_generator_model = None
        self.data_file = "neural_data/session_data.pkl"
        self.models_dir = "neural_data/models"
        
        # Ensure directories exist
        os.makedirs("neural_data", exist_ok=True)
        os.makedirs(self.models_dir, exist_ok=True)
        
        # Load existing data
        self.load_existing_data()
        
        # Initialize neural networks
        self.init_neural_networks()
    
    def init_neural_networks(self):
        """Initialize neural network models"""
        # Main gameplay prediction model
        self.model = keras.Sequential([
            keras.layers.Dense(64, activation='relu', input_shape=(10,)),
            keras.layers.Dense(32, activation='relu'),
            keras.layers.Dense(16, activation='relu'),
            keras.layers.Dense(4, activation='softmax')  # 4 possible actions
        ])
        
        self.model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        
        # Level generation model
        self.level_generator_model = keras.Sequential([
            keras.layers.Dense(128, activation='relu', input_shape=(20,)),
            keras.layers.Dense(64, activation='relu'),
            keras.layers.Dense(32, activation='relu'),
            keras.layers.Dense(50, activation='sigmoid')  # 50 level parameters
        ])
        
        self.level_generator_model.compile(
            optimizer='adam',
            loss='mse',
            metrics=['mae']
        )
        
        # Story generation model (simplified)
        self.story_generator_model = keras.Sequential([
            keras.layers.Dense(64, activation='relu', input_shape=(15,)),
            keras.layers.Dense(32, activation='relu'),
            keras.layers.Dense(10, activation='softmax')  # 10 story types
        ])
        
        self.story_generator_model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        
        # Try to load existing models
        self.load_models()
    
    def collect_data(self, game_data):
        """Collect data from game sessions"""
        processed_data = {
            'timestamp': game_data['timestamp'],
            'car_position': game_data['car_position'],
            'car_velocity': game_data['car_velocity'],
            'car_angle': game_data['car_angle'],
            'walls_count': len(game_data['walls_nearby']),
            'input_keys': game_data['input_keys'],
            'session_id': len(self.session_data)
        }
        
        self.session_data.append(processed_data)
        
        # Train periodically
        if len(self.session_data) % 100 == 0:
            self.train_networks()
    
    def train_networks(self):
        """Train the neural networks with collected data"""
        if len(self.session_data) < 50:
            return
        
        print(f"Training neural networks with {len(self.session_data)} data points...")
        
        # Prepare training data
        X, y = self.prepare_training_data()
        
        if len(X) > 0:
            # Train main model
            try:
                self.model.fit(X, y, epochs=5, verbose=0, validation_split=0.2)
                print("Main model trained successfully")
            except Exception as e:
                print(f"Error training main model: {e}")
            
            # Train level generator
            try:
                level_X, level_y = self.prepare_level_training_data()
                if len(level_X) > 0:
                    self.level_generator_model.fit(level_X, level_y, epochs=3, verbose=0)
                    print("Level generator trained successfully")
            except Exception as e:
                print(f"Error training level generator: {e}")
    
    def prepare_training_data(self):
        """Prepare training data from collected sessions"""
        X = []
        y = []
        
        for data in self.session_data:
            # Input features
            features = [
                data['car_position'][0] / 1000,  # Normalize position
                data['car_position'][1] / 1000,
                data['car_velocity'][0] / 10,    # Normalize velocity
                data['car_velocity'][1] / 10,
                data['car_angle'] / 360,         # Normalize angle
                data['walls_count'] / 10,        # Normalize wall count
                float(data['input_keys'][0]),    # Left key
                float(data['input_keys'][1]),    # Right key
                float(data['input_keys'][2]),    # Up key
                float(data['input_keys'][3])     # Down key
            ]
            
            # Output (predict next action based on current state)
            action = [0, 0, 0, 0]
            if any(data['input_keys']):
                action[data['input_keys'].index(True)] = 1
            else:
                action[0] = 1  # Default action
            
            X.append(features)
            y.append(action)
        
        return np.array(X), np.array(y)
    
    def prepare_level_training_data(self):
        """Prepare training data for level generation"""
        X = []
        y = []
        
        # Use gameplay data to inform level design
        for i in range(len(self.session_data) - 1):
            current = self.session_data[i]
            next_data = self.session_data[i + 1]
            
            # Input: current game state
            features = [
                current['car_position'][0] / 1000,
                current['car_position'][1] / 1000,
                current['car_velocity'][0] / 10,
                current['car_velocity'][1] / 10,
                current['car_angle'] / 360,
                current['walls_count'] / 10,
                *[float(k) for k in current['input_keys']],
                # Add more contextual features
                (next_data['car_position'][0] - current['car_position'][0]) / 100,
                (next_data['car_position'][1] - current['car_position'][1]) / 100,
                (next_data['timestamp'] - current['timestamp']) / 1000,
                len(self.session_data) / 1000,  # Game progression
                float(current['walls_count'] > 0),  # Near walls
                float(abs(current['car_velocity'][0]) > 5),  # High speed
                float(abs(current['car_velocity'][1]) > 5)   # High vertical speed
            ]
            
            # Output: level parameters (simplified)
            level_params = np.random.rand(50)  # Placeholder for real level data
            
            X.append(features)
            y.append(level_params)
        
        return np.array(X), np.array(y)
    
    def generate_level_suggestions(self):
        """Generate level suggestions using trained model"""
        if len(self.session_data) < 10:
            return self.get_default_level_suggestions()
        
        # Use recent gameplay data to inform new level
        recent_data = self.session_data[-10:]
        
        # Analyze patterns
        avg_speed = np.mean([np.sqrt(d['car_velocity'][0]**2 + d['car_velocity'][1]**2) 
                            for d in recent_data])
        wall_encounters = np.mean([d['walls_count'] for d in recent_data])
        
        # Generate suggestions based on analysis
        suggestions = {
            'difficulty': min(1.0, avg_speed / 10),
            'wall_density': min(1.0, wall_encounters / 5),
            'vertical_challenge': np.random.rand() * 0.5 + 0.3,
            'horizontal_spread': np.random.rand() * 0.7 + 0.3,
            'landing_zones': max(3, int(5 * (1 - suggestions.get('difficulty', 0.5)))),
            'story_complexity': np.random.rand() * 0.8 + 0.2
        }
        
        # Use neural network if trained
        try:
            if len(self.session_data) > 100:
                # Create input from recent gameplay
                nn_input = np.array([[
                    avg_speed / 10,
                    wall_encounters / 5,
                    len(self.session_data) / 1000,
                    np.mean([d['car_position'][0] for d in recent_data]) / 1000,
                    np.mean([d['car_position'][1] for d in recent_data]) / 1000,
                    *[0.5] * 15  # Padding
                ]])
                
                prediction = self.level_generator_model.predict(nn_input, verbose=0)[0]
                
                # Interpret prediction
                suggestions['difficulty'] = prediction[0]
                suggestions['wall_density'] = prediction[1]
                suggestions['vertical_challenge'] = prediction[2]
                suggestions['horizontal_spread'] = prediction[3]
                suggestions['landing_zones'] = int(prediction[4] * 10) + 1
                
        except Exception as e:
            print(f"Error generating AI suggestions: {e}")
        
        return suggestions
    
    def get_default_level_suggestions(self):
        """Get default level suggestions for new sessions"""
        return {
            'difficulty': 0.5,
            'wall_density': 0.4,
            'vertical_challenge': 0.6,
            'horizontal_spread': 0.5,
            'landing_zones': 4,
            'story_complexity': 0.5
        }
    
    def generate_story_suggestions(self, context):
        """Generate story suggestions based on context"""
        try:
            # Simple story generation based on context
            story_types = [
                'adventure', 'mystery', 'sci-fi', 'fantasy', 'action',
                'exploration', 'puzzle', 'racing', 'survival', 'comedy'
            ]
            
            # Use neural network prediction if available
            if len(self.session_data) > 50:
                features = [
                    context.get('location_x', 0) / 1000,
                    context.get('location_y', 0) / 1000,
                    context.get('speed', 0) / 10,
                    context.get('difficulty', 0.5),
                    len(self.session_data) / 1000,
                    *[0.5] * 10  # Padding
                ]
                
                prediction = self.story_generator_model.predict(
                    np.array([features]), verbose=0
                )[0]
                
                story_type = story_types[np.argmax(prediction)]
            else:
                story_type = np.random.choice(story_types)
            
            return {
                'type': story_type,
                'complexity': np.random.rand() * 0.8 + 0.2,
                'elements': np.random.choice(['mystery', 'action', 'exploration'], 
                                           size=2, replace=False).tolist()
            }
            
        except Exception as e:
            print(f"Error generating story suggestions: {e}")
            return {'type': 'adventure', 'complexity': 0.5, 'elements': ['exploration']}
    
    def save_session_data(self):
        """Save session data to file"""
        try:
            with open(self.data_file, 'wb') as f:
                pickle.dump(self.session_data, f)
            print(f"Saved {len(self.session_data)} data points")
            
            # Save models
            self.save_models()
            
        except Exception as e:
            print(f"Error saving session data: {e}")
    
    def load_existing_data(self):
        """Load existing session data"""
        try:
            if os.path.exists(self.data_file):
                with open(self.data_file, 'rb') as f:
                    self.session_data = pickle.load(f)
                print(f"Loaded {len(self.session_data)} existing data points")
        except Exception as e:
            print(f"Error loading existing data: {e}")
            self.session_data = []
    
    def save_models(self):
        """Save trained models"""
        try:
            self.model.save(os.path.join(self.models_dir, 'main_model.h5'))
            self.level_generator_model.save(os.path.join(self.models_dir, 'level_generator.h5'))
            self.story_generator_model.save(os.path.join(self.models_dir, 'story_generator.h5'))
            print("Models saved successfully")
        except Exception as e:
            print(f"Error saving models: {e}")
    
    def load_models(self):
        """Load existing models"""
        try:
            main_model_path = os.path.join(self.models_dir, 'main_model.h5')
            level_gen_path = os.path.join(self.models_dir, 'level_generator.h5')
            story_gen_path = os.path.join(self.models_dir, 'story_generator.h5')
            
            if os.path.exists(main_model_path):
                self.model = keras.models.load_model(main_model_path)
                print("Main model loaded")
            
            if os.path.exists(level_gen_path):
                self.level_generator_model = keras.models.load_model(level_gen_path)
                print("Level generator loaded")
            
            if os.path.exists(story_gen_path):
                self.story_generator_model = keras.models.load_model(story_gen_path)
                print("Story generator loaded")
                
        except Exception as e:
            print(f"Error loading models: {e}")
    
    def get_analytics(self):
        """Get analytics about the collected data"""
        if not self.session_data:
            return {}
        
        speeds = [np.sqrt(d['car_velocity'][0]**2 + d['car_velocity'][1]**2) 
                 for d in self.session_data]
        
        return {
            'total_sessions': len(self.session_data),
            'avg_speed': np.mean(speeds),
            'max_speed': np.max(speeds),
            'wall_encounters': np.mean([d['walls_count'] for d in self.session_data]),
            'most_used_key': max(['left', 'right', 'up', 'down'], 
                                key=lambda k: sum(1 for d in self.session_data 
                                                 if d['input_keys'][['left', 'right', 'up', 'down'].index(k)]))
        }