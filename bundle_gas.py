import re
import os

def bundle():
    with open('Index.html', 'r') as f:
        content = f.read()

    # Simple bundler that assumes everything is in Index.html for this specific project
    # If there were sub-files, we would include them here.

    with open('/home/jules/verification/bundled_app.html', 'w') as f:
        f.write(content)

if __name__ == "__main__":
    bundle()
