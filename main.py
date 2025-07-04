import pygame
import sys
import os
from src.game_engine import GameEngine
from src.neural_brain import NeuralBrain
from src.story_generator import StoryGenerator

def main():
    """Main entry point for the Neural Car Adventure game"""
    # Initialize pygame
    pygame.init()
    
    # Create the game engine
    game_engine = GameEngine()
    
    # Create neural brain for data collection and learning
    neural_brain = NeuralBrain()
    
    # Create story generator
    story_generator = StoryGenerator()
    
    # Main game loop
    running = True
    clock = pygame.time.Clock()
    
    while running:
        # Handle events
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    running = False
                elif event.key == pygame.K_r:
                    # Reset game
                    game_engine.reset()
                elif event.key == pygame.K_n:
                    # Generate new level using neural network
                    game_engine.generate_new_level(neural_brain)
        
        # Update game state
        game_data = game_engine.update()
        
        # Collect data for neural network
        if game_data:
            neural_brain.collect_data(game_data)
        
        # Render game
        game_engine.render()
        
        # Cap the frame rate
        clock.tick(60)
    
    # Save neural network data before quitting
    neural_brain.save_session_data()
    
    # Quit
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()