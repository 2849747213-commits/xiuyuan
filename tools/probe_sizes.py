import urllib.request, urllib.error
sizes = [320, 480, 640, 800, 1024, 1280]
url_base = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Portrait_of_Qin_Shi_Huang.jpg'
for s in sizes:
    url = f'{url_base}/{s}px-Portrait_of_Qin_Shi_Huang.jpg'
    req = urllib.request.Request(url, headers={'User-Agent': 'curl/8.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            ct = r.headers.get('Content-Type', '')
            print(f'{s}: OK {r.status} {ct}')
    except urllib.error.HTTPError as e:
        body_head = b''
        try:
            body_head = e.read()[:120]
        except Exception:
            pass
        print(f'{s}: {e.code} body={body_head[:80]!r}')
    except Exception as e:
        print(f'{s}: ERR {e}')