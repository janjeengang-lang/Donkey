#!/usr/bin/env python3
import json
import base64
import hashlib
import secrets
import string

def generate_donkey_credentials():
    """Generate credentials with predictable passwords for testing"""
    credentials = []
    
    for i in range(100):
        # Username format: user_XXX
        username = f"user_{i:03d}"
        
        # Password format: passwordXXX
        password = f"password{i:03d}"
        
        # Base64 encode username
        encoded_username = base64.b64encode(username.encode()).decode()
        
        # Create secret salt for this user
        secret_salt = secrets.token_hex(8)
        
        # Generate hash: username:password:secret
        combined_string = f"{username}:{password}:donkey-2024-secure-key-{secret_salt}"
        password_hash = hashlib.sha256(combined_string.encode()).hexdigest()
        
        credential = {
            "u": encoded_username,
            "p": password_hash,
            "s": secret_salt
        }
        
        credentials.append(credential)
    
    return credentials

def save_credentials_to_file(credentials):
    """Save credentials to JSON file"""
    with open('credentials.json', 'w', encoding='utf-8') as f:
        json.dump(credentials, f, indent=2)
    print(f"Generated {len(credentials)} credentials in credentials.json")

def create_readme():
    """Create a README with test credentials"""
    readme_content = """# Donkey AI Web Automation - Test Credentials

## Login Credentials for Testing

You can use these credentials to test the Donkey login system:

"""
    
    for i in range(10):  # Show first 10 for reference
        username = f"user_{i:03d}"
        password = f"password{i:03d}"
        readme_content += f"**Username:** `{username}` | **Password:** `{password}`\n"
    
    readme_content += """
## How to Use

1. Open the Donkey extension
2. You'll see the Welcome page - click "Get Started"
3. You'll be redirected to the Login page
4. Use any username/password pair above to login
5. Upon successful login, you'll be redirected to the main extension

## Security Notes

- This is for testing purposes only
- Real passwords should never be stored in plain text
- In production, use proper authentication systems
- All passwords are encrypted with SHA-256 + secret salt
"""
    
    with open('TEST_CREDENTIALS.md', 'w', encoding='utf-8') as f:
        f.write(readme_content)
    print("Created TEST_CREDENTIALS.md with login examples")

if __name__ == "__main__":
    print("🔑 Generating Donkey AI test credentials...")
    credentials = generate_donkey_credentials()
    save_credentials_to_file(credentials)
    create_readme()
    print("✅ Credentials generation complete!")
    print("\n📋 Test credentials created:")
    print("   - user_000 / password000")
    print("   - user_001 / password001")
    print("   - user_002 / password002")
    print("   ... (and 97 more)")
    print("\n🔒 Security: All passwords use SHA-256 + secret salt encryption")