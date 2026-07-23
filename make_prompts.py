import json
from pathlib import Path

uncached = Path('graphify-out/.graphify_uncached.txt').read_text(encoding='utf-8').splitlines()
spec = Path('C:/Users/Agung/.gemini/config/skills/graphify/references/extraction-spec.md').read_text(encoding='utf-8')

docs = [f for f in uncached if not f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg'))]
images = [f for f in uncached if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg'))]

chunks = []
if docs:
    chunks.append(docs)
for img in images:
    chunks.append([img])

total_chunks = len(chunks)
prompts = []

for i, chunk_files in enumerate(chunks):
    chunk_num = i + 1
    file_list = '\n'.join(chunk_files)
    chunk_path = Path(f'C:/Users/Agung/web-admin/graphify-out/.graphify_chunk_{chunk_num:02d}.json').resolve().as_posix()
    
    prompt = spec.replace('FILE_LIST', file_list)
    prompt = prompt.replace('CHUNK_NUM', str(chunk_num))
    prompt = prompt.replace('TOTAL_CHUNKS', str(total_chunks))
    prompt = prompt.replace('DEEP_MODE', 'false')
    prompt = prompt.replace('CHUNK_PATH', chunk_path)
    
    prompts.append({
        'TypeName': 'self',
        'Role': f'Extraction Subagent {chunk_num}',
        'Prompt': prompt
    })

Path('graphify-out/.graphify_prompts.json').write_text(json.dumps(prompts, indent=2), encoding='utf-8')
print(f"Generated {total_chunks} prompts")
