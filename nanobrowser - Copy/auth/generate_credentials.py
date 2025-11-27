# generate_credentials.py
import json, base64, hashlib, pathlib, random, string

def generate_secret(k=16):
    return ''.join(random.choice(string.ascii_letters + string.digits) for _ in range(k))

creds = []
for i in range(100):
    user = f"user_{i:03d}"
    pwd = f"password{i:03d}"
    secret = generate_secret()
    enc_user = base64.b64encode(user.encode()).decode()
    enc_pwd = hashlib.sha256((pwd + secret).encode()).hexdigest()
    creds.append({"u": enc_user, "p": enc_pwd, "s": secret})

out_path = pathlib.Path('credentials.json')
out_path.write_text(json.dumps(creds, indent=2), encoding='utf-8')
print('Generated 100 credentials with per‑user secrets in credentials.json')
