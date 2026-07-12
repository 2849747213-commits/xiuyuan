import json
m = json.load(open('assets/sample-library/sample_images_manifest.json', encoding='utf-8'))
for s in m['samples']:
    main = s.get('mainImage') or '-'
    alt = s.get('altImage') or '-'
    status = s.get('status', '?')
    print(f"{s['sampleId']:4} status={status:7} main={main:48} alt={alt}")