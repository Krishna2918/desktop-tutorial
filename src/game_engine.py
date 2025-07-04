import pygame
import math
import random
import numpy as np
from .car import Car
from .level_generator import LevelGenerator
from .story_generator import StoryGenerator
from .distributed_neural_brain import DistributedNeuralBrain
from .enhanced_graphics import EnhancedGraphics

class GameEngine:
    def __init__(self):
        # Screen dimensions
        self.width = 1200
        self.height = 800
        self.screen = pygame.display.set_mode((self.width, self.height))
        pygame.display.set_caption("Neural Car Adventure - AI Driven Game")
        
        # Colors
        self.BLACK = (0, 0, 0)
        self.WHITE = (255, 255, 255)
        self.RED = (255, 0, 0)
        self.GREEN = (0, 255, 0)
        self.BLUE = (0, 0, 255)
        self.GRAY = (128, 128, 128)
        self.YELLOW = (255, 255, 0)
        
        # Game objects
        self.car = Car(100, 400)
        self.level_generator = LevelGenerator()
        self.story_generator = StoryGenerator()
        self.distributed_brain = DistributedNeuralBrain()
        self.enhanced_graphics = EnhancedGraphics(self.screen)
        
        # Game state
        self.camera_x = 0
        self.camera_y = 0
        self.walls = []
        self.landing_zones = []
        self.current_story = ""
        self.game_session_data = []
        self.visual_effects = []
        self.dynamic_difficulty = 0.5
        self.performance_feedback = ""
        
        # Generate initial level
        self.generate_level()
        
        # Fonts
        self.font = pygame.font.Font(None, 36)
        self.small_font = pygame.font.Font(None, 24)
        
    def generate_level(self):
        """Generate a new level with walls and landing zones"""
        level_data = self.level_generator.generate_level()
        self.walls = level_data['walls']
        self.landing_zones = level_data['landing_zones']
        
    def generate_new_level(self, neural_brain=None):
        """Generate a new level using distributed neural network insights"""
        # Use distributed brain for enhanced level generation
        ai_suggestions = self.distributed_brain.generate_ai_enhanced_level()
        level_data = self.level_generator.generate_level_from_ai(ai_suggestions)
        self.walls = level_data['walls']
        self.landing_zones = level_data['landing_zones']
        
        # Update dynamic difficulty based on AI suggestions
        self.dynamic_difficulty = ai_suggestions.get('personalized_difficulty', 0.5)
        
        # Add visual effects for new level
        self.visual_effects.append({
            'type': 'level_transition',
            'timestamp': pygame.time.get_ticks(),
            'duration': 2000
        })
        
        # Reset car position
        self.car.reset_position(100, 400)
        
    def update(self):
        """Update game state and return data for neural network"""
        # Handle input
        keys = pygame.key.get_pressed()
        
        # Update car physics
        self.car.update(keys, self.walls)
        
        # Update camera to follow car
        self.camera_x = self.car.x - self.width // 2
        self.camera_y = self.car.y - self.height // 2
        
        # Check for landing zone collisions
        for zone in self.landing_zones:
            if self.car.check_collision_with_zone(zone):
                # Generate new story based on landing location
                story_context = {
                    'location': zone['type'],
                    'car_state': self.car.get_state(),
                    'game_time': pygame.time.get_ticks()
                }
                self.current_story = self.story_generator.generate_story(story_context)
                
                # Start new adventure/level
                self.generate_level()
                self.car.reset_position(100, 400)
                
                break
        
        # Collect enhanced data for distributed neural network
        game_data = {
            'car_position': (self.car.x, self.car.y),
            'car_velocity': (self.car.vel_x, self.car.vel_y),
            'car_angle': self.car.angle,
            'walls_nearby': self.get_nearby_walls(),
            'input_keys': [keys[pygame.K_LEFT], keys[pygame.K_RIGHT], 
                          keys[pygame.K_UP], keys[pygame.K_DOWN]],
            'timestamp': pygame.time.get_ticks(),
            'dynamic_difficulty': self.dynamic_difficulty,
            'car_state': self.car.get_state(),
            'level_complexity': len(self.walls),
            'landing_zones_available': len(self.landing_zones)
        }
        
        # Use distributed brain for enhanced data collection
        self.distributed_brain.collect_enhanced_data(game_data)
        
        # Generate performance feedback
        self.generate_performance_feedback(game_data)
        
        # Update visual effects
        self.update_visual_effects()
        
        return game_data
    
    def get_nearby_walls(self):
        """Get walls within a certain distance of the car"""
        nearby_walls = []
        car_rect = pygame.Rect(self.car.x - 100, self.car.y - 100, 200, 200)
        
        for wall in self.walls:
            wall_rect = pygame.Rect(wall['x'], wall['y'], wall['width'], wall['height'])
            if car_rect.colliderect(wall_rect):
                nearby_walls.append(wall)
        
        return nearby_walls
    
    def generate_performance_feedback(self, game_data):
        """Generate real-time performance feedback"""
        speed = math.sqrt(game_data['car_velocity'][0]**2 + game_data['car_velocity'][1]**2)
        walls_nearby = len(game_data['walls_nearby'])
        
        if speed > 10 and walls_nearby > 0:
            self.performance_feedback = "Excellent speed control near obstacles!"
        elif speed > 8:
            self.performance_feedback = "Great speed!"
        elif walls_nearby > 3:
            self.performance_feedback = "Nice wall climbing!"
        elif speed < 2:
            self.performance_feedback = "Try accelerating more"
        else:
            self.performance_feedback = ""
    
    def update_visual_effects(self):
        """Update visual effects based on gameplay"""
        current_time = pygame.time.get_ticks()
        
        # Remove expired effects
        self.visual_effects = [effect for effect in self.visual_effects 
                              if current_time - effect['timestamp'] < effect.get('duration', 1000)]
        
        # Add speed trail effect
        speed = math.sqrt(self.car.vel_x**2 + self.car.vel_y**2)
        if speed > 8:
            self.visual_effects.append({
                'type': 'speed_trail',
                'position': (self.car.x, self.car.y),
                'timestamp': current_time,
                'duration': 500
            })
        
        # Add wall climbing effect
        if self.car.on_wall:
            self.visual_effects.append({
                'type': 'wall_climbing',
                'position': (self.car.x, self.car.y),
                'timestamp': current_time,
                'duration': 300
            })
    
    def render(self):
        """Render the game with enhanced graphics"""
        self.enhanced_graphics.clear_screen()
        
        # Draw walls with enhanced graphics
        for wall in self.walls:
            wall_screen_pos = (wall['x'] - self.camera_x, wall['y'] - self.camera_y)
            self.enhanced_graphics.draw_wall(wall, wall_screen_pos)
        
        # Draw landing zones with enhanced graphics
        for zone in self.landing_zones:
            zone_screen_pos = (zone['x'] - self.camera_x, zone['y'] - self.camera_y)
            self.enhanced_graphics.draw_landing_zone(zone, zone_screen_pos)
        
        # Draw visual effects
        for effect in self.visual_effects:
            effect_screen_pos = (effect['position'][0] - self.camera_x, 
                               effect['position'][1] - self.camera_y)
            self.enhanced_graphics.draw_effect(effect, effect_screen_pos)
        
        # Draw car with enhanced graphics
        car_screen_x = self.car.x - self.camera_x
        car_screen_y = self.car.y - self.camera_y
        self.enhanced_graphics.draw_car(self.car, car_screen_x, car_screen_y)
        
        # Draw UI
        self.draw_ui()
        
        # Update display
        pygame.display.flip()
    
    def draw_ui(self):
        """Draw enhanced user interface elements"""
        # Draw controls
        controls = [
            "Arrow Keys: Move Car",
            "R: Reset Game",
            "N: Generate New Level (AI)",
            "ESC: Quit",
            "A: Analytics Dashboard"
        ]
        
        for i, control in enumerate(controls):
            text = self.small_font.render(control, True, self.WHITE)
            self.screen.blit(text, (10, 10 + i * 25))
        
        # Draw performance feedback
        if self.performance_feedback:
            feedback_text = self.small_font.render(self.performance_feedback, True, self.GREEN)
            self.screen.blit(feedback_text, (10, 140))
        
        # Draw neural network insights
        player_profile = self.distributed_brain.player_profile
        insights = [
            f"Skill Level: {player_profile['skill_level']:.2f}",
            f"Play Style: {player_profile['play_style']}",
            f"Difficulty: {self.dynamic_difficulty:.2f}",
            f"Playtime: {player_profile['total_playtime']}"
        ]
        
        for i, insight in enumerate(insights):
            text = self.small_font.render(insight, True, self.BLUE)
            self.screen.blit(text, (10, 170 + i * 25))
        
        # Draw current story
        if self.current_story:
            story_lines = self.current_story.split('\n')
            for i, line in enumerate(story_lines[:3]):  # Show first 3 lines
                text = self.small_font.render(line, True, self.YELLOW)
                self.screen.blit(text, (10, self.height - 100 + i * 25))
        
        # Draw car stats
        stats = [
            f"Speed: {self.car.get_speed():.1f}",
            f"Angle: {self.car.angle:.1f}°",
            f"Position: ({self.car.x:.0f}, {self.car.y:.0f})",
            f"Wall Climbing: {'Yes' if self.car.on_wall else 'No'}",
            f"Ground Contact: {'Yes' if self.car.on_ground else 'No'}"
        ]
        
        for i, stat in enumerate(stats):
            text = self.small_font.render(stat, True, self.WHITE)
            self.screen.blit(text, (self.width - 220, 10 + i * 25))
    
    def reset(self):
        """Reset the game"""
        self.car.reset_position(100, 400)
        self.generate_level()
        self.current_story = ""
        self.visual_effects = []
        self.performance_feedback = ""
        
        # Save distributed brain data
        self.distributed_brain.save_distributed_data()
    
    def show_analytics_dashboard(self):
        """Display analytics dashboard"""
        analytics = self.distributed_brain.get_analytics_dashboard()
        
        # Create a simple analytics display
        analytics_screen = pygame.Surface((800, 600))
        analytics_screen.fill((20, 20, 40))
        
        font = pygame.font.Font(None, 24)
        title_font = pygame.font.Font(None, 32)
        
        y_offset = 20
        
        # Title
        title = title_font.render("Neural Network Analytics Dashboard", True, (255, 255, 255))
        analytics_screen.blit(title, (20, y_offset))
        y_offset += 50
        
        # Player Profile
        profile_title = font.render("Player Profile:", True, (255, 255, 0))
        analytics_screen.blit(profile_title, (20, y_offset))
        y_offset += 30
        
        profile_data = [
            f"Skill Level: {analytics['player_profile']['skill_level']:.3f}",
            f"Play Style: {analytics['player_profile']['play_style']}",
            f"Total Playtime: {analytics['player_profile']['total_playtime']}",
            f"Preferred Difficulty: {analytics['player_profile']['preferred_difficulty']:.3f}"
        ]
        
        for data in profile_data:
            text = font.render(data, True, (255, 255, 255))
            analytics_screen.blit(text, (40, y_offset))
            y_offset += 25
        
        # Performance Trend
        y_offset += 20
        trend_title = font.render("Performance Trend:", True, (255, 255, 0))
        analytics_screen.blit(trend_title, (20, y_offset))
        y_offset += 30
        
        trend_data = analytics['performance_trend']
        if trend_data.get('trend') != 'insufficient_data':
            trend_info = [
                f"Trend: {trend_data['trend'].title()}",
                f"Current Level: {trend_data['current_level']:.3f}",
                f"Improvement Rate: {trend_data.get('improvement_rate', 0):.3f}"
            ]
            
            for data in trend_info:
                text = font.render(data, True, (255, 255, 255))
                analytics_screen.blit(text, (40, y_offset))
                y_offset += 25
        else:
            text = font.render("Not enough data yet", True, (255, 255, 255))
            analytics_screen.blit(text, (40, y_offset))
            y_offset += 25
        
        # Engagement Analysis
        y_offset += 20
        engagement_title = font.render("Engagement Analysis:", True, (255, 255, 0))
        analytics_screen.blit(engagement_title, (20, y_offset))
        y_offset += 30
        
        engagement_data = analytics['engagement_analysis']
        if engagement_data.get('status') != 'insufficient_data':
            engagement_info = [
                f"Status: {engagement_data['status'].replace('_', ' ').title()}",
                f"Average Engagement: {engagement_data['average_engagement']:.3f}",
                f"Consistency: {engagement_data['engagement_consistency']:.3f}"
            ]
            
            for data in engagement_info:
                text = font.render(data, True, (255, 255, 255))
                analytics_screen.blit(text, (40, y_offset))
                y_offset += 25
        else:
            text = font.render("Not enough data yet", True, (255, 255, 255))
            analytics_screen.blit(text, (40, y_offset))
            y_offset += 25
        
        # Network Stats
        y_offset += 20
        network_title = font.render("Neural Network Stats:", True, (255, 255, 0))
        analytics_screen.blit(network_title, (20, y_offset))
        y_offset += 30
        
        network_info = [
            f"Gameplay Patterns: {analytics['total_gameplay_patterns']}",
            f"Parent Network Updates: {analytics['parent_network_contributions']}",
            f"Local Network Sessions: {analytics['local_network_stats'].get('total_sessions', 0)}"
        ]
        
        for data in network_info:
            text = font.render(data, True, (255, 255, 255))
            analytics_screen.blit(text, (40, y_offset))
            y_offset += 25
        
        # Instructions
        y_offset += 40
        instructions = font.render("Press any key to return to game", True, (255, 255, 0))
        analytics_screen.blit(instructions, (20, y_offset))
        
        # Show analytics screen
        self.screen.blit(analytics_screen, (200, 100))
        pygame.display.flip()
        
        # Wait for key press
        waiting = True
        while waiting:
            for event in pygame.event.get():
                if event.type == pygame.KEYDOWN or event.type == pygame.QUIT:
                    waiting = False