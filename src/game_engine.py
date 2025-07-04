import pygame
import math
import random
import numpy as np
from .car import Car
from .level_generator import LevelGenerator
from .story_generator import StoryGenerator

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
        
        # Game state
        self.camera_x = 0
        self.camera_y = 0
        self.walls = []
        self.landing_zones = []
        self.current_story = ""
        self.game_session_data = []
        
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
        
    def generate_new_level(self, neural_brain):
        """Generate a new level using neural network insights"""
        # Get AI suggestions for level design
        ai_suggestions = neural_brain.generate_level_suggestions()
        level_data = self.level_generator.generate_level_from_ai(ai_suggestions)
        self.walls = level_data['walls']
        self.landing_zones = level_data['landing_zones']
        
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
        
        # Collect data for neural network
        game_data = {
            'car_position': (self.car.x, self.car.y),
            'car_velocity': (self.car.vel_x, self.car.vel_y),
            'car_angle': self.car.angle,
            'walls_nearby': self.get_nearby_walls(),
            'input_keys': [keys[pygame.K_LEFT], keys[pygame.K_RIGHT], 
                          keys[pygame.K_UP], keys[pygame.K_DOWN]],
            'timestamp': pygame.time.get_ticks()
        }
        
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
    
    def render(self):
        """Render the game"""
        self.screen.fill(self.BLACK)
        
        # Draw walls
        for wall in self.walls:
            wall_rect = pygame.Rect(
                wall['x'] - self.camera_x,
                wall['y'] - self.camera_y,
                wall['width'],
                wall['height']
            )
            pygame.draw.rect(self.screen, self.GRAY, wall_rect)
        
        # Draw landing zones
        for zone in self.landing_zones:
            zone_rect = pygame.Rect(
                zone['x'] - self.camera_x,
                zone['y'] - self.camera_y,
                zone['width'],
                zone['height']
            )
            color = self.GREEN if zone['type'] == 'forest' else self.YELLOW
            pygame.draw.rect(self.screen, color, zone_rect)
        
        # Draw car
        car_screen_x = self.car.x - self.camera_x
        car_screen_y = self.car.y - self.camera_y
        self.car.draw(self.screen, car_screen_x, car_screen_y)
        
        # Draw UI
        self.draw_ui()
        
        # Update display
        pygame.display.flip()
    
    def draw_ui(self):
        """Draw user interface elements"""
        # Draw controls
        controls = [
            "Arrow Keys: Move Car",
            "R: Reset Game",
            "N: Generate New Level (AI)",
            "ESC: Quit"
        ]
        
        for i, control in enumerate(controls):
            text = self.small_font.render(control, True, self.WHITE)
            self.screen.blit(text, (10, 10 + i * 25))
        
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
            f"Position: ({self.car.x:.0f}, {self.car.y:.0f})"
        ]
        
        for i, stat in enumerate(stats):
            text = self.small_font.render(stat, True, self.WHITE)
            self.screen.blit(text, (self.width - 200, 10 + i * 25))
    
    def reset(self):
        """Reset the game"""
        self.car.reset_position(100, 400)
        self.generate_level()
        self.current_story = ""