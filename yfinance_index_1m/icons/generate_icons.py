#!/usr/bin/env python3
"""
Generate PWA icons for YFinance application
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon(size):
    """Create a single icon of specified size"""
    # Create image with gradient background
    img = Image.new('RGB', (size, size), color='#667eea')
    draw = ImageDraw.Draw(img)
    
    # Draw gradient effect
    for y in range(size):
        r = int(102 + (118 - 102) * y / size)
        g = int(126 + (75 - 126) * y / size)
        b = int(234 + (162 - 234) * y / size)
        draw.line([(0, y), (size, y)], fill=(r, g, b))
    
    # Draw chart icon
    padding = int(size * 0.15)
    chart_width = size - (padding * 2)
    chart_height = size - (padding * 2)
    
    # Draw candlesticks
    bars = 4
    bar_width = chart_width // (bars * 3)
    
    for i in range(bars):
        x = padding + (i * (chart_width // bars)) + bar_width
        bar_height = int(chart_height * (0.3 + (i * 0.15)))
        y = padding + chart_height - bar_height
        
        # Draw vertical line (wick)
        line_y1 = padding + int(chart_height * 0.2)
        line_y2 = padding + int(chart_height * 0.9)
        draw.line([(x, line_y1), (x, line_y2)], fill='white', width=max(2, size//100))
        
        # Draw rectangle (candle body)
        color = (16, 185, 129) if i % 2 == 0 else (239, 68, 68)  # green or red
        draw.rectangle([x - bar_width//2, y, x + bar_width//2, y + bar_height], fill=color)
    
    # Draw trend line
    points = [
        (padding, padding + int(chart_height * 0.7)),
        (padding + int(chart_width * 0.3), padding + int(chart_height * 0.5)),
        (padding + int(chart_width * 0.6), padding + int(chart_height * 0.6)),
        (padding + chart_width, padding + int(chart_height * 0.3))
    ]
    draw.line(points, fill=(255, 255, 255, 150), width=max(2, size//40))
    
    return img

def generate_all_icons():
    """Generate all required icon sizes"""
    sizes = [72, 96, 128, 144, 152, 192, 256, 384, 512]
    
    # Create icons directory if it doesn't exist
    icons_dir = os.path.dirname(os.path.abspath(__file__))
    
    print(f"Generating {len(sizes)} PWA icons...")
    print(f"Output directory: {icons_dir}")
    print()
    
    for size in sizes:
        filename = f"icon-{size}x{size}.png"
        filepath = os.path.join(icons_dir, filename)
        
        try:
            img = create_icon(size)
            img.save(filepath, 'PNG', optimize=True)
            file_size = os.path.getsize(filepath) / 1024
            print(f"✓ Generated {filename} ({file_size:.1f} KB)")
        except Exception as e:
            print(f"✗ Failed to generate {filename}: {e}")
    
    print()
    print("Icon generation complete!")
    print("Icons are optimized for PWA installation.")

if __name__ == "__main__":
    try:
        generate_all_icons()
    except ImportError:
        print("PIL/Pillow not installed. Installing...")
        import subprocess
        subprocess.run(["pip", "install", "pillow"], check=True)
        print("Pillow installed. Running icon generation...")
        generate_all_icons()
