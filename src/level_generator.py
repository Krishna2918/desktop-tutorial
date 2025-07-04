import random
import math
import numpy as np

class LevelGenerator:
    def __init__(self):
        self.width = 3000  # World width
        self.height = 2000  # World height
        self.wall_types = ['platform', 'vertical_wall', 'ramp', 'obstacle']
        self.zone_types = ['forest', 'city', 'desert', 'mountain', 'ocean', 'space']
        
    def generate_level(self):
        """Generate a basic level with walls and landing zones"""
        walls = []
        landing_zones = []
        
        # Generate ground platforms
        for i in range(10):
            x = random.randint(0, self.width - 200)
            y = random.randint(400, self.height - 100)
            width = random.randint(100, 300)
            height = random.randint(20, 40)
            
            walls.append({
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'type': 'platform'
            })
        
        # Generate vertical walls for climbing
        for i in range(15):
            x = random.randint(0, self.width - 50)
            y = random.randint(200, self.height - 200)
            width = random.randint(30, 80)
            height = random.randint(100, 400)
            
            walls.append({
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'type': 'vertical_wall'
            })
        
        # Generate ramps
        for i in range(8):
            x = random.randint(0, self.width - 150)
            y = random.randint(300, self.height - 150)
            width = random.randint(80, 150)
            height = random.randint(30, 60)
            
            walls.append({
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'type': 'ramp'
            })
        
        # Generate landing zones
        for i in range(6):
            x = random.randint(100, self.width - 200)
            y = random.randint(100, self.height - 100)
            width = random.randint(80, 150)
            height = random.randint(50, 100)
            zone_type = random.choice(self.zone_types)
            
            landing_zones.append({
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'type': zone_type
            })
        
        return {
            'walls': walls,
            'landing_zones': landing_zones
        }
    
    def generate_level_from_ai(self, ai_suggestions):
        """Generate a level based on AI suggestions"""
        walls = []
        landing_zones = []
        
        # Extract AI parameters
        difficulty = ai_suggestions.get('difficulty', 0.5)
        wall_density = ai_suggestions.get('wall_density', 0.4)
        vertical_challenge = ai_suggestions.get('vertical_challenge', 0.6)
        horizontal_spread = ai_suggestions.get('horizontal_spread', 0.5)
        num_landing_zones = ai_suggestions.get('landing_zones', 4)
        
        # Adjust parameters based on difficulty
        num_walls = int(20 * wall_density * (1 + difficulty))
        num_vertical_walls = int(15 * vertical_challenge * (1 + difficulty))
        
        # Generate platforms based on AI suggestions
        for i in range(num_walls):
            x = random.randint(0, int(self.width * horizontal_spread))
            y = random.randint(300, self.height - 100)
            
            # Size based on difficulty
            base_width = 150 if difficulty < 0.5 else 100
            base_height = 30 if difficulty < 0.5 else 20
            
            width = random.randint(base_width - 50, base_width + 50)
            height = random.randint(base_height - 10, base_height + 10)
            
            walls.append({
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'type': 'platform'
            })
        
        # Generate vertical walls for climbing
        for i in range(num_vertical_walls):
            x = random.randint(0, int(self.width * horizontal_spread))
            y = random.randint(200, self.height - 200)
            
            # Height based on vertical challenge
            base_height = int(200 * vertical_challenge * (1 + difficulty))
            width = random.randint(30, 80)
            height = random.randint(base_height - 50, base_height + 100)
            
            walls.append({
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'type': 'vertical_wall'
            })
        
        # Generate complex structures for higher difficulty
        if difficulty > 0.6:
            self.generate_complex_structures(walls, difficulty)
        
        # Generate AI-influenced landing zones
        for i in range(num_landing_zones):
            x = random.randint(100, int(self.width * horizontal_spread) - 200)
            y = random.randint(100, self.height - 100)
            
            # Size based on difficulty (smaller zones for higher difficulty)
            base_width = 120 if difficulty < 0.7 else 80
            base_height = 80 if difficulty < 0.7 else 50
            
            width = random.randint(base_width - 20, base_width + 30)
            height = random.randint(base_height - 20, base_height + 20)
            
            # Zone type influenced by AI suggestions
            zone_type = self.select_zone_type_from_ai(ai_suggestions)
            
            landing_zones.append({
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'type': zone_type
            })
        
        return {
            'walls': walls,
            'landing_zones': landing_zones
        }
    
    def generate_complex_structures(self, walls, difficulty):
        """Generate complex wall structures for higher difficulty"""
        # Generate maze-like structures
        maze_size = int(5 * difficulty)
        for i in range(maze_size):
            # Create interconnected platforms
            base_x = random.randint(0, self.width - 400)
            base_y = random.randint(300, self.height - 300)
            
            # Generate a small maze section
            for j in range(3):
                for k in range(3):
                    if random.random() < 0.6:  # 60% chance for each cell
                        x = base_x + j * 120
                        y = base_y + k * 100
                        
                        walls.append({
                            'x': x,
                            'y': y,
                            'width': 100,
                            'height': 30,
                            'type': 'platform'
                        })
        
        # Generate spiral climbing structures
        spiral_count = int(3 * difficulty)
        for i in range(spiral_count):
            center_x = random.randint(200, self.width - 200)
            center_y = random.randint(400, self.height - 400)
            radius = random.randint(100, 200)
            
            # Create spiral of platforms
            for angle in range(0, 360, 30):
                rad = math.radians(angle)
                x = center_x + math.cos(rad) * radius
                y = center_y + math.sin(rad) * radius - angle // 30 * 20
                
                walls.append({
                    'x': int(x),
                    'y': int(y),
                    'width': 80,
                    'height': 25,
                    'type': 'platform'
                })
    
    def select_zone_type_from_ai(self, ai_suggestions):
        """Select landing zone type based on AI suggestions"""
        story_complexity = ai_suggestions.get('story_complexity', 0.5)
        
        if story_complexity < 0.3:
            # Simple zones
            return random.choice(['forest', 'city'])
        elif story_complexity < 0.7:
            # Medium complexity zones
            return random.choice(['desert', 'mountain', 'forest', 'city'])
        else:
            # Complex zones
            return random.choice(['ocean', 'space', 'desert', 'mountain'])
    
    def generate_procedural_challenge(self, player_stats):
        """Generate procedural challenges based on player performance"""
        walls = []
        
        # Analyze player stats
        avg_speed = player_stats.get('avg_speed', 5)
        wall_climbing_success = player_stats.get('wall_climbing_success', 0.5)
        jump_accuracy = player_stats.get('jump_accuracy', 0.5)
        
        # Generate adaptive challenges
        if avg_speed > 7:
            # Player is fast, create narrow passages
            for i in range(8):
                x = random.randint(0, self.width - 100)
                y = random.randint(200, self.height - 200)
                
                walls.append({
                    'x': x,
                    'y': y,
                    'width': 60,  # Narrow passage
                    'height': 150,
                    'type': 'narrow_passage'
                })
        
        if wall_climbing_success < 0.3:
            # Player struggles with wall climbing, provide more ramps
            for i in range(10):
                x = random.randint(0, self.width - 150)
                y = random.randint(300, self.height - 100)
                
                walls.append({
                    'x': x,
                    'y': y,
                    'width': 120,
                    'height': 40,
                    'type': 'ramp'
                })
        
        if jump_accuracy > 0.7:
            # Player is good at jumping, create longer gaps
            for i in range(6):
                x = random.randint(0, self.width - 300)
                y = random.randint(400, self.height - 100)
                
                # Create two platforms with a gap
                walls.append({
                    'x': x,
                    'y': y,
                    'width': 80,
                    'height': 30,
                    'type': 'platform'
                })
                
                walls.append({
                    'x': x + 180,  # Gap of 100 pixels
                    'y': y,
                    'width': 80,
                    'height': 30,
                    'type': 'platform'
                })
        
        return walls
    
    def generate_themed_level(self, theme):
        """Generate a level based on a specific theme"""
        walls = []
        landing_zones = []
        
        if theme == 'urban':
            # City-like structures
            for i in range(15):
                x = random.randint(0, self.width - 100)
                y = random.randint(300, self.height - 200)
                width = random.randint(80, 120)
                height = random.randint(100, 300)
                
                walls.append({
                    'x': x,
                    'y': y,
                    'width': width,
                    'height': height,
                    'type': 'building'
                })
        
        elif theme == 'natural':
            # Natural formations
            for i in range(12):
                x = random.randint(0, self.width - 200)
                y = random.randint(400, self.height - 100)
                width = random.randint(150, 300)
                height = random.randint(50, 100)
                
                walls.append({
                    'x': x,
                    'y': y,
                    'width': width,
                    'height': height,
                    'type': 'rock_formation'
                })
        
        elif theme == 'mechanical':
            # Industrial/mechanical structures
            for i in range(20):
                x = random.randint(0, self.width - 150)
                y = random.randint(200, self.height - 150)
                width = random.randint(100, 150)
                height = random.randint(30, 60)
                
                walls.append({
                    'x': x,
                    'y': y,
                    'width': width,
                    'height': height,
                    'type': 'machinery'
                })
        
        # Generate themed landing zones
        zone_count = 5
        for i in range(zone_count):
            x = random.randint(100, self.width - 200)
            y = random.randint(100, self.height - 100)
            width = random.randint(100, 150)
            height = random.randint(60, 100)
            
            if theme == 'urban':
                zone_type = random.choice(['city', 'rooftop'])
            elif theme == 'natural':
                zone_type = random.choice(['forest', 'mountain', 'desert'])
            else:  # mechanical
                zone_type = random.choice(['factory', 'space'])
            
            landing_zones.append({
                'x': x,
                'y': y,
                'width': width,
                'height': height,
                'type': zone_type
            })
        
        return {
            'walls': walls,
            'landing_zones': landing_zones
        }