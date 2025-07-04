import pygame
import math

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
        self.wall_climbing_force = 0.4
        self.on_ground = False
        self.on_wall = False
        self.wall_normal = (0, 0)
        
        # Car colors
        self.color = (255, 0, 0)  # Red
        self.wheel_color = (50, 50, 50)  # Dark gray
        
    def update(self, keys, walls):
        """Update car physics and handle wall climbing"""
        # Apply gravity
        if not self.on_ground and not self.on_wall:
            self.vel_y += self.gravity
        
        # Handle input
        if keys[pygame.K_LEFT]:
            if self.on_wall:
                # Wall climbing movement
                self.vel_x -= self.wall_climbing_force
            else:
                self.vel_x -= self.acceleration
                self.angle -= 2
        
        if keys[pygame.K_RIGHT]:
            if self.on_wall:
                # Wall climbing movement
                self.vel_x += self.wall_climbing_force
            else:
                self.vel_x += self.acceleration
                self.angle += 2
        
        if keys[pygame.K_UP]:
            if self.on_wall:
                # Climb up the wall
                self.vel_y -= self.wall_climbing_force
            elif self.on_ground:
                # Jump
                self.vel_y = -12
        
        if keys[pygame.K_DOWN]:
            if self.on_wall:
                # Climb down the wall
                self.vel_y += self.wall_climbing_force
            else:
                # Brake
                self.vel_x *= 0.7
        
        # Apply friction
        self.vel_x *= self.friction
        if abs(self.vel_x) < 0.1:
            self.vel_x = 0
        
        # Limit speed
        speed = math.sqrt(self.vel_x**2 + self.vel_y**2)
        if speed > self.max_speed:
            self.vel_x = (self.vel_x / speed) * self.max_speed
            self.vel_y = (self.vel_y / speed) * self.max_speed
        
        # Update position
        self.x += self.vel_x
        self.y += self.vel_y
        
        # Handle wall collisions and climbing
        self.handle_wall_collisions(walls)
        
        # Keep angle in reasonable range
        self.angle = self.angle % 360
    
    def handle_wall_collisions(self, walls):
        """Handle collisions with walls and enable wall climbing"""
        car_rect = pygame.Rect(self.x - self.width//2, self.y - self.height//2, 
                              self.width, self.height)
        
        self.on_ground = False
        self.on_wall = False
        
        for wall in walls:
            wall_rect = pygame.Rect(wall['x'], wall['y'], wall['width'], wall['height'])
            
            if car_rect.colliderect(wall_rect):
                # Determine collision side
                overlap_left = car_rect.right - wall_rect.left
                overlap_right = wall_rect.right - car_rect.left
                overlap_top = car_rect.bottom - wall_rect.top
                overlap_bottom = wall_rect.bottom - car_rect.top
                
                min_overlap = min(overlap_left, overlap_right, overlap_top, overlap_bottom)
                
                if min_overlap == overlap_top:
                    # Collision from top (car landing on wall)
                    self.y = wall_rect.top - self.height//2
                    self.vel_y = 0
                    self.on_ground = True
                elif min_overlap == overlap_bottom:
                    # Collision from bottom (car hitting ceiling)
                    self.y = wall_rect.bottom + self.height//2
                    self.vel_y = 0
                elif min_overlap == overlap_left:
                    # Collision from left (car hitting right wall)
                    self.x = wall_rect.left - self.width//2
                    self.vel_x = 0
                    self.on_wall = True
                    self.wall_normal = (-1, 0)
                elif min_overlap == overlap_right:
                    # Collision from right (car hitting left wall)
                    self.x = wall_rect.right + self.width//2
                    self.vel_x = 0
                    self.on_wall = True
                    self.wall_normal = (1, 0)
    
    def check_collision_with_zone(self, zone):
        """Check if car collides with a landing zone"""
        car_rect = pygame.Rect(self.x - self.width//2, self.y - self.height//2, 
                              self.width, self.height)
        zone_rect = pygame.Rect(zone['x'], zone['y'], zone['width'], zone['height'])
        return car_rect.colliderect(zone_rect)
    
    def draw(self, screen, screen_x, screen_y):
        """Draw the car"""
        # Car body
        car_rect = pygame.Rect(screen_x - self.width//2, screen_y - self.height//2, 
                              self.width, self.height)
        pygame.draw.rect(screen, self.color, car_rect)
        
        # Car wheels
        wheel_size = 8
        wheel_positions = [
            (screen_x - self.width//2 + 5, screen_y + self.height//2 - 3),
            (screen_x + self.width//2 - 5, screen_y + self.height//2 - 3)
        ]
        
        for wheel_pos in wheel_positions:
            pygame.draw.circle(screen, self.wheel_color, wheel_pos, wheel_size//2)
        
        # Car direction indicator
        direction_x = screen_x + math.cos(math.radians(self.angle)) * 20
        direction_y = screen_y + math.sin(math.radians(self.angle)) * 20
        pygame.draw.line(screen, (255, 255, 0), (screen_x, screen_y), 
                        (direction_x, direction_y), 3)
    
    def get_state(self):
        """Get car state for neural network"""
        return {
            'position': (self.x, self.y),
            'velocity': (self.vel_x, self.vel_y),
            'angle': self.angle,
            'on_ground': self.on_ground,
            'on_wall': self.on_wall,
            'speed': self.get_speed()
        }
    
    def get_speed(self):
        """Get current speed"""
        return math.sqrt(self.vel_x**2 + self.vel_y**2)
    
    def reset_position(self, x, y):
        """Reset car to a specific position"""
        self.x = x
        self.y = y
        self.vel_x = 0
        self.vel_y = 0
        self.angle = 0
        self.on_ground = False
        self.on_wall = False