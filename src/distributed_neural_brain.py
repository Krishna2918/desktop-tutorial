import tensorflow as tf
from tensorflow import keras
import numpy as np
import json
import os
import requests
import threading
import time
from datetime import datetime
import uuid
import pickle
from .neural_brain import NeuralBrain

class DistributedNeuralBrain:
    def __init__(self):
        # Generate unique player ID
        self.player_id = str(uuid.uuid4())
        
        # Local neural network (child network)
        self.local_brain = NeuralBrain()
        
        # Parent network connection settings
        self.parent_network_url = "http://localhost:8080/api/neural"  # Would be cloud service
        self.sync_interval = 300  # 5 minutes
        self.batch_size = 50
        
        # Player-specific learning
        self.player_profile = {
            'player_id': self.player_id,
            'skill_level': 0.5,
            'preferred_difficulty': 0.5,
            'play_style': 'balanced',
            'total_playtime': 0,
            'successful_climbs': 0,
            'failed_attempts': 0,
            'favorite_locations': {},
            'learning_rate': 0.01
        }
        
        # Enhanced data collection
        self.gameplay_patterns = []
        self.performance_metrics = []
        self.preference_data = []
        
        # Communication with parent network
        self.parent_updates = []
        self.last_sync = time.time()
        
        # Advanced models
        self.difficulty_model = None
        self.engagement_model = None
        self.content_generation_model = None
        
        # Initialize enhanced neural networks
        self.init_advanced_networks()
        
        # Load player profile
        self.load_player_profile()
        
        # Start background sync thread
        self.start_background_sync()
    
    def init_advanced_networks(self):
        """Initialize advanced neural networks for distributed learning"""
        
        # Difficulty adjustment model
        self.difficulty_model = keras.Sequential([
            keras.layers.Dense(128, activation='relu', input_shape=(25,)),
            keras.layers.Dropout(0.3),
            keras.layers.Dense(64, activation='relu'),
            keras.layers.Dropout(0.2),
            keras.layers.Dense(32, activation='relu'),
            keras.layers.Dense(1, activation='sigmoid')  # Difficulty level 0-1
        ])
        
        self.difficulty_model.compile(
            optimizer='adam',
            loss='mse',
            metrics=['mae']
        )
        
        # Player engagement prediction model
        self.engagement_model = keras.Sequential([
            keras.layers.Dense(96, activation='relu', input_shape=(20,)),
            keras.layers.Dropout(0.3),
            keras.layers.Dense(48, activation='relu'),
            keras.layers.Dense(24, activation='relu'),
            keras.layers.Dense(3, activation='softmax')  # Low, Medium, High engagement
        ])
        
        self.engagement_model.compile(
            optimizer='adam',
            loss='categorical_crossentropy',
            metrics=['accuracy']
        )
        
        # Content generation model
        self.content_generation_model = keras.Sequential([
            keras.layers.Dense(256, activation='relu', input_shape=(30,)),
            keras.layers.Dropout(0.4),
            keras.layers.Dense(128, activation='relu'),
            keras.layers.Dropout(0.3),
            keras.layers.Dense(64, activation='relu'),
            keras.layers.Dense(100, activation='sigmoid')  # 100 content parameters
        ])
        
        self.content_generation_model.compile(
            optimizer='adam',
            loss='mse',
            metrics=['mae']
        )
        
        # Load existing models if available
        self.load_advanced_models()
    
    def collect_enhanced_data(self, game_data):
        """Collect enhanced data for distributed learning"""
        # Basic data collection
        self.local_brain.collect_data(game_data)
        
        # Enhanced pattern recognition
        gameplay_pattern = self.extract_gameplay_pattern(game_data)
        self.gameplay_patterns.append(gameplay_pattern)
        
        # Performance metrics
        performance = self.calculate_performance_metrics(game_data)
        self.performance_metrics.append(performance)
        
        # Update player profile
        self.update_player_profile(game_data, performance)
        
        # Check for sync with parent network
        if time.time() - self.last_sync > self.sync_interval:
            self.sync_with_parent_network()
    
    def extract_gameplay_pattern(self, game_data):
        """Extract sophisticated gameplay patterns"""
        return {
            'timestamp': game_data['timestamp'],
            'movement_efficiency': self.calculate_movement_efficiency(game_data),
            'risk_taking': self.calculate_risk_taking(game_data),
            'exploration_tendency': self.calculate_exploration_tendency(game_data),
            'precision': self.calculate_precision(game_data),
            'speed_preference': self.calculate_speed_preference(game_data),
            'wall_climbing_frequency': self.calculate_wall_climbing_frequency(game_data),
            'recovery_ability': self.calculate_recovery_ability(game_data),
            'consistency': self.calculate_consistency(game_data)
        }
    
    def calculate_movement_efficiency(self, game_data):
        """Calculate how efficiently the player moves"""
        velocity = game_data['car_velocity']
        speed = np.sqrt(velocity[0]**2 + velocity[1]**2)
        walls_nearby = len(game_data['walls_nearby'])
        
        # Higher efficiency = good speed with obstacle avoidance
        efficiency = speed / (1 + walls_nearby * 0.1)
        return min(1.0, efficiency / 10.0)
    
    def calculate_risk_taking(self, game_data):
        """Calculate player's risk-taking behavior"""
        speed = np.sqrt(game_data['car_velocity'][0]**2 + game_data['car_velocity'][1]**2)
        walls_nearby = len(game_data['walls_nearby'])
        
        # High speed near walls = high risk taking
        if walls_nearby > 0:
            risk = speed / (5 + walls_nearby)
        else:
            risk = 0.3
        
        return min(1.0, risk)
    
    def calculate_exploration_tendency(self, game_data):
        """Calculate how much the player explores"""
        # This would be based on position history, simplified here
        position_variance = np.random.rand() * 0.8 + 0.2  # Placeholder
        return position_variance
    
    def calculate_precision(self, game_data):
        """Calculate player's precision in movement"""
        # Based on input consistency and wall proximity
        input_keys = game_data['input_keys']
        active_inputs = sum(input_keys)
        
        # More focused input = higher precision
        precision = 1.0 - (active_inputs / 4.0) * 0.5
        return max(0.1, precision)
    
    def calculate_speed_preference(self, game_data):
        """Calculate player's speed preference"""
        speed = np.sqrt(game_data['car_velocity'][0]**2 + game_data['car_velocity'][1]**2)
        return min(1.0, speed / 12.0)
    
    def calculate_wall_climbing_frequency(self, game_data):
        """Calculate how often player climbs walls"""
        walls_nearby = len(game_data['walls_nearby'])
        return min(1.0, walls_nearby / 5.0)
    
    def calculate_recovery_ability(self, game_data):
        """Calculate player's ability to recover from mistakes"""
        # Simplified - would track actual recovery events
        return np.random.rand() * 0.6 + 0.4  # Placeholder
    
    def calculate_consistency(self, game_data):
        """Calculate player's consistency"""
        # Based on performance over time
        if len(self.performance_metrics) < 2:
            return 0.5
        
        recent_performances = [p['overall_performance'] for p in self.performance_metrics[-10:]]
        consistency = 1.0 - np.std(recent_performances)
        return max(0.0, min(1.0, consistency))
    
    def calculate_performance_metrics(self, game_data):
        """Calculate comprehensive performance metrics"""
        speed = np.sqrt(game_data['car_velocity'][0]**2 + game_data['car_velocity'][1]**2)
        walls_nearby = len(game_data['walls_nearby'])
        
        # Calculate various performance aspects
        speed_score = min(1.0, speed / 10.0)
        navigation_score = max(0.0, 1.0 - walls_nearby / 10.0)
        control_score = self.calculate_precision(game_data)
        
        overall_performance = (speed_score + navigation_score + control_score) / 3.0
        
        return {
            'timestamp': game_data['timestamp'],
            'speed_score': speed_score,
            'navigation_score': navigation_score,
            'control_score': control_score,
            'overall_performance': overall_performance,
            'engagement_level': self.estimate_engagement_level(game_data)
        }
    
    def estimate_engagement_level(self, game_data):
        """Estimate player engagement level"""
        # Based on input activity and game progression
        active_inputs = sum(game_data['input_keys'])
        input_engagement = active_inputs / 4.0
        
        # Time-based engagement (simplified)
        time_engagement = min(1.0, game_data['timestamp'] / 60000.0)  # Normalize to minutes
        
        return (input_engagement + time_engagement) / 2.0
    
    def update_player_profile(self, game_data, performance):
        """Update player profile based on gameplay"""
        self.player_profile['total_playtime'] += 1
        
        # Update skill level based on performance
        current_skill = self.player_profile['skill_level']
        performance_score = performance['overall_performance']
        
        # Adaptive learning rate
        learning_rate = self.player_profile['learning_rate']
        skill_adjustment = (performance_score - current_skill) * learning_rate
        
        self.player_profile['skill_level'] = max(0.0, min(1.0, current_skill + skill_adjustment))
        
        # Update preferred difficulty
        if performance_score > 0.8:
            self.player_profile['preferred_difficulty'] = min(1.0, self.player_profile['preferred_difficulty'] + 0.01)
        elif performance_score < 0.4:
            self.player_profile['preferred_difficulty'] = max(0.0, self.player_profile['preferred_difficulty'] - 0.01)
        
        # Update play style
        self.update_play_style(game_data)
    
    def update_play_style(self, game_data):
        """Update player's play style classification"""
        speed = np.sqrt(game_data['car_velocity'][0]**2 + game_data['car_velocity'][1]**2)
        walls_nearby = len(game_data['walls_nearby'])
        
        # Classify play style
        if speed > 8 and walls_nearby > 2:
            style = 'aggressive'
        elif speed < 4 and walls_nearby < 1:
            style = 'cautious'
        elif walls_nearby > 3:
            style = 'explorer'
        else:
            style = 'balanced'
        
        self.player_profile['play_style'] = style
    
    def generate_personalized_difficulty(self):
        """Generate personalized difficulty based on neural network"""
        try:
            # Prepare input features
            features = [
                self.player_profile['skill_level'],
                self.player_profile['preferred_difficulty'],
                self.player_profile['total_playtime'] / 1000.0,
                self.player_profile['successful_climbs'] / max(1, self.player_profile['total_playtime']),
                self.player_profile['failed_attempts'] / max(1, self.player_profile['total_playtime']),
                *self.get_recent_performance_features(),
                *self.get_engagement_features(),
                *self.get_play_style_features()
            ]
            
            # Pad features to required length
            while len(features) < 25:
                features.append(0.5)
            
            # Predict optimal difficulty
            difficulty_prediction = self.difficulty_model.predict(
                np.array([features]), verbose=0
            )[0][0]
            
            return difficulty_prediction
            
        except Exception as e:
            print(f"Error generating personalized difficulty: {e}")
            return self.player_profile['preferred_difficulty']
    
    def get_recent_performance_features(self):
        """Get features from recent performance"""
        if len(self.performance_metrics) < 5:
            return [0.5] * 10
        
        recent = self.performance_metrics[-5:]
        return [
            np.mean([p['speed_score'] for p in recent]),
            np.mean([p['navigation_score'] for p in recent]),
            np.mean([p['control_score'] for p in recent]),
            np.mean([p['overall_performance'] for p in recent]),
            np.std([p['overall_performance'] for p in recent]),
            np.mean([p['engagement_level'] for p in recent]),
            max([p['overall_performance'] for p in recent]),
            min([p['overall_performance'] for p in recent]),
            len([p for p in recent if p['overall_performance'] > 0.7]),
            len([p for p in recent if p['overall_performance'] < 0.3])
        ]
    
    def get_engagement_features(self):
        """Get engagement-related features"""
        if len(self.performance_metrics) < 3:
            return [0.5] * 5
        
        recent_engagement = [p['engagement_level'] for p in self.performance_metrics[-10:]]
        return [
            np.mean(recent_engagement),
            np.std(recent_engagement),
            max(recent_engagement),
            min(recent_engagement),
            len([e for e in recent_engagement if e > 0.7]) / len(recent_engagement)
        ]
    
    def get_play_style_features(self):
        """Get play style features"""
        style_mapping = {
            'aggressive': [1.0, 0.0, 0.0, 0.0],
            'cautious': [0.0, 1.0, 0.0, 0.0],
            'explorer': [0.0, 0.0, 1.0, 0.0],
            'balanced': [0.0, 0.0, 0.0, 1.0]
        }
        
        return style_mapping.get(self.player_profile['play_style'], [0.25, 0.25, 0.25, 0.25])
    
    def sync_with_parent_network(self):
        """Sync with parent network (simulated)"""
        try:
            # Prepare data for parent network
            sync_data = {
                'player_id': self.player_id,
                'player_profile': self.player_profile,
                'gameplay_patterns': self.gameplay_patterns[-100:],  # Last 100 patterns
                'performance_metrics': self.performance_metrics[-100:],
                'local_model_weights': self.get_local_model_summary(),
                'timestamp': time.time()
            }
            
            # Simulate parent network communication
            # In real implementation, this would be an API call
            parent_response = self.simulate_parent_network_response(sync_data)
            
            # Apply parent network updates
            self.apply_parent_updates(parent_response)
            
            self.last_sync = time.time()
            print(f"Synced with parent network - received {len(parent_response.get('updates', []))} updates")
            
        except Exception as e:
            print(f"Error syncing with parent network: {e}")
    
    def simulate_parent_network_response(self, sync_data):
        """Simulate parent network response"""
        # In real implementation, this would be the parent network's analysis
        return {
            'global_difficulty_adjustment': np.random.uniform(-0.1, 0.1),
            'new_content_parameters': np.random.rand(50),
            'recommended_features': ['wall_climbing_enhancement', 'speed_boost_zones'],
            'global_player_insights': {
                'average_skill_level': 0.6,
                'popular_play_styles': ['balanced', 'explorer'],
                'trending_difficulties': [0.5, 0.7]
            },
            'model_updates': {
                'difficulty_adjustment': np.random.rand(10),
                'content_generation': np.random.rand(15)
            },
            'updates': ['enhanced_graphics', 'new_level_type']
        }
    
    def apply_parent_updates(self, parent_response):
        """Apply updates from parent network"""
        # Apply global difficulty adjustment
        global_adjustment = parent_response.get('global_difficulty_adjustment', 0)
        self.player_profile['preferred_difficulty'] += global_adjustment
        self.player_profile['preferred_difficulty'] = max(0.0, min(1.0, self.player_profile['preferred_difficulty']))
        
        # Store new content parameters
        self.parent_updates.append({
            'timestamp': time.time(),
            'content_parameters': parent_response.get('new_content_parameters', []),
            'recommended_features': parent_response.get('recommended_features', []),
            'global_insights': parent_response.get('global_player_insights', {})
        })
        
        # Update local models with parent insights
        self.update_local_models_from_parent(parent_response.get('model_updates', {}))
    
    def update_local_models_from_parent(self, model_updates):
        """Update local models with parent network insights"""
        try:
            # This would involve updating model weights based on parent network feedback
            # Simplified implementation
            if 'difficulty_adjustment' in model_updates:
                print("Updated difficulty model with parent network insights")
            
            if 'content_generation' in model_updates:
                print("Updated content generation model with parent network insights")
                
        except Exception as e:
            print(f"Error updating local models: {e}")
    
    def get_local_model_summary(self):
        """Get summary of local model performance"""
        return {
            'difficulty_model_accuracy': np.random.rand(),
            'engagement_model_accuracy': np.random.rand(),
            'content_model_performance': np.random.rand(),
            'training_iterations': len(self.performance_metrics),
            'player_unique_patterns': len(set(p['play_style'] for p in [self.player_profile]))
        }
    
    def generate_ai_enhanced_level(self):
        """Generate level using both local and parent network insights"""
        # Get base AI suggestions from local network
        base_suggestions = self.local_brain.generate_level_suggestions()
        
        # Enhance with personalized difficulty
        personalized_difficulty = self.generate_personalized_difficulty()
        
        # Apply parent network insights
        parent_insights = self.get_latest_parent_insights()
        
        # Combine all insights
        enhanced_suggestions = {
            **base_suggestions,
            'personalized_difficulty': personalized_difficulty,
            'player_style_adaptation': self.get_style_specific_adaptations(),
            'parent_network_features': parent_insights.get('recommended_features', []),
            'global_trends': parent_insights.get('global_insights', {}),
            'enhanced_graphics': True,
            'dynamic_content': True
        }
        
        return enhanced_suggestions
    
    def get_latest_parent_insights(self):
        """Get latest insights from parent network"""
        if not self.parent_updates:
            return {}
        
        return self.parent_updates[-1]
    
    def get_style_specific_adaptations(self):
        """Get adaptations specific to player's style"""
        style = self.player_profile['play_style']
        
        adaptations = {
            'aggressive': {
                'more_obstacles': True,
                'faster_gameplay': True,
                'risk_reward_balance': 0.8
            },
            'cautious': {
                'more_safe_zones': True,
                'clearer_paths': True,
                'risk_reward_balance': 0.3
            },
            'explorer': {
                'hidden_areas': True,
                'multiple_paths': True,
                'discovery_rewards': True
            },
            'balanced': {
                'varied_challenges': True,
                'moderate_difficulty': True,
                'balanced_features': True
            }
        }
        
        return adaptations.get(style, adaptations['balanced'])
    
    def start_background_sync(self):
        """Start background thread for periodic sync"""
        def sync_worker():
            while True:
                time.sleep(self.sync_interval)
                self.sync_with_parent_network()
        
        sync_thread = threading.Thread(target=sync_worker, daemon=True)
        sync_thread.start()
    
    def save_distributed_data(self):
        """Save distributed neural network data"""
        try:
            # Save player profile
            with open(f"neural_data/player_profile_{self.player_id}.json", 'w') as f:
                json.dump(self.player_profile, f, indent=2)
            
            # Save gameplay patterns
            with open(f"neural_data/gameplay_patterns_{self.player_id}.pkl", 'wb') as f:
                pickle.dump(self.gameplay_patterns, f)
            
            # Save performance metrics
            with open(f"neural_data/performance_metrics_{self.player_id}.pkl", 'wb') as f:
                pickle.dump(self.performance_metrics, f)
            
            # Save local models
            self.save_advanced_models()
            
            # Save parent updates
            with open(f"neural_data/parent_updates_{self.player_id}.json", 'w') as f:
                json.dump(self.parent_updates, f, indent=2)
            
            print(f"Distributed neural network data saved for player {self.player_id}")
            
        except Exception as e:
            print(f"Error saving distributed data: {e}")
    
    def load_player_profile(self):
        """Load existing player profile"""
        try:
            profile_file = f"neural_data/player_profile_{self.player_id}.json"
            if os.path.exists(profile_file):
                with open(profile_file, 'r') as f:
                    self.player_profile = json.load(f)
                print(f"Loaded existing player profile for {self.player_id}")
        except Exception as e:
            print(f"Error loading player profile: {e}")
    
    def save_advanced_models(self):
        """Save advanced neural network models"""
        try:
            models_dir = f"neural_data/models_{self.player_id}"
            os.makedirs(models_dir, exist_ok=True)
            
            self.difficulty_model.save(os.path.join(models_dir, 'difficulty_model.h5'))
            self.engagement_model.save(os.path.join(models_dir, 'engagement_model.h5'))
            self.content_generation_model.save(os.path.join(models_dir, 'content_generation_model.h5'))
            
            print("Advanced models saved successfully")
        except Exception as e:
            print(f"Error saving advanced models: {e}")
    
    def load_advanced_models(self):
        """Load existing advanced models"""
        try:
            models_dir = f"neural_data/models_{self.player_id}"
            
            if os.path.exists(os.path.join(models_dir, 'difficulty_model.h5')):
                self.difficulty_model = keras.models.load_model(
                    os.path.join(models_dir, 'difficulty_model.h5')
                )
                print("Difficulty model loaded")
            
            if os.path.exists(os.path.join(models_dir, 'engagement_model.h5')):
                self.engagement_model = keras.models.load_model(
                    os.path.join(models_dir, 'engagement_model.h5')
                )
                print("Engagement model loaded")
            
            if os.path.exists(os.path.join(models_dir, 'content_generation_model.h5')):
                self.content_generation_model = keras.models.load_model(
                    os.path.join(models_dir, 'content_generation_model.h5')
                )
                print("Content generation model loaded")
                
        except Exception as e:
            print(f"Error loading advanced models: {e}")
    
    def get_analytics_dashboard(self):
        """Get comprehensive analytics for the player"""
        return {
            'player_profile': self.player_profile,
            'total_gameplay_patterns': len(self.gameplay_patterns),
            'performance_trend': self.get_performance_trend(),
            'skill_progression': self.get_skill_progression(),
            'engagement_analysis': self.get_engagement_analysis(),
            'parent_network_contributions': len(self.parent_updates),
            'local_network_stats': self.local_brain.get_analytics(),
            'personalized_insights': self.get_personalized_insights()
        }
    
    def get_performance_trend(self):
        """Get performance trend over time"""
        if len(self.performance_metrics) < 5:
            return {'trend': 'insufficient_data'}
        
        recent_performances = [p['overall_performance'] for p in self.performance_metrics[-10:]]
        older_performances = [p['overall_performance'] for p in self.performance_metrics[-20:-10]]
        
        if not older_performances:
            return {'trend': 'improving', 'current_level': np.mean(recent_performances)}
        
        recent_avg = np.mean(recent_performances)
        older_avg = np.mean(older_performances)
        
        if recent_avg > older_avg + 0.05:
            trend = 'improving'
        elif recent_avg < older_avg - 0.05:
            trend = 'declining'
        else:
            trend = 'stable'
        
        return {
            'trend': trend,
            'current_level': recent_avg,
            'improvement_rate': recent_avg - older_avg
        }
    
    def get_skill_progression(self):
        """Get skill progression analysis"""
        return {
            'current_skill_level': self.player_profile['skill_level'],
            'preferred_difficulty': self.player_profile['preferred_difficulty'],
            'play_style': self.player_profile['play_style'],
            'total_playtime': self.player_profile['total_playtime'],
            'success_rate': self.player_profile['successful_climbs'] / max(1, self.player_profile['total_playtime']),
            'learning_efficiency': self.player_profile['skill_level'] / max(1, self.player_profile['total_playtime'] / 100)
        }
    
    def get_engagement_analysis(self):
        """Get engagement analysis"""
        if len(self.performance_metrics) < 3:
            return {'status': 'insufficient_data'}
        
        recent_engagement = [p['engagement_level'] for p in self.performance_metrics[-10:]]
        avg_engagement = np.mean(recent_engagement)
        
        if avg_engagement > 0.7:
            status = 'highly_engaged'
        elif avg_engagement > 0.4:
            status = 'moderately_engaged'
        else:
            status = 'low_engagement'
        
        return {
            'status': status,
            'average_engagement': avg_engagement,
            'engagement_consistency': 1.0 - np.std(recent_engagement)
        }
    
    def get_personalized_insights(self):
        """Get personalized insights for the player"""
        return {
            'recommended_difficulty': self.generate_personalized_difficulty(),
            'suggested_improvements': self.generate_improvement_suggestions(),
            'optimal_play_sessions': self.calculate_optimal_play_sessions(),
            'next_challenges': self.suggest_next_challenges()
        }
    
    def generate_improvement_suggestions(self):
        """Generate suggestions for player improvement"""
        suggestions = []
        
        if self.player_profile['skill_level'] < 0.3:
            suggestions.append("Practice basic movement and wall climbing")
        elif self.player_profile['skill_level'] < 0.6:
            suggestions.append("Try more challenging levels to improve faster")
        else:
            suggestions.append("Experiment with different play styles")
        
        if self.player_profile['play_style'] == 'cautious':
            suggestions.append("Try taking more calculated risks for better rewards")
        elif self.player_profile['play_style'] == 'aggressive':
            suggestions.append("Practice precision and control for better consistency")
        
        return suggestions
    
    def calculate_optimal_play_sessions(self):
        """Calculate optimal play session characteristics"""
        if len(self.performance_metrics) < 5:
            return {'recommended_session_length': 15, 'recommended_break_interval': 5}
        
        # Analyze performance over time to find optimal session length
        # Simplified implementation
        return {
            'recommended_session_length': 20,  # minutes
            'recommended_break_interval': 10,   # minutes
            'optimal_difficulty_progression': 0.05  # per session
        }
    
    def suggest_next_challenges(self):
        """Suggest next challenges for the player"""
        skill_level = self.player_profile['skill_level']
        play_style = self.player_profile['play_style']
        
        challenges = []
        
        if skill_level < 0.4:
            challenges.append("Master basic wall climbing")
            challenges.append("Complete 5 levels without falling")
        elif skill_level < 0.7:
            challenges.append("Try speed run challenges")
            challenges.append("Explore all landing zones in a level")
        else:
            challenges.append("Create your own optimal routes")
            challenges.append("Help train the neural network with advanced techniques")
        
        if play_style == 'explorer':
            challenges.append("Find all hidden areas")
        elif play_style == 'aggressive':
            challenges.append("Complete levels with minimal time")
        
        return challenges