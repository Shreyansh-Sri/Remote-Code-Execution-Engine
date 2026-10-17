import subprocess
import tempfile
import os

code = """#include <iostream>
#include <vector>
#include <string>
#include <sstream>
#include <unordered_map>

using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> seen;
    for (int i = 0; i < nums.size(); i++) {
        int diff = target - nums[i];
        if (seen.count(diff)) {
            return {seen[diff], i};
        }
        seen[nums[i]] = i;
    }
    return {};
}

vector<int> parseArray(const string& str) {
    vector<int> res;
    stringstream ss;
    for (char c : str) {
        if (c == ',' || c == '[' || c == ']') ss << ' ';
        else ss << c;
    }
    int val;
    while (ss >> val) res.push_back(val);
    return res;
}

int main() {
    string line1;
    if (getline(cin, line1)) {
        int target;
        cin >> target;
        vector<int> nums = parseArray(line1);
        vector<int> ans = twoSum(nums, target);
        if (ans.size() == 2) {
            cout << "[" << ans[0] << ", " << ans[1] << "]" << endl;
        } else {
            cout << "[]" << endl;
        }
    }
    return 0;
}
"""

d = tempfile.mkdtemp()
src = os.path.join(d, "solution.cpp")
with open(src, "w") as f:
    f.write(code)

exe = os.path.join(d, "solution.exe")
comp = subprocess.run(["g++", "-std=c++11", "-O2", src, "-o", exe], capture_output=True, text=True)
print("COMP:", comp.returncode, comp.stderr)

run = subprocess.run([exe], input="[2, 7, 11, 15]\n9", capture_output=True, text=True)
print("RUN OUTPUT:", run.returncode, run.stdout)
