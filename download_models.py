#!/usr/bin/env python3
"""
Download PaddleOCR language models during Docker build
"""
import os
import sys
from paddleocr import PaddleOCR

# Suppress PaddleOCR logging
os.environ['FLAGS_allocator_strategy'] = 'auto_growth'
os.environ['GLOG_minloglevel'] = '3'

# List of languages to download
langs = ['en', 'fr', 'german', 'es', 'it', 'pt', 'nl']

print('Starting language model downloads...')
success_count = 0
failed_count = 0

for lang in langs:
    try:
        print(f'Downloading {lang} model...')
        ocr = PaddleOCR(lang=lang, use_angle_cls=True, show_log=False, use_gpu=False)
        print(f'✓ {lang} model cached successfully')
        success_count += 1
    except Exception as e:
        print(f'✗ Failed to download {lang}: {e}')
        failed_count += 1

print(f'\nLanguage models download complete: {success_count} succeeded, {failed_count} failed')

# Exit with 0 (success) even if some downloads failed
# We don't want to fail the entire build if one language fails
sys.exit(0)
