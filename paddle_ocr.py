#!/usr/bin/env python3
"""
PaddleOCR wrapper script for Node.js integration.

Supports both PaddleOCR 2.x (PP-OCRv3/v4) and 3.x (PP-OCRv5, which adds
much stronger handwriting recognition). Accepts one or more image paths so
multi-page documents are processed with a single model initialization.

Usage:
    paddle_ocr.py <image_path> [lang]                 (legacy single-image)
    paddle_ocr.py --lang <lang> <image1> [image2 ...]

Output (JSON on stdout):
    {
      "success": true,
      "engine": "paddleocr-v3",
      "pages": [{ "blocks": [...], "text": "...", "pageCount": 1 }, ...],
      # For single-image calls the first page is also mirrored at the top
      # level (blocks/text/pageCount) for backward compatibility.
    }
"""

import sys
import json
import os
import contextlib
import multiprocessing

os.environ.setdefault('FLAGS_allocator_strategy', 'auto_growth')
os.environ['GLOG_minloglevel'] = '3'  # Suppress all logging
os.environ.setdefault('FLAGS_use_mkldnn', '0')

# Multi-core CPU optimization - use all available cores
cpu_count = multiprocessing.cpu_count()
os.environ['OMP_NUM_THREADS'] = str(cpu_count)
os.environ['MKL_NUM_THREADS'] = str(cpu_count)


@contextlib.contextmanager
def suppress_output():
    """Silence stdout/stderr so model download progress etc. never corrupts
    the JSON we print at the end."""
    devnull = open(os.devnull, 'w')
    old_stdout, old_stderr = sys.stdout, sys.stderr
    sys.stdout = devnull
    sys.stderr = devnull
    try:
        yield
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        devnull.close()


with suppress_output():
    import paddleocr
    from paddleocr import PaddleOCR

try:
    PADDLE_MAJOR = int(getattr(paddleocr, '__version__', '2').split('.')[0])
except (ValueError, AttributeError):
    PADDLE_MAJOR = 2

ENGINE_NAME = f'paddleocr-v{PADDLE_MAJOR}'

# Map common language codes (tesseract-style) to PaddleOCR format
LANG_MAP = {
    'eng': 'en',
    'fra': 'fr',
    'deu': 'german',
    'spa': 'es',
    'por': 'pt',
    'ita': 'it',
    'nld': 'nl',
    'jpn': 'japan',
    'kor': 'korean',
    'chi_sim': 'ch',
    'chi_tra': 'chinese_cht',
    'ara': 'ar',
    'rus': 'ru',
}

# Latin-script languages can fall back to the shared latin model when the
# installed PaddleOCR version doesn't ship a dedicated model for them.
LATIN_LANGS = {'en', 'fr', 'german', 'es', 'pt', 'it', 'nl', 'latin'}


def _init_ocr(lang: str):
    if PADDLE_MAJOR >= 3:
        # PP-OCRv5: document orientation + textline orientation handle
        # rotated scans; v5 recognition models cover handwriting.
        # Cap the detector input size. PP-OCRv5's default keeps large scans
        # (e.g. a 300 DPI A4 render at ~3500px) near native resolution, where
        # sparse text falls outside the detection model's trained size range
        # and yields ZERO boxes. Downscaling the longest side to 960 puts the
        # text back in distribution so sparse pages are detected at all.
        try:
            return PaddleOCR(
                lang=lang,
                use_doc_orientation_classify=True,
                use_doc_unwarping=False,
                use_textline_orientation=True,
                text_det_limit_side_len=960,
                text_det_limit_type='max',
            )
        except (TypeError, ValueError):
            # Older 3.x builds may not accept the det-limit kwargs.
            try:
                return PaddleOCR(
                    lang=lang,
                    use_doc_orientation_classify=True,
                    use_doc_unwarping=False,
                    use_textline_orientation=True,
                )
            except (TypeError, ValueError):
                return PaddleOCR(lang=lang)
    return PaddleOCR(
        use_angle_cls=True,
        lang=lang,
        show_log=False,
        use_gpu=False,
    )


