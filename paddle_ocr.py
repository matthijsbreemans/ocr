#!/usr/bin/env python3
"""
PaddleOCR wrapper script for Node.js integration
Outputs JSON with text blocks, bounding boxes, and confidence scores
"""

import sys
import json
import os

# Suppress ALL PaddleOCR output before import
os.environ['FLAGS_allocator_strategy'] = 'auto_growth'
os.environ['GLOG_minloglevel'] = '3'  # Suppress all logging
os.environ['FLAGS_use_mkldnn'] = '0'

# Multi-core CPU optimization - use all available cores
import multiprocessing
cpu_count = multiprocessing.cpu_count()
os.environ['OMP_NUM_THREADS'] = str(cpu_count)
os.environ['MKL_NUM_THREADS'] = str(cpu_count)

# Redirect stderr to /dev/null to suppress download progress
import sys
original_stderr = sys.stderr
sys.stderr = open(os.devnull, 'w')

from paddleocr import PaddleOCR

# Restore stderr after import
sys.stderr = original_stderr

def perform_ocr(image_path: str, lang: str = 'en') -> dict:
    """
    Perform OCR on an image using PaddleOCR

    Args:
        image_path: Path to the image file
        lang: Language code (en, ch, fr, german, korean, japan, etc.)

    Returns:
        dict with blocks: [{text, bbox: {x, y, width, height}, confidence}]
    """
    try:
        # Redirect stdout and stderr during initialization to suppress all output
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        devnull = open(os.devnull, 'w')
        sys.stdout = devnull
        sys.stderr = devnull

        # Initialize PaddleOCR
        # use_angle_cls=True enables text rotation detection
        # show_log=False reduces console output
        ocr = PaddleOCR(
            use_angle_cls=True,
            lang=lang,
            show_log=False,
            use_gpu=False  # Set to True if GPU available
        )

        # Perform OCR (model download happens here on first run)
        result = ocr.ocr(image_path, cls=True)

        # Restore stdout and stderr AFTER OCR completes
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        devnull.close()

        if not result or not result[0]:
            return {
                'success': True,
                'blocks': [],
                'text': '',
                'pageCount': 1
            }

        blocks = []
        all_text = []

        # Process each detected text region
        for line in result[0]:
            bbox_points = line[0]  # [[x1,y1], [x2,y2], [x3,y3], [x4,y4]]
            text_info = line[1]    # (text, confidence)
            text = text_info[0]
            confidence = float(text_info[1])

            # Convert polygon points to bounding box
            xs = [point[0] for point in bbox_points]
            ys = [point[1] for point in bbox_points]

            x = min(xs)
            y = min(ys)
            width = max(xs) - x
            height = max(ys) - y

            blocks.append({
                'text': text,
                'bbox': {
                    'x': round(x, 2),
                    'y': round(y, 2),
                    'width': round(width, 2),
                    'height': round(height, 2)
                },
                'confidence': round(confidence, 4),
                'blockType': 'text'  # PaddleOCR doesn't classify block types
            })

            all_text.append(text)

        return {
            'success': True,
            'blocks': blocks,
            'text': '\n'.join(all_text),
            'pageCount': 1
        }

    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'blocks': [],
            'text': '',
            'pageCount': 0
        }

def main():
    """
    Main entry point - reads arguments and outputs JSON
    """
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'Usage: paddle_ocr.py <image_path> [lang]'
        }))
        sys.exit(1)

    image_path = sys.argv[1]
    lang = sys.argv[2] if len(sys.argv) > 2 else 'en'

    # Map common language codes to PaddleOCR format
    lang_map = {
        'eng': 'en',
        'fra': 'french',
        'deu': 'german',
        'spa': 'spanish',
        'por': 'portuguese',
        'ita': 'italian',
        'jpn': 'japan',
        'kor': 'korean',
        'chi_sim': 'ch',
        'chi_tra': 'chinese_cht',
        'ara': 'arabic',
        'rus': 'cyrillic'
    }

    paddle_lang = lang_map.get(lang, lang)

    result = perform_ocr(image_path, paddle_lang)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
