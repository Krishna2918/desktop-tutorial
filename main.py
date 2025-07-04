import pygame
import sys
import os
from src.game_engine import GameEngine

def main():
    """Main entry point for the Neural Car Adventure game"""
    # Initialize pygame
    pygame.init()
    
    # Create the game engine (includes distributed neural brain and enhanced graphics)
    game_engine = GameEngine()
    
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
                    # Generate new level using distributed neural network
                    game_engine.generate_new_level()
                elif event.key == pygame.K_a:
                    # Show analytics dashboard
                    game_engine.show_analytics_dashboard()
        
        # Update game state
        game_data = game_engine.update()
        
        # Data collection is now handled within the game engine
        
        # Render game
        game_engine.render()
        
        # Cap the frame rate
        clock.tick(60)
    
    # Save distributed neural network data before quitting
    game_engine.distributed_brain.save_distributed_data()
    
    # Quit
    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    main()