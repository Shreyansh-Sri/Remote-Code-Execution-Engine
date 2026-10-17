import subprocess
import tempfile
import os

d = tempfile.mkdtemp()
src = os.path.join(d, 'sol.cpp')
with open(src, 'w') as f:
    f.write('''#include <iostream>
#include <vector>
#include <unordered_map>
using namespace std;
int main() {
    cout << "[0, 1]" << endl;
    return 0;
}
''')

exe = os.path.join(d, 'sol.exe')
comp = subprocess.run(['g++', '-std=c++11', src, '-o', exe], capture_output=True, text=True)
print("COMP RETURNCODE:", comp.returncode)
if comp.returncode != 0:
    print("COMP STDERR:\n", comp.stderr[:500])
else:
    run = subprocess.run([exe], capture_output=True, text=True)
    print("RUN OUTPUT:", run.stdout)
