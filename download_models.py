#!/usr/bin/env python3
"""
Download PaddleOCR language models during Docker build.
Compatible with both PaddleOCR 2.x and 3.x (PP-OCRv5).
"""
import os
import sys

# Suppress PaddleOCR logging
os.environ['FLAGS_allocator_strategy'] = 'auto_growth'
os.environ['GLOG_minloglevel'] = '3'

import paddleocr
from paddleocr import PaddleOCR

try:
    PADDLE_MAJOR = int(getattr(paddleocr, '__version__', '2').split('.')[0])
except (ValueError, AttributeError):
    PADDLE_MAJOR = 2

# List of languages to download (most common European languages)
langs = ['en', 'fr', 'german', 'es', 'it', 'pt', 'nl']

print(f'Starting language model downloads (PaddleOCR {paddleocr.__version__})...')
success_count = 0
failed_count = 0

for lang in langs:
    try:
        print(f'Downloading {lang} model...')
        if PADDLE_MAJOR >= 3:
            PaddleOCR(
                lang=lang,
                use_doc_orientation_classify=True,
                use_doc_unwarping=False,
                use_textline_orientation=True,
            )
        else:
            PaddleOCR(lang=lang, use_angle_cls=True, show_log=False, use_gpu=False)
        print(f'+ {lang} model cached successfully')
        success_count += 1
    except Exception as e:
        print(f'x Failed to download {lang}: {e}')
        failed_count += 1

print(f'\nLanguage models download complete: {success_count} succeeded, {failed_count} failed')

# Exit with 0 (success) even if some downloads failed
# We don't want to fail the entire build if one language fails
sys.exit(0)
