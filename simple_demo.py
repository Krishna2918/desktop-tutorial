#!/usr/bin/env python3
"""
Neural Car Adventure - Demo Version
A simplified version that demonstrates the core concepts without heavy dependencies.
"""

import random
import math
import json
import os
import time
from datetime import datetime

# Mock pygame for demonstration
class MockPygame:
    def __init__(self):
        self.K_LEFT = 'left'
        self.K_RIGHT = 'right' 
        self.K_UP = 'up'
        self.K_DOWN = 'down'
        self.K_r = 'r'
        self.K_n = 'n'
        self.K_a = 'a'
        self.K_ESCAPE = 'escape'
        
    def init(self):
        pass
        
    def quit(self):
        pass

# Simple Car class
class Car:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.vel_x = 0
        self.vel_y = 0
        self.angle = 0
        self.width = 30
        self.height = 15
        self.max_speed = 8
        self.acceleration = 0.3
        self.friction = 0.85
        self.gravity = 0.5
        self.on_ground = False
        self.on_wall = False
        
    def update(self, input_keys, walls):
        # Simple physics simulation
        if not self.on_ground and not self.on_wall:
            self.vel_y += self.gravity
            
        # Handle input
        if 'left' in input_keys:
            self.vel_x -= self.acceleration
            self.angle -= 2
        if 'right' in input_keys:
            self.vel_x += self.acceleration  
            self.angle += 2
        if 'up' in input_keys and self.on_ground:
            self.vel_y = -12
            
        # Apply friction
        self.vel_x *= self.friction
        
        # Update position
        self.x += self.vel_x
        self.y += self.vel_y
        
        # Simple collision detection
        self.on_ground = self.y > 400
        if self.on_ground:
            self.y = 400
            self.vel_y = 0
            
    def get_speed(self):
        return math.sqrt(self.vel_x**2 + self.vel_y**2)
        
    def get_state(self):
        return {
            'position': (self.x, self.y),
            'velocity': (self.vel_x, self.vel_y),
            'angle': self.angle,
            'on_ground': self.on_ground,
            'on_wall': self.on_wall,
            'speed': self.get_speed()
        }

# Simple Neural Brain (no TensorFlow)
class SimpleNeuralBrain:
    def __init__(self):
        self.player_id = f"player_{random.randint(1000, 9999)}"
        self.session_data = []
        self.player_profile = {
            'player_id': self.player_id,
            'skill_level': 0.5,
            'preferred_difficulty': 0.5,
            'play_style': 'balanced',
            'total_playtime': 0,
            'successful_climbs': 0,
            'failed_attempts': 0
        }
        self.patterns = []
        self.performance_metrics = []
        
    def collect_data(self, game_data):
        """Collect and analyze game data"""
        # Simple pattern recognition
        speed = math.sqrt(game_data['car_velocity'][0]**2 + game_data['car_velocity'][1]**2)
        
        pattern = {
            'timestamp': time.time(),
            'speed': speed,
            'input_activity': sum(game_data['input_keys']),
            'position': game_data['car_position']
        }
        
        self.patterns.append(pattern)
        self.session_data.append(game_data)
        
        # Update player profile
        self.player_profile['total_playtime'] += 1
        
        # Simple learning: adjust skill level based on performance
        if speed > 8:
            self.player_profile['skill_level'] = min(1.0, self.player_profile['skill_level'] + 0.001)
        elif speed < 2:
            self.player_profile['skill_level'] = max(0.0, self.player_profile['skill_level'] - 0.001)
            
        # Classify play style
        if speed > 6:
            self.player_profile['play_style'] = 'aggressive'
        elif speed < 3:
            self.player_profile['play_style'] = 'cautious'
        else:
            self.player_profile['play_style'] = 'balanced'
            
    def generate_level_suggestions(self):
        """Generate level suggestions based on collected data"""
        # Simple AI: adjust difficulty based on player performance
        avg_speed = 5
        if len(self.patterns) > 10:
            recent_speeds = [p['speed'] for p in self.patterns[-10:]]
            avg_speed = sum(recent_speeds) / len(recent_speeds)
            
        difficulty = min(1.0, avg_speed / 10.0)
        
        return {
            'difficulty': difficulty,
            'wall_density': 0.4 + (difficulty * 0.3),
            'vertical_challenge': 0.6 + (difficulty * 0.2),
            'horizontal_spread': 0.5,
            'landing_zones': max(3, int(6 - difficulty * 3)),
            'story_complexity': difficulty
        }
        
    def get_analytics(self):
        """Get player analytics"""
        if not self.patterns:
            return {'status': 'No data yet'}
            
        recent_patterns = self.patterns[-20:] if len(self.patterns) > 20 else self.patterns
        avg_speed = sum(p['speed'] for p in recent_patterns) / len(recent_patterns)
        
        return {
            'player_profile': self.player_profile,
            'average_speed': avg_speed,
            'total_patterns': len(self.patterns),
            'session_length': len(self.session_data),
            'performance_trend': 'improving' if avg_speed > 5 else 'stable'
        }
        
    def save_data(self):
        """Save neural network data"""
        os.makedirs('neural_data', exist_ok=True)
        
        with open(f'neural_data/player_profile_{self.player_id}.json', 'w') as f:
            json.dump(self.player_profile, f, indent=2)
            
        with open(f'neural_data/patterns_{self.player_id}.json', 'w') as f:
            json.dump(self.patterns, f, indent=2)
            
        print(f"✅ Saved data for player {self.player_id}")

