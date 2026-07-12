#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""在 apply_mapping 已写完 modern manifest 之后，重生 modern_sample_board.html.
复用 build_modern_board 但 mainImage / altImage 字段名已更新，不需改 build_modern_board。
此脚本只负责触发 build_modern_board.main()."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_modern_board import main as build_board

if __name__ == "__main__":
    build_board()