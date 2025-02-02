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

# # Add a new cell at the beginning to set the API key
# new_cell = nbformat.v4.new_code_cell(
#     source="import os\nos.environ['OPENAI_API_KEY'] = '" + os.environ.get('OPENAI_API_KEY', '') + "'"
# )
# nb.cells.insert(0, new_cell)

ep = ExecutePreprocessor(timeout=600, kernel_name='python3')
ep.preprocess(nb, {'metadata': {'path': '.'}})

# Remove the cell with the API key before saving
# nb.cells.pop(0)

with open(notebook_path, 'w', encoding='utf-8') as f:
    nbformat.write(nb, f)
