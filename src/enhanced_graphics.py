import pygame
import math
import random
import numpy as np

class EnhancedGraphics:
    def __init__(self, screen):
        self.screen = screen
        self.width = screen.get_width()
        self.height = screen.get_height()
        
        # Color palettes
        self.colors = {
            'background': (10, 15, 25),
            'wall_primary': (80, 90, 120),
            'wall_secondary': (60, 70, 100),
            'wall_highlight': (120, 130, 160),
            'car_primary': (255, 50, 50),
            'car_secondary': (200, 40, 40),
            'car_highlight': (255, 100, 100),
            'speed_trail': (255, 255, 100),
            'wall_climb_effect': (100, 255, 255),
            'forest': (50, 150, 50),
            'city': (100, 100, 150),
            'desert': (200, 180, 100),
            'mountain': (120, 120, 140),
            'ocean': (50, 100, 200),
            'space': (50, 50, 100),
            'particle': (255, 255, 255)
        }
        
        # Particle system
        self.particles = []
        self.max_particles = 200
        
        # Animation states
        self.animation_time = 0
        self.shake_intensity = 0
        self.zoom_level = 1.0
        
        # Pre-calculated gradients
        self.gradients = {}
        self.init_gradients()
    
    def init_gradients(self):
        """Initialize gradient surfaces for performance"""
        for zone_type in ['forest', 'city', 'desert', 'mountain', 'ocean', 'space']:
            self.gradients[zone_type] = self.create_gradient(200, 100, 
                                                           self.colors[zone_type], 
                                                           (0, 0, 0))
    
    def create_gradient(self, width, height, start_color, end_color):
        """Create a gradient surface"""
        surface = pygame.Surface((width, height))
        for y in range(height):
            ratio = y / height
            r = int(start_color[0] * (1 - ratio) + end_color[0] * ratio)
            g = int(start_color[1] * (1 - ratio) + end_color[1] * ratio)
            b = int(start_color[2] * (1 - ratio) + end_color[2] * ratio)
            pygame.draw.line(surface, (r, g, b), (0, y), (width, y))
        return surface
    
    def clear_screen(self):
        """Clear screen with animated background"""
        # Create animated background
        base_color = self.colors['background']
        animation_offset = math.sin(self.animation_time * 0.001) * 10
        
        # Add subtle color variation
        bg_color = (
            max(0, min(255, base_color[0] + animation_offset)),
            max(0, min(255, base_color[1] + animation_offset)),
            max(0, min(255, base_color[2] + animation_offset))
        )
        
        self.screen.fill(bg_color)
        
        # Add starfield effect
        self.draw_starfield()
        
        # Update animation time
        self.animation_time += 16  # Assume 60 FPS
    
    def draw_starfield(self):
        """Draw animated starfield background"""
        for i in range(50):
            x = (self.animation_time * 0.1 + i * 73) % self.width
            y = (self.animation_time * 0.05 + i * 97) % self.height
            brightness = int(100 + 50 * math.sin(self.animation_time * 0.002 + i))
            color = (brightness, brightness, brightness)
            pygame.draw.circle(self.screen, color, (int(x), int(y)), 1)
    
    def draw_wall(self, wall, position):
        """Draw enhanced wall with 3D effect"""
        x, y = position
        wall_rect = pygame.Rect(x, y, wall['width'], wall['height'])
        
        # Main wall body
        pygame.draw.rect(self.screen, self.colors['wall_primary'], wall_rect)
        
        # 3D effect - top and left highlights
        highlight_points = [
            (x, y),
            (x + wall['width'], y),
            (x + wall['width'] - 8, y + 8),
            (x + 8, y + 8)
        ]
        pygame.draw.polygon(self.screen, self.colors['wall_highlight'], highlight_points)
        
        # 3D effect - bottom and right shadows
        shadow_points = [
            (x + wall['width'], y),
            (x + wall['width'], y + wall['height']),
            (x + wall['width'] - 8, y + wall['height'] - 8),
            (x + wall['width'] - 8, y + 8)
        ]
        pygame.draw.polygon(self.screen, self.colors['wall_secondary'], shadow_points)
        
        # Add texture lines
        for i in range(0, wall['width'], 20):
            line_x = x + i
            pygame.draw.line(self.screen, self.colors['wall_secondary'], 
                           (line_x, y), (line_x, y + wall['height']), 1)
        
        for i in range(0, wall['height'], 15):
            line_y = y + i
            pygame.draw.line(self.screen, self.colors['wall_secondary'], 
                           (x, line_y), (x + wall['width'], line_y), 1)
    
    def draw_landing_zone(self, zone, position):
        """Draw enhanced landing zone with animated effects"""
        x, y = position
        zone_rect = pygame.Rect(x, y, zone['width'], zone['height'])
        
        # Get zone color
        zone_color = self.colors.get(zone['type'], self.colors['forest'])
        
        # Draw zone with gradient
        if zone['type'] in self.gradients:
            gradient = pygame.transform.scale(self.gradients[zone['type']], 
                                            (zone['width'], zone['height']))
            self.screen.blit(gradient, (x, y))
        else:
            pygame.draw.rect(self.screen, zone_color, zone_rect)
        
        # Animated border
        border_intensity = int(100 + 50 * math.sin(self.animation_time * 0.005))
        border_color = (
            min(255, zone_color[0] + border_intensity),
            min(255, zone_color[1] + border_intensity),
            min(255, zone_color[2] + border_intensity)
        )
        pygame.draw.rect(self.screen, border_color, zone_rect, 3)
        
        # Add zone-specific effects
        if zone['type'] == 'forest':
            self.draw_forest_effect(zone_rect)
        elif zone['type'] == 'city':
            self.draw_city_effect(zone_rect)
        elif zone['type'] == 'ocean':
            self.draw_ocean_effect(zone_rect)
        elif zone['type'] == 'space':
            self.draw_space_effect(zone_rect)
    
    def draw_forest_effect(self, rect):
        """Draw forest-specific visual effects"""
        # Draw simple trees
        for i in range(3):
            tree_x = rect.x + rect.width // 4 * (i + 1)
            tree_y = rect.y + rect.height - 10
            
            # Tree trunk
            pygame.draw.rect(self.screen, (60, 30, 10), 
                           pygame.Rect(tree_x - 2, tree_y - 15, 4, 15))
            
            # Tree crown
            pygame.draw.circle(self.screen, (40, 120, 40), 
                             (tree_x, tree_y - 15), 8)
    
    def draw_city_effect(self, rect):
        """Draw city-specific visual effects"""
        # Draw simple buildings
        for i in range(4):
            building_x = rect.x + rect.width // 5 * (i + 1)
            building_height = random.randint(15, 25)
            building_y = rect.y + rect.height - building_height
            
            # Building
            pygame.draw.rect(self.screen, (60, 60, 90), 
                           pygame.Rect(building_x - 5, building_y, 10, building_height))
            
            # Windows
            for j in range(building_height // 8):
                window_y = building_y + j * 8 + 3
                pygame.draw.rect(self.screen, (200, 200, 100), 
                               pygame.Rect(building_x - 3, window_y, 2, 2))
    
    def draw_ocean_effect(self, rect):
        """Draw ocean-specific visual effects"""
        # Draw waves
        wave_y = rect.y + rect.height // 2
        for x in range(rect.x, rect.x + rect.width, 10):
            wave_offset = math.sin((x + self.animation_time * 0.01) * 0.1) * 3
            pygame.draw.circle(self.screen, (100, 150, 255), 
                             (x, int(wave_y + wave_offset)), 3)
    
    def draw_space_effect(self, rect):
        """Draw space-specific visual effects"""
        # Draw twinkling stars
        for i in range(8):
            star_x = rect.x + random.randint(5, rect.width - 5)
            star_y = rect.y + random.randint(5, rect.height - 5)
            brightness = int(100 + 100 * math.sin(self.animation_time * 0.003 + i))
            color = (brightness, brightness, brightness)
            pygame.draw.circle(self.screen, color, (star_x, star_y), 1)
    
    def draw_car(self, car, screen_x, screen_y):
        """Draw enhanced car with dynamic effects"""
        # Car body with gradient
        car_rect = pygame.Rect(screen_x - car.width//2, screen_y - car.height//2, 
                              car.width, car.height)
        
        # Main body
        pygame.draw.rect(self.screen, self.colors['car_primary'], car_rect)
        
        # Highlight
        highlight_rect = pygame.Rect(screen_x - car.width//2 + 2, screen_y - car.height//2 + 2, 
                                   car.width - 4, car.height//2 - 2)
        pygame.draw.rect(self.screen, self.colors['car_highlight'], highlight_rect)
        
        # Enhanced wheels
        wheel_size = 10
        wheel_positions = [
            (screen_x - car.width//2 + 5, screen_y + car.height//2 - 3),
            (screen_x + car.width//2 - 5, screen_y + car.height//2 - 3)
        ]
        
        for wheel_pos in wheel_positions:
            # Wheel shadow
            pygame.draw.circle(self.screen, (20, 20, 20), 
                             (wheel_pos[0] + 2, wheel_pos[1] + 2), wheel_size//2)
            # Wheel body
            pygame.draw.circle(self.screen, (40, 40, 40), wheel_pos, wheel_size//2)
            # Wheel rim
            pygame.draw.circle(self.screen, (80, 80, 80), wheel_pos, wheel_size//2 - 2)
        
        # Enhanced direction indicator
        direction_length = 25
        direction_x = screen_x + math.cos(math.radians(car.angle)) * direction_length
        direction_y = screen_y + math.sin(math.radians(car.angle)) * direction_length
        
        # Glowing effect
        for i in range(3):
            alpha = 255 - i * 60
            width = 5 - i
            pygame.draw.line(self.screen, (255, 255, 100), 
                           (screen_x, screen_y), (direction_x, direction_y), width)
        
        # Speed-based effects
        speed = car.get_speed()
        if speed > 8:
            # Speed lines
            for i in range(5):
                line_x = screen_x - (i + 1) * 10
                line_y = screen_y + random.randint(-5, 5)
                pygame.draw.line(self.screen, self.colors['speed_trail'], 
                               (line_x, line_y), (line_x + 8, line_y), 2)
        
        # Wall climbing effect
        if car.on_wall:
            # Sparks effect
            for i in range(3):
                spark_x = screen_x + random.randint(-15, 15)
                spark_y = screen_y + random.randint(-15, 15)
                pygame.draw.circle(self.screen, self.colors['wall_climb_effect'], 
                                 (spark_x, spark_y), 2)
    
    def draw_effect(self, effect, position):
        """Draw visual effects"""
        x, y = position
        current_time = pygame.time.get_ticks()
        age = current_time - effect['timestamp']
        max_age = effect.get('duration', 1000)
        
        if age > max_age:
            return
        
        # Calculate effect intensity based on age
        intensity = 1.0 - (age / max_age)
        
        if effect['type'] == 'speed_trail':
            self.draw_speed_trail_effect(x, y, intensity)
        elif effect['type'] == 'wall_climbing':
            self.draw_wall_climbing_effect(x, y, intensity)
        elif effect['type'] == 'level_transition':
            self.draw_level_transition_effect(x, y, intensity)
        elif effect['type'] == 'landing':
            self.draw_landing_effect(x, y, intensity)
    
    def draw_speed_trail_effect(self, x, y, intensity):
        """Draw speed trail effect"""
        alpha = int(255 * intensity)
        color = (*self.colors['speed_trail'], alpha)
        
        # Create trail particles
        for i in range(8):
            trail_x = x - i * 5
            trail_y = y + random.randint(-3, 3)
            size = max(1, int(6 * intensity))
            
            # Create surface with per-pixel alpha
            trail_surface = pygame.Surface((size * 2, size * 2), pygame.SRCALPHA)
            pygame.draw.circle(trail_surface, color, (size, size), size)
            self.screen.blit(trail_surface, (trail_x - size, trail_y - size))
    
    def draw_wall_climbing_effect(self, x, y, intensity):
        """Draw wall climbing effect"""
        alpha = int(255 * intensity)
        color = (*self.colors['wall_climb_effect'], alpha)
        
        # Create sparks
        for i in range(6):
            spark_x = x + random.randint(-20, 20)
            spark_y = y + random.randint(-20, 20)
            size = max(1, int(4 * intensity))
            
            spark_surface = pygame.Surface((size * 2, size * 2), pygame.SRCALPHA)
            pygame.draw.circle(spark_surface, color, (size, size), size)
            self.screen.blit(spark_surface, (spark_x - size, spark_y - size))
    
    def draw_level_transition_effect(self, x, y, intensity):
        """Draw level transition effect"""
        # Screen-wide effect
        alpha = int(100 * intensity)
        color = (255, 255, 255, alpha)
        
        # Create transition surface
        transition_surface = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        transition_surface.fill(color)
        self.screen.blit(transition_surface, (0, 0))
        
        # Add radial effect
        radius = int(200 * (1 - intensity))
        if radius > 0:
            pygame.draw.circle(self.screen, (255, 255, 255), 
                             (self.width // 2, self.height // 2), radius, 5)
    
    def draw_landing_effect(self, x, y, intensity):
        """Draw landing effect"""
        alpha = int(255 * intensity)
        color = (255, 255, 100, alpha)
        
        # Create expanding circle
        radius = int(30 * (1 - intensity))
        if radius > 0:
            landing_surface = pygame.Surface((radius * 2, radius * 2), pygame.SRCALPHA)
            pygame.draw.circle(landing_surface, color, (radius, radius), radius, 3)
            self.screen.blit(landing_surface, (x - radius, y - radius))
    
    def add_particles(self, x, y, count, particle_type='default'):
        """Add particles to the system"""
        for _ in range(count):
            if len(self.particles) < self.max_particles:
                particle = {
                    'x': x,
                    'y': y,
                    'vx': random.uniform(-2, 2),
                    'vy': random.uniform(-2, 2),
                    'life': 100,
                    'type': particle_type,
                    'size': random.randint(1, 3)
                }
                self.particles.append(particle)
    
    def update_particles(self):
        """Update particle system"""
        for particle in self.particles[:]:
            particle['x'] += particle['vx']
            particle['y'] += particle['vy']
            particle['life'] -= 1
            
            if particle['life'] <= 0:
                self.particles.remove(particle)
    
    def draw_particles(self):
        """Draw all particles"""
        for particle in self.particles:
            alpha = int(255 * (particle['life'] / 100))
            color = (*self.colors['particle'], alpha)
            
            particle_surface = pygame.Surface((particle['size'] * 2, particle['size'] * 2), pygame.SRCALPHA)
            pygame.draw.circle(particle_surface, color, (particle['size'], particle['size']), particle['size'])
            self.screen.blit(particle_surface, (particle['x'] - particle['size'], particle['y'] - particle['size']))
    
    def apply_screen_shake(self, intensity):
        """Apply screen shake effect"""
        self.shake_intensity = intensity
    
    def get_shake_offset(self):
        """Get current shake offset"""
        if self.shake_intensity > 0:
            offset_x = random.randint(-self.shake_intensity, self.shake_intensity)
            offset_y = random.randint(-self.shake_intensity, self.shake_intensity)
            self.shake_intensity = max(0, self.shake_intensity - 1)
            return offset_x, offset_y
        return 0, 0
    
    def draw_ui_background(self, rect, alpha=128):
        """Draw UI background with transparency"""
        ui_surface = pygame.Surface((rect.width, rect.height), pygame.SRCALPHA)
        ui_surface.fill((0, 0, 0, alpha))
        self.screen.blit(ui_surface, rect)
    
    def draw_progress_bar(self, x, y, width, height, progress, color):
        """Draw a progress bar"""
        # Background
        bg_rect = pygame.Rect(x, y, width, height)
        pygame.draw.rect(self.screen, (50, 50, 50), bg_rect)
        
        # Fill
        if progress > 0:
            fill_width = int(width * progress)
            fill_rect = pygame.Rect(x, y, fill_width, height)
            pygame.draw.rect(self.screen, color, fill_rect)
        
        # Border
        pygame.draw.rect(self.screen, (100, 100, 100), bg_rect, 2)