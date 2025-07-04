import random
import json
import os

class StoryGenerator:
    def __init__(self):
        self.story_templates = {
            'forest': [
                "As your car settles in the ancient forest, you notice glowing mushrooms...",
                "The forest whispers secrets of a lost civilization...",
                "Strange mechanical sounds echo through the trees...",
                "A path of light appears, leading deeper into the woods...",
                "The trees seem to move, forming a pattern around your car..."
            ],
            'city': [
                "The neon lights of the city reflect off your car's windshield...",
                "A mysterious figure watches from the shadows...",
                "The city's AI system has detected your arrival...",
                "Steam rises from the manholes as you explore...",
                "The buildings seem to shift and change around you..."
            ],
            'desert': [
                "The desert sand reveals ancient ruins beneath...",
                "A mirage shows you glimpses of other worlds...",
                "The car's engine creates music in the vast emptiness...",
                "Strange lights dance on the horizon...",
                "The dunes hide secrets of time travelers..."
            ],
            'mountain': [
                "The mountain peak offers a view of infinite possibilities...",
                "Ancient echoes speak of legendary races...",
                "The thin air reveals hidden portals...",
                "Your car has awakened something in the mountain...",
                "The rocks shimmer with mysterious energy..."
            ],
            'ocean': [
                "The car transforms into a submarine...",
                "Beneath the waves, a lost city beckons...",
                "Sea creatures communicate through your radio...",
                "The ocean floor reveals a network of tunnels...",
                "Bioluminescent trails guide you to adventure..."
            ],
            'space': [
                "Your car lifts off into the cosmic void...",
                "Among the stars, you find a racing circuit...",
                "Alien civilizations signal your arrival...",
                "The car's wheels adapt to walk on asteroid surfaces...",
                "A wormhole opens, offering passage to distant worlds..."
            ]
        }
        
        self.story_continuations = {
            'mystery': [
                "A puzzle awaits your solution...",
                "Clues are scattered throughout this realm...",
                "The mystery deepens with each discovery...",
                "Your car's headlights reveal hidden symbols...",
                "The answer lies in the pattern of your journey..."
            ],
            'action': [
                "The chase begins now...",
                "Your skills will be tested to the limit...",
                "Time is running out...",
                "The stakes have never been higher...",
                "Your car becomes your greatest weapon..."
            ],
            'exploration': [
                "New territories await your discovery...",
                "Every turn reveals new wonders...",
                "The map in your mind grows with each adventure...",
                "Your car leaves tracks in uncharted lands...",
                "The horizon promises endless possibilities..."
            ],
            'sci-fi': [
                "Technology and nature merge in unexpected ways...",
                "The laws of physics bend to your will...",
                "Your car's AI begins to evolve...",
                "Reality shifts around your vehicle...",
                "The future calls to you through time..."
            ],
            'fantasy': [
                "Magic flows through your car's engine...",
                "Mythical creatures recognize your noble quest...",
                "The car transforms with elemental power...",
                "Ancient prophecies speak of your arrival...",
                "Your wheels leave trails of starlight..."
            ]
        }
        
        self.character_archetypes = [
            "The Wandering Mechanic",
            "The Speed Sage",
            "The Quantum Racer",
            "The Dream Driver",
            "The Time Traveler",
            "The Reality Shifter",
            "The Cosmic Explorer",
            "The Dimension Hopper"
        ]
        
        self.load_story_history()
    
    def generate_story(self, context):
        """Generate a story based on the landing context"""
        location = context.get('location', 'forest')
        car_state = context.get('car_state', {})
        game_time = context.get('game_time', 0)
        
        # Select base story template
        base_story = random.choice(self.story_templates.get(location, self.story_templates['forest']))
        
        # Analyze car state for story adaptation
        speed = car_state.get('speed', 0)
        was_on_wall = car_state.get('on_wall', False)
        position = car_state.get('position', (0, 0))
        
        # Generate story continuation based on game state
        story_type = self.determine_story_type(car_state, game_time)
        continuation = random.choice(self.story_continuations.get(story_type, self.story_continuations['exploration']))
        
        # Create character context
        character = self.select_character_archetype(car_state)
        
        # Build the complete story
        story = self.build_narrative(base_story, continuation, character, context)
        
        # Save story to history
        self.save_story_to_history(story, context)
        
        return story
    
    def determine_story_type(self, car_state, game_time):
        """Determine story type based on gameplay context"""
        speed = car_state.get('speed', 0)
        was_on_wall = car_state.get('on_wall', False)
        
        if speed > 10:
            return 'action'
        elif was_on_wall:
            return 'exploration'
        elif game_time > 60000:  # More than 1 minute
            return 'mystery'
        elif random.random() < 0.3:
            return 'sci-fi'
        else:
            return 'fantasy'
    
    def select_character_archetype(self, car_state):
        """Select character archetype based on car state"""
        speed = car_state.get('speed', 0)
        was_on_wall = car_state.get('on_wall', False)
        
        if speed > 12:
            return "The Speed Sage"
        elif was_on_wall:
            return "The Wandering Mechanic"
        elif random.random() < 0.2:
            return "The Time Traveler"
        else:
            return random.choice(self.character_archetypes)
    
    def build_narrative(self, base_story, continuation, character, context):
        """Build the complete narrative"""
        location = context.get('location', 'unknown')
        
        # Create opening
        opening = f"As {character}, you have arrived in the {location}."
        
        # Add context-specific details
        details = self.generate_contextual_details(context)
        
        # Add quest or objective
        objective = self.generate_objective(location, character)
        
        # Combine all elements
        story = f"{opening}\n{base_story}\n{details}\n{continuation}\n{objective}"
        
        return story
    
    def generate_contextual_details(self, context):
        """Generate details based on context"""
        location = context.get('location', 'unknown')
        car_state = context.get('car_state', {})
        
        details = []
        
        # Speed-based details
        speed = car_state.get('speed', 0)
        if speed > 8:
            details.append("Your high-speed arrival has stirred the local energy.")
        elif speed < 3:
            details.append("Your careful approach has been noted by the inhabitants.")
        
        # Position-based details
        position = car_state.get('position', (0, 0))
        if position[1] < 200:  # High altitude
            details.append("The elevated position offers a commanding view.")
        elif position[1] > 600:  # Low altitude
            details.append("The ground-level perspective reveals hidden secrets.")
        
        # Location-specific details
        if location == 'forest':
            details.append("The ancient trees recognize your mechanical companion.")
        elif location == 'city':
            details.append("The urban environment hums with digital consciousness.")
        elif location == 'desert':
            details.append("The sand holds memories of countless journeys.")
        elif location == 'mountain':
            details.append("The peak resonates with your car's engine frequency.")
        elif location == 'ocean':
            details.append("The water reflects possibilities beyond imagination.")
        elif location == 'space':
            details.append("The cosmos welcomes another traveler.")
        
        return " ".join(details)
    
    def generate_objective(self, location, character):
        """Generate quest objectives"""
        objectives = {
            'forest': [
                "Find the three sacred groves to unlock the forest's power.",
                "Collect the whispers of the ancient trees.",
                "Navigate the maze of moving branches.",
                "Discover the source of the glowing mushrooms.",
                "Restore the balance between nature and machine."
            ],
            'city': [
                "Infiltrate the AI core to learn the city's secrets.",
                "Race through the neon-lit streets to find the truth.",
                "Solve the puzzle of the shifting architecture.",
                "Connect with the underground resistance.",
                "Become the bridge between digital and physical worlds."
            ],
            'desert': [
                "Uncover the buried civilization beneath the dunes.",
                "Follow the star patterns to find the oasis of knowledge.",
                "Collect the fragments of the time crystal.",
                "Navigate the labyrinth of sand and stone.",
                "Awaken the sleeping guardians of the desert."
            ],
            'mountain': [
                "Climb to the peak where reality bends.",
                "Find the three elemental engines.",
                "Solve the riddle of the echoing caverns.",
                "Master the art of aerial navigation.",
                "Discover the mountain's connection to other worlds."
            ],
            'ocean': [
                "Explore the depths where legends are born.",
                "Communicate with the ocean's consciousness.",
                "Find the lost fleet of time-traveling vessels.",
                "Master the art of underwater racing.",
                "Discover the source of the bioluminescent network."
            ],
            'space': [
                "Navigate the cosmic racing circuit.",
                "Find the three stellar keys to unlock the universe.",
                "Establish contact with the cosmic council.",
                "Master the art of dimensional driving.",
                "Discover your role in the grand cosmic design."
            ]
        }
        
        location_objectives = objectives.get(location, objectives['forest'])
        objective = random.choice(location_objectives)
        
        return f"Your quest: {objective}"
    
    def generate_advanced_story(self, context, neural_suggestions=None):
        """Generate advanced story using neural network suggestions"""
        if neural_suggestions:
            story_type = neural_suggestions.get('type', 'adventure')
            complexity = neural_suggestions.get('complexity', 0.5)
            elements = neural_suggestions.get('elements', ['exploration'])
        else:
            story_type = self.determine_story_type(context.get('car_state', {}), context.get('game_time', 0))
            complexity = random.uniform(0.3, 0.8)
            elements = ['exploration', 'mystery']
        
        # Generate story based on complexity
        if complexity < 0.4:
            return self.generate_simple_story(context, story_type)
        elif complexity < 0.7:
            return self.generate_medium_story(context, story_type, elements)
        else:
            return self.generate_complex_story(context, story_type, elements)
    
    def generate_simple_story(self, context, story_type):
        """Generate a simple story"""
        location = context.get('location', 'forest')
        base_story = random.choice(self.story_templates.get(location, self.story_templates['forest']))
        continuation = random.choice(self.story_continuations.get(story_type, self.story_continuations['exploration']))
        
        return f"{base_story}\n{continuation}"
    
    def generate_medium_story(self, context, story_type, elements):
        """Generate a medium complexity story"""
        location = context.get('location', 'forest')
        character = self.select_character_archetype(context.get('car_state', {}))
        
        story_parts = []
        story_parts.append(f"As {character}, you find yourself in the {location}.")
        story_parts.append(random.choice(self.story_templates.get(location, self.story_templates['forest'])))
        
        for element in elements:
            story_parts.append(random.choice(self.story_continuations.get(element, self.story_continuations['exploration'])))
        
        story_parts.append(self.generate_objective(location, character))
        
        return "\n".join(story_parts)
    
    def generate_complex_story(self, context, story_type, elements):
        """Generate a complex multi-layered story"""
        location = context.get('location', 'forest')
        character = self.select_character_archetype(context.get('car_state', {}))
        
        # Create a complex narrative structure
        story_parts = []
        
        # Opening with world-building
        story_parts.append(f"In the role of {character}, you have crossed into the {location}, a realm where the boundaries between dimensions blur.")
        
        # Location-specific opening
        story_parts.append(random.choice(self.story_templates.get(location, self.story_templates['forest'])))
        
        # Add multiple story layers
        for i, element in enumerate(elements):
            if i == 0:
                story_parts.append(f"The first layer of reality reveals: {random.choice(self.story_continuations.get(element, self.story_continuations['exploration']))}")
            else:
                story_parts.append(f"Deeper still, you discover: {random.choice(self.story_continuations.get(element, self.story_continuations['exploration']))}")
        
        # Add environmental interaction
        story_parts.append(self.generate_contextual_details(context))
        
        # Add multiple objectives
        primary_objective = self.generate_objective(location, character)
        secondary_objectives = [
            "Collect data for the neural consciousness that guides your journey.",
            "Establish connections between this realm and others you've visited.",
            "Prepare for the ultimate synthesis of all your adventures."
        ]
        
        story_parts.append(primary_objective)
        story_parts.append(f"Secondary objectives: {random.choice(secondary_objectives)}")
        
        # Add meta-narrative element
        story_parts.append("Remember: each choice you make teaches the great neural network that dreams new worlds into existence.")
        
        return "\n".join(story_parts)
    
    def save_story_to_history(self, story, context):
        """Save generated story to history for analysis"""
        try:
            history_file = "neural_data/story_history.json"
            os.makedirs(os.path.dirname(history_file), exist_ok=True)
            
            story_record = {
                'timestamp': context.get('game_time', 0),
                'location': context.get('location', 'unknown'),
                'story': story,
                'car_state': context.get('car_state', {}),
                'story_id': len(self.story_history) if hasattr(self, 'story_history') else 0
            }
            
            if hasattr(self, 'story_history'):
                self.story_history.append(story_record)
            else:
                self.story_history = [story_record]
            
            with open(history_file, 'w') as f:
                json.dump(self.story_history, f, indent=2)
                
        except Exception as e:
            print(f"Error saving story history: {e}")
    
    def load_story_history(self):
        """Load existing story history"""
        try:
            history_file = "neural_data/story_history.json"
            if os.path.exists(history_file):
                with open(history_file, 'r') as f:
                    self.story_history = json.load(f)
            else:
                self.story_history = []
        except Exception as e:
            print(f"Error loading story history: {e}")
            self.story_history = []
    
    def get_story_analytics(self):
        """Get analytics about generated stories"""
        if not hasattr(self, 'story_history') or not self.story_history:
            return {}
        
        locations = [story['location'] for story in self.story_history]
        location_counts = {}
        for location in locations:
            location_counts[location] = location_counts.get(location, 0) + 1
        
        return {
            'total_stories': len(self.story_history),
            'location_distribution': location_counts,
            'most_common_location': max(location_counts, key=location_counts.get) if location_counts else None,
            'average_story_length': sum(len(story['story']) for story in self.story_history) / len(self.story_history)
        }