def make_ocr(lang: str):
    """Initialize PaddleOCR, falling back through related language models if
    the requested code isn't supported by the installed version."""
    candidates = [lang]
    if lang in LATIN_LANGS:
        candidates.append('latin')
    candidates.append('en')

    last_error = None
    for candidate in dict.fromkeys(candidates):
        try:
            with suppress_output():
                return _init_ocr(candidate)
        except Exception as e:  # unsupported lang code, missing model, etc.
            last_error = e
    raise last_error


def poly_to_bbox(points):
    xs = [float(p[0]) for p in points]
    ys = [float(p[1]) for p in points]
    x, y = min(xs), min(ys)
    return {
        'x': round(x, 2),
        'y': round(y, 2),
        'width': round(max(xs) - x, 2),
        'height': round(max(ys) - y, 2),
    }


def page_from_items(items):
    """items: list of (text, confidence, polygon_points)."""
    blocks = []
    all_text = []
    for text, confidence, points in items:
        if not text:
            continue
        blocks.append({
            'text': text,
            'bbox': poly_to_bbox(points),
            'confidence': round(float(confidence), 4),
            'blockType': 'text',
        })
        all_text.append(text)
    return {
        'blocks': blocks,
        'text': '\n'.join(all_text),
        'pageCount': 1,
    }


def ocr_page_v3(ocr, image_path):
    with suppress_output():
        results = ocr.predict(image_path)

    items = []
    for res in results or []:
        # OCRResult subclasses dict in PaddleOCR 3.x; fall back to .json
        data = res if isinstance(res, dict) else {}
        if not data:
            raw = getattr(res, 'json', None)
            if isinstance(raw, dict):
                data = raw.get('res', raw)
        texts = data.get('rec_texts') or []
        scores = data.get('rec_scores') or []
        polys = data.get('rec_polys')
        if polys is None:
            polys = data.get('dt_polys') or []
        for i, text in enumerate(texts):
            score = scores[i] if i < len(scores) else 0.0
            poly = polys[i] if i < len(polys) else [[0, 0], [0, 0], [0, 0], [0, 0]]
            items.append((text, score, poly))
    return page_from_items(items)


def ocr_page_v2(ocr, image_path):
    with suppress_output():
        result = ocr.ocr(image_path, cls=True)

    items = []
    if result and result[0]:
        for line in result[0]:
            bbox_points = line[0]
            text, confidence = line[1][0], line[1][1]
            items.append((text, confidence, bbox_points))
    return page_from_items(items)


def perform_ocr(image_paths, lang):
    try:
        ocr = make_ocr(lang)
        ocr_page = ocr_page_v3 if PADDLE_MAJOR >= 3 else ocr_page_v2

        pages = []
        for image_path in image_paths:
            try:
                pages.append(ocr_page(ocr, image_path))
            except Exception as page_error:
                pages.append({
                    'blocks': [],
                    'text': '',
                    'pageCount': 1,
                    'error': str(page_error),
                })

        output = {
            'success': True,
            'engine': ENGINE_NAME,
            'pages': pages,
        }
        # Backward-compatible top-level fields for single-image calls
        if len(pages) == 1:
            output.update(pages[0])
        return output
    except Exception as e:
        return {
            'success': False,
            'engine': ENGINE_NAME,
            'error': str(e),
            'pages': [],
            'blocks': [],
            'text': '',
            'pageCount': 0,
        }


def main():
    args = sys.argv[1:]
    lang = None
    paths = []

    i = 0
    while i < len(args):
        arg = args[i]
        if arg == '--lang':
            if i + 1 >= len(args):
                print(json.dumps({'success': False, 'error': '--lang requires a value'}))
                sys.exit(1)
            lang = args[i + 1]
            i += 2
        elif arg.startswith('--lang='):
            lang = arg.split('=', 1)[1]
            i += 1
        else:
            paths.append(arg)
            i += 1

    # Legacy invocation: paddle_ocr.py <image_path> [lang]
    if lang is None and len(paths) == 2 and not os.path.exists(paths[1]):
        lang = paths.pop(1)

    if not paths:
        print(json.dumps({
            'success': False,
            'error': 'Usage: paddle_ocr.py [--lang <lang>] <image_path> [image_path ...]',
        }))
        sys.exit(1)

    lang = lang or 'en'
    # Sanitize then map to PaddleOCR language code
    lang = ''.join(c for c in lang if c.isalnum() or c == '_')
    paddle_lang = LANG_MAP.get(lang, lang)

    result = perform_ocr(paths, paddle_lang)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
