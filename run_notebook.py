import sys
import os
import asyncio
import nbformat
from nbconvert.preprocessors import ExecutePreprocessor

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

notebook_path = sys.argv[1]
with open(notebook_path, 'r', encoding='utf-8') as f:
    nb = nbformat.read(f, as_version=4)

ep = ExecutePreprocessor(timeout=600, kernel_name='python3')
try:
    notebook_dir = os.path.dirname(notebook_path) or '.'
    ep.preprocess(nb, {'metadata': {'path': notebook_dir}})

except Exception as e:
    sys.stderr.write("Error executing the notebook: " + str(e))
    sys.exit(1)

print("Notebook executed successfully")


with open(notebook_path, 'w', encoding='utf-8') as f:
    nbformat.write(nb, f)