# Simple Story Generator
class SimpleStoryGenerator:
    def __init__(self):
        self.stories = {
            'forest': [
                "You discover an ancient forest where the trees whisper secrets of forgotten races.",
                "Glowing mushrooms light your path through this mystical woodland realm.",
                "The forest spirits have recognized your car as a worthy traveler."
            ],
            'city': [
                "Neon lights reflect off your windshield in this futuristic metropolis.",
                "The city's AI has detected your arrival and opens new pathways.",
                "Skyscrapers stretch infinitely upward, defying the laws of physics."
            ],
            'desert': [
                "Ancient ruins emerge from the sand dunes as you explore.",
                "The desert holds memories of time travelers who came before.",
                "Mirages show glimpses of other dimensions waiting to be explored."
            ]
        }
        
    def generate_story(self, context):
        """Generate a story based on context"""
        location = context.get('location', 'forest')
        stories = self.stories.get(location, self.stories['forest'])
        
        base_story = random.choice(stories)
        car_state = context.get('car_state', {})
        
        if car_state.get('speed', 0) > 8:
            addition = " Your high-speed arrival has stirred ancient energies!"
        elif car_state.get('speed', 0) < 3:
            addition = " Your careful approach reveals hidden details."
        else:
            addition = " The realm welcomes another explorer."
            
        return base_story + addition

# Simple Game Engine
class SimpleGameEngine:
    def __init__(self):
        print("🎮 Neural Car Adventure - Demo Version")
        print("=" * 50)
        
        self.car = Car(100, 400)
        self.neural_brain = SimpleNeuralBrain()
        self.story_generator = SimpleStoryGenerator()
        
        self.walls = self.generate_simple_level()
        self.landing_zones = [
            {'x': 500, 'y': 350, 'width': 100, 'height': 50, 'type': 'forest'},
            {'x': 800, 'y': 300, 'width': 100, 'height': 50, 'type': 'city'},
            {'x': 1200, 'y': 400, 'width': 100, 'height': 50, 'type': 'desert'}
        ]
        
        self.current_story = ""
        self.game_time = 0
        
    def generate_simple_level(self):
        """Generate a simple level layout"""
        walls = []
        
        # Ground platforms
        for i in range(5):
            x = 200 + i * 200
            y = 450 + random.randint(-50, 50)
            walls.append({
                'x': x, 'y': y, 'width': 150, 'height': 30, 'type': 'platform'
            })
            
        # Vertical walls for climbing
        for i in range(3):
            x = 300 + i * 300
            y = 250
            walls.append({
                'x': x, 'y': y, 'width': 40, 'height': 200, 'type': 'wall'
            })
            
        return walls
        
    def update(self, input_keys):
        """Update game state"""
        self.game_time += 1
        
        # Update car
        self.car.update(input_keys, self.walls)
        
        # Check landing zone collisions
        for zone in self.landing_zones:
            if (zone['x'] <= self.car.x <= zone['x'] + zone['width'] and
                zone['y'] <= self.car.y <= zone['y'] + zone['height']):
                
                # Generate new story
                story_context = {
                    'location': zone['type'],
                    'car_state': self.car.get_state(),
                    'game_time': self.game_time
                }
                self.current_story = self.story_generator.generate_story(story_context)
                
                # Reset for new adventure
                self.car.x = 100
                self.car.y = 400
                self.walls = self.generate_simple_level()
                break
                
        # Collect neural network data
        game_data = {
            'car_position': (self.car.x, self.car.y),
            'car_velocity': (self.car.vel_x, self.car.vel_y),
            'car_angle': self.car.angle,
            'walls_nearby': [w for w in self.walls if abs(w['x'] - self.car.x) < 200],
            'input_keys': [k in input_keys for k in ['left', 'right', 'up', 'down']],
            'timestamp': self.game_time
        }
        
        self.neural_brain.collect_data(game_data)
        
        return game_data
        
    def generate_ai_level(self):
        """Generate new level using AI suggestions"""
        suggestions = self.neural_brain.generate_level_suggestions()
        
        print(f"\n🧠 AI Generated Level (Difficulty: {suggestions['difficulty']:.2f})")
        
        # Generate level based on AI suggestions
        num_platforms = int(5 * suggestions['wall_density'])
        num_walls = int(4 * suggestions['vertical_challenge'])
        
        walls = []
        
        # AI-suggested platforms
        for i in range(num_platforms):
            x = random.randint(100, 1000)
            y = random.randint(300, 500)
            width = int(150 * (2 - suggestions['difficulty']))  # Smaller platforms for higher difficulty
            walls.append({
                'x': x, 'y': y, 'width': width, 'height': 30, 'type': 'platform'
            })
            
        # AI-suggested climbing walls
        for i in range(num_walls):
            x = random.randint(200, 800)
            y = 200
            height = int(200 * suggestions['vertical_challenge'])
            walls.append({
                'x': x, 'y': y, 'width': 40, 'height': height, 'type': 'wall'
            })
            
        self.walls = walls
        self.car.x = 100
        self.car.y = 400
        
        print("✅ New AI-generated level created!")
        
    def show_analytics(self):
        """Show neural network analytics"""
        analytics = self.neural_brain.get_analytics()
        
        print("\n📊 Neural Network Analytics Dashboard")
        print("=" * 50)
        
        if analytics.get('status') == 'No data yet':
            print("No data collected yet. Play the game to see analytics!")
            return
            
        profile = analytics['player_profile']
        
        print(f"Player ID: {profile['player_id']}")
        print(f"Skill Level: {profile['skill_level']:.3f}")
        print(f"Play Style: {profile['play_style']}")
        print(f"Preferred Difficulty: {profile['preferred_difficulty']:.3f}")
        print(f"Total Playtime: {profile['total_playtime']} frames")
        print(f"Average Speed: {analytics['average_speed']:.2f}")
        print(f"Performance Trend: {analytics['performance_trend']}")
        print(f"Data Points Collected: {analytics['total_patterns']}")
        
        if profile['play_style'] == 'aggressive':
            print("\n💡 AI Insight: You prefer high-speed, risky gameplay!")
        elif profile['play_style'] == 'cautious':
            print("\n💡 AI Insight: You take a careful, methodical approach!")
        else:
            print("\n💡 AI Insight: You have a balanced play style!")
            
        print(f"\n🎯 Recommended Difficulty: {self.neural_brain.generate_level_suggestions()['difficulty']:.2f}")
        
    def render_text_mode(self):
        """Simple text-based rendering"""
        print(f"\n🚗 Car Position: ({self.car.x:.0f}, {self.car.y:.0f})")
        print(f"⚡ Speed: {self.car.get_speed():.1f}")
        print(f"🎮 Playtime: {self.game_time} frames")
        
        if self.current_story:
            print(f"\n📖 Story: {self.current_story}")
            
        # Show nearby elements
        nearby_walls = [w for w in self.walls if abs(w['x'] - self.car.x) < 100]
        if nearby_walls:
            print(f"🧱 Walls nearby: {len(nearby_walls)}")
            
        nearby_zones = [z for z in self.landing_zones if abs(z['x'] - self.car.x) < 100]
        if nearby_zones:
            zone_types = [z['type'] for z in nearby_zones]
            print(f"🎯 Landing zones nearby: {', '.join(zone_types)}")

