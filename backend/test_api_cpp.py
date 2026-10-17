import urllib.request
import json

code = open("backend/test_full_cpp.py").read().split('code = """')[1].split('"""')[0]

data = json.dumps({
    "problem_id": "two-sum",
    "language": "cpp",
    "code": code,
    "only_first_case": False
}).encode()

req = urllib.request.Request("http://127.0.0.1:8080/api/submissions", data=data, headers={"Content-Type": "application/json"})
res = urllib.request.urlopen(req)
sub_id = json.loads(res.read().decode())["submission_id"]
print("SUBMISSION ID:", sub_id)

stream = urllib.request.urlopen(f"http://127.0.0.1:8080/api/submissions/{sub_id}/stream")
for line in stream:
    text = line.decode().strip()
    if "TEST_PROGRESS" in text or "COMPLETED" in text:
        print(text)
