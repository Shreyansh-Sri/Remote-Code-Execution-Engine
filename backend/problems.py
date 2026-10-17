"""
Test cases for problems supported by the judge.
In a production system, these are fetched from PostgreSQL / S3.
"""

PROBLEMS_DB = {
    "two-sum": {
        "title": "1. Two Sum",
        "time_limit_ms": 2000,
        "memory_limit_mb": 128,
        "test_cases": [
            {
                "id": 1,
                "input": "[2, 7, 11, 15]\n9",
                "expected": "[0, 1]",
            },
            {
                "id": 2,
                "input": "[3, 2, 4]\n6",
                "expected": "[1, 2]",
            },
            {
                "id": 3,
                "input": "[3, 3]\n6",
                "expected": "[0, 1]",
            },
            {
                "id": 4,
                "input": "[1, 5, 7, 12, 19]\n20",
                "expected": "[0, 4]",
            },
            {
                "id": 5,
                "input": "[-3, 4, 3, 90]\n0",
                "expected": "[0, 2]",
            },
        ],
    },
    "reverse-string": {
        "title": "344. Reverse String",
        "time_limit_ms": 2000,
        "memory_limit_mb": 128,
        "test_cases": [
            {
                "id": 1,
                "input": '["h","e","l","l","o"]',
                "expected": '["o","l","l","e","h"]',
            },
            {
                "id": 2,
                "input": '["H","a","n","n","a","h"]',
                "expected": '["h","a","n","n","a","H"]',
            },
        ],
    },
}
