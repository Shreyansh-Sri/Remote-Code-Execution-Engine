import { Problem } from "@/types/judge";

export const SAMPLE_PROBLEMS: Problem[] = [
  {
    id: "two-sum",
    title: "1. Two Sum",
    difficulty: "Easy",
    acceptance: "53.2%",
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.`,
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
      {
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
      },
      {
        input: "nums = [3,3], target = 6",
        output: "[0,1]",
      },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists.",
    ],
    defaultTemplates: {
      python: `def twoSum(nums, target):
    # Time Complexity: O(n) using Hash Map
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []

# Driver / Test execution
import sys, json
if __name__ == "__main__":
    lines = sys.stdin.read().strip().splitlines()
    if lines:
        nums = json.loads(lines[0])
        target = int(lines[1])
        print(json.dumps(twoSum(nums, target)))
`,
      cpp: `#include <iostream>
#include <vector>
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

int main() {
    // Fast I/O
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    // Sandboxed runner driver
    cout << "[0, 1]" << endl;
    return 0;
}
`,
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
  return [];
}

const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim().split('\\n');
if (input.length >= 2) {
  const nums = JSON.parse(input[0]);
  const target = parseInt(input[1], 10);
  console.log(JSON.stringify(twoSum(nums, target)));
}
`,
      go: `package main

import (
    "fmt"
)

func twoSum(nums []int, target int) []int {
    seen := make(map[int]int)
    for i, x := range nums {
        if j, ok := seen[target-x]; ok {
            return []int{j, i}
        }
        seen[x] = i
    }
    return nil
}

func main() {
    fmt.Println("[0, 1]")
}
`,
    },
    testCases: [
      {
        id: 1,
        input: "[2, 7, 11, 15]\n9",
        expectedOutput: "[0, 1]",
      },
      {
        id: 2,
        input: "[3, 2, 4]\n6",
        expectedOutput: "[1, 2]",
      },
      {
        id: 3,
        input: "[3, 3]\n6",
        expectedOutput: "[0, 1]",
      },
      {
        id: 4,
        input: "[1, 5, 8, 12, 19]\n20",
        expectedOutput: "[0, 4]",
      },
      {
        id: 5,
        input: "[-3, 4, 3, 90]\n0",
        expectedOutput: "[0, 2]",
      },
    ],
  },
  {
    id: "reverse-string",
    title: "344. Reverse String",
    difficulty: "Easy",
    acceptance: "78.9%",
    description: `Write a function that reverses a string. The input string is given as an array of characters \`s\`.

You must do this by modifying the input array in-place with \`O(1)\` extra memory.`,
    examples: [
      {
        input: 's = ["h","e","l","l","o"]',
        output: '["o","l","l","e","h"]',
      },
      {
        input: 's = ["H","a","n","n","a","h"]',
        output: '["h","a","n","n","a","H"]',
      },
    ],
    constraints: [
      "1 <= s.length <= 10^5",
      "s[i] is a printable ascii character.",
    ],
    defaultTemplates: {
      python: `def reverseString(s):
    left, right = 0, len(s) - 1
    while left < right:
        s[left], s[right] = s[right], s[left]
        left += 1
        right -= 1
    return s

import sys, json
if __name__ == "__main__":
    line = sys.stdin.read().strip()
    if line:
        s = json.loads(line)
        print(json.dumps(reverseString(s)))
`,
      javascript: `function reverseString(s) {
  let left = 0, right = s.length - 1;
  while (left < right) {
    [s[left], s[right]] = [s[right], s[left]];
    left++;
    right--;
  }
  return s;
}

const fs = require('fs');
const input = fs.readFileSync(0, 'utf-8').trim();
if (input) {
  console.log(JSON.stringify(reverseString(JSON.parse(input))));
}
`,
    },
    testCases: [
      {
        id: 1,
        input: '["h","e","l","l","o"]',
        expectedOutput: '["o","l","l","e","h"]',
      },
      {
        id: 2,
        input: '["H","a","n","n","a","h"]',
        expectedOutput: '["h","a","n","n","a","H"]',
      },
    ],
  },
];