def main():
    """Main demo function"""
    print("🧠 Neural Car Adventure - AI Demo")
    print("This is a simplified demonstration of the neural network concepts.")
    print("\nThe full version includes:")
    print("• Beautiful graphics with pygame")
    print("• Advanced TensorFlow neural networks")
    print("• Distributed learning system")
    print("• Enhanced visual effects")
    print("• Wall climbing physics")
    print("\n" + "="*60)
    
    game = SimpleGameEngine()
    
    # Simulate some gameplay
    input_sequences = [
        ['right', 'right', 'up'],          # Jump and move right
        ['right', 'right', 'right'],       # Speed up
        ['left', 'up'],                    # Change direction
        ['right', 'right', 'right', 'up'], # High speed jump
        [],                                # Coast
        ['left', 'left'],                  # Slow down
        ['right', 'up', 'right'],          # Another jump
    ]
    
    print("\n🎮 Simulating Gameplay...")
    print("(In the full version, you would use arrow keys to control the car)")
    
    for i, inputs in enumerate(input_sequences):
        print(f"\nFrame {i+1}: Inputs = {inputs}")
        game.update(inputs)
        game.render_text_mode()
        
        if i == 3:  # Show AI level generation after some gameplay
            print("\n🤖 Neural Network has learned from your gameplay!")
            game.generate_ai_level()
            
        time.sleep(1)  # Pause for demo
    
    # Show final analytics
    game.show_analytics()
    
    # Save neural network data
    game.neural_brain.save_data()
    
    print(f"\n🎉 Demo completed!")
    print("\nTo run the full version:")
    print("1. Install required packages: pygame, tensorflow, numpy, matplotlib")
    print("2. Run: python main.py")
    print("\nThe full game includes:")
    print("• Real-time graphics and animations")
    print("• Advanced neural networks that learn from your play style")
    print("• Distributed learning that improves the game for everyone")
    print("• Wall climbing physics and enhanced car mechanics")
    print("• Dynamic story generation and procedural levels")

if __name__ == "__main__":
    main()