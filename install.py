#!/usr/bin/env python3
"""
Neural Car Adventure - Installation Script
Automatically sets up the game environment and dependencies.
"""

import subprocess
import sys
import os
import platform

def run_command(command, description):
    """Run a system command with error handling"""
    print(f"🔧 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, 
                              capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error during {description}")
        print(f"Error: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is 3.8 or higher"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8 or higher is required")
        print(f"Current version: {version.major}.{version.minor}.{version.micro}")
        return False
    print(f"✅ Python {version.major}.{version.minor}.{version.micro} detected")
    return True

def create_directories():
    """Create necessary directories"""
    directories = ['neural_data', 'neural_data/models']
    for directory in directories:
        os.makedirs(directory, exist_ok=True)
    print("✅ Directories created")

def install_dependencies():
    """Install required Python packages"""
    packages = [
        "pygame==2.5.2",
        "tensorflow==2.15.0", 
        "numpy==1.24.3",
        "matplotlib==3.7.1",
        "opencv-python==4.8.0.74",
        "scikit-learn==1.3.0",
        "Pillow==10.0.0"
    ]
    
    print("📦 Installing Python packages...")
    for package in packages:
        if not run_command(f"pip install {package}", f"Installing {package}"):
            return False
    return True

def verify_installation():
    """Verify that all dependencies are properly installed"""
    print("🔍 Verifying installation...")
    
    test_imports = [
        ("pygame", "pygame"),
        ("tensorflow", "tensorflow"),
        ("numpy", "numpy"),
        ("matplotlib", "matplotlib"),
        ("cv2", "opencv-python"),
        ("sklearn", "scikit-learn"),
        ("PIL", "Pillow")
    ]
    
    for module_name, package_name in test_imports:
        try:
            __import__(module_name)
            print(f"✅ {package_name} imported successfully")
        except ImportError:
            print(f"❌ Failed to import {package_name}")
            return False
    
    return True

def create_launch_script():
    """Create a launch script for easy game starting"""
    system = platform.system()
    
    if system == "Windows":
        script_content = """@echo off
echo Starting Neural Car Adventure...
python main.py
pause
"""
        with open("start_game.bat", "w") as f:
            f.write(script_content)
        print("✅ Created start_game.bat launcher")
    
    else:  # Linux/Mac
        script_content = """#!/bin/bash
echo "Starting Neural Car Adventure..."
python3 main.py
"""
        with open("start_game.sh", "w") as f:
            f.write(script_content)
        os.chmod("start_game.sh", 0o755)
        print("✅ Created start_game.sh launcher")

def main():
    """Main installation process"""
    print("🎮 Neural Car Adventure - Installation Script")
    print("=" * 50)
    
    # Check Python version
    if not check_python_version():
        return False
    
    # Create necessary directories
    create_directories()
    
    # Install dependencies
    if not install_dependencies():
        print("❌ Dependency installation failed")
        return False
    
    # Verify installation
    if not verify_installation():
        print("❌ Installation verification failed")
        return False
    
    # Create launch script
    create_launch_script()
    
    print("\n🎉 Installation completed successfully!")
    print("\n🚀 To start the game:")
    print("   • Run: python main.py")
    if platform.system() == "Windows":
        print("   • Or double-click: start_game.bat")
    else:
        print("   • Or run: ./start_game.sh")
    
    print("\n🎯 Game Controls:")
    print("   • Arrow Keys: Move car")
    print("   • R: Reset level")
    print("   • N: Generate new AI level")
    print("   • A: View analytics dashboard")
    print("   • ESC: Quit")
    
    print("\n🧠 Neural Network Features:")
    print("   • Personalized difficulty adjustment")
    print("   • AI-generated levels and stories")
    print("   • Performance analytics")
    print("   • Distributed learning system")
    
    print("\n📊 The game will start collecting data immediately")
    print("   and improve based on your unique play style!")
    
    return True

if __name__ == "__main__":
    try:
        success = main()
        if not success:
            print("\n❌ Installation failed. Please check the errors above.")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n🛑 Installation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error during installation: {e}")
        sys.exit(1)