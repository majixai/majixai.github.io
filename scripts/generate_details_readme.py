import os
import re

def find_js_features(directory):
    """Scans JS files for a variety of features and returns a formatted markdown string."""
    features = {
        'Modular, class-based architecture': False,
        'Private class members (`#`)': False,
        'Decorators': False,
        '`async/await` for asynchronous operations': False,
        'Generators and Iterators': False,
        'Immediately Invoked Function Expression (IIFE)': False,
        'JSDoc type definitions': False,
        'Bitwise operations': False,
    }

    class_pattern = re.compile(r'class\s+\w+\s*\{')
    private_member_pattern = re.compile(r'#\w+')
    decorator_pattern = re.compile(r'timingDecorator') # Specific to this project
    async_pattern = re.compile(r'async\s+function|async\s+\w+')
    generator_pattern = re.compile(r'function\*|\*\w+\(')
    iife_pattern = re.compile(r'\(\(function\(\)\s*\{')
    jsdoc_typedef_pattern = re.compile(r'@typedef')
    bitwise_pattern = re.compile(r'\&\s|\s\&')

    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith(".js"):
                filepath = os.path.join(root, file)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    if class_pattern.search(content): features['Modular, class-based architecture'] = True
                    if private_member_pattern.search(content): features['Private class members (`#`)'] = True
                    if decorator_pattern.search(content): features['Decorators'] = True
                    if async_pattern.search(content): features['`async/await` for asynchronous operations'] = True
                    if generator_pattern.search(content): features['Generators and Iterators'] = True
                    if iife_pattern.search(content): features['Immediately Invoked Function Expression (IIFE)'] = True
                    if jsdoc_typedef_pattern.search(content): features['JSDoc type definitions'] = True
                    if bitwise_pattern.search(content): features['Bitwise operations'] = True

    markdown = "#### Advanced JavaScript & OOP:\n"
    markdown += "\n".join(f"*   {feature}" for feature, found in features.items() if found)
    return markdown

def find_ui_features(css_file):
    """Scans CSS file for UI/UX features."""
    features = {
        'Responsive layout (W3.CSS & Bootstrap)': True, # Assumed from index.html
        'Parallax effect': False,
        'CSS animations with start/stop control': False,
        'Layouts with CSS Grid and Flexbox': False,
    }

    with open(css_file, 'r', encoding='utf-8') as f:
        content = f.read()
        if '.parallax' in content: features['Parallax effect'] = True
        if '@keyframes' in content: features['CSS animations with start/stop control'] = True
        if 'display: grid' in content or 'display: flex' in content: features['Layouts with CSS Grid and Flexbox'] = True

    markdown = "#### UI & Styling:\n"
    markdown += "\n".join(f"*   {feature}" for feature, found in features.items() if found)
    return markdown

def find_data_handling_features(data_service_file):
    """Scans the DataService to find data handling features."""
    features = {
        'Loads and parses standard JSON data': False,
        'Loads and queries a gzipped SQLite database': False,
        'In-memory caching': False,
    }
    with open(data_service_file, 'r', encoding='utf-8') as f:
        content = f.read()
        if "case 'json':" in content: features['Loads and parses standard JSON data'] = True
        if "case 'sqlite':" in content and 'pako.inflate' in content: features['Loads and queries a gzipped SQLite database'] = True
        if "CacheService" in content: features['In-memory caching'] = True

    markdown = "#### Data Handling:\n"
    markdown += "\n".join(f"*   {feature}" for feature, found in features.items() if found)
    return markdown


def main():
    """Main function to generate and update the README."""
    details_dir = 'details'
    readme_path = os.path.join(details_dir, 'README.md')
    js_dir = os.path.join(details_dir, 'js')
    css_file = os.path.join(details_dir, 'css', 'style.css')
    data_service_file = os.path.join(js_dir, 'services', 'DataService.js')

    # Generate feature lists
    js_features_md = find_js_features(js_dir)
    ui_features_md = find_ui_features(css_file)
    data_features_md = find_data_handling_features(data_service_file)

    generated_content = f"{data_features_md}\n\n{ui_features_md}\n\n{js_features_md}"

    # Read the original README
    with open(readme_path, 'r', encoding='utf-8') as f:
        readme_content = f.read()

    # Replace the placeholder content
    placeholder_start = '<!-- AUTO-GENERATED-FEATURES:START -->'
    placeholder_end = '<!-- AUTO-GENERATED-FEATURES:END -->'

    # Use a regex to be robust against newline variations
    pattern = re.compile(f"({re.escape(placeholder_start)}).*?({re.escape(placeholder_end)})", re.DOTALL)

    new_readme_content = pattern.sub(f"\\1\n{generated_content}\n\\2", readme_content, 1)

    # Write back to the README if content has changed
    if new_readme_content != readme_content:
        with open(readme_path, 'w', encoding='utf-8') as f:
            f.write(new_readme_content)
        print("README.md has been updated.")
    else:
        print("No changes detected in README.md.")


if __name__ == "__main__":
    main()
