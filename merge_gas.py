import re
import os

def include_file(match):
    filename = match.group(1)
    filepath = f"{filename}.html"
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            content = f.read()
            # Recursively handle includes if any
            return re.sub(r'<\?!= include\(\'(.+?)\'\); \?>', include_file, content)
    return f"<!-- {filename} not found -->"

with open('Index.html', 'r') as f:
    index_content = f.read()

rendered = re.sub(r'<\?!= include\(\'(.+?)\'\); \?>', include_file, index_content)

# Mock some GAS global objects/functions if needed for basic load
rendered = rendered.replace('google.script.run', '({withSuccessHandler: () => ({withFailureHandler: () => ({})})})')

with open('/home/jules/verification/rendered.html', 'w') as f:
    f.write(rendered)
