"""
Defines compilation and execution parameters for each supported programming language.
"""

import sys
from typing import Dict, Any, List

LANGUAGE_CONFIGS: Dict[str, Dict[str, Any]] = {
    "python": {
        "file_name": "solution.py",
        "requires_compilation": False,
        "run_cmd": [sys.executable, "solution.py"],
    },
    "javascript": {
        "file_name": "solution.js",
        "requires_compilation": False,
        "run_cmd": ["node", "solution.js"],
    },
    "cpp": {
        "file_name": "solution.cpp",
        "requires_compilation": True,
        # Use g++ with C++11 on Windows
        "compile_cmd": ["g++", "-std=c++11", "-O2", "solution.cpp", "-o", "solution.exe"],
        "run_cmd": ["solution.exe"],
    },
}
